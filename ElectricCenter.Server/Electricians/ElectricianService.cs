using System.Text.RegularExpressions;
using ElectricCenter.Server.Auth;
using ElectricCenter.Server.Data;
using ElectricCenter.Server.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace ElectricCenter.Server.Electricians
{
    /// <summary>Field limits and the specialty catalog, shared by validation and the database schema.</summary>
    public static partial class ElectricianRules
    {
        public const int NameMaxLength = 100;
        public const int LocationMaxLength = 100;
        public const int UrlMaxLength = 500;
        public const int BioMaxLength = 2000;
        public const int SpecialtyMaxLength = 50;
        public const int MaxYearsExperience = 70;
        public const decimal MaxRate = 1_000_000m;
        public const int MaxPastWorks = 20;
        public const int PastWorkTitleMaxLength = 100;
        public const int PastWorkDescriptionMaxLength = 500;

        /// <summary>The specialties an admin can pick from. A fixed list keeps the filter pills consistent.</summary>
        public static readonly IReadOnlyList<string> Specialties =
        [
            "AC Electrical",
            "Appliance Repair",
            "Battery Backup",
            "Circuit Repair",
            "Generator Installation",
            "House Wiring",
            "Industrial Wiring",
            "Inverter & Solar",
            "Lighting Design",
            "Panel Upgrades",
            "Smart Home",
        ];

        public static string? NormalizeSpecialty(string? value) =>
            Specialties.FirstOrDefault(s => string.Equals(s, value?.Trim(), StringComparison.OrdinalIgnoreCase));

        /// <summary>E.164: "+", country code, 8–15 digits in total. Spaces and dashes are stripped first.</summary>
        [GeneratedRegex(@"^\+[1-9]\d{7,14}$")]
        public static partial Regex E164();

        public static string NormalizePhone(string? value) =>
            new string((value ?? string.Empty).Where(c => !char.IsWhiteSpace(c) && c != '-' && c != '(' && c != ')').ToArray());
    }

    public sealed record PastWorkInput(string? Title, string? Description, string? ImageUrl, DateOnly? Date);

    public sealed record ElectricianInput(
        string? Name,
        string? PhotoUrl,
        string? Location,
        int? YearsExperience,
        bool IsContractor,
        decimal? RateAmount,
        string? RateUnit,
        string? Demand,
        string? WhatsAppNumber,
        string? Bio,
        List<string>? Specialties,
        List<PastWorkInput>? PastWorks);

    public sealed record ElectricianQuery(string? Search = null, string? Specialty = null, string? Sort = null, bool IncludeDeleted = false);

    public interface IElectricianService
    {
        Task<IReadOnlyList<Electrician>> ListAsync(ElectricianQuery query, CancellationToken ct = default);
        Task<Electrician?> GetAsync(int id, bool includeDeleted, CancellationToken ct = default);
        Task<ServiceResult<Electrician>> CreateAsync(ElectricianInput input, Guid actingUserId, CancellationToken ct = default);
        Task<ServiceResult<Electrician>> UpdateAsync(int id, ElectricianInput input, Guid? expectedVersion, Guid actingUserId, CancellationToken ct = default);

        /// <summary>Soft delete: the row stays, flagged IsDeleted, and disappears from every public query.</summary>
        Task<ServiceResult<Electrician>> DeleteAsync(int id, Guid actingUserId, CancellationToken ct = default);

        Task<ServiceResult<Electrician>> RestoreAsync(int id, Guid actingUserId, CancellationToken ct = default);
    }

    public sealed class ElectricianService(AppDbContext db, TimeProvider timeProvider) : IElectricianService
    {
        private const string ConcurrencyMessage = "This electrician was changed by someone else since you opened it. Reload and try again.";

        private DateTime UtcNow => timeProvider.GetUtcNow().UtcDateTime;

        private IQueryable<Electrician> Query(bool includeDeleted) =>
            (includeDeleted ? db.Electricians.IgnoreQueryFilters() : db.Electricians)
                .Include(e => e.Specialties)
                .AsSplitQuery();

        public async Task<IReadOnlyList<Electrician>> ListAsync(ElectricianQuery query, CancellationToken ct = default)
        {
            var electricians = Query(query.IncludeDeleted).AsNoTracking();

            if (!string.IsNullOrWhiteSpace(query.Search))
            {
                // LIKE with the user's %, _ and \ escaped; case-insensitive on MySQL and SQLite.
                var pattern = "%" + query.Search.Trim().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_") + "%";
                electricians = electricians.Where(e => EF.Functions.Like(e.Name, pattern, "\\")
                    || EF.Functions.Like(e.Location, pattern, "\\")
                    || e.Specialties.Any(s => EF.Functions.Like(s.Specialty, pattern, "\\")));
            }

            if (ElectricianRules.NormalizeSpecialty(query.Specialty) is { } specialty)
                electricians = electricians.Where(e => e.Specialties.Any(s => s.Specialty == specialty));

            electricians = query.Sort switch
            {
                "price_asc" => electricians.OrderBy(e => e.RateAmount).ThenBy(e => e.Name),
                "price_desc" => electricians.OrderByDescending(e => e.RateAmount).ThenBy(e => e.Name),
                // Most available first: Low demand ("Available now"), then Medium, then High; unknown last.
                "availability" => electricians
                    .OrderBy(e => e.Demand == DemandLevel.Low ? 0 : e.Demand == DemandLevel.Medium ? 1 : e.Demand == DemandLevel.High ? 2 : 3)
                    .ThenBy(e => e.Name),
                "experience" => electricians.OrderByDescending(e => e.YearsExperience).ThenBy(e => e.Name),
                _ => electricians.OrderBy(e => e.CreatedAtUtc).ThenBy(e => e.Id), // "Recommended": the order the admin added them
            };

            return await electricians.ToListAsync(ct);
        }

        public Task<Electrician?> GetAsync(int id, bool includeDeleted, CancellationToken ct = default) =>
            Query(includeDeleted).AsNoTracking().SingleOrDefaultAsync(e => e.Id == id, ct);

        public async Task<ServiceResult<Electrician>> CreateAsync(ElectricianInput input, Guid actingUserId, CancellationToken ct = default)
        {
            var (error, specialties, pastWorks) = Validate(input);
            if (error is not null) return ServiceResult<Electrician>.Fail(ServiceError.Validation, error);

            var electrician = new Electrician
            {
                CreatedAtUtc = UtcNow,
                CreatedByUserId = actingUserId,
                Version = Guid.NewGuid(),
            };
            Apply(electrician, input, specialties!, pastWorks!);
            db.Electricians.Add(electrician);
            await db.SaveChangesAsync(ct);

            return ServiceResult<Electrician>.Ok((await GetAsync(electrician.Id, includeDeleted: false, ct))!);
        }

        public async Task<ServiceResult<Electrician>> UpdateAsync(int id, ElectricianInput input, Guid? expectedVersion, Guid actingUserId, CancellationToken ct = default)
        {
            if (expectedVersion is null)
                return ServiceResult<Electrician>.Fail(ServiceError.Validation, "The electrician version is required to save changes.");

            var electrician = await Query(includeDeleted: false).SingleOrDefaultAsync(e => e.Id == id, ct);
            if (electrician is null) return ServiceResult<Electrician>.Fail(ServiceError.NotFound, "Electrician not found.");
            if (electrician.Version != expectedVersion) return ServiceResult<Electrician>.Fail(ServiceError.Conflict, ConcurrencyMessage);

            var (error, specialties, pastWorks) = Validate(input);
            if (error is not null) return ServiceResult<Electrician>.Fail(ServiceError.Validation, error);

            Apply(electrician, input, specialties!, pastWorks!);
            electrician.UpdatedAtUtc = UtcNow;
            electrician.UpdatedByUserId = actingUserId;
            return await SaveWithNewVersionAsync(electrician, ct);
        }

        public async Task<ServiceResult<Electrician>> DeleteAsync(int id, Guid actingUserId, CancellationToken ct = default)
        {
            var electrician = await db.Electricians.SingleOrDefaultAsync(e => e.Id == id, ct);
            if (electrician is null) return ServiceResult<Electrician>.Fail(ServiceError.NotFound, "Electrician not found.");

            electrician.IsDeleted = true;
            electrician.DeletedAtUtc = UtcNow;
            electrician.DeletedByUserId = actingUserId;
            return await SaveWithNewVersionAsync(electrician, ct);
        }

        public async Task<ServiceResult<Electrician>> RestoreAsync(int id, Guid actingUserId, CancellationToken ct = default)
        {
            var electrician = await db.Electricians.IgnoreQueryFilters().SingleOrDefaultAsync(e => e.Id == id, ct);
            if (electrician is null) return ServiceResult<Electrician>.Fail(ServiceError.NotFound, "Electrician not found.");
            if (!electrician.IsDeleted) return ServiceResult<Electrician>.Fail(ServiceError.Validation, "This electrician isn't deleted.");

            electrician.IsDeleted = false;
            electrician.DeletedAtUtc = null;
            electrician.DeletedByUserId = null;
            electrician.UpdatedAtUtc = UtcNow;
            electrician.UpdatedByUserId = actingUserId;
            return await SaveWithNewVersionAsync(electrician, ct);
        }

        /// <summary>Rotates the concurrency token and saves; a concurrent save by another admin becomes a 409.</summary>
        private async Task<ServiceResult<Electrician>> SaveWithNewVersionAsync(Electrician electrician, CancellationToken ct)
        {
            electrician.Version = Guid.NewGuid();
            try
            {
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                return ServiceResult<Electrician>.Fail(ServiceError.Conflict, ConcurrencyMessage);
            }

            var saved = await Query(includeDeleted: true).AsNoTracking().SingleAsync(e => e.Id == electrician.Id, ct);
            return ServiceResult<Electrician>.Ok(saved);
        }

        private static void Apply(Electrician electrician, ElectricianInput input, List<string> specialties, List<PastWork> pastWorks)
        {
            electrician.Name = input.Name!.Trim();
            electrician.PhotoUrl = Clean(input.PhotoUrl);
            electrician.Location = input.Location!.Trim();
            electrician.YearsExperience = input.YearsExperience!.Value;
            electrician.IsContractor = input.IsContractor;
            electrician.RateAmount = decimal.Round(input.RateAmount!.Value, 2);
            electrician.RateUnit = input.RateUnit!.Trim().ToLowerInvariant();
            electrician.Demand = DemandLevel.All.FirstOrDefault(d => string.Equals(d, input.Demand?.Trim(), StringComparison.OrdinalIgnoreCase));
            electrician.WhatsAppNumber = ElectricianRules.NormalizePhone(input.WhatsAppNumber);
            electrician.Bio = input.Bio!.Trim();
            electrician.PastWorks = pastWorks;

            // Replace the specialty set (rows are attributes of the electrician, like a user's roles).
            electrician.Specialties.RemoveAll(s => !specialties.Contains(s.Specialty));
            foreach (var specialty in specialties.Where(s => electrician.Specialties.All(existing => existing.Specialty != s)))
                electrician.Specialties.Add(new ElectricianSpecialty { Specialty = specialty });
        }

        private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

        private static bool IsHttpUrl(string value) =>
            value.Length <= ElectricianRules.UrlMaxLength
            && Uri.TryCreate(value, UriKind.Absolute, out var uri)
            && (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp);

        private (string? Error, List<string>? Specialties, List<PastWork>? PastWorks) Validate(ElectricianInput input)
        {
            static (string?, List<string>?, List<PastWork>?) Invalid(string message) => (message, null, null);

            if (string.IsNullOrWhiteSpace(input.Name)) return Invalid("Name is required.");
            if (input.Name.Trim().Length > ElectricianRules.NameMaxLength) return Invalid($"Name must be at most {ElectricianRules.NameMaxLength} characters.");
            if (Clean(input.PhotoUrl) is { } photo && !IsHttpUrl(photo)) return Invalid("Photo URL must be a full http(s) link.");
            if (string.IsNullOrWhiteSpace(input.Location)) return Invalid("Location is required.");
            if (input.Location.Trim().Length > ElectricianRules.LocationMaxLength) return Invalid($"Location must be at most {ElectricianRules.LocationMaxLength} characters.");

            if (input.YearsExperience is not { } years || years < 0 || years > ElectricianRules.MaxYearsExperience)
                return Invalid($"Years of experience must be between 0 and {ElectricianRules.MaxYearsExperience}.");

            if (input.RateAmount is not { } rate || rate <= 0) return Invalid("Rate must be greater than 0.");
            if (rate > ElectricianRules.MaxRate) return Invalid($"Rate must be at most {ElectricianRules.MaxRate:N0}.");
            if (!RateUnit.All.Contains(input.RateUnit?.Trim().ToLowerInvariant() ?? string.Empty))
                return Invalid($"Rate unit must be one of: {string.Join(", ", RateUnit.All)}.");

            if (!string.IsNullOrWhiteSpace(input.Demand) && !DemandLevel.All.Any(d => string.Equals(d, input.Demand.Trim(), StringComparison.OrdinalIgnoreCase)))
                return Invalid($"Availability must be one of: {string.Join(", ", DemandLevel.All)} (or left empty).");

            if (!ElectricianRules.E164().IsMatch(ElectricianRules.NormalizePhone(input.WhatsAppNumber)))
                return Invalid("WhatsApp number must include the country code, e.g. +9779841445050.");

            if (string.IsNullOrWhiteSpace(input.Bio)) return Invalid("A short bio is required.");
            if (input.Bio.Trim().Length > ElectricianRules.BioMaxLength) return Invalid($"Bio must be at most {ElectricianRules.BioMaxLength} characters.");

            var specialties = new List<string>();
            foreach (var raw in input.Specialties ?? [])
            {
                var specialty = ElectricianRules.NormalizeSpecialty(raw);
                if (specialty is null) return Invalid($"Unknown specialty \"{raw}\".");
                if (!specialties.Contains(specialty)) specialties.Add(specialty);
            }
            if (specialties.Count == 0) return Invalid("Choose at least one specialty.");

            var pastWorks = new List<PastWork>();
            var latestAllowed = DateOnly.FromDateTime(UtcNow).AddDays(1);
            foreach (var work in input.PastWorks ?? [])
            {
                if (string.IsNullOrWhiteSpace(work.Title) && string.IsNullOrWhiteSpace(work.Description) && string.IsNullOrWhiteSpace(work.ImageUrl))
                    continue; // empty row in the form
                if (string.IsNullOrWhiteSpace(work.Title)) return Invalid("Every past work needs a title.");
                if (work.Title.Trim().Length > ElectricianRules.PastWorkTitleMaxLength) return Invalid($"Past work titles are limited to {ElectricianRules.PastWorkTitleMaxLength} characters.");
                if (Clean(work.Description) is { Length: > ElectricianRules.PastWorkDescriptionMaxLength })
                    return Invalid($"Past work descriptions are limited to {ElectricianRules.PastWorkDescriptionMaxLength} characters.");
                if (Clean(work.ImageUrl) is { } image && !IsHttpUrl(image)) return Invalid("Past work image URLs must be full http(s) links.");
                if (work.Date > latestAllowed) return Invalid("Past work dates can't be in the future.");
                pastWorks.Add(new PastWork(work.Title.Trim(), Clean(work.Description), Clean(work.ImageUrl), work.Date));
            }
            if (pastWorks.Count > ElectricianRules.MaxPastWorks) return Invalid($"At most {ElectricianRules.MaxPastWorks} past works.");

            return (null, specialties, pastWorks);
        }
    }
}
