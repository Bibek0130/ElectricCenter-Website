using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using ElectricCenter.Server.Auth;
using ElectricCenter.Server.Data;
using ElectricCenter.Server.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace ElectricCenter.Server.Articles
{
    /// <summary>Field limits shared by validation and the database schema.</summary>
    public static partial class ArticleRules
    {
        /// <summary>Search engines show roughly the first 60 characters of a title; schema.org caps a headline at 110.</summary>
        public const int TitleMaxLength = 110;
        public const int SlugMaxLength = 80;
        public const int SummaryMaxLength = 300;
        public const int BodyMaxLength = 50_000;
        public const int ImageUrlMaxLength = 500;
        public const int ImageAltMaxLength = 150;
        public const int AuthorMaxLength = 80;

        /// <summary>Safety cap on the public list. There's no paging yet; this is far more articles than the site will have for a long time.</summary>
        public const int PublicListLimit = 200;

        [GeneratedRegex("^[a-z0-9]+(?:-[a-z0-9]+)*$")]
        public static partial Regex SlugPattern();

        /// <summary>
        /// "Why Surge Protectors Matter in Kathmandu!" becomes "why-surge-protectors-matter-in-kathmandu".
        /// Accents are stripped; anything that isn't a letter or digit a-z (Devanagari included) becomes a separator,
        /// so a title written entirely in Nepali gives "" and the caller supplies a fallback.
        /// </summary>
        public static string Slugify(string? text)
        {
            if (string.IsNullOrWhiteSpace(text)) return string.Empty;

            var builder = new StringBuilder(text.Length);
            foreach (var c in text.Normalize(NormalizationForm.FormD))
            {
                if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark) continue;
                var lower = char.ToLowerInvariant(c);
                builder.Append(lower is >= 'a' and <= 'z' or >= '0' and <= '9' ? lower : '-');
            }

            var slug = MultipleHyphens().Replace(builder.ToString(), "-").Trim('-');
            if (slug.Length <= SlugMaxLength) return slug;

            // Cut at a word boundary when there is one, so the slug doesn't end mid-word.
            var cut = slug[..SlugMaxLength];
            var lastHyphen = cut.LastIndexOf('-');
            return (lastHyphen > SlugMaxLength / 2 ? cut[..lastHyphen] : cut).Trim('-');
        }

        [GeneratedRegex("-{2,}")]
        private static partial Regex MultipleHyphens();
    }

    public sealed record ArticleInput(
        string? Title,
        string? Slug,
        string? Summary,
        string? BodyMarkdown,
        string? CoverImageUrl,
        string? CoverImageAlt,
        string? AuthorName,
        bool IsPublished);

    /// <summary>What a list needs. Deliberately has no body, so listing never loads (or renders) every article's text.</summary>
    public sealed record ArticleSummary(
        int Id,
        string Title,
        string Slug,
        string Summary,
        string? CoverImageUrl,
        string? CoverImageAlt,
        string AuthorName,
        bool IsPublished,
        DateTime? PublishedAtUtc,
        DateTime CreatedAtUtc,
        DateTime? UpdatedAtUtc,
        bool IsDeleted,
        int ReadingMinutes);

    public sealed record ArticleSitemapEntry(string Slug, DateTime LastModifiedUtc);

    public interface IArticleService
    {
        /// <summary>Published, not deleted, newest first.</summary>
        Task<IReadOnlyList<ArticleSummary>> ListPublishedAsync(CancellationToken ct = default);

        /// <summary>Null for an unknown slug, a draft or a deleted article: the public can't tell them apart.</summary>
        Task<Article?> GetPublishedBySlugAsync(string slug, CancellationToken ct = default);

        Task<IReadOnlyList<ArticleSitemapEntry>> ListForSitemapAsync(CancellationToken ct = default);

        /// <summary>Admins: drafts included, newest first. Deleted ones only when asked.</summary>
        Task<IReadOnlyList<ArticleSummary>> ListForAdminAsync(bool includeDeleted, CancellationToken ct = default);

        /// <summary>Admins: any article by id, drafts and deleted included.</summary>
        Task<Article?> GetForAdminAsync(int id, CancellationToken ct = default);

        Task<ServiceResult<Article>> CreateAsync(ArticleInput input, Guid actingUserId, CancellationToken ct = default);
        Task<ServiceResult<Article>> UpdateAsync(int id, ArticleInput input, Guid? expectedVersion, Guid actingUserId, CancellationToken ct = default);

        /// <summary>Soft delete: the row stays, flagged IsDeleted, and disappears from every public query.</summary>
        Task<ServiceResult<Article>> DeleteAsync(int id, Guid actingUserId, CancellationToken ct = default);

        Task<ServiceResult<Article>> RestoreAsync(int id, Guid actingUserId, CancellationToken ct = default);
    }

    public sealed class ArticleService(AppDbContext db, TimeProvider timeProvider) : IArticleService
    {
        private const string ConcurrencyMessage = "This article was changed by someone else since you opened it. Reload it and try again.";

        private DateTime UtcNow => timeProvider.GetUtcNow().UtcDateTime;

        public async Task<IReadOnlyList<ArticleSummary>> ListPublishedAsync(CancellationToken ct = default) =>
            await Summaries(db.Articles.AsNoTracking().Where(a => a.IsPublished))
                .Take(ArticleRules.PublicListLimit)
                .ToListAsync(ct);

        public Task<Article?> GetPublishedBySlugAsync(string slug, CancellationToken ct = default) =>
            db.Articles.AsNoTracking().SingleOrDefaultAsync(a => a.IsPublished && a.Slug == slug, ct);

        public async Task<IReadOnlyList<ArticleSitemapEntry>> ListForSitemapAsync(CancellationToken ct = default)
        {
            var rows = await db.Articles.AsNoTracking()
                .Where(a => a.IsPublished)
                .OrderByDescending(a => a.PublishedAtUtc)
                .Select(a => new { a.Slug, a.UpdatedAtUtc, a.PublishedAtUtc, a.CreatedAtUtc })
                .Take(ArticleRules.PublicListLimit)
                .ToListAsync(ct);

            return rows.Select(a => new ArticleSitemapEntry(a.Slug, a.UpdatedAtUtc ?? a.PublishedAtUtc ?? a.CreatedAtUtc)).ToList();
        }

        public async Task<IReadOnlyList<ArticleSummary>> ListForAdminAsync(bool includeDeleted, CancellationToken ct = default) =>
            await Summaries((includeDeleted ? db.Articles.IgnoreQueryFilters() : db.Articles).AsNoTracking()).ToListAsync(ct);

        public Task<Article?> GetForAdminAsync(int id, CancellationToken ct = default) =>
            db.Articles.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(a => a.Id == id, ct);

        /// <summary>Newest first: by publish date, with drafts (no date yet) ordered by when they were last touched.</summary>
        private static IQueryable<ArticleSummary> Summaries(IQueryable<Article> articles) =>
            articles
                .OrderByDescending(a => a.PublishedAtUtc ?? a.UpdatedAtUtc ?? a.CreatedAtUtc)
                .ThenByDescending(a => a.Id)
                .Select(a => new ArticleSummary(
                    a.Id, a.Title, a.Slug, a.Summary, a.CoverImageUrl, a.CoverImageAlt, a.AuthorName,
                    a.IsPublished, a.PublishedAtUtc, a.CreatedAtUtc, a.UpdatedAtUtc, a.IsDeleted, a.ReadingMinutes));

        public async Task<ServiceResult<Article>> CreateAsync(ArticleInput input, Guid actingUserId, CancellationToken ct = default)
        {
            var error = Validate(input);
            if (error is not null) return error;

            var (slug, slugError) = await ResolveSlugAsync(input, existing: null, ct);
            if (slugError is not null) return slugError;

            var now = UtcNow;
            var article = new Article
            {
                CreatedAtUtc = now,
                CreatedByUserId = actingUserId,
                Version = Guid.NewGuid(),
                // The byline defaults to whoever is writing, so nobody has to type their own name every time.
                AuthorName = Clean(input.AuthorName) ?? await UserNameAsync(actingUserId, ct),
            };
            Apply(article, input, slug!, now);
            db.Articles.Add(article);

            try
            {
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException)
            {
                // Two admins saving the same URL at once: the unique index stopped the second one.
                if (await SlugTakenAsync(slug!, existingId: null, ct) is null) throw;
                return SlugTaken(slug!);
            }

            return ServiceResult<Article>.Ok((await GetForAdminAsync(article.Id, ct))!);
        }

        public async Task<ServiceResult<Article>> UpdateAsync(int id, ArticleInput input, Guid? expectedVersion, Guid actingUserId, CancellationToken ct = default)
        {
            if (expectedVersion is null)
                return ServiceResult<Article>.Fail(ServiceError.Validation, "The article version is required to save changes.");

            // The default filter hides deleted articles: restore one before editing it.
            var article = await db.Articles.SingleOrDefaultAsync(a => a.Id == id, ct);
            if (article is null) return ServiceResult<Article>.Fail(ServiceError.NotFound, "Article not found.");
            if (article.Version != expectedVersion)
                return ServiceResult<Article>.Fail(ServiceError.Conflict, ConcurrencyMessage);

            var error = Validate(input);
            if (error is not null) return error;

            var (slug, slugError) = await ResolveSlugAsync(input, article, ct);
            if (slugError is not null) return slugError;

            var now = UtcNow;
            Apply(article, input, slug!, now); // keeps the current byline unless the admin typed a different one
            article.UpdatedAtUtc = now;
            article.UpdatedByUserId = actingUserId;
            return await SaveWithNewVersionAsync(article, ct);
        }

        public async Task<ServiceResult<Article>> DeleteAsync(int id, Guid actingUserId, CancellationToken ct = default)
        {
            var article = await db.Articles.SingleOrDefaultAsync(a => a.Id == id, ct);
            if (article is null) return ServiceResult<Article>.Fail(ServiceError.NotFound, "Article not found.");

            article.IsDeleted = true;
            article.DeletedAtUtc = UtcNow;
            article.DeletedByUserId = actingUserId;
            return await SaveWithNewVersionAsync(article, ct);
        }

        public async Task<ServiceResult<Article>> RestoreAsync(int id, Guid actingUserId, CancellationToken ct = default)
        {
            var article = await db.Articles.IgnoreQueryFilters().SingleOrDefaultAsync(a => a.Id == id, ct);
            if (article is null) return ServiceResult<Article>.Fail(ServiceError.NotFound, "Article not found.");
            if (!article.IsDeleted) return ServiceResult<Article>.Fail(ServiceError.Validation, "This article isn't deleted.");

            article.IsDeleted = false;
            article.DeletedAtUtc = null;
            article.DeletedByUserId = null;
            article.UpdatedAtUtc = UtcNow;
            article.UpdatedByUserId = actingUserId;
            return await SaveWithNewVersionAsync(article, ct);
        }

        /// <summary>
        /// Rotates the concurrency token and saves. EF sends "WHERE Version = @old", so if another
        /// admin saved in between, zero rows match and we report a conflict instead of overwriting.
        /// </summary>
        private async Task<ServiceResult<Article>> SaveWithNewVersionAsync(Article article, CancellationToken ct)
        {
            article.Version = Guid.NewGuid();
            try
            {
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateConcurrencyException)
            {
                return ServiceResult<Article>.Fail(ServiceError.Conflict, ConcurrencyMessage);
            }
            catch (DbUpdateException)
            {
                if (await SlugTakenAsync(article.Slug, article.Id, ct) is null) throw;
                return SlugTaken(article.Slug);
            }

            return ServiceResult<Article>.Ok((await GetForAdminAsync(article.Id, ct))!);
        }

        private void Apply(Article article, ArticleInput input, string slug, DateTime now)
        {
            article.Title = input.Title!.Trim();
            article.Slug = slug;
            article.Summary = input.Summary!.Trim();
            article.BodyMarkdown = input.BodyMarkdown!.Trim();
            article.ReadingMinutes = ArticleMarkdown.ReadingMinutes(article.BodyMarkdown);
            article.CoverImageUrl = Clean(input.CoverImageUrl);
            article.CoverImageAlt = article.CoverImageUrl is null ? null : Clean(input.CoverImageAlt);
            if (Clean(input.AuthorName) is { } author) article.AuthorName = author;

            article.IsPublished = input.IsPublished;
            // The first time it goes live. Unpublishing and republishing keeps the original date.
            if (article.IsPublished && article.PublishedAtUtc is null) article.PublishedAtUtc = now;
        }

        private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

        private async Task<string> UserNameAsync(Guid userId, CancellationToken ct) =>
            await db.Users.Where(u => u.Id == userId).Select(u => u.FullName).FirstOrDefaultAsync(ct)
            ?? "Panchamukhi Electric Center";

        private static ServiceResult<Article>? Validate(ArticleInput input)
        {
            static ServiceResult<Article> Invalid(string message) => ServiceResult<Article>.Fail(ServiceError.Validation, message);

            if (string.IsNullOrWhiteSpace(input.Title)) return Invalid("Title is required.");
            if (input.Title.Trim().Length > ArticleRules.TitleMaxLength)
                return Invalid($"Title must be at most {ArticleRules.TitleMaxLength} characters.");

            if (string.IsNullOrWhiteSpace(input.Summary)) return Invalid("A summary is required. Search engines show it under the title.");
            if (input.Summary.Trim().Length > ArticleRules.SummaryMaxLength)
                return Invalid($"Summary must be at most {ArticleRules.SummaryMaxLength} characters.");

            if (string.IsNullOrWhiteSpace(input.BodyMarkdown)) return Invalid("The article text is required.");
            if (input.BodyMarkdown.Trim().Length > ArticleRules.BodyMaxLength)
                return Invalid($"The article text must be at most {ArticleRules.BodyMaxLength:N0} characters.");

            if (Clean(input.CoverImageUrl) is { } cover
                && (cover.Length > ArticleRules.ImageUrlMaxLength
                    || !Uri.TryCreate(cover, UriKind.Absolute, out var uri)
                    || uri.Scheme != Uri.UriSchemeHttps))
                return Invalid("Cover image must be a full https link.");

            if (Clean(input.CoverImageAlt) is { Length: > ArticleRules.ImageAltMaxLength })
                return Invalid($"Cover image description must be at most {ArticleRules.ImageAltMaxLength} characters.");

            if (Clean(input.AuthorName) is { Length: > ArticleRules.AuthorMaxLength })
                return Invalid($"Author name must be at most {ArticleRules.AuthorMaxLength} characters.");

            if (Clean(input.Slug) is { } slug
                && (slug.Length > ArticleRules.SlugMaxLength || !ArticleRules.SlugPattern().IsMatch(slug.ToLowerInvariant())))
                return Invalid($"The URL can only contain lowercase letters, numbers and single hyphens (max {ArticleRules.SlugMaxLength} characters).");

            return null;
        }

        /// <summary>
        /// A slug the admin typed must be free (or already this article's). A blank one is generated from the title on
        /// create, made unique with -2, -3, ... if needed, and left alone on update.
        /// </summary>
        private async Task<(string? Slug, ServiceResult<Article>? Error)> ResolveSlugAsync(ArticleInput input, Article? existing, CancellationToken ct)
        {
            if (Clean(input.Slug)?.ToLowerInvariant() is { } requested)
            {
                return await SlugTakenAsync(requested, existing?.Id, ct) is { } clash
                    ? (null, SlugTaken(requested, clash))
                    : (requested, null);
            }

            if (existing is not null) return (existing.Slug, null);

            var baseSlug = ArticleRules.Slugify(input.Title);
            if (baseSlug.Length == 0) baseSlug = $"article-{Guid.NewGuid():N}"[..16];

            var candidate = baseSlug;
            for (var attempt = 2; await SlugTakenAsync(candidate, null, ct) is not null; attempt++)
            {
                var suffix = $"-{attempt}";
                candidate = baseSlug.Length + suffix.Length > ArticleRules.SlugMaxLength
                    ? baseSlug[..(ArticleRules.SlugMaxLength - suffix.Length)].TrimEnd('-') + suffix
                    : baseSlug + suffix;
            }

            return (candidate, null);
        }

        private sealed record SlugClash(string Title, bool IsDeleted);

        /// <summary>Checked against deleted articles too: a restore must never collide with a newer article.</summary>
        private async Task<SlugClash?> SlugTakenAsync(string slug, int? existingId, CancellationToken ct) =>
            await db.Articles.IgnoreQueryFilters()
                .Where(a => a.Slug == slug && a.Id != existingId)
                .Select(a => new SlugClash(a.Title, a.IsDeleted))
                .FirstOrDefaultAsync(ct);

        private static ServiceResult<Article> SlugTaken(string slug, SlugClash? clash = null) =>
            ServiceResult<Article>.Fail(ServiceError.Conflict, clash is null
                ? $"The URL \"{slug}\" was just taken by another article. Choose a different one."
                : clash.IsDeleted
                    ? $"The URL \"{slug}\" belongs to the deleted article \"{clash.Title}\". Restore that article instead, or use another URL."
                    : $"The URL \"{slug}\" is already used by \"{clash.Title}\". Choose a different one.");
    }
}
