namespace ElectricCenter.Server.Auth
{
    public static class Roles
    {
        public const string Customer = "Customer";
        public const string Electrician = "Electrician";
        public const string Admin = "Admin";

        public static readonly IReadOnlyList<string> All = [Customer, Electrician, Admin];

        /// <summary>Returns the canonical spelling of a role name, or null if it isn't a known role.</summary>
        public static string? Normalize(string? role) =>
            All.FirstOrDefault(r => string.Equals(r, role?.Trim(), StringComparison.OrdinalIgnoreCase));
    }

    public static class Policies
    {
        public const string AdminOnly = nameof(AdminOnly);
    }

    public static class RateLimitPolicies
    {
        /// <summary>Login, register, change-password: guesses are the threat, so keep it tight.</summary>
        public const string AuthStrict = "auth-strict";

        /// <summary>Refresh/logout: called on every page load, so allow more.</summary>
        public const string AuthRefresh = "auth-refresh";
    }

    /// <summary>Short JWT claim names (inbound claim mapping is disabled, so these arrive as-is).</summary>
    public static class AuthClaims
    {
        public const string Subject = "sub";
        public const string Email = "email";
        public const string Name = "name";
        public const string Role = "role";
    }
}
