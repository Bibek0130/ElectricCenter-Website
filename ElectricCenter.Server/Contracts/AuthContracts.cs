using ElectricCenter.Server.Data.Entities;

namespace ElectricCenter.Server.Contracts
{
    // Fields are nullable so the services, not model binding, produce the validation messages.

    public sealed record RegisterRequest(string? FullName, string? Email, string? Phone, string? Password);

    public sealed record LoginRequest(string? Email, string? Password);

    public sealed record ChangePasswordRequest(string? CurrentPassword, string? NewPassword);

    public sealed record VerifyEmailRequest(string? VerificationId, string? Code);

    public sealed record ResendVerificationRequest(string? VerificationId);

    public sealed record VerificationDto(string VerificationId, string Email, DateTime ExpiresAt, DateTime ResendAvailableAt, int ExpiresInSeconds, int ResendAfterSeconds)
    {
        public static VerificationDto From(Auth.VerificationChallenge challenge) =>
            new(challenge.VerificationId, challenge.Email, challenge.ExpiresAtUtc, challenge.ResendAvailableAtUtc, challenge.ExpiresInSeconds, challenge.ResendAfterSeconds);
    }

    /// <summary>
    /// Returned by register (202, code "verification_sent") and by login for an unverified
    /// email (403, code "email_not_verified"): the client shows the enter-your-code screen.
    /// </summary>
    public sealed record VerificationRequiredResponse(string Code, string Message, VerificationDto Verification)
    {
        public const string VerificationSent = "verification_sent";
        public const string EmailNotVerified = "email_not_verified";
    }

    public sealed record UserDto(Guid Id, string Email, string FullName, string? Phone, IReadOnlyList<string> Roles)
    {
        public static UserDto From(User user) =>
            new(user.Id, user.Email, user.FullName, user.Phone, user.Roles.Select(r => r.Role).Order().ToList());
    }

    /// <summary>Returned by login, register, refresh and change-password. The refresh token is only ever in the HttpOnly cookie.</summary>
    public sealed record AuthResponse(string AccessToken, DateTime ExpiresAt, UserDto User);

    public sealed record AdminUserDto(
        Guid Id,
        string Email,
        string FullName,
        string? Phone,
        IReadOnlyList<string> Roles,
        bool IsActive,
        bool EmailConfirmed,
        bool IsLockedOut,
        DateTime CreatedAt,
        DateTime? LastLoginAt)
    {
        public static AdminUserDto From(User user, DateTime utcNow) => new(
            user.Id,
            user.Email,
            user.FullName,
            user.Phone,
            user.Roles.Select(r => r.Role).Order().ToList(),
            user.IsActive,
            user.EmailConfirmed,
            user.LockoutEndUtc > utcNow,
            user.CreatedAtUtc,
            user.LastLoginAtUtc);
    }

    public sealed record CreateUserRequest(string? FullName, string? Email, string? Phone, string? Password, List<string>? Roles);

    public sealed record SetRolesRequest(List<string>? Roles);

    public sealed record SetActiveRequest(bool IsActive);

    public sealed record ResetPasswordRequest(string? NewPassword);
}
