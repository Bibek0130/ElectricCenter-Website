using System.Text.RegularExpressions;
using ElectricCenter.Server.Auth;
using ElectricCenter.Server.Data;
using ElectricCenter.Server.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace ElectricCenter.Server.Products
{
    /// <summary>Field limits shared by validation and the database schema.</summary>
    public static partial class ProductRules
    {
        public const int NameMaxLength = 150;
        public const int BrandMaxLength = 100;
        public const int SkuMaxLength = 64;
        public const int ShortDescriptionMaxLength = 200;
        public const int DescriptionMaxLength = 4000;
        public const int ImageUrlMaxLength = 500;
        public const int MaxSpecs = 20;
        public const int SpecKeyMaxLength = 50;
        public const int SpecValueMaxLength = 200;
        public const decimal MaxPrice = 10_000_000m;
        public const int MaxDiscountPercent = 90;
        public const int MaxStock = 1_000_000;

        [GeneratedRegex("^[A-Za-z0-9._-]+$")]
        public static partial Regex SkuPattern();
    }

    public sealed record ProductInput(
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
        Dictionary<string, string>? Specs);

    public sealed record ProductQuery(
        string? Search = null,
        int? CategoryId = null,
        decimal? MinPrice = null,
        decimal? MaxPrice = null,
        string? Sort = null,
        bool IncludeDeleted = false);

    public interface IProductService
    {
        Task<IReadOnlyList<Category>> GetCategoriesAsync(CancellationToken ct = default);
        Task<IReadOnlyList<Product>> ListAsync(ProductQuery query, CancellationToken ct = default);
        Task<Product?> GetAsync(int id, bool includeDeleted, CancellationToken ct = default);
        Task<ServiceResult<Product>> CreateAsync(ProductInput input, Guid actingUserId, CancellationToken ct = default);
        Task<ServiceResult<Product>> UpdateAsync(int id, ProductInput input, Guid? expectedVersion, Guid actingUserId, CancellationToken ct = default);

        /// <summary>Soft delete: the row stays, flagged IsDeleted, and disappears from every public query.</summary>
        Task<ServiceResult<Product>> DeleteAsync(int id, Guid actingUserId, CancellationToken ct = default);

        Task<ServiceResult<Product>> RestoreAsync(int id, Guid actingUserId, CancellationToken ct = default);
    }

    public sealed class ProductService(AppDbContext db, TimeProvider timeProvider) : IProductService
    {
        private const string ConcurrencyMessage = "This product was changed by someone else since you opened it. Reload it and try again.";

        private DateTime UtcNow => timeProvider.GetUtcNow().UtcDateTime;

        public async Task<IReadOnlyList<Category>> GetCategoriesAsync(CancellationToken ct = default) =>
            await db.Categories.AsNoTracking().OrderBy(c => c.SortOrder).ThenBy(c => c.Name).ToListAsync(ct);

        public async Task<IReadOnlyList<Product>> ListAsync(ProductQuery query, CancellationToken ct = default)
        {
            var products = (query.IncludeDeleted ? db.Products.IgnoreQueryFilters() : db.Products)
                .AsNoTracking()
                .Include(p => p.Category)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(query.Search))
            {
                // LIKE (case-insensitive on MySQL's default collation and SQLite), with the user's
                // %, _ and \ escaped so they're matched literally rather than as wildcards.
                var pattern = "%" + query.Search.Trim().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_") + "%";
                products = products.Where(p => EF.Functions.Like(p.Name, pattern, "\\")
                    || (p.Brand != null && EF.Functions.Like(p.Brand, pattern, "\\"))
                    || (p.Sku != null && EF.Functions.Like(p.Sku, pattern, "\\")));
            }

            if (query.CategoryId is { } categoryId) products = products.Where(p => p.CategoryId == categoryId);

            // Price filters and sorts use the selling price (after discount), which is what customers see.
            if (query.MinPrice is { } min) products = products.Where(p => p.Price * (100 - p.DiscountPercent) / 100 >= min);
            if (query.MaxPrice is { } max) products = products.Where(p => p.Price * (100 - p.DiscountPercent) / 100 <= max);

            products = query.Sort switch
            {
                "price_asc" => products.OrderBy(p => p.Price * (100 - p.DiscountPercent) / 100).ThenBy(p => p.Id),
                "price_desc" => products.OrderByDescending(p => p.Price * (100 - p.DiscountPercent) / 100).ThenBy(p => p.Id),
                "name" => products.OrderBy(p => p.Name).ThenBy(p => p.Id),
                _ => products.OrderByDescending(p => p.CreatedAtUtc).ThenByDescending(p => p.Id),
            };

            return await products.ToListAsync(ct);
        }

        public Task<Product?> GetAsync(int id, bool includeDeleted, CancellationToken ct = default) =>
            (includeDeleted ? db.Products.IgnoreQueryFilters() : db.Products)
                .AsNoTracking()
                .Include(p => p.Category)
                .SingleOrDefaultAsync(p => p.Id == id, ct);

        public async Task<ServiceResult<Product>> CreateAsync(ProductInput input, Guid actingUserId, CancellationToken ct = default)
        {
            var error = await ValidateAsync(input, existingId: null, ct);
            if (error is not null) return error;

            var product = new Product
            {
                CreatedAtUtc = UtcNow,
                CreatedByUserId = actingUserId,
                Version = Guid.NewGuid(),
            };
            Apply(product, input);
            db.Products.Add(product);
            await db.SaveChangesAsync(ct);

            return ServiceResult<Product>.Ok((await GetAsync(product.Id, includeDeleted: false, ct))!);
        }

        public async Task<ServiceResult<Product>> UpdateAsync(int id, ProductInput input, Guid? expectedVersion, Guid actingUserId, CancellationToken ct = default)
        {
            if (expectedVersion is null)
                return ServiceResult<Product>.Fail(ServiceError.Validation, "The product version is required to save changes.");

            var product = await db.Products.SingleOrDefaultAsync(p => p.Id == id, ct);
            if (product is null) return ServiceResult<Product>.Fail(ServiceError.NotFound, "Product not found.");
            if (product.Version != expectedVersion)
                return ServiceResult<Product>.Fail(ServiceError.Conflict, ConcurrencyMessage);

            var error = await ValidateAsync(input, existingId: id, ct);
            if (error is not null) return error;

            Apply(product, input);
            product.UpdatedAtUtc = UtcNow;
            product.UpdatedByUserId = actingUserId;
            return await SaveWithNewVersionAsync(product, ct);
        }

        public async Task<ServiceResult<Product>> DeleteAsync(int id, Guid actingUserId, CancellationToken ct = default)
        {
            var product = await db.Products.SingleOrDefaultAsync(p => p.Id == id, ct);
            if (product is null) return ServiceResult<Product>.Fail(ServiceError.NotFound, "Product not found.");

            product.IsDeleted = true;
            product.DeletedAtUtc = UtcNow;
            product.DeletedByUserId = actingUserId;
            return await SaveWithNewVersionAsync(product, ct);
        }

        public async Task<ServiceResult<Product>> RestoreAsync(int id, Guid actingUserId, CancellationToken ct = default)
        {
            var product = await db.Products.IgnoreQueryFilters().SingleOrDefaultAsync(p => p.Id == id, ct);
            if (product is null) return ServiceResult<Product>.Fail(ServiceError.NotFound, "Product not found.");
            if (!product.IsDeleted) return ServiceResult<Product>.Fail(ServiceError.Validation, "This product isn't deleted.");

            product.IsDeleted = false;
            product.DeletedAtUtc = null;
            product.DeletedByUserId = null;
            product.UpdatedAtUtc = UtcNow;
            product.UpdatedByUserId = actingUserId;
            return await SaveWithNewVersionAsync(product, ct);
        }

        /// <summary>
        /// Rotates the concurrency token and saves. EF sends "WHERE Version = @old", so if another
        /// admin saved in between, zero rows match and we report a conflict instead of overwriting.
        /// </summary>
        private async Task<ServiceResult<Product>> SaveWithNewVersionAsync(Product product, CancellationToken ct)
        {
            product.Version = Guid.NewGuid();
            try
            {
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                return ServiceResult<Product>.Fail(ServiceError.Conflict, ConcurrencyMessage);
            }

            var saved = await (product.IsDeleted ? db.Products.IgnoreQueryFilters() : db.Products)
                .AsNoTracking().Include(p => p.Category).SingleAsync(p => p.Id == product.Id, ct);
            return ServiceResult<Product>.Ok(saved);
        }

        private static void Apply(Product product, ProductInput input)
        {
            product.Name = input.Name!.Trim();
            product.CategoryId = input.CategoryId!.Value;
            product.Price = decimal.Round(input.Price!.Value, 2);
            product.DiscountPercent = input.DiscountPercent ?? 0;
            product.Stock = input.Stock!.Value;
            product.Brand = Clean(input.Brand);
            product.Sku = Clean(input.Sku)?.ToUpperInvariant();
            product.ShortDescription = input.ShortDescription!.Trim();
            product.Description = Clean(input.Description);
            product.IsFeatured = input.IsFeatured;
            product.ImageUrl = Clean(input.ImageUrl);
            product.Specs = (input.Specs ?? [])
                .Where(s => !string.IsNullOrWhiteSpace(s.Key))
                .ToDictionary(s => s.Key.Trim(), s => s.Value?.Trim() ?? string.Empty);
        }

        private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

        private async Task<ServiceResult<Product>?> ValidateAsync(ProductInput input, int? existingId, CancellationToken ct)
        {
            static ServiceResult<Product> Invalid(string message) => ServiceResult<Product>.Fail(ServiceError.Validation, message);

            if (string.IsNullOrWhiteSpace(input.Name)) return Invalid("Product name is required.");
            if (input.Name.Trim().Length > ProductRules.NameMaxLength) return Invalid($"Name must be at most {ProductRules.NameMaxLength} characters.");

            if (input.CategoryId is not { } categoryId || !await db.Categories.AnyAsync(c => c.Id == categoryId, ct))
                return Invalid("Choose a valid category.");

            if (input.Price is not { } price || price <= 0) return Invalid("Price must be greater than 0.");
            if (price > ProductRules.MaxPrice) return Invalid($"Price must be at most {ProductRules.MaxPrice:N0}.");

            if (input.DiscountPercent is { } discount && (discount < 0 || discount > ProductRules.MaxDiscountPercent))
                return Invalid($"Discount must be between 0 and {ProductRules.MaxDiscountPercent}%.");

            if (input.Stock is not { } stock || stock < 0 || stock > ProductRules.MaxStock)
                return Invalid($"Stock must be a whole number between 0 and {ProductRules.MaxStock:N0}.");

            if (Clean(input.Brand) is { Length: > ProductRules.BrandMaxLength }) return Invalid($"Brand must be at most {ProductRules.BrandMaxLength} characters.");

            if (Clean(input.Sku) is { } sku)
            {
                if (sku.Length > ProductRules.SkuMaxLength || !ProductRules.SkuPattern().IsMatch(sku))
                    return Invalid($"SKU may only contain letters, numbers, '.', '-' and '_' (max {ProductRules.SkuMaxLength}).");

                var normalizedSku = sku.ToUpperInvariant();
                var clash = await db.Products.IgnoreQueryFilters()
                    .Where(p => p.Sku == normalizedSku && p.Id != existingId)
                    .Select(p => new { p.Name, p.IsDeleted })
                    .FirstOrDefaultAsync(ct);
                if (clash is not null)
                {
                    return ServiceResult<Product>.Fail(ServiceError.Conflict, clash.IsDeleted
                        ? $"SKU {normalizedSku} belongs to the deleted product \"{clash.Name}\". Restore that product instead, or use another SKU."
                        : $"SKU {normalizedSku} is already used by \"{clash.Name}\".");
                }
            }

            if (string.IsNullOrWhiteSpace(input.ShortDescription)) return Invalid("A short description is required.");
            if (input.ShortDescription.Trim().Length > ProductRules.ShortDescriptionMaxLength)
                return Invalid($"Short description must be at most {ProductRules.ShortDescriptionMaxLength} characters.");
            if (Clean(input.Description) is { Length: > ProductRules.DescriptionMaxLength })
                return Invalid($"Description must be at most {ProductRules.DescriptionMaxLength} characters.");

            if (Clean(input.ImageUrl) is { } imageUrl
                && (imageUrl.Length > ProductRules.ImageUrlMaxLength
                    || !Uri.TryCreate(imageUrl, UriKind.Absolute, out var uri)
                    || (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp)))
                return Invalid("Image URL must be a full http(s) link.");

            var specs = (input.Specs ?? []).Where(s => !string.IsNullOrWhiteSpace(s.Key)).ToList();
            if (specs.Count > ProductRules.MaxSpecs) return Invalid($"At most {ProductRules.MaxSpecs} specifications.");
            if (specs.Any(s => s.Key.Trim().Length > ProductRules.SpecKeyMaxLength || (s.Value?.Trim().Length ?? 0) > ProductRules.SpecValueMaxLength))
                return Invalid($"Specification names are limited to {ProductRules.SpecKeyMaxLength} characters and values to {ProductRules.SpecValueMaxLength}.");
            if (specs.Select(s => s.Key.Trim().ToLowerInvariant()).Distinct().Count() != specs.Count)
                return Invalid("Each specification name can only appear once.");

            return null;
        }
    }
}
