namespace ElectricCenter.Server.Data.Entities
{
    /// <summary>
    /// Entities that are never physically deleted. <see cref="AppDbContext"/> turns an EF
    /// <c>Remove()</c> of one into a soft delete, and a global query filter hides deleted rows.
    /// </summary>
    public interface ISoftDeletable
    {
        bool IsDeleted { get; set; }
        DateTime? DeletedAtUtc { get; set; }
        Guid? DeletedByUserId { get; set; }
    }

    public class Category
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public int SortOrder { get; set; }

        public List<Product> Products { get; set; } = [];
    }

    public class Product : ISoftDeletable, IVersioned
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;

        public int CategoryId { get; set; }
        public Category Category { get; set; } = null!;

        /// <summary>List price in NPR, before discount.</summary>
        public decimal Price { get; set; }

        /// <summary>0–90. The selling price is Price × (100 − DiscountPercent) / 100.</summary>
        public int DiscountPercent { get; set; }

        public int Stock { get; set; }
        public string? Brand { get; set; }

        /// <summary>Optional; unique when set (including across deleted products, so a restore can't clash).</summary>
        public string? Sku { get; set; }

        public string ShortDescription { get; set; } = string.Empty;
        public string? Description { get; set; }
        public bool IsFeatured { get; set; }
        public string? ImageUrl { get; set; }

        /// <summary>Free-form specification table, e.g. { "Ampere Rating": "63A" }. Stored as JSON.</summary>
        public Dictionary<string, string> Specs { get; set; } = [];

        /// <summary>Optimistic-concurrency token: changes on every write; an update must send the version it read.</summary>
        public Guid Version { get; set; }

        public DateTime CreatedAtUtc { get; set; }
        public Guid? CreatedByUserId { get; set; }
        public DateTime? UpdatedAtUtc { get; set; }
        public Guid? UpdatedByUserId { get; set; }

        public bool IsDeleted { get; set; }
        public DateTime? DeletedAtUtc { get; set; }
        public Guid? DeletedByUserId { get; set; }
    }
}
