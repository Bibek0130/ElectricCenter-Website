using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;
using ElectricCenter.Server.Data;
using ElectricCenter.Server.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ElectricCenter.Server.Auth
{
    /// <summary>Outcome of a correct email + password: either a session, or (for an unverified email) an OTP challenge.</summary>
    public sealed record LoginResult(AuthSession? Session, VerificationChallenge? Verification);

    public interface IAuthService
    {
        Task<ServiceResult<LoginResult>> LoginAsync(string? email, string? password, CancellationToken ct = default);
        Task<ServiceResult<AuthSession>> RefreshAsync(string? rawRefreshToken, CancellationToken ct = default);
        Task LogoutAsync(string? rawRefreshToken, CancellationToken ct = default);
        Task LogoutAllAsync(Guid userId, CancellationToken ct = default);
        Task<ServiceResult<AuthSession>> ChangePasswordAsync(Guid userId, string? currentPassword, string? newPassword, CancellationToken ct = default);
        Task<User?> GetUserAsync(Guid userId, CancellationToken ct = default);

        /// <summary>Signs in a user whose identity was just proven another way (an email OTP).</summary>
        Task<AuthSession> CreateSessionAsync(User user, CancellationToken ct = default);
    }

    public sealed class AuthService(
        AppDbContext db,
        IPasswordHasher passwordHasher,
        IJwtTokenService jwtTokenService,
        IEmailVerificationService emailVerification,
        IOptions<JwtOptions> jwtOptions,
        TimeProvider timeProvider) : IAuthService
    {
        public const int MaxFailedLoginAttempts = 5;
        public static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

        /// <summary>
        /// How long a just-rotated refresh token is still honoured. Covers two tabs (or a
        /// double-mounted React effect) refreshing at the same moment with the same cookie:
        /// the loser gets a new access token instead of tripping reuse detection.
        /// </summary>
        public static readonly TimeSpan RotationGracePeriod = TimeSpan.FromSeconds(30);

        private const string InvalidCredentialsMessage = "Invalid email or password, or the account is temporarily locked.";
        private const string InvalidSessionMessage = "Your session has expired. Please log in again.";

        private DateTime UtcNow => timeProvider.GetUtcNow().UtcDateTime;

        public async Task<ServiceResult<LoginResult>> LoginAsync(string? email, string? password, CancellationToken ct = default)
        {
            var normalizedEmail = UserInput.NormalizeEmail(email);
            password ??= string.Empty;

            var user = await db.Users.Include(u => u.Roles).SingleOrDefaultAsync(u => u.Email == normalizedEmail, ct);
            var now = UtcNow;

            // Unknown, deactivated and locked accounts all get the same response and similar timing.
            if (user is null || !user.IsActive || user.LockoutEndUtc > now)
            {
                passwordHasher.VerifyDummy(password);
                return ServiceResult<LoginResult>.Fail(ServiceError.InvalidCredentials, InvalidCredentialsMessage);
            }

            if (!passwordHasher.Verify(password, user.PasswordHash))
            {
                user.FailedLoginCount++;
                if (user.FailedLoginCount >= MaxFailedLoginAttempts)
                {
                    user.LockoutEndUtc = now.Add(LockoutDuration);
                    user.FailedLoginCount = 0;
                }
                await db.SaveChangesAsync(ct);
                return ServiceResult<LoginResult>.Fail(ServiceError.InvalidCredentials, InvalidCredentialsMessage);
            }

            user.FailedLoginCount = 0;
            user.LockoutEndUtc = null;

            if (!user.EmailConfirmed)
            {
                // Right password, but the address was never proven (e.g. an admin-created account):
                // email a code instead of signing in. Only reachable with the correct password.
                await db.SaveChangesAsync(ct);
                var challenge = await emailVerification.StartLoginVerificationAsync(user, ct);
                return challenge.Succeeded
                    ? ServiceResult<LoginResult>.Ok(new LoginResult(null, challenge.Value))
                    : ServiceResult<LoginResult>.Fail(challenge.Error, challenge.Message!);
            }

            user.LastLoginAtUtc = now;

            // Housekeeping: drop this user's expired tokens so the table doesn't grow forever.
            await db.RefreshTokens.Where(t => t.UserId == user.Id && t.ExpiresAtUtc < now).ExecuteDeleteAsync(ct);

            return ServiceResult<LoginResult>.Ok(new LoginResult(await StartNewSessionAsync(user, ct), null));
        }

        public Task<AuthSession> CreateSessionAsync(User user, CancellationToken ct = default) => StartNewSessionAsync(user, ct);

        public async Task<ServiceResult<AuthSession>> RefreshAsync(string? rawRefreshToken, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(rawRefreshToken))
                return ServiceResult<AuthSession>.Fail(ServiceError.Unauthorized, InvalidSessionMessage);

            var hash = HashToken(rawRefreshToken);
            var token = await db.RefreshTokens.AsNoTracking()
                .Include(t => t.User).ThenInclude(u => u.Roles)
                .SingleOrDefaultAsync(t => t.TokenHash == hash, ct);
            var now = UtcNow;

            if (token is null || !token.User.IsActive)
                return ServiceResult<AuthSession>.Fail(ServiceError.Unauthorized, InvalidSessionMessage);

            if (token.RevokedAtUtc is { } revokedAt)
            {
                if (token.ReplacedByTokenHash is not null && now - revokedAt <= RotationGracePeriod
                    && await FamilyIsActiveAsync(token.FamilyId, now, ct))
                    return ServiceResult<AuthSession>.Ok(AccessOnlySession(token.User));

                // A rotated token was replayed after the grace period, or a logged-out token was reused:
                // assume it was stolen and kill every token descended from that login.
                await RevokeFamilyAsync(token.FamilyId, now, ct);
                return ServiceResult<AuthSession>.Fail(ServiceError.Unauthorized, InvalidSessionMessage);
            }

            if (token.ExpiresAtUtc <= now)
                return ServiceResult<AuthSession>.Fail(ServiceError.Unauthorized, InvalidSessionMessage);

            var newRaw = GenerateRawToken();
            var newHash = HashToken(newRaw);
            var expiresAt = now.AddDays(jwtOptions.Value.RefreshTokenDays);

            var strategy = db.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                db.ChangeTracker.Clear();
                await using var transaction = await db.Database.BeginTransactionAsync(ct);

                // Conditional update = atomic claim of this token. If another request rotated it
                // first, zero rows change and we fall back to the grace behaviour.
                var claimed = await db.RefreshTokens
                    .Where(t => t.Id == token.Id && t.RevokedAtUtc == null)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(t => t.RevokedAtUtc, now)
                        .SetProperty(t => t.ReplacedByTokenHash, newHash), ct);

                if (claimed == 0)
                {
                    await transaction.RollbackAsync(ct);
                    // Either a concurrent refresh rotated it (family still active → grace) or a logout revoked it.
                    return await FamilyIsActiveAsync(token.FamilyId, now, ct)
                        ? ServiceResult<AuthSession>.Ok(AccessOnlySession(token.User))
                        : ServiceResult<AuthSession>.Fail(ServiceError.Unauthorized, InvalidSessionMessage);
                }

                db.RefreshTokens.Add(new RefreshToken
                {
                    Id = Guid.NewGuid(),
                    UserId = token.UserId,
                    FamilyId = token.FamilyId,
                    TokenHash = newHash,
                    CreatedAtUtc = now,
                    ExpiresAtUtc = expiresAt,
                });
                await db.SaveChangesAsync(ct);
                await transaction.CommitAsync(ct);

                return ServiceResult<AuthSession>.Ok(new AuthSession(
                    token.User,
                    jwtTokenService.CreateAccessToken(token.User),
                    new IssuedRefreshToken(newRaw, expiresAt)));
            });
        }

        public async Task LogoutAsync(string? rawRefreshToken, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(rawRefreshToken)) return;

            var hash = HashToken(rawRefreshToken);
            var familyId = await db.RefreshTokens.Where(t => t.TokenHash == hash).Select(t => (Guid?)t.FamilyId).SingleOrDefaultAsync(ct);
            if (familyId is { } id) await RevokeFamilyAsync(id, UtcNow, ct);
        }

        public async Task LogoutAllAsync(Guid userId, CancellationToken ct = default)
        {
            var now = UtcNow;
            await db.RefreshTokens
                .Where(t => t.UserId == userId && t.RevokedAtUtc == null)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAtUtc, now), ct);
        }

        public async Task<ServiceResult<AuthSession>> ChangePasswordAsync(Guid userId, string? currentPassword, string? newPassword, CancellationToken ct = default)
        {
            var user = await db.Users.Include(u => u.Roles).SingleOrDefaultAsync(u => u.Id == userId && u.IsActive, ct);
            if (user is null)
                return ServiceResult<AuthSession>.Fail(ServiceError.Unauthorized, InvalidSessionMessage);

            if (!passwordHasher.Verify(currentPassword ?? string.Empty, user.PasswordHash))
                return ServiceResult<AuthSession>.Fail(ServiceError.Validation, "Current password is incorrect.");

            var error = PasswordPolicy.Validate(newPassword);
            if (error is not null) return ServiceResult<AuthSession>.Fail(ServiceError.Validation, error);
            if (newPassword == currentPassword)
                return ServiceResult<AuthSession>.Fail(ServiceError.Validation, "New password must be different from the current one.");

            user.PasswordHash = passwordHasher.Hash(newPassword!);
            await db.SaveChangesAsync(ct);

            // Sign out every other device, then give this one a fresh session.
            await LogoutAllAsync(user.Id, ct);
            return ServiceResult<AuthSession>.Ok(await StartNewSessionAsync(user, ct));
        }

        public Task<User?> GetUserAsync(Guid userId, CancellationToken ct = default) =>
            db.Users.AsNoTracking().Include(u => u.Roles).SingleOrDefaultAsync(u => u.Id == userId && u.IsActive, ct);

        /// <summary>Issues a refresh token in a new family (a new login) and saves pending user changes.</summary>
        private async Task<AuthSession> StartNewSessionAsync(User user, CancellationToken ct)
        {
            var now = UtcNow;
            var raw = GenerateRawToken();
            var expiresAt = now.AddDays(jwtOptions.Value.RefreshTokenDays);

            db.RefreshTokens.Add(new RefreshToken
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                FamilyId = Guid.NewGuid(),
                TokenHash = HashToken(raw),
                CreatedAtUtc = now,
                ExpiresAtUtc = expiresAt,
            });
            await db.SaveChangesAsync(ct);

            return new AuthSession(user, jwtTokenService.CreateAccessToken(user), new IssuedRefreshToken(raw, expiresAt));
        }

        private AuthSession AccessOnlySession(User user) => new(user, jwtTokenService.CreateAccessToken(user), null);

        private Task<bool> FamilyIsActiveAsync(Guid familyId, DateTime now, CancellationToken ct) =>
            db.RefreshTokens.AnyAsync(t => t.FamilyId == familyId && t.RevokedAtUtc == null && t.ExpiresAtUtc > now, ct);

        private Task RevokeFamilyAsync(Guid familyId, DateTime now, CancellationToken ct) =>
            db.RefreshTokens
                .Where(t => t.FamilyId == familyId && t.RevokedAtUtc == null)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAtUtc, now), ct);

        private static string GenerateRawToken() => Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(64));

        public static string HashToken(string rawToken) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));
    }
}
