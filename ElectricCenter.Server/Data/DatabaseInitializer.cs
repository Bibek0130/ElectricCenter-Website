using ElectricCenter.Server.Auth;
using ElectricCenter.Server.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace ElectricCenter.Server.Data
{
    /// <summary>
    /// Runs at startup: applies pending migrations (when Database:MigrateOnStartup is true,
    /// which defaults to true in Development) and seeds the first admin account from the
    /// Seed:Admin:* settings if that email doesn't exist yet. An existing account is never modified.
    /// </summary>
    public static class DatabaseInitializer
    {
        public static async Task InitializeAsync(IServiceProvider services, CancellationToken ct = default)
        {
            await using var scope = services.CreateAsyncScope();
            var provider = scope.ServiceProvider;
            var config = provider.GetRequiredService<IConfiguration>();
            var env = provider.GetRequiredService<IHostEnvironment>();
            var logger = provider.GetRequiredService<ILoggerFactory>().CreateLogger(typeof(DatabaseInitializer));
            var db = provider.GetRequiredService<AppDbContext>();

            if (config.GetValue<bool?>("Database:MigrateOnStartup") ?? env.IsDevelopment())
            {
                logger.LogInformation("Applying database migrations…");
                await db.Database.MigrateAsync(ct);
            }

            await SeedAdminAsync(db, config, provider.GetRequiredService<IPasswordHasher>(), provider.GetRequiredService<TimeProvider>(), logger, ct);

            if (env.IsDevelopment() && config.GetValue<bool>("Seed:SampleProducts"))
                await SeedSampleProductsAsync(db, provider.GetRequiredService<TimeProvider>(), logger, ct);

            if (env.IsDevelopment() && config.GetValue<bool>("Seed:SampleElectricians"))
                await SeedSampleElectriciansAsync(db, provider.GetRequiredService<TimeProvider>(), logger, ct);
        }

        /// <summary>Development convenience: loads the old hard-coded electrician once, into an empty Electricians table only.</summary>
        private static async Task SeedSampleElectriciansAsync(AppDbContext db, TimeProvider time, ILogger logger, CancellationToken ct)
        {
            if (await db.Electricians.IgnoreQueryFilters().AnyAsync(ct)) return;

            var samples = SampleCatalog.CreateSampleElectricians();
            foreach (var electrician in samples) electrician.CreatedAtUtc = time.GetUtcNow().UtcDateTime;
            db.Electricians.AddRange(samples);
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Seeded {Count} sample electricians (Seed:SampleElectricians).", samples.Length);
        }

        /// <summary>Development convenience: loads the old hard-coded catalog once, into an empty Products table only.</summary>
        private static async Task SeedSampleProductsAsync(AppDbContext db, TimeProvider time, ILogger logger, CancellationToken ct)
        {
            // IgnoreQueryFilters: if every product was soft-deleted, the table isn't "empty", so don't re-seed.
            if (await db.Products.IgnoreQueryFilters().AnyAsync(ct)) return;

            var now = time.GetUtcNow().UtcDateTime;
            var samples = SampleCatalog.CreateSampleProducts();
            for (var i = 0; i < samples.Length; i++)
                samples[i].CreatedAtUtc = now.AddSeconds(-i); // keeps the original order under "Newest"

            db.Products.AddRange(samples);
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Seeded {Count} sample products (Seed:SampleProducts).", samples.Length);
        }

        private static async Task SeedAdminAsync(AppDbContext db, IConfiguration config, IPasswordHasher hasher, TimeProvider time, ILogger logger, CancellationToken ct)
        {
            var email = UserInput.NormalizeEmail(config["Seed:Admin:Email"]);
            var password = config["Seed:Admin:Password"];
            if (email.Length == 0 || string.IsNullOrEmpty(password)) return;

            if (!UserInput.IsValidEmail(email) || PasswordPolicy.Validate(password) is not null)
            {
                logger.LogWarning("Skipping admin seed: Seed:Admin:Email or Seed:Admin:Password is invalid.");
                return;
            }

            if (await db.Users.AnyAsync(u => u.Email == email, ct)) return;

            db.Users.Add(new User
            {
                Id = Guid.NewGuid(),
                Email = email,
                PasswordHash = hasher.Hash(password),
                FullName = config["Seed:Admin:FullName"]?.Trim() is { Length: > 0 } name ? name : "Administrator",
                // Configured by whoever runs the server, so treated as verified (it may not be a real mailbox).
                EmailConfirmed = true,
                CreatedAtUtc = time.GetUtcNow().UtcDateTime,
                Roles = [new UserRole { Role = Roles.Admin }],
            });
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Seeded admin account {Email}.", email);
        }
    }
}
