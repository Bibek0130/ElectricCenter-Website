using ElectricCenter.Server.Data;
using ElectricCenter.Server.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace ElectricCenter.Server.Auth
{
    /// <summary>Admin-only operations on accounts: creating electrician/admin users and changing roles or status.</summary>
    public interface IUserManagementService
    {
        Task<IReadOnlyList<User>> ListAsync(CancellationToken ct = default);
        Task<ServiceResult<User>> CreateAsync(string? fullName, string? email, string? phone, string? password, IEnumerable<string>? roles, CancellationToken ct = default);
        Task<ServiceResult<User>> SetRolesAsync(Guid actingUserId, Guid userId, IEnumerable<string>? roles, CancellationToken ct = default);
        Task<ServiceResult<User>> SetActiveAsync(Guid actingUserId, Guid userId, bool isActive, CancellationToken ct = default);
        Task<ServiceResult<User>> ResetPasswordAsync(Guid userId, string? newPassword, CancellationToken ct = default);
    }

    public sealed class UserManagementService(
        AppDbContext db,
        IPasswordHasher passwordHasher,
        IAuthService authService,
        TimeProvider timeProvider) : IUserManagementService
    {
        public async Task<IReadOnlyList<User>> ListAsync(CancellationToken ct = default) =>
            await db.Users.AsNoTracking().Include(u => u.Roles).OrderBy(u => u.Email).ToListAsync(ct);

        public async Task<ServiceResult<User>> CreateAsync(string? fullName, string? email, string? phone, string? password, IEnumerable<string>? roles, CancellationToken ct = default)
        {
            var normalizedEmail = UserInput.NormalizeEmail(email);
            var error = UserInput.ValidateProfile(fullName, normalizedEmail, phone) ?? PasswordPolicy.Validate(password);
            if (error is not null) return ServiceResult<User>.Fail(ServiceError.Validation, error);

            if (!TryParseRoles(roles, out var parsedRoles, out var roleError))
                return ServiceResult<User>.Fail(ServiceError.Validation, roleError!);

            if (await db.Users.AnyAsync(u => u.Email == normalizedEmail, ct))
                return ServiceResult<User>.Fail(ServiceError.Conflict, "An account with this email already exists.");

            var user = new User
            {
                Id = Guid.NewGuid(),
                Email = normalizedEmail,
                PasswordHash = passwordHasher.Hash(password!),
                FullName = fullName!.Trim(),
                Phone = UserInput.CleanPhone(phone),
                CreatedAtUtc = timeProvider.GetUtcNow().UtcDateTime,
                Roles = parsedRoles.Select(r => new UserRole { Role = r }).ToList(),
            };
            db.Users.Add(user);
            await db.SaveChangesAsync(ct);
            return ServiceResult<User>.Ok(user);
        }

        public async Task<ServiceResult<User>> SetRolesAsync(Guid actingUserId, Guid userId, IEnumerable<string>? roles, CancellationToken ct = default)
        {
            if (!TryParseRoles(roles, out var parsedRoles, out var roleError))
                return ServiceResult<User>.Fail(ServiceError.Validation, roleError!);

            var user = await db.Users.Include(u => u.Roles).SingleOrDefaultAsync(u => u.Id == userId, ct);
            if (user is null) return ServiceResult<User>.Fail(ServiceError.NotFound, "User not found.");

            if (userId == actingUserId && !parsedRoles.Contains(Roles.Admin))
                return ServiceResult<User>.Fail(ServiceError.Validation, "You can't remove your own Admin role.");

            user.Roles.RemoveAll(r => !parsedRoles.Contains(r.Role));
            foreach (var role in parsedRoles.Where(r => user.Roles.All(existing => existing.Role != r)))
                user.Roles.Add(new UserRole { UserId = user.Id, Role = role });

            await db.SaveChangesAsync(ct);
            // No token revocation needed: the next refresh (≤ access-token lifetime) picks up the new roles.
            return ServiceResult<User>.Ok(user);
        }

        public async Task<ServiceResult<User>> SetActiveAsync(Guid actingUserId, Guid userId, bool isActive, CancellationToken ct = default)
        {
            if (userId == actingUserId && !isActive)
                return ServiceResult<User>.Fail(ServiceError.Validation, "You can't deactivate your own account.");

            var user = await db.Users.Include(u => u.Roles).SingleOrDefaultAsync(u => u.Id == userId, ct);
            if (user is null) return ServiceResult<User>.Fail(ServiceError.NotFound, "User not found.");

            user.IsActive = isActive;
            await db.SaveChangesAsync(ct);
            if (!isActive) await authService.LogoutAllAsync(user.Id, ct);
            return ServiceResult<User>.Ok(user);
        }

        public async Task<ServiceResult<User>> ResetPasswordAsync(Guid userId, string? newPassword, CancellationToken ct = default)
        {
            var error = PasswordPolicy.Validate(newPassword);
            if (error is not null) return ServiceResult<User>.Fail(ServiceError.Validation, error);

            var user = await db.Users.Include(u => u.Roles).SingleOrDefaultAsync(u => u.Id == userId, ct);
            if (user is null) return ServiceResult<User>.Fail(ServiceError.NotFound, "User not found.");

            user.PasswordHash = passwordHasher.Hash(newPassword!);
            user.FailedLoginCount = 0;
            user.LockoutEndUtc = null;
            await db.SaveChangesAsync(ct);
            await authService.LogoutAllAsync(user.Id, ct);
            return ServiceResult<User>.Ok(user);
        }

        private static bool TryParseRoles(IEnumerable<string>? roles, out HashSet<string> parsed, out string? error)
        {
            parsed = [];
            foreach (var role in roles ?? [])
            {
                var canonical = Roles.Normalize(role);
                if (canonical is null)
                {
                    error = $"Unknown role \"{role}\". Valid roles: {string.Join(", ", Roles.All)}.";
                    return false;
                }
                parsed.Add(canonical);
            }

            error = parsed.Count == 0 ? "A user needs at least one role." : null;
            return error is null;
        }
    }
}
