using System.Net.Mail;
using ElectricCenter.Server.Data.Entities;

namespace ElectricCenter.Server.Auth
{
    public enum ServiceError
    {
        None,
        Validation,
        Conflict,
        InvalidCredentials,
        Unauthorized,
        Forbidden,
        NotFound,
        TooManyRequests,
        Unavailable,
    }

    public sealed record ServiceResult<T>(T? Value, ServiceError Error, string? Message)
    {
        public bool Succeeded => Error == ServiceError.None;

        public static ServiceResult<T> Ok(T value) => new(value, ServiceError.None, null);
        public static ServiceResult<T> Fail(ServiceError error, string message) => new(default, error, message);
    }

    public sealed record IssuedRefreshToken(string Value, DateTime ExpiresAtUtc);

    /// <summary>
    /// Result of a successful sign-in or refresh. <see cref="RefreshToken"/> is null when
    /// the existing refresh cookie stays valid and must not be overwritten (the
    /// concurrent-refresh grace case).
    /// </summary>
    public sealed record AuthSession(User User, AccessToken AccessToken, IssuedRefreshToken? RefreshToken);

    public static class UserInput
    {
        public const int FullNameMaxLength = 100;
        public const int PhoneMaxLength = 20;
        public const int EmailMaxLength = 254;

        public static string NormalizeEmail(string? email) => (email ?? string.Empty).Trim().ToLowerInvariant();

        public static bool IsValidEmail(string email) =>
            email.Length is > 0 and <= EmailMaxLength
            && MailAddress.TryCreate(email, out var address)
            && address.Address == email
            && address.Host.Contains('.');

        /// <summary>Validates the profile fields shared by self-registration and admin-created accounts.</summary>
        public static string? ValidateProfile(string? fullName, string normalizedEmail, string? phone)
        {
            if (string.IsNullOrWhiteSpace(fullName)) return "Full name is required.";
            if (fullName.Trim().Length > FullNameMaxLength) return $"Full name must be at most {FullNameMaxLength} characters.";
            if (!IsValidEmail(normalizedEmail)) return "Enter a valid email address.";
            if (phone is not null && phone.Trim().Length > PhoneMaxLength) return $"Phone must be at most {PhoneMaxLength} characters.";
            return null;
        }

        public static string? CleanPhone(string? phone) => string.IsNullOrWhiteSpace(phone) ? null : phone.Trim();
    }
}
