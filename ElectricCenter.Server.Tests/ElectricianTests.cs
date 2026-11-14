using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using ElectricCenter.Server.Auth;
using ElectricCenter.Server.Contracts;
using ElectricCenter.Server.Electricians;
using Microsoft.EntityFrameworkCore;

namespace ElectricCenter.Server.Tests
{
    public class ElectricianServiceTests : IDisposable
    {
        private static readonly Guid AdminId = Guid.NewGuid();
        private readonly AuthTestContext _ctx = new();
        private readonly ElectricianService _electricians;

        public ElectricianServiceTests() => _electricians = new ElectricianService(_ctx.Db, _ctx.Time);

        public void Dispose() => _ctx.Dispose();

        private static ElectricianInput Valid(string name = "Udhav Mainali", decimal rate = 1000, string? demand = null, List<string>? specialties = null) =>
            new(name, "https://example.com/udhav.jpg", "Kumarigal, Kathmandu", 20, true, rate, "service", demand,
                "+977 984-144-5050", "Electrician and contractor with 20 years of experience.",
                specialties ?? ["house wiring", "Panel Upgrades"],
                [new PastWorkInput("Full home rewiring", "Rewired a 3-storey house.", null, new DateOnly(2025, 6, 12)), new PastWorkInput("", "", "", null)]);

        private async Task<Data.Entities.Electrician> CreateAsync(ElectricianInput input)
        {
            var result = await _electricians.CreateAsync(input, AdminId);
            Assert.True(result.Succeeded, result.Message);
            return result.Value!;
        }

        [Fact]
        public async Task Create_normalizes_phone_specialties_and_drops_empty_past_work_rows()
        {
            var electrician = await CreateAsync(Valid());

            Assert.Equal("+9779841445050", electrician.WhatsAppNumber);
            Assert.Equal(["House Wiring", "Panel Upgrades"], electrician.Specialties.Select(s => s.Specialty).Order());
            Assert.Equal("Full home rewiring", Assert.Single(electrician.PastWorks).Title);
            Assert.Equal(AdminId, electrician.CreatedByUserId);
        }

        public static TheoryData<ElectricianInput, string> InvalidInputs => new()
        {
            { Valid() with { Name = "" }, "Name is required" },
            { Valid() with { Location = " " }, "Location is required" },
            { Valid() with { YearsExperience = 80 }, "experience" },
            { Valid() with { RateAmount = 0 }, "greater than 0" },
            { Valid() with { RateUnit = "day" }, "Rate unit" },
            { Valid() with { Demand = "Busy" }, "Availability" },
            { Valid() with { WhatsAppNumber = "9841445050" }, "country code" },
            { Valid() with { Specialties = [] }, "at least one specialty" },
            { Valid() with { Specialties = ["Plumbing"] }, "Unknown specialty" },
            { Valid() with { PhotoUrl = "ftp://x/y.jpg" }, "Photo URL" },
            { Valid() with { PastWorks = [new PastWorkInput("", "Has text but no title", null, null)] }, "needs a title" },
            { Valid() with { PastWorks = [new PastWorkInput("Future", null, null, new DateOnly(2030, 1, 1))] }, "future" },
        };

