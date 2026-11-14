using ElectricCenter.Server.Auth;
using Microsoft.EntityFrameworkCore;

namespace ElectricCenter.Server.Tests
{
    public class AuthServiceTests : IDisposable
    {
        private const string Password = "correct horse battery";
        private readonly AuthTestContext _ctx = new();

        public void Dispose() => _ctx.Dispose();

        private async Task<AuthSession> RegisterAsync(string email = "Customer@Example.com")
        {
            return await _ctx.RegisterVerifiedAsync(email, Password);
        }

        [Fact]
        public async Task Register_normalizes_email_assigns_customer_role_and_starts_a_session()
        {
            var session = await RegisterAsync("  Customer@Example.COM ");

            Assert.Equal("customer@example.com", session.User.Email);
            Assert.Equal([Roles.Customer], session.User.Roles.Select(r => r.Role));
            Assert.NotNull(session.RefreshToken);
            Assert.False(string.IsNullOrEmpty(session.AccessToken.Token));
            Assert.NotEqual(Password, session.User.PasswordHash);
        }

        [Fact]
        public async Task Register_rejects_duplicate_email_case_insensitively()
        {
            await RegisterAsync("dup@example.com");

            var result = await _ctx.Verification.StartRegistrationAsync("Someone", "DUP@example.com", null, Password);

            Assert.Equal(ServiceError.Conflict, result.Error);
        }

        [Theory]
        [InlineData("Name", "not-an-email", "longenough1")]
        [InlineData("", "a@example.com", "longenough1")]
        [InlineData("Name", "a@example.com", "short")]
        public async Task Register_validates_input(string fullName, string email, string password)
        {
            var result = await _ctx.Verification.StartRegistrationAsync(fullName, email, null, password);
            Assert.Equal(ServiceError.Validation, result.Error);
        }

        [Fact]
        public async Task Login_succeeds_with_correct_password_and_any_email_casing()
        {
            await RegisterAsync("login@example.com");

            var result = await _ctx.Auth.LoginAsync("LOGIN@example.com", Password);

            Assert.True(result.Succeeded);
            Assert.NotNull(result.Value!.Session!.RefreshToken);
        }

        [Fact]
        public async Task Login_gives_the_same_error_for_unknown_email_and_wrong_password()
        {
            await RegisterAsync("known@example.com");

            var unknown = await _ctx.Auth.LoginAsync("nobody@example.com", Password);
            var wrong = await _ctx.Auth.LoginAsync("known@example.com", "wrong password!");

            Assert.Equal(ServiceError.InvalidCredentials, unknown.Error);
            Assert.Equal(unknown.Error, wrong.Error);
            Assert.Equal(unknown.Message, wrong.Message);
        }

        [Fact]
        public async Task Login_locks_out_after_repeated_failures_until_the_lockout_expires()
        {
            await RegisterAsync("lock@example.com");

            for (var i = 0; i < AuthService.MaxFailedLoginAttempts; i++)
                await _ctx.Auth.LoginAsync("lock@example.com", "wrong password!");

            var whileLocked = await _ctx.Auth.LoginAsync("lock@example.com", Password);
            Assert.Equal(ServiceError.InvalidCredentials, whileLocked.Error);

            _ctx.Time.Advance(AuthService.LockoutDuration + TimeSpan.FromSeconds(1));
            var afterLockout = await _ctx.Auth.LoginAsync("lock@example.com", Password);
            Assert.True(afterLockout.Succeeded);
        }

        [Fact]
        public async Task Refresh_rotates_the_token_and_marks_the_old_one_replaced()
        {
            var session = await RegisterAsync();
            var oldRaw = session.RefreshToken!.Value;

            var refreshed = await _ctx.Auth.RefreshAsync(oldRaw);

            Assert.True(refreshed.Succeeded);
            Assert.NotNull(refreshed.Value!.RefreshToken);
            Assert.NotEqual(oldRaw, refreshed.Value.RefreshToken!.Value);

            await using var db = _ctx.CreateDbContext();
            var old = await db.RefreshTokens.SingleAsync(t => t.TokenHash == AuthService.HashToken(oldRaw));
            Assert.NotNull(old.RevokedAtUtc);
            Assert.Equal(AuthService.HashToken(refreshed.Value.RefreshToken.Value), old.ReplacedByTokenHash);
        }

        [Fact]
        public async Task Refresh_reusing_a_rotated_token_within_the_grace_period_returns_an_access_token_only()
        {
            var session = await RegisterAsync();
            var oldRaw = session.RefreshToken!.Value;
            var first = await _ctx.Auth.RefreshAsync(oldRaw);

            _ctx.Time.Advance(TimeSpan.FromSeconds(5));
            var second = await _ctx.Auth.RefreshAsync(oldRaw);

            Assert.True(second.Succeeded);
            Assert.Null(second.Value!.RefreshToken); // the cookie from the first refresh stays in place
            Assert.True((await _ctx.Auth.RefreshAsync(first.Value!.RefreshToken!.Value)).Succeeded);
        }

