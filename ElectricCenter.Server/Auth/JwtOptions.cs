using System.Text;

namespace ElectricCenter.Server.Auth
{
    /// <summary>Bound from the "Jwt" config section. <see cref="SigningKey"/> must come from user-secrets or an environment variable.</summary>
    public sealed class JwtOptions
    {
        public const string SectionName = "Jwt";
        public const int MinSigningKeyBytes = 32;

        public string Issuer { get; set; } = "ElectricCenter";
        public string Audience { get; set; } = "ElectricCenter.Client";
        public string SigningKey { get; set; } = string.Empty;
        public int AccessTokenMinutes { get; set; } = 15;
        public int RefreshTokenDays { get; set; } = 14;

        public byte[] SigningKeyBytes => Encoding.UTF8.GetBytes(SigningKey);

        public bool IsValid(out string? error)
        {
            if (Encoding.UTF8.GetByteCount(SigningKey) < MinSigningKeyBytes)
                error = $"Jwt:SigningKey must be at least {MinSigningKeyBytes} bytes. Set it with user-secrets in development or the Jwt__SigningKey environment variable in production.";
            else if (AccessTokenMinutes is < 1 or > 60)
                error = "Jwt:AccessTokenMinutes must be between 1 and 60.";
            else if (RefreshTokenDays is < 1 or > 90)
                error = "Jwt:RefreshTokenDays must be between 1 and 90.";
            else
                error = null;
            return error is null;
        }
    }
}
