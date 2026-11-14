using ElectricCenter.Server.Auth;
using ElectricCenter.Server.Products;
using Microsoft.EntityFrameworkCore;

namespace ElectricCenter.Server.Tests
{
    public class ProductServiceTests : IDisposable
    {
        private static readonly Guid AdminId = Guid.NewGuid();
        private readonly AuthTestContext _ctx = new();
        private readonly ProductService _products;

        public ProductServiceTests() => _products = new ProductService(_ctx.Db, _ctx.Time);

        public void Dispose() => _ctx.Dispose();

        private static ProductInput Valid(string name = "Schneider 63A MCB", int categoryId = 1, decimal price = 2850, int discount = 10,
            string? sku = "sch-63a", string? brand = "Schneider", Dictionary<string, string>? specs = null) =>
            new(name, categoryId, price, discount, 45, brand, sku, "Reliable overload protection", "Long description", true,
                "https://example.com/mcb.jpg", specs ?? new() { ["Ampere Rating"] = "63A", ["Poles"] = "2" });

        private async Task<Data.Entities.Product> CreateAsync(ProductInput input)
        {
            var result = await _products.CreateAsync(input, AdminId);
            Assert.True(result.Succeeded, result.Message);
            return result.Value!;
        }

        [Fact]
        public async Task Create_saves_the_product_with_category_audit_fields_and_a_normalized_sku()
        {
            var product = await CreateAsync(Valid());

            Assert.True(product.Id > 0);
            Assert.Equal("Circuit Breakers", product.Category.Name);
            Assert.Equal("SCH-63A", product.Sku);
            Assert.Equal(AdminId, product.CreatedByUserId);
            Assert.NotEqual(Guid.Empty, product.Version);
            Assert.Equal("63A", product.Specs["Ampere Rating"]);
            Assert.False(product.IsDeleted);
        }

        public static TheoryData<ProductInput, string> InvalidInputs => new()
        {
            { Valid() with { Name = " " }, "name is required" },
            { Valid() with { CategoryId = 999 }, "valid category" },
            { Valid() with { Price = 0 }, "greater than 0" },
            { Valid() with { DiscountPercent = 95 }, "Discount" },
            { Valid() with { Stock = -1 }, "Stock" },
            { Valid() with { Sku = "has spaces" }, "SKU" },
            { Valid() with { ImageUrl = "javascript:alert(1)" }, "Image URL" },
            { Valid() with { ShortDescription = "" }, "short description" },
            { Valid() with { Specs = Enumerable.Range(0, 21).ToDictionary(i => $"k{i}", i => "v") }, "At most 20" },
            { Valid() with { Specs = new() { ["Poles"] = "2", ["poles "] = "3" } }, "only appear once" },
        };

