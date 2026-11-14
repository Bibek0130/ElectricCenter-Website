namespace ElectricCenter.Server.Auth
{
    public interface IPasswordHasher
    {
        string Hash(string password);
        bool Verify(string password, string hash);

        /// <summary>
        /// Runs a verification against a throwaway hash. Called when the user doesn't
        /// exist or is locked, so those responses take as long as a real check and
        /// don't reveal which emails are registered.
        /// </summary>
        void VerifyDummy(string password);
    }

    /// <summary>
    /// BCrypt with SHA-384 pre-hashing ("enhanced" mode), which removes bcrypt's
    /// 72-byte input limit so long passwords aren't silently truncated.
    /// </summary>
    public sealed class BcryptPasswordHasher : IPasswordHasher
    {
        public const int DefaultWorkFactor = 12;

        private readonly int _workFactor;
        private readonly Lazy<string> _dummyHash;

        public BcryptPasswordHasher(int workFactor = DefaultWorkFactor)
        {
            _workFactor = workFactor;
            _dummyHash = new Lazy<string>(() => Hash(Guid.NewGuid().ToString()));
        }

        public string Hash(string password) => BCrypt.Net.BCrypt.EnhancedHashPassword(password, _workFactor);

        public bool Verify(string password, string hash)
        {
            try
            {
                return BCrypt.Net.BCrypt.EnhancedVerify(password, hash);
            }
            catch (BCrypt.Net.SaltParseException)
            {
                return false;
            }
        }

        public void VerifyDummy(string password) => Verify(password, _dummyHash.Value);
    }

    public static class PasswordPolicy
    {
        public const int MinLength = 8;
        public const int MaxLength = 128;

        /// <summary>Returns an error message, or null if the password is acceptable.</summary>
        public static string? Validate(string? password)
        {
            if (string.IsNullOrEmpty(password) || password.Length < MinLength)
                return $"Password must be at least {MinLength} characters.";
            if (password.Length > MaxLength)
                return $"Password must be at most {MaxLength} characters.";
            if (string.IsNullOrWhiteSpace(password))
                return "Password can't be only spaces.";
            return null;
        }
    }
}
