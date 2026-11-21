using ElectricCenter.Server.Auth;
using ElectricCenter.Server.Data;
using ElectricCenter.Server.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace ElectricCenter.Server.Settings
{
    /// <summary>
    /// What an admin may change. Every field is nullable so that a request that leaves one out is
    /// rejected instead of silently turning a switch off (a missing JSON bool would otherwise read as false).
    /// </summary>
    public sealed record SiteSettingsInput(bool? ShowPrice);

    public interface ISiteSettingsService
    {
        Task<SiteSettings> GetAsync(CancellationToken ct = default);
        Task<ServiceResult<SiteSettings>> UpdateAsync(SiteSettingsInput input, Guid actingUserId, CancellationToken ct = default);
    }

    public sealed class SiteSettingsService(AppDbContext db, TimeProvider timeProvider) : ISiteSettingsService
    {
        /// <summary>
        /// The migration seeds the row. If it's somehow missing (e.g. a database created by hand) fall back to the
        /// defaults rather than failing every product request.
        /// </summary>
        public async Task<SiteSettings> GetAsync(CancellationToken ct = default) =>
            await db.Settings.AsNoTracking().SingleOrDefaultAsync(s => s.Id == SiteSettings.SingletonId, ct)
            ?? new SiteSettings { Id = SiteSettings.SingletonId };

        public async Task<ServiceResult<SiteSettings>> UpdateAsync(SiteSettingsInput input, Guid actingUserId, CancellationToken ct = default)
        {
            if (input.ShowPrice is not { } showPrice)
                return ServiceResult<SiteSettings>.Fail(ServiceError.Validation, "showPrice is required (true or false).");

            var settings = await db.Settings.SingleOrDefaultAsync(s => s.Id == SiteSettings.SingletonId, ct);
            if (settings is null)
            {
                settings = new SiteSettings { Id = SiteSettings.SingletonId };
                db.Settings.Add(settings);
            }

            settings.ShowPrice = showPrice;
            settings.UpdatedAtUtc = timeProvider.GetUtcNow().UtcDateTime;
            settings.UpdatedByUserId = actingUserId;
            await db.SaveChangesAsync(ct);

            return ServiceResult<SiteSettings>.Ok(settings);
        }
    }
}
