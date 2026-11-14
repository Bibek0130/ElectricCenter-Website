using System.Text.RegularExpressions;
using ElectricCenter.Server.Auth;
using ElectricCenter.Server.Data;
using ElectricCenter.Server.Services.Email.Interface;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace ElectricCenter.Server.Tests
{
    public sealed class MutableTimeProvider(DateTimeOffset start) : TimeProvider
    {
        public DateTimeOffset Now { get; private set; } = start;

        public override DateTimeOffset GetUtcNow() => Now;

        public void Advance(TimeSpan by) => Now = Now.Add(by);
    }

    /// <summary>Records emails instead of sending them, so tests can read the OTP code.</summary>
    public sealed partial class CapturingEmailSender : IEmailSender
    {
        private readonly List<SentEmail> _sent = [];

        public sealed record SentEmail(string To, string Subject, string Text, string? Html);

        /// <summary>When true, sending throws (simulates an SMTP outage).</summary>
        public bool Fail { get; set; }

        public IReadOnlyList<SentEmail> Sent
        {
            get { lock (_sent) return _sent.ToList(); }
        }

        public Task SendEmailAsync(string email, string subject, string message, string? htmlMessage = null)
        {
            if (Fail) throw new InvalidOperationException("Simulated SMTP failure.");
            lock (_sent) _sent.Add(new SentEmail(email, subject, message, htmlMessage));
            return Task.CompletedTask;
        }

        public int CountTo(string email) => Sent.Count(m => m.To == email);

        /// <summary>The 6-digit code from the most recent email to <paramref name="email"/>.</summary>
        public string LastCodeFor(string email)
        {
            var mail = Sent.LastOrDefault(m => m.To == email) ?? throw new InvalidOperationException($"No email was sent to {email}.");
            return CodePattern().Match(mail.Text).Value;
        }

        [GeneratedRegex(@"\b\d{6}\b")]
        private static partial Regex CodePattern();
    }

    /// <summary>
    /// SQLite in-memory database plus the real auth services, for fast unit tests.
    /// SQLite supports ExecuteUpdate/ExecuteDelete and transactions, which the auth code relies on.
    /// </summary>
    public sealed class AuthTestContext : IDisposable
    {
        public const string SigningKey = "unit-test-signing-key-that-is-long-enough-0123456789";

        private readonly SqliteConnection _connection;

        public AuthTestContext()
        {
            _connection = new SqliteConnection("DataSource=:memory:");
            _connection.Open();
            Db = CreateDbContext();
            Db.Database.EnsureCreated();

            Time = new MutableTimeProvider(new DateTimeOffset(2026, 1, 1, 9, 0, 0, TimeSpan.Zero));
            JwtOptions = Options.Create(new JwtOptions { SigningKey = SigningKey });
            VerificationOptions = new EmailVerificationOptions();
            Hasher = new BcryptPasswordHasher(workFactor: 4); // minimum cost keeps tests fast
            Email = new CapturingEmailSender();
            Jwt = new JwtTokenService(JwtOptions, Time);
            Verification = new EmailVerificationService(Db, Hasher, Email, Options.Create(VerificationOptions), JwtOptions, Time, NullLogger<EmailVerificationService>.Instance);
            Auth = new AuthService(Db, Hasher, Jwt, Verification, JwtOptions, Time);
            Users = new UserManagementService(Db, Hasher, Auth, Time);
        }

        public AppDbContext Db { get; }
        public MutableTimeProvider Time { get; }
        public IOptions<JwtOptions> JwtOptions { get; }
        public EmailVerificationOptions VerificationOptions { get; }
        public BcryptPasswordHasher Hasher { get; }
        public CapturingEmailSender Email { get; }
        public JwtTokenService Jwt { get; }
        public EmailVerificationService Verification { get; }
        public AuthService Auth { get; }
        public UserManagementService Users { get; }

        /// <summary>Full self-registration: start, read the emailed code, verify, sign in.</summary>
        public async Task<AuthSession> RegisterVerifiedAsync(string email, string password, string fullName = "Test Customer")
        {
            var started = await Verification.StartRegistrationAsync(fullName, email, "+9779800000000", password);
            Assert.True(started.Succeeded, started.Message);
            var verified = await Verification.VerifyAsync(started.Value!.VerificationId, Email.LastCodeFor(started.Value.Email));
            Assert.True(verified.Succeeded, verified.Message);
            return await Auth.CreateSessionAsync(verified.Value!);
        }

        /// <summary>Logs in, completing the one-time email verification if the account still needs it.</summary>
        public async Task<AuthSession> LoginVerifiedAsync(string email, string password)
        {
            var login = await Auth.LoginAsync(email, password);
            Assert.True(login.Succeeded, login.Message);
            if (login.Value!.Session is { } session) return session;

            var challenge = login.Value.Verification!;
            var verified = await Verification.VerifyAsync(challenge.VerificationId, Email.LastCodeFor(challenge.Email));
            Assert.True(verified.Succeeded, verified.Message);
            return await Auth.CreateSessionAsync(verified.Value!);
        }

        /// <summary>A second context on the same database, to read state without the first context's tracking cache.</summary>
        public AppDbContext CreateDbContext() =>
            new(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).Options);

        public void Dispose()
        {
            Db.Dispose();
            _connection.Dispose();
        }
    }
}
