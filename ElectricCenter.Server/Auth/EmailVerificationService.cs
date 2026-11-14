using System.Buffers.Text;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using ElectricCenter.Server.Data;
using ElectricCenter.Server.Data.Entities;
using ElectricCenter.Server.Services.Email.Interface;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ElectricCenter.Server.Auth
{
    /// <summary>Bound from the "EmailVerification" config section; the defaults are sensible for production.</summary>
    public sealed class EmailVerificationOptions
    {
        public const string SectionName = "EmailVerification";

        public int CodeLifetimeMinutes { get; set; } = 10;
        public int MaxAttempts { get; set; } = 5;
        public int ResendCooldownSeconds { get; set; } = 60;
        public int MaxSendsPerChallenge { get; set; } = 5;

        /// <summary>Caps how many codes one address can receive per hour, so the form can't be used to spam someone's inbox.</summary>
        public int MaxEmailsPerAddressPerHour { get; set; } = 6;
    }

    /// <summary>What the client needs to show the "enter your code" screen.</summary>
    /// <remarks>The relative seconds let the client run its countdowns without trusting its own clock.</remarks>
    public sealed record VerificationChallenge(string VerificationId, string Email, DateTime ExpiresAtUtc, DateTime ResendAvailableAtUtc, int ExpiresInSeconds, int ResendAfterSeconds);

    public interface IEmailVerificationService
    {
        /// <summary>Validates a sign-up and emails a code. No account exists until <see cref="VerifyAsync"/> succeeds.</summary>
        Task<ServiceResult<VerificationChallenge>> StartRegistrationAsync(string? fullName, string? email, string? phone, string? password, CancellationToken ct = default);

        /// <summary>Emails a code to an existing account whose email isn't verified yet (e.g. created by an admin).</summary>
        Task<ServiceResult<VerificationChallenge>> StartLoginVerificationAsync(User user, CancellationToken ct = default);

        Task<ServiceResult<VerificationChallenge>> ResendAsync(string? verificationId, CancellationToken ct = default);

        /// <summary>Checks the code; on success returns the now-verified user (created, for registrations), roles loaded.</summary>
        Task<ServiceResult<User>> VerifyAsync(string? verificationId, string? code, CancellationToken ct = default);
    }

    public sealed class EmailVerificationService(
        AppDbContext db,
        IPasswordHasher passwordHasher,
        IEmailSender emailSender,
        IOptions<EmailVerificationOptions> options,
        IOptions<JwtOptions> jwtOptions,
        TimeProvider timeProvider,
        ILogger<EmailVerificationService> logger) : IEmailVerificationService
    {
        public const int CodeLength = 6;

        private const string NoLongerValidMessage = "This code is no longer valid. Please request a new one.";
        private const string SendFailedMessage = "We couldn't send the verification email right now. Please try again in a moment.";
        private const string TooManyEmailsMessage = "We've sent several codes to this address recently. Please wait a while and try again.";
        private const string AccountExistsMessage = "An account with this email already exists. Please log in instead.";

        private byte[]? _codeKey;
        private EmailVerificationOptions Settings => options.Value;
        private DateTime UtcNow => timeProvider.GetUtcNow().UtcDateTime;

        public async Task<ServiceResult<VerificationChallenge>> StartRegistrationAsync(string? fullName, string? email, string? phone, string? password, CancellationToken ct = default)
        {
            var normalizedEmail = UserInput.NormalizeEmail(email);
            var error = UserInput.ValidateProfile(fullName, normalizedEmail, phone) ?? PasswordPolicy.Validate(password);
            if (error is not null) return ServiceResult<VerificationChallenge>.Fail(ServiceError.Validation, error);

            if (await db.Users.AnyAsync(u => u.Email == normalizedEmail, ct))
                return ServiceResult<VerificationChallenge>.Fail(ServiceError.Conflict, AccountExistsMessage);

            var now = UtcNow;
            // Housekeeping: challenges are useless a day after they expire.
            var staleBefore = now.AddDays(-1);
            await db.EmailVerifications.Where(v => v.ExpiresAtUtc < staleBefore).ExecuteDeleteAsync(ct);

            if (await AddressOverHourlyLimitAsync(normalizedEmail, now, ct))
                return ServiceResult<VerificationChallenge>.Fail(ServiceError.TooManyRequests, TooManyEmailsMessage);

            var challenge = new EmailVerification
            {
                Id = Guid.NewGuid(),
                Kind = EmailVerificationKind.Registration,
                Email = normalizedEmail,
                PendingFullName = fullName!.Trim(),
                PendingPhone = UserInput.CleanPhone(phone),
                PendingPasswordHash = passwordHasher.Hash(password!),
            };
            return await CreateAndSendAsync(challenge, challenge.PendingFullName, ct);
        }

        public async Task<ServiceResult<VerificationChallenge>> StartLoginVerificationAsync(User user, CancellationToken ct = default)
        {
            var now = UtcNow;
            if (await AddressOverHourlyLimitAsync(user.Email, now, ct))
                return ServiceResult<VerificationChallenge>.Fail(ServiceError.TooManyRequests, TooManyEmailsMessage);

            var challenge = new EmailVerification
            {
                Id = Guid.NewGuid(),
                Kind = EmailVerificationKind.Login,
                Email = user.Email,
                UserId = user.Id,
            };
            return await CreateAndSendAsync(challenge, user.FullName, ct);
        }

        public async Task<ServiceResult<VerificationChallenge>> ResendAsync(string? verificationId, CancellationToken ct = default)
        {
            var challenge = await FindAsync(verificationId, ct);
            if (challenge is null || challenge.ConsumedAtUtc is not null)
                return ServiceResult<VerificationChallenge>.Fail(ServiceError.NotFound, "This verification has ended. Please sign up or log in again.");

            var now = UtcNow;
            var resendAt = challenge.LastSentAtUtc.AddSeconds(Settings.ResendCooldownSeconds);
            if (now < resendAt)
            {
                var wait = (int)Math.Ceiling((resendAt - now).TotalSeconds);
                return ServiceResult<VerificationChallenge>.Fail(ServiceError.TooManyRequests, $"Please wait {wait} seconds before requesting another code.");
            }

            if (challenge.SendCount >= Settings.MaxSendsPerChallenge)
                return ServiceResult<VerificationChallenge>.Fail(ServiceError.TooManyRequests, "You've requested too many codes. Please sign up or log in again.");

            if (await AddressOverHourlyLimitAsync(challenge.Email, now, ct))
                return ServiceResult<VerificationChallenge>.Fail(ServiceError.TooManyRequests, TooManyEmailsMessage);

            if (challenge.Kind == EmailVerificationKind.Registration && await db.Users.AnyAsync(u => u.Email == challenge.Email, ct))
                return ServiceResult<VerificationChallenge>.Fail(ServiceError.Conflict, AccountExistsMessage);

            var displayName = challenge.PendingFullName
                ?? await db.Users.Where(u => u.Id == challenge.UserId).Select(u => u.FullName).SingleOrDefaultAsync(ct)
                ?? "there";

            var code = GenerateCode();
            if (!await TrySendCodeAsync(challenge, displayName, code))
                return ServiceResult<VerificationChallenge>.Fail(ServiceError.Unavailable, SendFailedMessage);

            // A fresh code replaces the old one and resets the attempt counter.
            challenge.CodeHash = HashCode(challenge.Id, code);
            challenge.FailedAttempts = 0;
            challenge.SendCount++;
            challenge.LastSentAtUtc = now;
            challenge.ExpiresAtUtc = now.AddMinutes(Settings.CodeLifetimeMinutes);
            await db.SaveChangesAsync(ct);

            return ServiceResult<VerificationChallenge>.Ok(ToChallenge(challenge, verificationId!));
        }

        public async Task<ServiceResult<User>> VerifyAsync(string? verificationId, string? code, CancellationToken ct = default)
        {
            var cleanedCode = new string((code ?? string.Empty).Where(c => !char.IsWhiteSpace(c) && c != '-').ToArray());
            if (cleanedCode.Length != CodeLength || !cleanedCode.All(char.IsAsciiDigit))
                return ServiceResult<User>.Fail(ServiceError.Validation, $"Enter the {CodeLength}-digit code from the email.");

            var challenge = await FindAsync(verificationId, ct);
            var now = UtcNow;
            if (challenge is null || challenge.ConsumedAtUtc is not null)
                return ServiceResult<User>.Fail(ServiceError.Validation, NoLongerValidMessage);
            if (challenge.FailedAttempts >= Settings.MaxAttempts)
                return ServiceResult<User>.Fail(ServiceError.Validation, "Too many incorrect attempts. Please request a new code.");
            if (challenge.ExpiresAtUtc <= now)
                return ServiceResult<User>.Fail(ServiceError.Validation, "This code has expired. Please request a new one.");

            if (!CodesMatch(challenge.CodeHash, HashCode(challenge.Id, cleanedCode)))
            {
                challenge.FailedAttempts++;
                await db.SaveChangesAsync(ct);
                var remaining = Settings.MaxAttempts - challenge.FailedAttempts;
                return ServiceResult<User>.Fail(ServiceError.Validation, remaining > 0
                    ? $"That code is incorrect. {remaining} {(remaining == 1 ? "attempt" : "attempts")} left."
                    : "Too many incorrect attempts. Please request a new code.");
            }

            // Atomically claim the challenge so a double-submit can't verify twice.
            var claimed = await db.EmailVerifications
                .Where(v => v.Id == challenge.Id && v.ConsumedAtUtc == null)
                .ExecuteUpdateAsync(s => s.SetProperty(v => v.ConsumedAtUtc, now), ct);
            if (claimed == 0) return ServiceResult<User>.Fail(ServiceError.Validation, NoLongerValidMessage);
            db.ChangeTracker.Clear();

            var result = challenge.Kind == EmailVerificationKind.Registration
                ? await CompleteRegistrationAsync(challenge, now, ct)
                : await CompleteLoginVerificationAsync(challenge, now, ct);

            if (result.Succeeded)
            {
                // Any other open codes for this address are now pointless.
                await db.EmailVerifications
                    .Where(v => v.Email == challenge.Email && v.ConsumedAtUtc == null)
                    .ExecuteUpdateAsync(s => s.SetProperty(v => v.ConsumedAtUtc, now), ct);
            }
            return result;
        }

        private async Task<ServiceResult<User>> CompleteRegistrationAsync(EmailVerification challenge, DateTime now, CancellationToken ct)
        {
            if (await db.Users.AnyAsync(u => u.Email == challenge.Email, ct))
                return ServiceResult<User>.Fail(ServiceError.Conflict, AccountExistsMessage);

            var user = new User
            {
                Id = Guid.NewGuid(),
                Email = challenge.Email,
                PasswordHash = challenge.PendingPasswordHash!,
                FullName = challenge.PendingFullName!,
                Phone = challenge.PendingPhone,
                EmailConfirmed = true,
                CreatedAtUtc = now,
                LastLoginAtUtc = now,
                // Self-registration always creates a customer. Electrician/Admin roles are granted by an admin.
                Roles = [new UserRole { Role = Roles.Customer }],
            };
            db.Users.Add(user);

            try
            {
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException)
            {
                db.ChangeTracker.Clear();
                // Another registration for the same email finished first (unique index).
                if (!await db.Users.AsNoTracking().AnyAsync(u => u.Email == challenge.Email, ct)) throw;
                return ServiceResult<User>.Fail(ServiceError.Conflict, AccountExistsMessage);
            }
            return ServiceResult<User>.Ok(user);
        }

        private async Task<ServiceResult<User>> CompleteLoginVerificationAsync(EmailVerification challenge, DateTime now, CancellationToken ct)
        {
            var user = await db.Users.Include(u => u.Roles).SingleOrDefaultAsync(u => u.Id == challenge.UserId, ct);
            if (user is null || !user.IsActive || user.Email != challenge.Email)
                return ServiceResult<User>.Fail(ServiceError.Unauthorized, "This account can't be signed in. Please contact the Electric Center.");

            user.EmailConfirmed = true;
            user.LastLoginAtUtc = now;
            await db.SaveChangesAsync(ct);
            return ServiceResult<User>.Ok(user);
        }

        private async Task<ServiceResult<VerificationChallenge>> CreateAndSendAsync(EmailVerification challenge, string displayName, CancellationToken ct)
        {
            var now = UtcNow;
            var verificationId = Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(32));
            var code = GenerateCode();

            challenge.TokenHash = HashToken(verificationId);
            challenge.CodeHash = HashCode(challenge.Id, code);
            challenge.CreatedAtUtc = now;
            challenge.LastSentAtUtc = now;
            challenge.ExpiresAtUtc = now.AddMinutes(Settings.CodeLifetimeMinutes);
            challenge.SendCount = 1;

            // Save first so the challenge counts toward the hourly limit even if sending is slow.
            db.EmailVerifications.Add(challenge);
            await db.SaveChangesAsync(ct);

            if (!await TrySendCodeAsync(challenge, displayName, code))
            {
                db.EmailVerifications.Remove(challenge);
                await db.SaveChangesAsync(ct);
                return ServiceResult<VerificationChallenge>.Fail(ServiceError.Unavailable, SendFailedMessage);
            }

            return ServiceResult<VerificationChallenge>.Ok(ToChallenge(challenge, verificationId));
        }

        private async Task<bool> TrySendCodeAsync(EmailVerification challenge, string displayName, string code)
        {
            var (subject, text, html) = ComposeEmail(displayName, code, challenge.Kind, Settings.CodeLifetimeMinutes);
            try
            {
                await emailSender.SendEmailAsync(challenge.Email, subject, text, html);
                return true;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to send verification email to {Email}.", challenge.Email);
                return false;
            }
        }

        private async Task<bool> AddressOverHourlyLimitAsync(string email, DateTime now, CancellationToken ct)
        {
            var since = now.AddHours(-1);
            var recentSends = await db.EmailVerifications
                .Where(v => v.Email == email && v.LastSentAtUtc > since)
                .SumAsync(v => v.SendCount, ct);
            return recentSends >= Settings.MaxEmailsPerAddressPerHour;
        }

        private Task<EmailVerification?> FindAsync(string? verificationId, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(verificationId) || verificationId.Length > 128) return Task.FromResult<EmailVerification?>(null);
            var hash = HashToken(verificationId);
            return db.EmailVerifications.SingleOrDefaultAsync(v => v.TokenHash == hash, ct);
        }

        private VerificationChallenge ToChallenge(EmailVerification challenge, string verificationId) =>
            new(verificationId, challenge.Email, challenge.ExpiresAtUtc, challenge.LastSentAtUtc.AddSeconds(Settings.ResendCooldownSeconds),
                Settings.CodeLifetimeMinutes * 60, Settings.ResendCooldownSeconds);

        private static string GenerateCode() => RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");

        private static string HashToken(string raw) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw)));

        /// <summary>
        /// A 6-digit code has only a million values, so a plain hash would be trivially reversible from a
        /// database dump. HMAC with a server-side key (derived from the JWT signing key) prevents that, and
        /// including the challenge id binds each code to its own challenge.
        /// </summary>
        private string HashCode(Guid challengeId, string code)
        {
            _codeKey ??= HKDF.DeriveKey(HashAlgorithmName.SHA256, jwtOptions.Value.SigningKeyBytes, 32, [], "ElectricCenter email OTP v1"u8.ToArray());
            return Convert.ToHexString(HMACSHA256.HashData(_codeKey, Encoding.UTF8.GetBytes($"{challengeId:N}:{code}")));
        }

        private static bool CodesMatch(string storedHash, string candidateHash) =>
            CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(storedHash), Encoding.ASCII.GetBytes(candidateHash));

        public static (string Subject, string Text, string Html) ComposeEmail(string displayName, string code, string kind, int lifetimeMinutes)
        {
            var firstName = displayName.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? "there";
            var purpose = kind == EmailVerificationKind.Registration ? "finish creating your account" : "finish signing in";
            var ignore = kind == EmailVerificationKind.Registration
                ? "If you didn't try to create an account, you can ignore this email and no account will be created."
                : "If you didn't try to sign in, you can ignore this email. Your account stays locked to this address until it's verified.";

            var subject = "Your Panchamukhi Electric Center verification code";
            var text = $"""
                Hi {firstName},

                Your verification code is: {code}

                Enter it on the verification page to {purpose}. It expires in {lifetimeMinutes} minutes.

                {ignore}

                Never share this code with anyone. Panchamukhi Electric Center will never ask you for it.

                Panchamukhi Electric Center
                """;

            var safeName = WebUtility.HtmlEncode(firstName);
            var html = $"""
                <!doctype html>
                <html><body style="margin:0;padding:24px;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
                  <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
                    <tr><td>
                      <p style="margin:0 0 16px;font-size:18px;font-weight:bold">⚡ Panchamukhi Electric Center</p>
                      <p style="margin:0 0 16px">Hi {safeName},</p>
                      <p style="margin:0 0 8px">Your verification code is:</p>
                      <p style="margin:0 0 16px;font-size:32px;font-weight:bold;letter-spacing:8px">{code}</p>
                      <p style="margin:0 0 16px">Enter it on the verification page to {purpose}. It expires in {lifetimeMinutes} minutes.</p>
                      <p style="margin:0 0 16px;color:#6b7280;font-size:13px">{WebUtility.HtmlEncode(ignore)}</p>
                      <p style="margin:0;color:#6b7280;font-size:13px">Never share this code with anyone. We will never ask you for it.</p>
                    </td></tr>
                  </table>
                </body></html>
                """;
            return (subject, text, html);
        }
    }
}
