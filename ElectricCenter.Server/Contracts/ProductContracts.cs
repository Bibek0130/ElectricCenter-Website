using ElectricCenter.Server.Data.Entities;
using ElectricCenter.Server.Products;

namespace ElectricCenter.Server.Contracts
{
    public sealed record CategoryDto(int Id, string Name)
    {
        public static CategoryDto From(Category category) => new(category.Id, category.Name);
    }

    public sealed record ProductDto(
        int Id,
        string Name,
        int CategoryId,
        string CategoryName,
        decimal Price,
        int DiscountPercent,
        int Stock,
        string? Brand,
        string? Sku,
        string ShortDescription,
        string? Description,
        bool IsFeatured,
        string? ImageUrl,
        IReadOnlyDictionary<string, string> Specs,
        Guid Version,
        DateTime CreatedAt,
        DateTime? UpdatedAt,
        bool IsDeleted,
        DateTime? DeletedAt)
    {
        public static ProductDto From(Product p) => new(
            p.Id, p.Name, p.CategoryId, p.Category.Name, p.Price, p.DiscountPercent, p.Stock, p.Brand, p.Sku,
            p.ShortDescription, p.Description, p.IsFeatured, p.ImageUrl, p.Specs, p.Version,
            p.CreatedAtUtc, p.UpdatedAtUtc, p.IsDeleted, p.DeletedAtUtc);
    }

    /// <summary>Body for create and update. Update must also send the <see cref="Version"/> it last read.</summary>
    public sealed record SaveProductRequest(
        string? Name,
        int? CategoryId,
        decimal? Price,
        int? DiscountPercent,
        int? Stock,
        string? Brand,
        string? Sku,
        string? ShortDescription,
        string? Description,
        bool IsFeatured,
        string? ImageUrl,
        Dictionary<string, string>? Specs,
        Guid? Version)
    {
        public ProductInput ToInput() => new(Name, CategoryId, Price, DiscountPercent, Stock, Brand, Sku,
            ShortDescription, Description, IsFeatured, ImageUrl, Specs);
    }
}