        [Theory]
        [MemberData(nameof(InvalidInputs))]
        public async Task Create_rejects_invalid_input(ElectricianInput input, string expectedMessage)
        {
            var result = await _electricians.CreateAsync(input, AdminId);

            Assert.Equal(ServiceError.Validation, result.Error);
            Assert.Contains(expectedMessage, result.Message, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public async Task Update_requires_the_current_version_and_replaces_specialties()
        {
            var created = await CreateAsync(Valid());

            Assert.Equal(ServiceError.Conflict, (await _electricians.UpdateAsync(created.Id, Valid(), Guid.NewGuid(), AdminId)).Error);

            var updated = await _electricians.UpdateAsync(created.Id, Valid(rate: 1200, specialties: ["Smart Home"]), created.Version, AdminId);
            Assert.True(updated.Succeeded, updated.Message);
            Assert.Equal(1200, updated.Value!.RateAmount);
            Assert.Equal(["Smart Home"], updated.Value.Specialties.Select(s => s.Specialty));
            Assert.NotEqual(created.Version, updated.Value.Version);
        }

        [Fact]
        public async Task Delete_is_soft_and_restore_brings_the_electrician_back()
        {
            var electrician = await CreateAsync(Valid());

            Assert.True((await _electricians.DeleteAsync(electrician.Id, AdminId)).Succeeded);
            Assert.Empty(await _electricians.ListAsync(new ElectricianQuery()));
            Assert.Null(await _electricians.GetAsync(electrician.Id, includeDeleted: false));

            await using (var db = _ctx.CreateDbContext())
            {
                var row = await db.Electricians.IgnoreQueryFilters().Include(e => e.Specialties).SingleAsync(e => e.Id == electrician.Id);
                Assert.True(row.IsDeleted);
                Assert.Equal(AdminId, row.DeletedByUserId);
                Assert.Equal(2, row.Specialties.Count); // child rows kept too
            }

            Assert.True((await _electricians.RestoreAsync(electrician.Id, AdminId)).Succeeded);
            Assert.Single(await _electricians.ListAsync(new ElectricianQuery()));
        }

        [Fact]
        public async Task Removing_an_electrician_through_ef_never_hard_deletes_it()
        {
            var electrician = await CreateAsync(Valid());

            await using (var db = _ctx.CreateDbContext())
            {
                db.Electricians.Remove(await db.Electricians.SingleAsync(e => e.Id == electrician.Id));
                await db.SaveChangesAsync();
            }

            await using var check = _ctx.CreateDbContext();
            Assert.True((await check.Electricians.IgnoreQueryFilters().SingleAsync(e => e.Id == electrician.Id)).IsDeleted);
        }

        [Fact]
        public async Task List_filters_by_search_and_specialty_and_sorts()
        {
            await CreateAsync(Valid(name: "Asha", rate: 800, demand: "High", specialties: ["Smart Home"]));
            await CreateAsync(Valid(name: "Bikash", rate: 500, demand: "Low", specialties: ["House Wiring"]));
            await CreateAsync(Valid(name: "Chandra", rate: 1500, demand: null, specialties: ["House Wiring", "Smart Home"]));

            Assert.Equal(["Bikash", "Chandra"], (await _electricians.ListAsync(new ElectricianQuery(Specialty: "house wiring"))).Select(e => e.Name));
            Assert.Equal(["Asha", "Chandra"], (await _electricians.ListAsync(new ElectricianQuery(Search: "smart"))).Select(e => e.Name));
            Assert.Equal(["Bikash", "Asha", "Chandra"], (await _electricians.ListAsync(new ElectricianQuery(Sort: "price_asc"))).Select(e => e.Name));
            // Most available first: Low, (Medium), High, unknown last.
            Assert.Equal(["Bikash", "Asha", "Chandra"], (await _electricians.ListAsync(new ElectricianQuery(Sort: "availability"))).Select(e => e.Name));
        }
    }

    public class ElectricianApiTests(AuthApiFactory factory) : IClassFixture<AuthApiFactory>, IAsyncLifetime
    {
        private const string Password = "integration password";

        public Task InitializeAsync() => factory.EnsureDatabaseAsync();
        public Task DisposeAsync() => Task.CompletedTask;

        private sealed record ElectricianList(List<ElectricianDto> Items, int Total);

        private static SaveElectricianRequest NewElectrician(string name = "Udhav Mainali", Guid? version = null) =>
            new(name, null, "Kumarigal, Kathmandu", 20, true, new RateDto(1000, "service"), null, "+9779841445050",
                "Electrician and contractor.", ["House Wiring"], [new PastWorkDto("Rewiring", null, null, new DateOnly(2026, 6, 12))], version);

        private async Task<HttpClient> SignedInClientAsync(params string[] roles)
        {
            var email = $"user-{Guid.NewGuid():N}@example.com";
            await factory.CreateUserAsync(email, Password, verified: true, roles);
            var client = factory.CreateSpaClient();
            var login = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, Password));
            Assert.Equal(HttpStatusCode.OK, login.StatusCode);
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", (await login.Content.ReadFromJsonAsync<AuthResponse>())!.AccessToken);
            return client;
        }

