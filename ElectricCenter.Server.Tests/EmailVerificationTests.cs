using ElectricCenter.Server.Auth;
using ElectricCenter.Server.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace ElectricCenter.Server.Tests
{
    public class EmailVerificationTests : IDisposable
    {
        private const string Password = "verification password";
        private readonly AuthTestContext _ctx = new();

        public void Dispose() => _ctx.Dispose();

        private async Task<VerificationChallenge> StartAsync(string email = "new@example.com", string name = "New Customer")
        {
            var result = await _ctx.Verification.StartRegistrationAsync(name, email, null, Password);
            Assert.True(result.Succeeded, result.Message);
            return result.Value!;
        }

        private static string WrongCode(string code) => code == "000000" ? "111111" : "000000";

        [Fact]
        public async Task Registration_emails_a_code_and_creates_no_account_until_verified()
        {
            var challenge = await StartAsync();

            Assert.Equal(1, _ctx.Email.CountTo("new@example.com"));
            Assert.Matches(@"^\d{6}$", _ctx.Email.LastCodeFor("new@example.com"));
            Assert.False(await _ctx.CreateDbContext().Users.AnyAsync());
            Assert.Equal(ServiceError.InvalidCredentials, (await _ctx.Auth.LoginAsync("new@example.com", Password)).Error);

            var verified = await _ctx.Verification.VerifyAsync(challenge.VerificationId, _ctx.Email.LastCodeFor("new@example.com"));

            Assert.True(verified.Succeeded, verified.Message);
            Assert.True(verified.Value!.EmailConfirmed);
            Assert.Equal([Roles.Customer], verified.Value.Roles.Select(r => r.Role));
            Assert.NotNull((await _ctx.Auth.LoginAsync("new@example.com", Password)).Value!.Session);
        }

        [Fact]
        public async Task Code_and_pending_password_are_stored_only_as_hashes()
        {
            await StartAsync();
            var code = _ctx.Email.LastCodeFor("new@example.com");

            var stored = await _ctx.CreateDbContext().EmailVerifications.SingleAsync();

            Assert.DoesNotContain(code, stored.CodeHash);
            Assert.Equal(64, stored.CodeHash.Length);
            Assert.NotEqual(Password, stored.PendingPasswordHash);
            Assert.True(_ctx.Hasher.Verify(Password, stored.PendingPasswordHash!));
        }

        [Fact]
        public async Task Accepts_codes_typed_with_spaces_or_dashes()
        {
            var challenge = await StartAsync();
            var code = _ctx.Email.LastCodeFor("new@example.com");

            var verified = await _ctx.Verification.VerifyAsync(challenge.VerificationId, $" {code[..3]}-{code[3..]} ");

            Assert.True(verified.Succeeded, verified.Message);
        }

        [Fact]
        public async Task Wrong_codes_count_down_and_lock_the_challenge_after_max_attempts()
        {
            var challenge = await StartAsync();
            var code = _ctx.Email.LastCodeFor("new@example.com");

            var first = await _ctx.Verification.VerifyAsync(challenge.VerificationId, WrongCode(code));
            Assert.Equal(ServiceError.Validation, first.Error);
            Assert.Contains("4 attempts left", first.Message);

            for (var i = 1; i < _ctx.VerificationOptions.MaxAttempts; i++)
                await _ctx.Verification.VerifyAsync(challenge.VerificationId, WrongCode(code));

            var correctTooLate = await _ctx.Verification.VerifyAsync(challenge.VerificationId, code);
            Assert.False(correctTooLate.Succeeded);
            Assert.Contains("Too many incorrect attempts", correctTooLate.Message);
        }

        [Fact]
        public async Task Expired_code_is_rejected_and_a_resent_code_replaces_it()
        {
            var challenge = await StartAsync();
            var oldCode = _ctx.Email.LastCodeFor("new@example.com");

            _ctx.Time.Advance(TimeSpan.FromMinutes(_ctx.VerificationOptions.CodeLifetimeMinutes + 1));
            Assert.Contains("expired", (await _ctx.Verification.VerifyAsync(challenge.VerificationId, oldCode)).Message);

            var resent = await _ctx.Verification.ResendAsync(challenge.VerificationId);
            Assert.True(resent.Succeeded, resent.Message);
            var newCode = _ctx.Email.LastCodeFor("new@example.com");

            if (newCode != oldCode)
                Assert.False((await _ctx.Verification.VerifyAsync(challenge.VerificationId, oldCode)).Succeeded);
            Assert.True((await _ctx.Verification.VerifyAsync(challenge.VerificationId, newCode)).Succeeded);
        }

        [Fact]
        public async Task Resend_respects_the_cooldown_and_the_per_challenge_cap()
        {
            var challenge = await StartAsync();

            var tooSoon = await _ctx.Verification.ResendAsync(challenge.VerificationId);
            Assert.Equal(ServiceError.TooManyRequests, tooSoon.Error);
            Assert.Contains("seconds", tooSoon.Message);

            for (var sent = 1; sent < _ctx.VerificationOptions.MaxSendsPerChallenge; sent++)
            {
                _ctx.Time.Advance(TimeSpan.FromSeconds(_ctx.VerificationOptions.ResendCooldownSeconds + 1));
                Assert.True((await _ctx.Verification.ResendAsync(challenge.VerificationId)).Succeeded);
            }

            _ctx.Time.Advance(TimeSpan.FromSeconds(_ctx.VerificationOptions.ResendCooldownSeconds + 1));
            var overCap = await _ctx.Verification.ResendAsync(challenge.VerificationId);
            Assert.Equal(ServiceError.TooManyRequests, overCap.Error);
            Assert.Equal(_ctx.VerificationOptions.MaxSendsPerChallenge, _ctx.Email.CountTo("new@example.com"));
        }

        [Fact]
        public async Task An_address_can_only_receive_a_limited_number_of_codes_per_hour()
        {
            for (var i = 0; i < _ctx.VerificationOptions.MaxEmailsPerAddressPerHour; i++)
                await StartAsync();

            var blocked = await _ctx.Verification.StartRegistrationAsync("Spammer", "new@example.com", null, Password);
            Assert.Equal(ServiceError.TooManyRequests, blocked.Error);

            _ctx.Time.Advance(TimeSpan.FromHours(1) + TimeSpan.FromMinutes(1));
            Assert.True((await _ctx.Verification.StartRegistrationAsync("Later", "new@example.com", null, Password)).Succeeded);
        }

        [Fact]
        public async Task A_code_only_works_with_the_challenge_it_was_sent_for()
        {
            var attacker = await StartAsync(name: "Attacker");
            var victim = await StartAsync(name: "Victim");
            var victimCode = _ctx.Email.LastCodeFor("new@example.com");

            // Someone who started their own sign-up for the address can't use the code meant for another one.
            var hijack = await _ctx.Verification.VerifyAsync(attacker.VerificationId, victimCode);
            Assert.False(hijack.Succeeded);

            var real = await _ctx.Verification.VerifyAsync(victim.VerificationId, victimCode);
            Assert.True(real.Succeeded, real.Message);
            Assert.Equal("Victim", real.Value!.FullName);
        }

        [Fact]
        public async Task A_challenge_verifies_once_and_other_pending_sign_ups_for_the_address_end()
        {
            var first = await StartAsync();
            var firstCode = _ctx.Email.LastCodeFor("new@example.com");
            var second = await StartAsync();
            var secondCode = _ctx.Email.LastCodeFor("new@example.com");

            Assert.True((await _ctx.Verification.VerifyAsync(first.VerificationId, firstCode)).Succeeded);
            Assert.False((await _ctx.Verification.VerifyAsync(first.VerificationId, firstCode)).Succeeded);
            Assert.False((await _ctx.Verification.VerifyAsync(second.VerificationId, secondCode)).Succeeded);
            Assert.Single(await _ctx.CreateDbContext().Users.ToListAsync());
        }

        [Fact]
        public async Task Registering_an_existing_email_is_a_conflict_and_sends_nothing()
        {
            await _ctx.RegisterVerifiedAsync("taken@example.com", Password);
            var before = _ctx.Email.CountTo("taken@example.com");

            var again = await _ctx.Verification.StartRegistrationAsync("Someone", "Taken@Example.com", null, Password);

            Assert.Equal(ServiceError.Conflict, again.Error);
            Assert.Equal(before, _ctx.Email.CountTo("taken@example.com"));
        }

        [Fact]
        public async Task Admin_created_account_must_verify_by_otp_on_first_login_only()
        {
            await _ctx.Users.CreateAsync("Udhav Mainali", "udhav@example.com", null, Password, [Roles.Electrician]);

            var wrongPassword = await _ctx.Auth.LoginAsync("udhav@example.com", "not the password");
            Assert.Equal(ServiceError.InvalidCredentials, wrongPassword.Error);
            Assert.Equal(0, _ctx.Email.CountTo("udhav@example.com")); // no code without the right password

            var firstLogin = await _ctx.Auth.LoginAsync("udhav@example.com", Password);
            Assert.True(firstLogin.Succeeded);
            Assert.Null(firstLogin.Value!.Session);
            var challenge = firstLogin.Value.Verification!;

            var verified = await _ctx.Verification.VerifyAsync(challenge.VerificationId, _ctx.Email.LastCodeFor("udhav@example.com"));
            Assert.True(verified.Succeeded, verified.Message);
            Assert.True(verified.Value!.EmailConfirmed);
            Assert.Equal([Roles.Electrician], verified.Value.Roles.Select(r => r.Role));

            var nextLogin = await _ctx.Auth.LoginAsync("udhav@example.com", Password);
            Assert.NotNull(nextLogin.Value!.Session);
            Assert.Equal(1, _ctx.Email.CountTo("udhav@example.com"));
        }

        [Fact]
        public async Task Smtp_failure_reports_unavailable_and_does_not_count_against_limits()
        {
            _ctx.Email.Fail = true;
            var failed = await _ctx.Verification.StartRegistrationAsync("Name", "new@example.com", null, Password);
            Assert.Equal(ServiceError.Unavailable, failed.Error);
            Assert.False(await _ctx.CreateDbContext().EmailVerifications.AnyAsync());

            _ctx.Email.Fail = false;
            Assert.True((await _ctx.Verification.StartRegistrationAsync("Name", "new@example.com", null, Password)).Succeeded);
        }

        [Fact]
        public async Task Unknown_verification_ids_and_malformed_codes_are_rejected()
        {
            Assert.Equal(ServiceError.Validation, (await _ctx.Verification.VerifyAsync("no-such-id", "123456")).Error);
            Assert.Equal(ServiceError.Validation, (await _ctx.Verification.VerifyAsync("no-such-id", "12ab56")).Error);
            Assert.Equal(ServiceError.NotFound, (await _ctx.Verification.ResendAsync("no-such-id")).Error);
        }

        [Fact]
        public void Email_contains_the_code_and_html_encodes_the_name()
        {
            var (subject, text, html) = EmailVerificationService.ComposeEmail("<b>Eve</b> Smith", "042317", EmailVerificationKind.Registration, 10);

            Assert.Contains("verification code", subject);
            Assert.Contains("042317", text);
            Assert.Contains("042317", html);
            Assert.Contains("&lt;b&gt;Eve&lt;/b&gt;", html);
            Assert.DoesNotContain("<b>Eve</b>", html);
        }
    }
}
