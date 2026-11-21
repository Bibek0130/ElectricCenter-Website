using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using ElectricCenter.Server.Auth;
using ElectricCenter.Server.Contracts;
using ElectricCenter.Server.Data.Entities;
using ElectricCenter.Server.Products;
using ElectricCenter.Server.Settings;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ElectricCenter.Server.Tests
{
    public class SiteSettingsServiceTests : IDisposable
    {
        private static readonly Guid AdminId = Guid.NewGuid();
        private readonly AuthTestContext _ctx = new();
        private readonly SiteSettingsService _settings;

        public SiteSettingsServiceTests() => _settings = new SiteSettingsService(_ctx.Db, _ctx.Time);

        public void Dispose() => _ctx.Dispose();

        [Fact]
        public async Task Prices_are_shown_until_an_admin_turns_them_off()
        {
            var settings = await _settings.GetAsync();

            Assert.True(settings.ShowPrice);
            Assert.Null(settings.UpdatedAtUtc);
        }

        [Fact]
        public async Task Update_saves_the_switch_and_records_who_changed_it_and_when()
        {
            var result = await _settings.UpdateAsync(new SiteSettingsInput(false), AdminId);

            Assert.True(result.Succeeded, result.Message);
            Assert.False(result.Value!.ShowPrice);

            var saved = await _ctx.CreateDbContext().Settings.SingleAsync();
            Assert.False(saved.ShowPrice);
            Assert.Equal(AdminId, saved.UpdatedByUserId);
            Assert.Equal(_ctx.Time.GetUtcNow().UtcDateTime, saved.UpdatedAtUtc);

            Assert.False((await _settings.GetAsync()).ShowPrice);
            Assert.True((await _settings.UpdateAsync(new SiteSettingsInput(true), AdminId)).Value!.ShowPrice);
        }

        [Fact]
        public async Task Update_rejects_a_missing_value_instead_of_treating_it_as_false()
        {
            var result = await _settings.UpdateAsync(new SiteSettingsInput(null), AdminId);

            Assert.False(result.Succeeded);
            Assert.Equal(ServiceError.Validation, result.Error);
            Assert.True((await _settings.GetAsync()).ShowPrice);
        }

        [Fact]
        public async Task A_missing_settings_row_falls_back_to_the_defaults_and_is_recreated_on_update()
        {
            await _ctx.Db.Settings.ExecuteDeleteAsync();

            Assert.True((await _settings.GetAsync()).ShowPrice);

            var result = await _settings.UpdateAsync(new SiteSettingsInput(false), AdminId);

            Assert.True(result.Succeeded, result.Message);
            Assert.False((await _settings.GetAsync()).ShowPrice);
            Assert.Equal(1, await _ctx.Db.Settings.CountAsync());
        }
    }

    public class ProductQueryTests
    {
        [Fact]
        public void WithoutPriceRules_drops_price_filters_and_price_sorts_but_keeps_everything_else()
        {
            var query = new ProductQuery("mcb", 2, 100, 5000, "price_desc", IncludeDeleted: true).WithoutPriceRules();

            Assert.Null(query.MinPrice);
            Assert.Null(query.MaxPrice);
            Assert.Null(query.Sort);
            Assert.Equal("mcb", query.Search);
            Assert.Equal(2, query.CategoryId);
            Assert.True(query.IncludeDeleted);
        }

        [Theory]
        [InlineData("price_asc", null)]
        [InlineData("price_desc", null)]
        [InlineData("name", "name")]
        [InlineData(null, null)]
        public void WithoutPriceRules_only_removes_price_based_sorts(string? sort, string? expected) =>
            Assert.Equal(expected, new ProductQuery(Sort: sort).WithoutPriceRules().Sort);
    }

    public class PriceVisibilityApiTests(AuthApiFactory factory) : IClassFixture<AuthApiFactory>, IAsyncLifetime
    {
        private const string Password = "integration password";

        // Each test class gets its own in-memory database, but the tests inside one class share it,
        // so every test starts from the default (prices shown).
        public async Task InitializeAsync()
        {
            await factory.EnsureDatabaseAsync();
            await SetShowPriceDirectlyAsync(true);
        }

        public Task DisposeAsync() => Task.CompletedTask;

        private sealed record ProductList(List<ProductDto> Items, int Total);

        private async Task SetShowPriceDirectlyAsync(bool value)
        {
            using var scope = factory.Services.CreateScope();
            var result = await scope.ServiceProvider.GetRequiredService<ISiteSettingsService>()
                .UpdateAsync(new SiteSettingsInput(value), Guid.NewGuid());
            Assert.True(result.Succeeded, result.Message);
        }

        private async Task<HttpClient> SignedInClientAsync(params string[] roles)
        {
            var email = $"user-{Guid.NewGuid():N}@example.com";
            await factory.CreateUserAsync(email, Password, verified: true, roles);
            var client = factory.CreateSpaClient();
            var login = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, Password));
            Assert.Equal(HttpStatusCode.OK, login.StatusCode);
            var token = (await login.Content.ReadFromJsonAsync<AuthResponse>())!.AccessToken;
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            return client;
        }

        private static async Task<ProductDto> CreateProductAsync(HttpClient admin, string name, decimal price, int discount = 0)
        {
            var sku = $"T-{Guid.NewGuid():N}"[..20];
            var body = new SaveProductRequest(name, 1, price, discount, 5, "Brand", sku, "Short description", null, false, null, new(), null);
            var response = await admin.PostAsJsonAsync("/api/products", body);
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            return (await response.Content.ReadFromJsonAsync<ProductDto>())!;
        }

        [Fact]
        public async Task Anyone_can_read_the_settings_and_prices_are_on_by_default()
        {
            var anonymous = factory.CreateSpaClient();

            var response = await anonymous.GetAsync("/api/settings");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.True((await response.Content.ReadFromJsonAsync<SiteSettingsDto>())!.ShowPrice);
            Assert.True(response.Headers.CacheControl?.NoStore);
        }

        [Fact]
        public async Task Only_admins_can_change_the_settings()
        {
            var body = new UpdateSiteSettingsRequest(false);
            var anonymous = factory.CreateSpaClient();
            var customer = await SignedInClientAsync(Roles.Customer);
            var electrician = await SignedInClientAsync(Roles.Electrician);
            var admin = await SignedInClientAsync(Roles.Admin);

            Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PutAsJsonAsync("/api/settings", body)).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await customer.PutAsJsonAsync("/api/settings", body)).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await electrician.PutAsJsonAsync("/api/settings", body)).StatusCode);
            Assert.True((await anonymous.GetFromJsonAsync<SiteSettingsDto>("/api/settings"))!.ShowPrice);

            var updated = await admin.PutAsJsonAsync("/api/settings", body);

            Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
            Assert.False((await updated.Content.ReadFromJsonAsync<SiteSettingsDto>())!.ShowPrice);
            Assert.False((await anonymous.GetFromJsonAsync<SiteSettingsDto>("/api/settings"))!.ShowPrice);
        }

        [Fact]
        public async Task A_body_without_showPrice_is_rejected_and_changes_nothing()
        {
            var admin = await SignedInClientAsync(Roles.Admin);

            var response = await admin.PutAsJsonAsync("/api/settings", new { });

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Contains("showPrice", await response.Content.ReadAsStringAsync());
            Assert.True((await factory.CreateSpaClient().GetFromJsonAsync<SiteSettingsDto>("/api/settings"))!.ShowPrice);
        }

        [Fact]
        public async Task With_prices_on_everyone_sees_price_and_discount()
        {
            var admin = await SignedInClientAsync(Roles.Admin);
            var product = await CreateProductAsync(admin, "Priced MCB", 1000, discount: 10);
            var anonymous = factory.CreateSpaClient();

            var single = await anonymous.GetFromJsonAsync<ProductDto>($"/api/products/{product.Id}");
            var list = await anonymous.GetFromJsonAsync<ProductList>("/api/products?search=Priced MCB");

            Assert.Equal(1000m, single!.Price);
            Assert.Equal(10, single.DiscountPercent);
            Assert.Equal(1000m, list!.Items.Single(p => p.Id == product.Id).Price);
        }

        [Fact]
        public async Task With_prices_off_the_public_gets_no_price_or_discount_but_admins_still_do()
        {
            var admin = await SignedInClientAsync(Roles.Admin);
            var customer = await SignedInClientAsync(Roles.Customer);
            var anonymous = factory.CreateSpaClient();
            var product = await CreateProductAsync(admin, "Hidden Price MCB", 1000, discount: 10);

            await SetShowPriceDirectlyAsync(false);

            foreach (var client in new[] { anonymous, customer })
            {
                var single = await client.GetFromJsonAsync<ProductDto>($"/api/products/{product.Id}");
                var listed = (await client.GetFromJsonAsync<ProductList>("/api/products?search=Hidden Price MCB"))!.Items.Single(p => p.Id == product.Id);

                foreach (var dto in new[] { single!, listed })
                {
                    Assert.Null(dto.Price);
                    Assert.Equal(0, dto.DiscountPercent);
                    Assert.Equal("Hidden Price MCB", dto.Name); // everything else is still served
                }
            }

            // The raw JSON must not carry the value anywhere, not just deserialize to null.
            var rawList = await anonymous.GetStringAsync("/api/products?search=Hidden Price MCB");
            Assert.DoesNotContain("1000", rawList);

            // Admins keep the price (the edit form needs it) ...
            var adminView = await admin.GetFromJsonAsync<ProductDto>($"/api/products/{product.Id}");
            Assert.Equal(1000m, adminView!.Price);
            Assert.Equal(10, adminView.DiscountPercent);
            var adminListed = (await admin.GetFromJsonAsync<ProductList>("/api/products?search=Hidden Price MCB"))!.Items.Single(p => p.Id == product.Id);
            Assert.Equal(1000m, adminListed.Price);

            // ... and can still save a product while prices are hidden from customers.
            var update = new SaveProductRequest("Hidden Price MCB", 1, 1200, 10, 5, "Brand", adminView.Sku, "Short description", null, false, null, new(), adminView.Version);
            var saved = await admin.PutAsJsonAsync($"/api/products/{product.Id}", update);
            Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
            Assert.Equal(1200m, (await saved.Content.ReadFromJsonAsync<ProductDto>())!.Price);
        }

        [Fact]
        public async Task Turning_prices_back_on_restores_them_straight_away()
        {
            var admin = await SignedInClientAsync(Roles.Admin);
            var anonymous = factory.CreateSpaClient();
            var product = await CreateProductAsync(admin, "Toggle MCB", 750);

            Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync("/api/settings", new UpdateSiteSettingsRequest(false))).StatusCode);
            Assert.Null((await anonymous.GetFromJsonAsync<ProductDto>($"/api/products/{product.Id}"))!.Price);

            Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync("/api/settings", new UpdateSiteSettingsRequest(true))).StatusCode);
            Assert.Equal(750m, (await anonymous.GetFromJsonAsync<ProductDto>($"/api/products/{product.Id}"))!.Price);
        }

        [Fact]
        public async Task Hidden_prices_cannot_be_worked_out_from_the_price_filter_or_sort()
        {
            var admin = await SignedInClientAsync(Roles.Admin);
            var anonymous = factory.CreateSpaClient();
            var token = $"Probe{Guid.NewGuid():N}"[..14];
            var cheap = await CreateProductAsync(admin, $"{token} cheap", 100);
            var dear = await CreateProductAsync(admin, $"{token} dear", 5000);

            async Task<List<int>> IdsAsync(string query) =>
                (await anonymous.GetFromJsonAsync<ProductList>($"/api/products?search={token}&{query}"))!.Items.Select(p => p.Id).ToList();

            // While prices are shown the filter works: only the expensive one is at least Rs 4,000.
            Assert.Equal([dear.Id], await IdsAsync("minPrice=4000"));
            Assert.Equal([cheap.Id, dear.Id], await IdsAsync("sort=price_asc"));
            Assert.Equal([dear.Id, cheap.Id], await IdsAsync("sort=price_desc"));

            await SetShowPriceDirectlyAsync(false);

            // Once hidden, the filter and the price sorts are ignored: a probe like minPrice=4000 learns nothing.
            var unfiltered = await IdsAsync("sort=default");
            Assert.Equal(2, unfiltered.Count);
            Assert.Equal(unfiltered, await IdsAsync("minPrice=4000"));
            Assert.Equal(unfiltered, await IdsAsync("maxPrice=200"));
            Assert.Equal(unfiltered, await IdsAsync("sort=price_asc"));
            Assert.Equal(unfiltered, await IdsAsync("sort=price_desc"));
        }
    }
}
