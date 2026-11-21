using ElectricCenter.Server.Data.Entities;
using ElectricCenter.Server.Settings;

namespace ElectricCenter.Server.Contracts
{
    /// <summary>The public view of the site settings: only what the storefront needs to render itself.</summary>
    public sealed record SiteSettingsDto(bool ShowPrice)
    {
        public static SiteSettingsDto From(SiteSettings settings) => new(settings.ShowPrice);
    }

    /// <summary>Body for <c>PUT /api/settings</c>. <see cref="ShowPrice"/> must be sent explicitly.</summary>
    public sealed record UpdateSiteSettingsRequest(bool? ShowPrice)
    {
        public SiteSettingsInput ToInput() => new(ShowPrice);
    }
}
