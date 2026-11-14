using ElectricCenter.Server.Data.Entities;
using ElectricCenter.Server.Electricians;
using ElectricCenter.Server.Products;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace ElectricCenter.Server.Data
{
    public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
    {
        public DbSet<User> Users => Set<User>();
        public DbSet<UserRole> UserRoles => Set<UserRole>();
        public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
        public DbSet<EmailVerification> EmailVerifications => Set<EmailVerification>();
        public DbSet<Category> Categories => Set<Category>();

        /// <summary>Excludes soft-deleted products. Use <c>IgnoreQueryFilters()</c> to include them (admin views).</summary>
        public DbSet<Product> Products => Set<Product>();

        /// <summary>Excludes soft-deleted electricians. Use <c>IgnoreQueryFilters()</c> to include them (admin views).</summary>
        public DbSet<Electrician> Electricians => Set<Electrician>();
        public DbSet<ElectricianSpecialty> ElectricianSpecialties => Set<ElectricianSpecialty>();

        protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
        {
            // MySQL DATETIME has no time zone, so values come back as DateTimeKind.Unspecified.
            // Every timestamp in this app is UTC; mark them as such on read so they serialize with "Z".
            configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
            configurationBuilder.Properties<DateTime?>().HaveConversion<NullableUtcDateTimeConverter>();

            // SQLite (used only by the test suite) can't compare or ORDER BY decimals; store them as REAL there.
            // MySQL keeps exact DECIMAL(10,2).
            if (Database.ProviderName == "Microsoft.EntityFrameworkCore.Sqlite")
                configurationBuilder.Properties<decimal>().HaveConversion<double>();
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<User>(user =>
            {
                user.ToTable("Users");
                user.HasKey(u => u.Id);
                user.Property(u => u.Email).HasMaxLength(254).IsRequired();
                user.HasIndex(u => u.Email).IsUnique();
                user.Property(u => u.PasswordHash).HasMaxLength(100).IsRequired();
                user.Property(u => u.FullName).HasMaxLength(100).IsRequired();
                user.Property(u => u.Phone).HasMaxLength(20);
            });

            modelBuilder.Entity<UserRole>(role =>
            {
                role.ToTable("UserRoles");
                role.HasKey(r => new { r.UserId, r.Role });
                role.Property(r => r.Role).HasMaxLength(32);
                role.HasOne(r => r.User).WithMany(u => u.Roles).HasForeignKey(r => r.UserId).OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<RefreshToken>(token =>
            {
                token.ToTable("RefreshTokens");
                token.HasKey(t => t.Id);
                token.Property(t => t.TokenHash).HasMaxLength(64).IsFixedLength().IsRequired();
                token.HasIndex(t => t.TokenHash).IsUnique();
                token.HasIndex(t => t.FamilyId);
                token.Property(t => t.ReplacedByTokenHash).HasMaxLength(64).IsFixedLength();
                token.HasOne(t => t.User).WithMany(u => u.RefreshTokens).HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<EmailVerification>(verification =>
            {
                verification.ToTable("EmailVerifications");
                verification.HasKey(v => v.Id);
                verification.Property(v => v.TokenHash).HasMaxLength(64).IsFixedLength().IsRequired();
                verification.HasIndex(v => v.TokenHash).IsUnique();
                verification.Property(v => v.Kind).HasMaxLength(16).IsRequired();
                verification.Property(v => v.Email).HasMaxLength(254).IsRequired();
                verification.HasIndex(v => new { v.Email, v.CreatedAtUtc });
                verification.Property(v => v.PendingFullName).HasMaxLength(100);
                verification.Property(v => v.PendingPhone).HasMaxLength(20);
                verification.Property(v => v.PendingPasswordHash).HasMaxLength(100);
                verification.Property(v => v.CodeHash).HasMaxLength(64).IsFixedLength().IsRequired();
                verification.HasOne(v => v.User).WithMany().HasForeignKey(v => v.UserId).OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<Category>(category =>
            {
                category.ToTable("Categories");
                category.HasKey(c => c.Id);
                category.Property(c => c.Name).HasMaxLength(60).IsRequired();
                category.HasIndex(c => c.Name).IsUnique();
                category.HasData(SampleCatalog.Categories);
            });

            modelBuilder.Entity<Product>(product =>
            {
                product.ToTable("Products");
                product.HasKey(p => p.Id);
                product.Property(p => p.Name).HasMaxLength(ProductRules.NameMaxLength).IsRequired();
                product.Property(p => p.Price).HasPrecision(10, 2);
                product.Property(p => p.Brand).HasMaxLength(ProductRules.BrandMaxLength);
                product.Property(p => p.Sku).HasMaxLength(ProductRules.SkuMaxLength);
                product.HasIndex(p => p.Sku).IsUnique();
                product.Property(p => p.ShortDescription).HasMaxLength(ProductRules.ShortDescriptionMaxLength).IsRequired();
                // TEXT, not VARCHAR: keeps these out of MySQL's 64 KB row-size limit. Lengths are enforced in ProductService.
                product.Property(p => p.Description).HasColumnType("text");
                product.Property(p => p.ImageUrl).HasMaxLength(ProductRules.ImageUrlMaxLength);
                product.Property(p => p.Specs)
                    .HasConversion(
                        v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                        v => JsonSerializer.Deserialize<Dictionary<string, string>>(v, (JsonSerializerOptions?)null) ?? new Dictionary<string, string>(),
                        new ValueComparer<Dictionary<string, string>>(
                            (a, b) => a!.Count == b!.Count && !a.Except(b).Any(),
                            v => v.Aggregate(0, (hash, pair) => HashCode.Combine(hash, pair.Key.GetHashCode(), pair.Value.GetHashCode())),
                            v => new Dictionary<string, string>(v)))
                    .HasColumnType("text");
                product.Property(p => p.Version).IsConcurrencyToken();
                product.HasIndex(p => new { p.IsDeleted, p.CategoryId });
                product.HasOne(p => p.Category).WithMany(c => c.Products).HasForeignKey(p => p.CategoryId).OnDelete(DeleteBehavior.Restrict);
                product.HasQueryFilter(p => !p.IsDeleted);
            });

            modelBuilder.Entity<Electrician>(electrician =>
            {
                electrician.ToTable("Electricians");
                electrician.HasKey(e => e.Id);
                electrician.Property(e => e.Name).HasMaxLength(ElectricianRules.NameMaxLength).IsRequired();
                electrician.Property(e => e.PhotoUrl).HasMaxLength(ElectricianRules.UrlMaxLength);
                electrician.Property(e => e.Location).HasMaxLength(ElectricianRules.LocationMaxLength).IsRequired();
                electrician.Property(e => e.RateAmount).HasPrecision(10, 2);
                electrician.Property(e => e.RateUnit).HasMaxLength(16).IsRequired();
                electrician.Property(e => e.Demand).HasMaxLength(16);
                electrician.Property(e => e.WhatsAppNumber).HasMaxLength(20).IsRequired();
                // TEXT keeps these out of MySQL's 64 KB row-size limit; lengths are enforced in ElectricianService.
                electrician.Property(e => e.Bio).HasColumnType("text").IsRequired();
                electrician.Property(e => e.PastWorks)
                    .HasConversion(
                        v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                        v => JsonSerializer.Deserialize<List<PastWork>>(v, (JsonSerializerOptions?)null) ?? new List<PastWork>(),
                        new ValueComparer<List<PastWork>>(
                            (a, b) => a!.SequenceEqual(b!),
                            v => v.Aggregate(0, (hash, work) => HashCode.Combine(hash, work.GetHashCode())),
                            v => v.ToList()))
                    .HasColumnType("text");
                electrician.Property(e => e.Version).IsConcurrencyToken();
                electrician.HasIndex(e => e.IsDeleted);
                electrician.HasQueryFilter(e => !e.IsDeleted);
            });

            modelBuilder.Entity<ElectricianSpecialty>(specialty =>
            {
                specialty.ToTable("ElectricianSpecialties");
                specialty.HasKey(s => new { s.ElectricianId, s.Specialty });
                specialty.Property(s => s.Specialty).HasMaxLength(ElectricianRules.SpecialtyMaxLength);
                specialty.HasIndex(s => s.Specialty);
                specialty.HasOne(s => s.Electrician).WithMany(e => e.Specialties).HasForeignKey(s => s.ElectricianId).OnDelete(DeleteBehavior.Cascade);
                // Matches the parent's filter so EF doesn't warn about required-relationship filtering.
                specialty.HasQueryFilter(s => !s.Electrician.IsDeleted);
            });
        }

        public override int SaveChanges(bool acceptAllChangesOnSuccess)
        {
            ConvertDeletesToSoftDeletes();
            return base.SaveChanges(acceptAllChangesOnSuccess);
        }

        public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
        {
            ConvertDeletesToSoftDeletes();
            return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
        }

        /// <summary>
        /// Safety net behind "products are never hard-deleted": if any code calls Remove() on a
        /// soft-deletable entity, it is flagged deleted instead of being removed from the table.
        /// (Bulk ExecuteDelete bypasses the change tracker; never use it on these entities.)
        /// </summary>
        private void ConvertDeletesToSoftDeletes()
        {
            foreach (var entry in ChangeTracker.Entries<ISoftDeletable>().Where(e => e.State == EntityState.Deleted))
            {
                entry.State = EntityState.Modified;
                entry.Entity.IsDeleted = true;
                entry.Entity.DeletedAtUtc ??= DateTime.UtcNow;
                if (entry.Entity is IVersioned versioned) versioned.Version = Guid.NewGuid();
            }
        }

        private sealed class UtcDateTimeConverter() : ValueConverter<DateTime, DateTime>(
            v => v.Kind == DateTimeKind.Utc ? v : v.ToUniversalTime(),
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

        private sealed class NullableUtcDateTimeConverter() : ValueConverter<DateTime?, DateTime?>(
            v => v.HasValue ? (v.Value.Kind == DateTimeKind.Utc ? v.Value : v.Value.ToUniversalTime()) : v,
            v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);
    }
}
