using ElectricCenter.Server.Data.Entities;
using ElectricCenter.Server.Electricians;

namespace ElectricCenter.Server.Contracts
{
    // Property names match the JSON shape the React app already used for its static data
    // (photo, rate { amount, unit }, whatsappNumber, pastWorks[].image), so the pages barely change.

    public sealed record RateDto(decimal Amount, string Unit);

    public sealed record PastWorkDto(string? Title, string? Description, string? Image, DateOnly? Date);

    public sealed record ElectricianDto(
        int Id,
        string Name,
        string? Photo,
        string Location,
        int YearsExperience,
        bool IsContractor,
        RateDto Rate,
        string? Demand,
        string WhatsappNumber,
        string Bio,
        IReadOnlyList<string> Specialties,
        IReadOnlyList<PastWorkDto> PastWorks,
        Guid Version,
        DateTime CreatedAt,
        DateTime? UpdatedAt,
        bool IsDeleted,
        DateTime? DeletedAt)
    {
        public static ElectricianDto From(Electrician e) => new(
            e.Id, e.Name, e.PhotoUrl, e.Location, e.YearsExperience, e.IsContractor,
            new RateDto(e.RateAmount, e.RateUnit), e.Demand, e.WhatsAppNumber, e.Bio,
            // Keep specialties in the catalog's order, not insertion order.
            e.Specialties.Select(s => s.Specialty).OrderBy(s => IndexOf(s)).ToList(),
            e.PastWorks.Select(w => new PastWorkDto(w.Title, w.Description, w.ImageUrl, w.Date)).ToList(),
            e.Version, e.CreatedAtUtc, e.UpdatedAtUtc, e.IsDeleted, e.DeletedAtUtc);

        private static int IndexOf(string specialty)
        {
            for (var i = 0; i < ElectricianRules.Specialties.Count; i++)
                if (ElectricianRules.Specialties[i] == specialty) return i;
            return int.MaxValue;
        }
    }

    /// <summary>Body for create and update. Update must also send the <see cref="Version"/> it last read.</summary>
    public sealed record SaveElectricianRequest(
        string? Name,
        string? Photo,
        string? Location,
        int? YearsExperience,
        bool IsContractor,
        RateDto? Rate,
        string? Demand,
        string? WhatsappNumber,
        string? Bio,
        List<string>? Specialties,
        List<PastWorkDto>? PastWorks,
        Guid? Version)
    {
        public ElectricianInput ToInput() => new(
            Name, Photo, Location, YearsExperience, IsContractor, Rate?.Amount, Rate?.Unit, Demand, WhatsappNumber, Bio,
            Specialties, PastWorks?.Select(w => new PastWorkInput(w.Title, w.Description, w.Image, w.Date)).ToList());
    }
}