        [Fact]
        public async Task Anyone_can_browse_electricians_and_specialties()
        {
            var anonymous = factory.CreateSpaClient();
            Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync("/api/electricians")).StatusCode);
            Assert.Equal(11, (await anonymous.GetFromJsonAsync<List<string>>("/api/electricians/specialties"))!.Count);
        }

        [Fact]
        public async Task Only_admins_can_write()
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateSpaClient().PostAsJsonAsync("/api/electricians", NewElectrician())).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await (await SignedInClientAsync(Roles.Customer)).PostAsJsonAsync("/api/electricians", NewElectrician())).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await (await SignedInClientAsync(Roles.Electrician)).PostAsJsonAsync("/api/electricians", NewElectrician())).StatusCode);
        }

        [Fact]
        public async Task Admin_crud_round_trip_with_soft_delete_and_restore()
        {
            var admin = await SignedInClientAsync(Roles.Admin);
            var publicClient = factory.CreateSpaClient();

            var created = await admin.PostAsJsonAsync("/api/electricians", NewElectrician());
            Assert.Equal(HttpStatusCode.Created, created.StatusCode);
            var electrician = (await created.Content.ReadFromJsonAsync<ElectricianDto>())!;
            Assert.Equal("service", electrician.Rate.Unit);
            Assert.Equal(new DateOnly(2026, 6, 12), Assert.Single(electrician.PastWorks).Date);

            Assert.Equal(HttpStatusCode.Conflict, (await admin.PutAsJsonAsync($"/api/electricians/{electrician.Id}", NewElectrician("X", Guid.NewGuid()))).StatusCode);
            var updated = await admin.PutAsJsonAsync($"/api/electricians/{electrician.Id}", NewElectrician("Udhav M.", electrician.Version));
            Assert.Equal("Udhav M.", (await updated.Content.ReadFromJsonAsync<ElectricianDto>())!.Name);

            Assert.Equal(HttpStatusCode.OK, (await admin.DeleteAsync($"/api/electricians/{electrician.Id}")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await publicClient.GetAsync($"/api/electricians/{electrician.Id}")).StatusCode);
            Assert.DoesNotContain((await publicClient.GetFromJsonAsync<ElectricianList>("/api/electricians?includeDeleted=true"))!.Items, e => e.Id == electrician.Id);
            Assert.Contains((await admin.GetFromJsonAsync<ElectricianList>("/api/electricians?includeDeleted=true"))!.Items, e => e.Id == electrician.Id && e.IsDeleted);

            Assert.Equal(HttpStatusCode.OK, (await admin.PostAsync($"/api/electricians/{electrician.Id}/restore", null)).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await publicClient.GetAsync($"/api/electricians/{electrician.Id}")).StatusCode);
        }

        [Fact]
        public async Task WhatsApp_notify_resolves_the_recipient_from_the_electrician_id()
        {
            var customer = await SignedInClientAsync(Roles.Customer);
            var booking = new { customerPhone = "+9779800000000", location = "Kumarigal", problem = "Lights flickering" };

            // Unknown electrician: refused before anything is sent.
            Assert.Equal(HttpStatusCode.NotFound, (await customer.PostAsJsonAsync("/api/whatsapp/notify", new { electricianId = 999999, booking })).StatusCode);

            var admin = await SignedInClientAsync(Roles.Admin);
            var electrician = (await (await admin.PostAsJsonAsync("/api/electricians", NewElectrician())).Content.ReadFromJsonAsync<ElectricianDto>())!;

            // Known electrician but WhatsApp Cloud API isn't configured in tests: 503 → client falls back to click-to-chat.
            Assert.Equal(HttpStatusCode.ServiceUnavailable, (await customer.PostAsJsonAsync("/api/whatsapp/notify", new { electricianId = electrician.Id, booking })).StatusCode);
        }
    }
}
