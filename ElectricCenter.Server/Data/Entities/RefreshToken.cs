namespace ElectricCenter.Server.Data.Entities
{
    /// <summary>
    /// A refresh token. Only the SHA-256 hash is stored, never the raw value.
    /// Tokens are rotated on every use; all tokens descended from one login
    /// share a <see cref="FamilyId"/> so a replayed (already-rotated) token
    /// can revoke the whole chain.
    /// </summary>
    public class RefreshToken
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public Guid FamilyId { get; set; }

        /// <summary>Upper-case hex SHA-256 of the raw token (64 chars).</summary>
        public string TokenHash { get; set; } = string.Empty;

        public DateTime CreatedAtUtc { get; set; }
        public DateTime ExpiresAtUtc { get; set; }
        public DateTime? RevokedAtUtc { get; set; }

        /// <summary>Set when this token was rotated; distinguishes a rotation from a logout/revocation.</summary>
        public string? ReplacedByTokenHash { get; set; }

        public User User { get; set; } = null!;
    }
}
