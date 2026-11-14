namespace ElectricCenter.Server.Data.Entities
{
    /// <summary>Entities with an optimistic-concurrency token that changes on every write.</summary>
    public interface IVersioned
    {
        Guid Version { get; set; }
    }

    public static class RateUnit
    {
        public const string Hour = "hour";
        public const string Visit = "visit";
        public const string Service = "service";

        public static readonly IReadOnlyList<string> All = [Hour, Visit, Service];
    }

    /// <summary>How busy the electrician is: High = in demand, Low = available now. Optional.</summary>
    public static class DemandLevel
    {
        public const string High = "High";
        public const string Medium = "Medium";
        public const string Low = "Low";

        public static readonly IReadOnlyList<string> All = [High, Medium, Low];
    }

    public class Electrician : ISoftDeletable, IVersioned
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? PhotoUrl { get; set; }
        public string Location { get; set; } = string.Empty;
        public int YearsExperience { get; set; }
        public bool IsContractor { get; set; }

        /// <summary>Rate in NPR per <see cref="RateUnit"/>.</summary>
        public decimal RateAmount { get; set; }
        public string RateUnit { get; set; } = Entities.RateUnit.Visit;

        /// <summary>Optional <see cref="DemandLevel"/>; the badge is hidden when null.</summary>
        public string? Demand { get; set; }

        /// <summary>E.164, e.g. +9779841445050. Booking notifications are sent here; never taken from the client.</summary>
        public string WhatsAppNumber { get; set; } = string.Empty;

        public string Bio { get; set; } = string.Empty;

        public List<ElectricianSpecialty> Specialties { get; set; } = [];

        /// <summary>Portfolio entries, stored as JSON (they're only ever read with the electrician).</summary>
        public List<PastWork> PastWorks { get; set; } = [];

        public Guid Version { get; set; }
        public DateTime CreatedAtUtc { get; set; }
        public Guid? CreatedByUserId { get; set; }
        public DateTime? UpdatedAtUtc { get; set; }
        public Guid? UpdatedByUserId { get; set; }

        public bool IsDeleted { get; set; }
        public DateTime? DeletedAtUtc { get; set; }
        public Guid? DeletedByUserId { get; set; }
    }

    /// <summary>One row per specialty; a table (not JSON) so the list can be filtered in SQL.</summary>
    public class ElectricianSpecialty
    {
        public int ElectricianId { get; set; }
        public string Specialty { get; set; } = string.Empty;

        public Electrician Electrician { get; set; } = null!;
    }

    public sealed record PastWork(string Title, string? Description, string? ImageUrl, DateOnly? Date);
}
