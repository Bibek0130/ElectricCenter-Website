namespace ElectricCenter.Server.Data.Entities
{
    /// <summary>One row per role a user holds; a user can hold several. Role names come from <see cref="Auth.Roles"/>.</summary>
    public class UserRole
    {
        public Guid UserId { get; set; }
        public string Role { get; set; } = string.Empty;

        public User User { get; set; } = null!;
    }
}
