namespace ElectricCenter.Server.Data.Entities
{
    public class User
    {
        public Guid Id { get; set; }

        /// <summary>Trimmed and lower-cased; unique. Used as the sign-in identifier.</summary>
        public string Email { get; set; } = string.Empty;

        public string PasswordHash { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public bool IsActive { get; set; } = true;

        /// <summary>True once the user has proven they own <see cref="Email"/> with an emailed OTP.</summary>
        public bool EmailConfirmed { get; set; }

        public int FailedLoginCount { get; set; }
        public DateTime? LockoutEndUtc { get; set; }

        public DateTime CreatedAtUtc { get; set; }
        public DateTime? LastLoginAtUtc { get; set; }

        public List<UserRole> Roles { get; set; } = [];
        public List<RefreshToken> RefreshTokens { get; set; } = [];
    }
}
