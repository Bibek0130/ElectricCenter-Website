namespace ElectricCenter.Server.Data.Entities
{
    /// <summary>
    /// Site-wide switches an admin can flip from the Settings page. There is exactly one row
    /// (<see cref="SingletonId"/>), created by the migration, so reading it never has to handle "no settings yet".
    /// </summary>
    public class SiteSettings
    {
        public const int SingletonId = 1;

        public int Id { get; set; }

        /// <summary>
        /// When false, product prices (and discounts) are withheld from everyone except admins, who still
        /// need them to edit the catalog. The storefront also hides them. Defaults to true: prices shown.
        /// </summary>
        public bool ShowPrice { get; set; } = true;

        public DateTime? UpdatedAtUtc { get; set; }
        public Guid? UpdatedByUserId { get; set; }
    }
}