        [Theory]
        [MemberData(nameof(InvalidInputs))]
        public async Task Create_rejects_invalid_input(ProductInput input, string expectedMessage)
        {
            var result = await _products.CreateAsync(input, AdminId);

            Assert.Equal(ServiceError.Validation, result.Error);
            Assert.Contains(expectedMessage, result.Message, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public async Task Sku_must_be_unique_including_against_deleted_products()
        {
            var first = await CreateAsync(Valid(sku: "ABC-1"));

            var duplicate = await _products.CreateAsync(Valid(name: "Other", sku: "abc-1"), AdminId);
            Assert.Equal(ServiceError.Conflict, duplicate.Error);

            await _products.DeleteAsync(first.Id, AdminId);
            var againAfterDelete = await _products.CreateAsync(Valid(name: "Other", sku: "ABC-1"), AdminId);
            Assert.Equal(ServiceError.Conflict, againAfterDelete.Error);
            Assert.Contains("Restore", againAfterDelete.Message);
        }

        [Fact]
        public async Task Update_requires_the_current_version_and_rotates_it()
        {
            var created = await CreateAsync(Valid());

            var stale = await _products.UpdateAsync(created.Id, Valid(name: "Renamed"), Guid.NewGuid(), AdminId);
            Assert.Equal(ServiceError.Conflict, stale.Error);

            var missing = await _products.UpdateAsync(created.Id, Valid(name: "Renamed"), null, AdminId);
            Assert.Equal(ServiceError.Validation, missing.Error);

            var updated = await _products.UpdateAsync(created.Id, Valid(name: "Renamed", price: 3000), created.Version, AdminId);
            Assert.True(updated.Succeeded, updated.Message);
            Assert.Equal("Renamed", updated.Value!.Name);
            Assert.Equal(3000, updated.Value.Price);
            Assert.NotEqual(created.Version, updated.Value.Version);
            Assert.Equal(AdminId, updated.Value.UpdatedByUserId);

            // A second admin still holding the original version is refused instead of overwriting.
            var secondAdmin = new ProductService(_ctx.CreateDbContext(), _ctx.Time);
            var lost = await secondAdmin.UpdateAsync(created.Id, Valid(name: "Clobber"), created.Version, Guid.NewGuid());
            Assert.Equal(ServiceError.Conflict, lost.Error);
        }

        [Fact]
        public async Task Delete_is_a_soft_delete_that_hides_the_product_but_keeps_the_row()
        {
            var product = await CreateAsync(Valid());

            var deleted = await _products.DeleteAsync(product.Id, AdminId);

            Assert.True(deleted.Succeeded, deleted.Message);
            Assert.Empty(await _products.ListAsync(new ProductQuery()));
            Assert.Null(await _products.GetAsync(product.Id, includeDeleted: false));
            Assert.Equal(ServiceError.NotFound, (await _products.DeleteAsync(product.Id, AdminId)).Error);

            await using var db = _ctx.CreateDbContext();
            var row = await db.Products.IgnoreQueryFilters().SingleAsync(p => p.Id == product.Id);
            Assert.True(row.IsDeleted);
            Assert.Equal(AdminId, row.DeletedByUserId);
            Assert.NotNull(row.DeletedAtUtc);

            var adminView = await _products.ListAsync(new ProductQuery(IncludeDeleted: true));
            Assert.True(Assert.Single(adminView).IsDeleted);
        }

        [Fact]
        public async Task Restore_brings_a_deleted_product_back()
        {
            var product = await CreateAsync(Valid());
            await _products.DeleteAsync(product.Id, AdminId);

            var restored = await _products.RestoreAsync(product.Id, AdminId);

            Assert.True(restored.Succeeded, restored.Message);
            Assert.False(restored.Value!.IsDeleted);
            Assert.Null(restored.Value.DeletedAtUtc);
            Assert.Single(await _products.ListAsync(new ProductQuery()));
            Assert.Equal(ServiceError.Validation, (await _products.RestoreAsync(product.Id, AdminId)).Error);
        }

        [Fact]
        public async Task Removing_a_product_through_ef_never_hard_deletes_it()
        {
            var product = await CreateAsync(Valid());

            await using (var db = _ctx.CreateDbContext())
            {
                db.Products.Remove(await db.Products.SingleAsync(p => p.Id == product.Id));
                await db.SaveChangesAsync();
            }

            await using var check = _ctx.CreateDbContext();
            var row = await check.Products.IgnoreQueryFilters().SingleOrDefaultAsync(p => p.Id == product.Id);
            Assert.NotNull(row);
            Assert.True(row.IsDeleted);
            Assert.False(await check.Products.AnyAsync());
        }

        [Fact]
        public async Task List_filters_by_search_category_and_selling_price_and_sorts()
        {
            await CreateAsync(Valid(name: "Cheap Bulb", categoryId: 4, price: 300, discount: 0, sku: "BULB-1", brand: "Philips"));
            await CreateAsync(Valid(name: "Discounted Panel", categoryId: 4, price: 2000, discount: 50, sku: "PNL-1", brand: "Wipro")); // sells at 1000
            await CreateAsync(Valid(name: "Big Breaker", categoryId: 1, price: 5000, discount: 0, sku: "BRK-1", brand: "ABB"));

            Assert.Equal(["Cheap Bulb"], (await _products.ListAsync(new ProductQuery(Search: "philips"))).Select(p => p.Name));
            Assert.Equal(["Discounted Panel"], (await _products.ListAsync(new ProductQuery(Search: "PNL"))).Select(p => p.Name));
            Assert.Equal(2, (await _products.ListAsync(new ProductQuery(CategoryId: 4))).Count);

            // Max 1500 matches the 2000 panel because its selling price is 1000.
            Assert.Equal(["Cheap Bulb", "Discounted Panel"],
                (await _products.ListAsync(new ProductQuery(MaxPrice: 1500, Sort: "price_asc"))).Select(p => p.Name));
            Assert.Equal(["Big Breaker", "Discounted Panel", "Cheap Bulb"],
                (await _products.ListAsync(new ProductQuery(Sort: "price_desc"))).Select(p => p.Name));
            Assert.Equal(["Big Breaker", "Cheap Bulb", "Discounted Panel"],
                (await _products.ListAsync(new ProductQuery(Sort: "name"))).Select(p => p.Name));
        }

        [Fact]
        public async Task Categories_are_seeded()
        {
            var categories = await _products.GetCategoriesAsync();
            Assert.Equal(6, categories.Count);
            Assert.Equal("Circuit Breakers", categories[0].Name);
        }
    }
}