        [Fact]
        public async Task Refresh_reusing_a_rotated_token_after_the_grace_period_revokes_the_whole_family()
        {
            var session = await RegisterAsync();
            var oldRaw = session.RefreshToken!.Value;
            var first = await _ctx.Auth.RefreshAsync(oldRaw);

            _ctx.Time.Advance(AuthService.RotationGracePeriod + TimeSpan.FromSeconds(1));
            var replay = await _ctx.Auth.RefreshAsync(oldRaw);
            var legit = await _ctx.Auth.RefreshAsync(first.Value!.RefreshToken!.Value);

            Assert.Equal(ServiceError.Unauthorized, replay.Error);
            Assert.Equal(ServiceError.Unauthorized, legit.Error);
        }

        [Fact]
        public async Task Refresh_fails_for_expired_unknown_and_missing_tokens()
        {
            var session = await RegisterAsync();

            Assert.Equal(ServiceError.Unauthorized, (await _ctx.Auth.RefreshAsync(null)).Error);
            Assert.Equal(ServiceError.Unauthorized, (await _ctx.Auth.RefreshAsync("not-a-real-token")).Error);

            _ctx.Time.Advance(TimeSpan.FromDays(_ctx.JwtOptions.Value.RefreshTokenDays + 1));
            Assert.Equal(ServiceError.Unauthorized, (await _ctx.Auth.RefreshAsync(session.RefreshToken!.Value)).Error);
        }

        [Fact]
        public async Task Logout_revokes_the_session_even_for_a_token_rotated_moments_ago()
        {
            var session = await RegisterAsync();
            var oldRaw = session.RefreshToken!.Value;
            var current = (await _ctx.Auth.RefreshAsync(oldRaw)).Value!.RefreshToken!.Value;

            await _ctx.Auth.LogoutAsync(current);

            Assert.Equal(ServiceError.Unauthorized, (await _ctx.Auth.RefreshAsync(current)).Error);
            // Still inside the grace window, but the family is logged out, so no access token either.
            Assert.Equal(ServiceError.Unauthorized, (await _ctx.Auth.RefreshAsync(oldRaw)).Error);
        }

        [Fact]
        public async Task LogoutAll_revokes_every_session_of_the_user()
        {
            var first = await RegisterAsync("multi@example.com");
            var second = await _ctx.LoginVerifiedAsync("multi@example.com", Password);

            await _ctx.Auth.LogoutAllAsync(first.User.Id);

            Assert.False((await _ctx.Auth.RefreshAsync(first.RefreshToken!.Value)).Succeeded);
            Assert.False((await _ctx.Auth.RefreshAsync(second.RefreshToken!.Value)).Succeeded);
        }

        [Fact]
        public async Task ChangePassword_requires_the_current_password_and_signs_out_other_sessions()
        {
            var session = await RegisterAsync("change@example.com");
            var otherDevice = await _ctx.LoginVerifiedAsync("change@example.com", Password);

            var wrong = await _ctx.Auth.ChangePasswordAsync(session.User.Id, "not it", "a brand new password");
            Assert.Equal(ServiceError.Validation, wrong.Error);

            var changed = await _ctx.Auth.ChangePasswordAsync(session.User.Id, Password, "a brand new password");
            Assert.True(changed.Succeeded);
            Assert.False((await _ctx.Auth.RefreshAsync(otherDevice.RefreshToken!.Value)).Succeeded);
            Assert.True((await _ctx.Auth.RefreshAsync(changed.Value!.RefreshToken!.Value)).Succeeded);
            Assert.False((await _ctx.Auth.LoginAsync("change@example.com", Password)).Succeeded);
            Assert.True((await _ctx.Auth.LoginAsync("change@example.com", "a brand new password")).Succeeded);
        }

        [Fact]
        public async Task Deactivated_users_cannot_log_in_or_refresh()
        {
            var session = await RegisterAsync("inactive@example.com");
            await _ctx.Users.SetActiveAsync(actingUserId: Guid.NewGuid(), session.User.Id, isActive: false);

            Assert.Equal(ServiceError.InvalidCredentials, (await _ctx.Auth.LoginAsync("inactive@example.com", Password)).Error);
            Assert.Equal(ServiceError.Unauthorized, (await _ctx.Auth.RefreshAsync(session.RefreshToken!.Value)).Error);
        }
    }
}
