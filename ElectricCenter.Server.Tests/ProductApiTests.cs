using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using ElectricCenter.Server.Auth;
using ElectricCenter.Server.Contracts;

namespace ElectricCenter.Server.Tests
{
    public class ProductApiTests(AuthApiFactory factory) : IClassFixture<AuthApiFactory>, IAsyncLifetime
    {
        private const string Password = "integration password";

        public Task InitializeAsync() => factory.EnsureDatabaseAsync();
        public Task DisposeAsync() => Task.CompletedTask;

        private sealed record ProductList(List<ProductDto> Items, int Total);

        private static SaveProductRequest NewProduct(string sku, Guid? version = null, string name = "Test MCB") =>
            new(name, 1, 1000, 10, 5, "Brand", sku, "Short description", null, false, null, new() { ["Rating"] = "16A" }, version);

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

        private static string NewSku() => $"T-{Guid.NewGuid():N}"[..20];

        [Fact]
        public async Task Anyone_can_browse_products_and_categories()
        {
            var anonymous = factory.CreateSpaClient();

            Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync("/api/products")).StatusCode);
            var categories = await anonymous.GetFromJsonAsync<List<CategoryDto>>("/api/categories");
            Assert.Equal(6, categories!.Count);
        }

        [Fact]
        public async Task Only_admins_can_create_update_delete_or_restore()
        {
            var anonymous = factory.CreateSpaClient();
            var customer = await SignedInClientAsync(Roles.Customer);
            var electrician = await SignedInClientAsync(Roles.Electrician);

            Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsJsonAsync("/api/products", NewProduct(NewSku()))).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await customer.PostAsJsonAsync("/api/products", NewProduct(NewSku()))).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await electrician.PostAsJsonAsync("/api/products", NewProduct(NewSku()))).StatusCode);

            var admin = await SignedInClientAsync(Roles.Admin);
            var created = await admin.PostAsJsonAsync("/api/products", NewProduct(NewSku()));
            Assert.Equal(HttpStatusCode.Created, created.StatusCode);
            var product = (await created.Content.ReadFromJsonAsync<ProductDto>())!;

            Assert.Equal(HttpStatusCode.Forbidden, (await customer.PutAsJsonAsync($"/api/products/{product.Id}", NewProduct(product.Sku!, product.Version))).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await customer.DeleteAsync($"/api/products/{product.Id}")).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await customer.PostAsync($"/api/products/{product.Id}/restore", null)).StatusCode);
        }

        [Fact]
        public async Task Admin_crud_round_trip_with_soft_delete_and_restore()
        {
            var admin = await SignedInClientAsync(Roles.Admin);
            var publicClient = factory.CreateSpaClient();

            var product = (await (await admin.PostAsJsonAsync("/api/products", NewProduct(NewSku()))).Content.ReadFromJsonAsync<ProductDto>())!;
            Assert.Equal(HttpStatusCode.OK, (await publicClient.GetAsync($"/api/products/{product.Id}")).StatusCode);

            // Update: stale version is a 409, current version succeeds.
            var stale = await admin.PutAsJsonAsync($"/api/products/{product.Id}", NewProduct(product.Sku!, Guid.NewGuid(), "Renamed"));
            Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
            var updated = await admin.PutAsJsonAsync($"/api/products/{product.Id}", NewProduct(product.Sku!, product.Version, "Renamed"));
            Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
            Assert.Equal("Renamed", (await updated.Content.ReadFromJsonAsync<ProductDto>())!.Name);

            // Soft delete: gone for the public, still visible to admins with includeDeleted.
            var deleted = await admin.DeleteAsync($"/api/products/{product.Id}");
            Assert.Equal(HttpStatusCode.OK, deleted.StatusCode);
            Assert.True((await deleted.Content.ReadFromJsonAsync<ProductDto>())!.IsDeleted);
            Assert.Equal(HttpStatusCode.NotFound, (await publicClient.GetAsync($"/api/products/{product.Id}")).StatusCode);

            var publicList = await publicClient.GetFromJsonAsync<ProductList>("/api/products?includeDeleted=true");
            Assert.DoesNotContain(publicList!.Items, p => p.Id == product.Id); // flag ignored for non-admins
            var adminList = await admin.GetFromJsonAsync<ProductList>("/api/products?includeDeleted=true");
            Assert.Contains(adminList!.Items, p => p.Id == product.Id && p.IsDeleted);

            // Restore.
            Assert.Equal(HttpStatusCode.OK, (await admin.PostAsync($"/api/products/{product.Id}/restore", null)).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await publicClient.GetAsync($"/api/products/{product.Id}")).StatusCode);
        }

        [Fact]
        public async Task Validation_errors_come_back_as_400_with_a_message()
        {
            var admin = await SignedInClientAsync(Roles.Admin);

            var response = await admin.PostAsJsonAsync("/api/products", NewProduct(NewSku()) with { Price = -5 });

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Contains("Price", await response.Content.ReadAsStringAsync());
        }
    }
}
