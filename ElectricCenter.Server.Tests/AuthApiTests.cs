using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using ElectricCenter.Server.Auth;
using ElectricCenter.Server.Contracts;
using ElectricCenter.Server.Data;
using ElectricCenter.Server.Services.Email.Interface;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace ElectricCenter.Server.Tests
{
    /// <summary>
    /// Runs the real ASP.NET pipeline (routing, JwtBearer, authorization, rate limiting, cookies)
    /// with the MySQL DbContext swapped for SQLite in-memory and email captured instead of sent.
    /// </summary>
    public class AuthApiFactory : WebApplicationFactory<Program>
    {
        private readonly SqliteConnection _connection = new("DataSource=:memory:");

        public CapturingEmailSender Email { get; } = new();

        protected virtual int AuthStrictPerMinute => 1000;

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            _connection.Open();

            // "Testing" (not Development) so the developer's user-secrets aren't loaded.
            builder.UseEnvironment("Testing");
            builder.UseSetting("ConnectionStrings:Default", "Server=unused-in-tests");
            builder.UseSetting("Database:MigrateOnStartup", "false");
            builder.UseSetting("Jwt:SigningKey", AuthTestContext.SigningKey);
            builder.UseSetting("RateLimiting:AuthStrictPerMinute", AuthStrictPerMinute.ToString());
            builder.UseSetting("RateLimiting:AuthRefreshPerMinute", "1000");
            builder.UseSetting("EmailVerification:MaxEmailsPerAddressPerHour", "1000");

            builder.ConfigureTestServices(services =>
            {
                var efRegistrations = services.Where(d =>
                    d.ServiceType == typeof(DbContextOptions<AppDbContext>)
                    || d.ServiceType == typeof(DbContextOptions)
                    || (d.ServiceType.IsGenericType
                        && d.ServiceType.GetGenericTypeDefinition() == typeof(IDbContextOptionsConfiguration<>)
                        && d.ServiceType.GenericTypeArguments[0] == typeof(AppDbContext))).ToList();
                foreach (var descriptor in efRegistrations) services.Remove(descriptor);

                services.AddDbContext<AppDbContext>(o => o.UseSqlite(_connection));
                services.AddSingleton<IPasswordHasher>(new BcryptPasswordHasher(workFactor: 4));
                services.AddSingleton<IEmailSender>(Email);
            });
        }

        protected override void ConfigureClient(HttpClient client)
        {
            base.ConfigureClient(client);
            client.DefaultRequestHeaders.Add(RequireSpaHeaderAttribute.HeaderName, "XMLHttpRequest");
        }

        /// <summary>HTTPS base address so the Secure refresh cookie is stored and sent back.</summary>
        public HttpClient CreateSpaClient() => CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            HandleCookies = true,
            AllowAutoRedirect = false,
        });

        public async Task EnsureDatabaseAsync()
        {
            using var scope = Services.CreateScope();
            await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.EnsureCreatedAsync();
        }

        /// <summary>Creates an account directly (admin-style). Pass verified=true to skip the first-login OTP.</summary>
        public async Task CreateUserAsync(string email, string password, bool verified, params string[] roles)
        {
            using var scope = Services.CreateScope();
            var users = scope.ServiceProvider.GetRequiredService<IUserManagementService>();
            var result = await users.CreateAsync("Seeded User", email, null, password, roles);
            Assert.True(result.Succeeded, result.Message);
            if (verified)
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                await db.Users.Where(u => u.Email == email).ExecuteUpdateAsync(s => s.SetProperty(u => u.EmailConfirmed, true));
            }
        }

        protected override void Dispose(bool disposing)
        {
            base.Dispose(disposing);
            if (disposing) _connection.Dispose();
        }
    }

    public class LowRateLimitAuthApiFactory : AuthApiFactory
    {
        protected override int AuthStrictPerMinute => 3;
    }

    public class AuthApiTests(AuthApiFactory factory) : IClassFixture<AuthApiFactory>, IAsyncLifetime
    {
        private const string Password = "integration password";

        public Task InitializeAsync() => factory.EnsureDatabaseAsync();
        public Task DisposeAsync() => Task.CompletedTask;

        private static string NewEmail() => $"user-{Guid.NewGuid():N}@example.com";

        private static async Task<AuthResponse> ReadAuthAsync(HttpResponseMessage response)
        {
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return (await response.Content.ReadFromJsonAsync<AuthResponse>())!;
        }

        private static HttpRequestMessage WithBearer(HttpMethod method, string url, string token)
        {
            var request = new HttpRequestMessage(method, url);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            return request;
        }

        private static async Task<VerificationRequiredResponse> StartRegistrationAsync(HttpClient client, string email, string name = "New Customer")
        {
            var response = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(name, email, null, Password));
            Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
            return (await response.Content.ReadFromJsonAsync<VerificationRequiredResponse>())!;
        }

        /// <summary>Register + verify through the API; returns the verify-email response (which carries the session).</summary>
        private async Task<HttpResponseMessage> RegisterAndVerifyAsync(HttpClient client, string email, string name = "New Customer")
        {
            var started = await StartRegistrationAsync(client, email, name);
            return await client.PostAsJsonAsync("/api/auth/verify-email",
                new VerifyEmailRequest(started.Verification.VerificationId, factory.Email.LastCodeFor(email)));
        }

        [Fact]
        public async Task Register_sends_a_code_and_returns_no_tokens_or_cookie()
        {
            var email = NewEmail();
            var response = await factory.CreateSpaClient().PostAsJsonAsync("/api/auth/register", new RegisterRequest("New Customer", email, null, Password));

            Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
            Assert.False(response.Headers.Contains("Set-Cookie"));
            var body = (await response.Content.ReadFromJsonAsync<VerificationRequiredResponse>())!;
            Assert.Equal(VerificationRequiredResponse.VerificationSent, body.Code);
            Assert.Equal(email, body.Verification.Email);
            Assert.DoesNotContain(factory.Email.LastCodeFor(email), await response.Content.ReadAsStringAsync());
        }

        [Fact]
        public async Task Verify_email_signs_in_with_access_token_in_body_and_refresh_token_only_in_a_locked_down_cookie()
        {
            var response = await RegisterAndVerifyAsync(factory.CreateSpaClient(), NewEmail());
            var body = await ReadAuthAsync(response);

            Assert.False(string.IsNullOrEmpty(body.AccessToken));
            Assert.Equal([Roles.Customer], body.User.Roles);

            var cookie = Assert.Single(response.Headers.GetValues("Set-Cookie"));
            Assert.StartsWith($"{RefreshTokenCookie.Name}=", cookie);
            Assert.Contains("path=/api/auth", cookie, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("secure", cookie, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("samesite=strict", cookie, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("refresh", await response.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public async Task Wrong_code_is_rejected_and_resend_is_throttled()
        {
            var client = factory.CreateSpaClient();
            var email = NewEmail();
            var started = await StartRegistrationAsync(client, email);
            var code = factory.Email.LastCodeFor(email);
            var wrong = code == "000000" ? "111111" : "000000";

            var badVerify = await client.PostAsJsonAsync("/api/auth/verify-email", new VerifyEmailRequest(started.Verification.VerificationId, wrong));
            Assert.Equal(HttpStatusCode.BadRequest, badVerify.StatusCode);
            Assert.Contains("incorrect", await badVerify.Content.ReadAsStringAsync());

            var resend = await client.PostAsJsonAsync("/api/auth/resend-verification", new ResendVerificationRequest(started.Verification.VerificationId));
            Assert.Equal(HttpStatusCode.TooManyRequests, resend.StatusCode);

            Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/auth/verify-email", new VerifyEmailRequest(started.Verification.VerificationId, code))).StatusCode);
        }

        [Fact]
        public async Task Registering_an_existing_email_is_a_conflict()
        {
            var email = NewEmail();
            await ReadAuthAsync(await RegisterAndVerifyAsync(factory.CreateSpaClient(), email));

            var again = await factory.CreateSpaClient().PostAsJsonAsync("/api/auth/register", new RegisterRequest("Again", email, null, Password));

            Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
        }

        [Fact]
        public async Task Unverified_account_login_returns_403_with_a_challenge_then_verifies_and_signs_in()
        {
            var email = NewEmail();
            await factory.CreateUserAsync(email, Password, verified: false, Roles.Electrician);
            var client = factory.CreateSpaClient();

            var login = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, Password));
            Assert.Equal(HttpStatusCode.Forbidden, login.StatusCode);
            Assert.False(login.Headers.Contains("Set-Cookie"));
            var challenge = (await login.Content.ReadFromJsonAsync<VerificationRequiredResponse>())!;
            Assert.Equal(VerificationRequiredResponse.EmailNotVerified, challenge.Code);

            var verified = await ReadAuthAsync(await client.PostAsJsonAsync("/api/auth/verify-email",
                new VerifyEmailRequest(challenge.Verification.VerificationId, factory.Email.LastCodeFor(email))));
            Assert.Equal([Roles.Electrician], verified.User.Roles);

            // Verified now, so the next login signs straight in.
            await ReadAuthAsync(await factory.CreateSpaClient().PostAsJsonAsync("/api/auth/login", new LoginRequest(email, Password)));
        }

        [Fact]
        public async Task Me_requires_a_valid_bearer_token()
        {
            var client = factory.CreateSpaClient();
            var auth = await ReadAuthAsync(await RegisterAndVerifyAsync(client, NewEmail(), "Me Test"));

            var anonymous = await client.GetAsync("/api/auth/me");
            var forged = await client.SendAsync(WithBearer(HttpMethod.Get, "/api/auth/me", auth.AccessToken[..^4] + "AAAA"));
            var valid = await client.SendAsync(WithBearer(HttpMethod.Get, "/api/auth/me", auth.AccessToken));

            Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, forged.StatusCode);
            Assert.Equal(HttpStatusCode.OK, valid.StatusCode);
            Assert.Equal(auth.User.Email, (await valid.Content.ReadFromJsonAsync<UserDto>())!.Email);
        }

        [Fact]
        public async Task Auth_endpoints_reject_requests_without_the_spa_header()
        {
            var client = factory.CreateSpaClient();
            client.DefaultRequestHeaders.Remove(RequireSpaHeaderAttribute.HeaderName);

            var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest("x@example.com", Password));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task Refresh_uses_the_cookie_and_logout_ends_the_session()
        {
            var client = factory.CreateSpaClient();
            await ReadAuthAsync(await RegisterAndVerifyAsync(client, NewEmail(), "Refresh Test"));

            var refreshed = await ReadAuthAsync(await client.PostAsync("/api/auth/refresh", null));
            Assert.False(string.IsNullOrEmpty(refreshed.AccessToken));

            Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync("/api/auth/logout", null)).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsync("/api/auth/refresh", null)).StatusCode);
        }

        [Fact]
        public async Task Refresh_without_a_cookie_is_unauthorized()
        {
            var response = await factory.CreateSpaClient().PostAsync("/api/auth/refresh", null);
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Wrong_password_is_unauthorized_with_a_generic_message()
        {
            var email = NewEmail();
            await ReadAuthAsync(await RegisterAndVerifyAsync(factory.CreateSpaClient(), email, "Wrong Pw"));

            var response = await factory.CreateSpaClient().PostAsJsonAsync("/api/auth/login", new LoginRequest(email, "not the password"));

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            Assert.Contains("Invalid email or password", await response.Content.ReadAsStringAsync());
        }

        [Fact]
        public async Task Admin_endpoints_are_forbidden_for_customers_and_allowed_for_admins()
        {
            var customerClient = factory.CreateSpaClient();
            var customer = await ReadAuthAsync(await RegisterAndVerifyAsync(customerClient, NewEmail(), "Cust"));
            var forbidden = await customerClient.SendAsync(WithBearer(HttpMethod.Get, "/api/admin/users", customer.AccessToken));
            Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);

            var adminEmail = NewEmail();
            await factory.CreateUserAsync(adminEmail, Password, verified: true, Roles.Admin);
            var adminClient = factory.CreateSpaClient();
            var admin = await ReadAuthAsync(await adminClient.PostAsJsonAsync("/api/auth/login", new LoginRequest(adminEmail, Password)));

            var list = await adminClient.SendAsync(WithBearer(HttpMethod.Get, "/api/admin/users", admin.AccessToken));
            Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        }

        [Fact]
        public async Task Admin_creates_an_electrician_with_multiple_roles_who_verifies_then_receives_both_roles()
        {
            var adminEmail = NewEmail();
            await factory.CreateUserAsync(adminEmail, Password, verified: true, Roles.Admin);
            var adminClient = factory.CreateSpaClient();
            var admin = await ReadAuthAsync(await adminClient.PostAsJsonAsync("/api/auth/login", new LoginRequest(adminEmail, Password)));

            var electricianEmail = NewEmail();
            var create = WithBearer(HttpMethod.Post, "/api/admin/users", admin.AccessToken);
            create.Content = JsonContent.Create(new CreateUserRequest("Udhav Mainali", electricianEmail, "+9779841445050", Password, [Roles.Electrician, Roles.Customer]));
            Assert.Equal(HttpStatusCode.Created, (await adminClient.SendAsync(create)).StatusCode);

            var electricianClient = factory.CreateSpaClient();
            var login = await electricianClient.PostAsJsonAsync("/api/auth/login", new LoginRequest(electricianEmail, Password));
            var challenge = (await login.Content.ReadFromJsonAsync<VerificationRequiredResponse>())!;
            var electrician = await ReadAuthAsync(await electricianClient.PostAsJsonAsync("/api/auth/verify-email",
                new VerifyEmailRequest(challenge.Verification.VerificationId, factory.Email.LastCodeFor(electricianEmail))));

            Assert.Equal([Roles.Customer, Roles.Electrician], electrician.User.Roles);
        }

        [Fact]
        public async Task WhatsApp_notify_requires_a_signed_in_user()
        {
            var response = await factory.CreateSpaClient().PostAsJsonAsync("/api/whatsapp/notify", new { to = "+9779800000000" });
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Email_test_endpoint_is_admin_only()
        {
            var response = await factory.CreateSpaClient().PostAsync("/api/email/test", null);
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
    }

    public class AuthRateLimitTests(LowRateLimitAuthApiFactory factory) : IClassFixture<LowRateLimitAuthApiFactory>, IAsyncLifetime
    {
        public Task InitializeAsync() => factory.EnsureDatabaseAsync();
        public Task DisposeAsync() => Task.CompletedTask;

        [Fact]
        public async Task Login_is_rate_limited()
        {
            var client = factory.CreateSpaClient();
            var statuses = new List<HttpStatusCode>();
            for (var i = 0; i < 4; i++)
                statuses.Add((await client.PostAsJsonAsync("/api/auth/login", new LoginRequest("nobody@example.com", "whatever password"))).StatusCode);

            Assert.Equal([HttpStatusCode.Unauthorized, HttpStatusCode.Unauthorized, HttpStatusCode.Unauthorized, HttpStatusCode.TooManyRequests], statuses);
        }
    }
}
