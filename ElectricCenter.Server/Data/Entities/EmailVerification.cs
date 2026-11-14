namespace ElectricCenter.Server.Data.Entities
{
    public static class EmailVerificationKind
    {
        /// <summary>Self-registration: the account is only created once the code is verified.</summary>
        public const string Registration = "Registration";

        /// <summary>An existing but unverified account (e.g. created by an admin) signing in for the first time.</summary>
        public const string Login = "Login";
    }

    /// <summary>
    /// One email-OTP challenge. The client holds an opaque verification id (only its hash
    /// is stored) and the user receives a 6-digit code by email; both are needed to verify,
    /// so a code is useless to anyone who didn't start that particular challenge.
    /// </summary>
    public class EmailVerification
    {
        public Guid Id { get; set; }

        /// <summary>Hex SHA-256 of the opaque verification id handed to the client.</summary>
        public string TokenHash { get; set; } = string.Empty;

        public string Kind { get; set; } = EmailVerificationKind.Registration;

        /// <summary>Normalized (trimmed, lower-case) email the code is sent to.</summary>
        public string Email { get; set; } = string.Empty;

        /// <summary>Set for <see cref="EmailVerificationKind.Login"/> challenges.</summary>
        public Guid? UserId { get; set; }

        // Registration details, held here until the email is proven. Never a plain-text password.
        public string? PendingFullName { get; set; }
        public string? PendingPhone { get; set; }
        public string? PendingPasswordHash { get; set; }

        /// <summary>Hex HMAC-SHA256 of the current code (keyed with a server secret, bound to this challenge).</summary>
        public string CodeHash { get; set; } = string.Empty;

        public int FailedAttempts { get; set; }
        public int SendCount { get; set; }

        public DateTime CreatedAtUtc { get; set; }
        public DateTime LastSentAtUtc { get; set; }
        public DateTime ExpiresAtUtc { get; set; }
        public DateTime? ConsumedAtUtc { get; set; }

        public User? User { get; set; }
    }
}
