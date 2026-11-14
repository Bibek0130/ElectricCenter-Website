using ElectricCenter.Server.Auth;
using ElectricCenter.Server.Data.Entities;
using Microsoft.IdentityModel.JsonWebTokens;

namespace ElectricCenter.Server.Tests
{
    public class JwtTokenServiceTests : IDisposable
    {
        private readonly AuthTestContext _ctx = new();

        public void Dispose() => _ctx.Dispose();

        [Fact]
        public async Task Access_token_carries_identity_and_every_role_and_validates()
        {
            var user = new User
            {
                Id = Guid.NewGuid(),
                Email = "udhav@example.com",
                FullName = "Udhav Mainali",
                Roles = [new UserRole { Role = Roles.Electrician }, new UserRole { Role = Roles.Admin }],
            };

            var token = _ctx.Jwt.CreateAccessToken(user);

            Assert.Equal(_ctx.Time.Now.UtcDateTime.AddMinutes(15), token.ExpiresAtUtc);

            var parameters = JwtTokenService.CreateValidationParameters(_ctx.JwtOptions.Value);
            parameters.ValidateLifetime = false; // the test clock is fixed in the past
            var result = await new JsonWebTokenHandler { MapInboundClaims = false }.ValidateTokenAsync(token.Token, parameters);

            Assert.True(result.IsValid, result.Exception?.Message);
            Assert.Equal(user.Id.ToString(), result.ClaimsIdentity.FindFirst(AuthClaims.Subject)?.Value);
            Assert.Equal("udhav@example.com", result.ClaimsIdentity.FindFirst(AuthClaims.Email)?.Value);
            Assert.Equal(
                [Roles.Admin, Roles.Electrician],
                result.ClaimsIdentity.FindAll(AuthClaims.Role).Select(c => c.Value).Order());
        }

        [Fact]
        public async Task Token_signed_with_another_key_is_rejected()
        {
            var token = _ctx.Jwt.CreateAccessToken(new User { Id = Guid.NewGuid(), Email = "x@example.com", FullName = "X" });
            var parameters = JwtTokenService.CreateValidationParameters(new JwtOptions { SigningKey = "a-completely-different-signing-key-0123456789" });
            parameters.ValidateLifetime = false;

            var result = await new JsonWebTokenHandler().ValidateTokenAsync(token.Token, parameters);

            Assert.False(result.IsValid);
        }

        [Theory]
        [InlineData("", false)]
        [InlineData("too-short", false)]
        [InlineData("exactly-thirty-two-bytes-long-ok", true)]
        public void Signing_key_must_be_at_least_32_bytes(string key, bool expectedValid)
        {
            Assert.Equal(expectedValid, new JwtOptions { SigningKey = key }.IsValid(out _));
        }
    }

    public class UserManagementServiceTests : IDisposable
    {
        private const string Password = "electrician password";
        private readonly AuthTestContext _ctx = new();

        public void Dispose() => _ctx.Dispose();

        [Fact]
        public async Task Admin_can_create_a_user_with_multiple_roles_who_can_then_log_in()
        {
            var created = await _ctx.Users.CreateAsync("Udhav Mainali", "Udhav@Example.com", null, Password, ["electrician", "Admin"]);

            Assert.True(created.Succeeded, created.Message);
            Assert.Equal([Roles.Admin, Roles.Electrician], created.Value!.Roles.Select(r => r.Role).Order());

            var login = await _ctx.Auth.LoginAsync("udhav@example.com", Password);
            Assert.True(login.Succeeded);
        }

        [Fact]
        public async Task Unknown_roles_and_empty_role_lists_are_rejected()
        {
            Assert.Equal(ServiceError.Validation, (await _ctx.Users.CreateAsync("A", "a@example.com", null, Password, ["SuperUser"])).Error);
            Assert.Equal(ServiceError.Validation, (await _ctx.Users.CreateAsync("A", "a@example.com", null, Password, [])).Error);
        }

        [Fact]
        public async Task SetRoles_replaces_the_role_set()
        {
            var user = (await _ctx.Users.CreateAsync("E", "e@example.com", null, Password, [Roles.Electrician])).Value!;

            var result = await _ctx.Users.SetRolesAsync(Guid.NewGuid(), user.Id, [Roles.Customer, Roles.Electrician]);

            Assert.True(result.Succeeded);
            Assert.Equal([Roles.Customer, Roles.Electrician], result.Value!.Roles.Select(r => r.Role).Order());
        }

        [Fact]
        public async Task Admin_cannot_remove_their_own_admin_role_or_deactivate_themselves()
        {
            var admin = (await _ctx.Users.CreateAsync("Boss", "boss@example.com", null, Password, [Roles.Admin])).Value!;

            Assert.Equal(ServiceError.Validation, (await _ctx.Users.SetRolesAsync(admin.Id, admin.Id, [Roles.Customer])).Error);
            Assert.Equal(ServiceError.Validation, (await _ctx.Users.SetActiveAsync(admin.Id, admin.Id, false)).Error);
        }

        [Fact]
        public async Task Deactivating_a_user_ends_their_sessions()
        {
            var user = (await _ctx.Users.CreateAsync("E", "e2@example.com", null, Password, [Roles.Electrician])).Value!;
            var session = await _ctx.LoginVerifiedAsync("e2@example.com", Password);

            await _ctx.Users.SetActiveAsync(Guid.NewGuid(), user.Id, false);

            Assert.False((await _ctx.Auth.RefreshAsync(session.RefreshToken!.Value)).Succeeded);
        }

        [Fact]
        public async Task ResetPassword_sets_the_new_password_clears_lockout_and_ends_sessions()
        {
            var user = (await _ctx.Users.CreateAsync("E", "e3@example.com", null, Password, [Roles.Electrician])).Value!;
            var session = await _ctx.LoginVerifiedAsync("e3@example.com", Password);

            var result = await _ctx.Users.ResetPasswordAsync(user.Id, "a different password");

            Assert.True(result.Succeeded);
            Assert.False((await _ctx.Auth.RefreshAsync(session.RefreshToken!.Value)).Succeeded);
            Assert.True((await _ctx.Auth.LoginAsync("e3@example.com", "a different password")).Succeeded);
        }
    }
}
