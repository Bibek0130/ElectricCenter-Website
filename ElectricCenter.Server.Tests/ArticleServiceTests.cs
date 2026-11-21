using ElectricCenter.Server.Articles;
using ElectricCenter.Server.Auth;
using Microsoft.EntityFrameworkCore;

namespace ElectricCenter.Server.Tests
{
    public class ArticleServiceTests : IDisposable
    {
        private static readonly Guid AdminId = Guid.NewGuid();
        private readonly AuthTestContext _ctx = new();
        private readonly ArticleService _articles;

        public ArticleServiceTests() => _articles = new ArticleService(_ctx.Db, _ctx.Time);

        public void Dispose() => _ctx.Dispose();

        private static ArticleInput Valid(string title = "Choosing an MCB", string? slug = null, bool published = false,
            string? author = "Sita Rai", string? cover = null, string? body = null) =>
            new(title, slug, "How to pick the right miniature circuit breaker for your home.", body ?? "## Rating\n\nPick 16A for lighting.",
                cover, cover is null ? null : "A 63A MCB", author, published);

        private async Task<Data.Entities.Article> CreateAsync(ArticleInput input)
        {
            var result = await _articles.CreateAsync(input, AdminId);
            Assert.True(result.Succeeded, result.Message);
            return result.Value!;
        }

        [Fact]
        public async Task Create_saves_a_draft_with_a_slug_from_the_title_and_audit_fields()
        {
            var article = await CreateAsync(Valid());

            Assert.True(article.Id > 0);
            Assert.Equal("choosing-an-mcb", article.Slug);
            Assert.False(article.IsPublished);
            Assert.Null(article.PublishedAtUtc);
            Assert.Equal(AdminId, article.CreatedByUserId);
            Assert.NotEqual(Guid.Empty, article.Version);
            Assert.Equal("Sita Rai", article.AuthorName);
            Assert.False(article.IsDeleted);
        }

        [Fact]
        public async Task Create_trims_text_and_works_out_the_reading_time_once()
        {
            var words = string.Join(' ', Enumerable.Repeat("word", 450));
            var article = await CreateAsync(Valid(title: "  Spaced title  ", body: $"\n\n{words}\n\n"));

            Assert.Equal("Spaced title", article.Title);
            Assert.Equal(words, article.BodyMarkdown);
            Assert.Equal(3, article.ReadingMinutes); // 450 words at 200 a minute, rounded up
        }

        [Fact]
        public async Task The_byline_defaults_to_the_admin_who_wrote_it()
        {
            _ctx.Db.Users.Add(new Data.Entities.User
            {
                Id = AdminId, Email = "writer@example.com", PasswordHash = "x", FullName = "Bibek Mainali", EmailConfirmed = true,
                CreatedAtUtc = _ctx.Time.GetUtcNow().UtcDateTime,
            });
            await _ctx.Db.SaveChangesAsync();

            var article = await CreateAsync(Valid(author: null));

            Assert.Equal("Bibek Mainali", article.AuthorName);
        }

        [Fact]
        public async Task Publishing_stamps_the_date_and_keeps_it_through_unpublish_and_republish()
        {
            var created = await CreateAsync(Valid());
            Assert.Null(created.PublishedAtUtc);

            var firstPublish = _ctx.Time.GetUtcNow().UtcDateTime;
            var published = (await _articles.UpdateAsync(created.Id, Valid(published: true), created.Version, AdminId)).Value!;
            Assert.True(published.IsPublished);
            Assert.Equal(firstPublish, published.PublishedAtUtc);

            _ctx.Time.Advance(TimeSpan.FromDays(3));
            var unpublished = (await _articles.UpdateAsync(created.Id, Valid(published: false), published.Version, AdminId)).Value!;
            Assert.False(unpublished.IsPublished);
            Assert.Equal(firstPublish, unpublished.PublishedAtUtc);

            _ctx.Time.Advance(TimeSpan.FromDays(3));
            var republished = (await _articles.UpdateAsync(created.Id, Valid(published: true), unpublished.Version, AdminId)).Value!;
            Assert.Equal(firstPublish, republished.PublishedAtUtc); // the public date doesn't jump
            Assert.Equal(_ctx.Time.GetUtcNow().UtcDateTime, republished.UpdatedAtUtc);
        }

        [Fact]
        public async Task Creating_as_published_stamps_the_date_straight_away()
        {
            var article = await CreateAsync(Valid(published: true));

            Assert.Equal(_ctx.Time.GetUtcNow().UtcDateTime, article.PublishedAtUtc);
        }

        [Fact]
        public async Task A_blank_slug_is_made_unique_with_a_number()
        {
            var first = await CreateAsync(Valid("Same Title"));
            var second = await CreateAsync(Valid("Same Title"));
            var third = await CreateAsync(Valid("Same Title"));

            Assert.Equal("same-title", first.Slug);
            Assert.Equal("same-title-2", second.Slug);
            Assert.Equal("same-title-3", third.Slug);
        }

        [Fact]
        public async Task A_title_with_no_latin_letters_still_gets_a_valid_slug()
        {
            var article = await CreateAsync(Valid("विद्युत सुरक्षा"));

            Assert.Matches(ArticleRules.SlugPattern(), article.Slug);
            Assert.StartsWith("article-", article.Slug);
            Assert.True(article.Slug.Length <= ArticleRules.SlugMaxLength);
        }

        [Fact]
        public async Task A_typed_slug_is_normalised_and_kept()
        {
            var article = await CreateAsync(Valid(slug: "  My-Custom-Address "));

            Assert.Equal("my-custom-address", article.Slug);
        }

        [Fact]
        public async Task A_typed_slug_that_is_taken_is_refused_not_silently_changed()
        {
            await CreateAsync(Valid("First", slug: "taken"));

            var result = await _articles.CreateAsync(Valid("Second", slug: "taken"), AdminId);

            Assert.False(result.Succeeded);
            Assert.Equal(ServiceError.Conflict, result.Error);
            Assert.Contains("already used by \"First\"", result.Message);
        }

        [Fact]
        public async Task A_deleted_articles_slug_stays_reserved_so_a_restore_cannot_collide()
        {
            var original = await CreateAsync(Valid("Old", slug: "reserved"));
            await _articles.DeleteAsync(original.Id, AdminId);

            var result = await _articles.CreateAsync(Valid("New", slug: "reserved"), AdminId);

            Assert.False(result.Succeeded);
            Assert.Equal(ServiceError.Conflict, result.Error);
            Assert.Contains("deleted article \"Old\"", result.Message);
        }

        [Fact]
        public async Task An_automatic_slug_steps_around_a_deleted_articles_address_too()
        {
            var original = await CreateAsync(Valid("Old")); // takes "old"
            await _articles.DeleteAsync(original.Id, AdminId);

            Assert.Equal("old-2", (await CreateAsync(Valid("Old"))).Slug);
        }

        public static TheoryData<ArticleInput, string> InvalidInputs => new()
        {
            { Valid() with { Title = " " }, "Title is required" },
            { Valid() with { Title = new string('x', 111) }, "Title must be at most 110" },
            { Valid() with { Summary = "" }, "summary is required" },
            { Valid() with { Summary = new string('x', 301) }, "Summary must be at most 300" },
            { Valid() with { BodyMarkdown = "  " }, "text is required" },
            { Valid() with { BodyMarkdown = new string('x', 50_001) }, "at most 50,000" },
            { Valid() with { Slug = "Has Spaces" }, "lowercase letters" },
            { Valid() with { Slug = "double--hyphen" }, "lowercase letters" },
            { Valid() with { Slug = new string('a', 81) }, "lowercase letters" },
            { Valid(cover: "http://example.com/a.jpg"), "https link" },
            { Valid(cover: "javascript:alert(1)"), "https link" },
            { Valid(cover: "not a url"), "https link" },
            { Valid() with { AuthorName = new string('x', 81) }, "Author name" },
            { Valid(cover: "https://example.com/a.jpg") with { CoverImageAlt = new string('x', 151) }, "Cover image description" },
        };

        [Theory]
        [MemberData(nameof(InvalidInputs))]
        public async Task Create_rejects_invalid_input(ArticleInput input, string expectedMessage)
        {
            var result = await _articles.CreateAsync(input, AdminId);

            Assert.False(result.Succeeded);
            Assert.Equal(ServiceError.Validation, result.Error);
            Assert.Contains(expectedMessage, result.Message, StringComparison.OrdinalIgnoreCase);
            Assert.Empty(await _ctx.Db.Articles.ToListAsync());
        }

        [Fact]
        public async Task The_cover_description_is_dropped_when_there_is_no_cover_image()
        {
            var article = await CreateAsync(Valid() with { CoverImageAlt = "orphan description" });

            Assert.Null(article.CoverImageUrl);
            Assert.Null(article.CoverImageAlt);
        }

        [Fact]
        public async Task Update_changes_the_fields_and_rotates_the_version()
        {
            var created = await CreateAsync(Valid());
            _ctx.Time.Advance(TimeSpan.FromHours(2));

            var result = await _articles.UpdateAsync(created.Id, Valid("Renamed", slug: "renamed", cover: "https://example.com/a.jpg"), created.Version, AdminId);

            Assert.True(result.Succeeded, result.Message);
            var updated = result.Value!;
            Assert.Equal("Renamed", updated.Title);
            Assert.Equal("renamed", updated.Slug);
            Assert.Equal("https://example.com/a.jpg", updated.CoverImageUrl);
            Assert.NotEqual(created.Version, updated.Version);
            Assert.Equal(_ctx.Time.GetUtcNow().UtcDateTime, updated.UpdatedAtUtc);
            Assert.Equal(AdminId, updated.UpdatedByUserId);
        }

        [Fact]
        public async Task Update_without_a_slug_keeps_the_current_one_and_without_an_author_keeps_the_byline()
        {
            var created = await CreateAsync(Valid(slug: "keep-me", author: "Original Author"));

            var updated = (await _articles.UpdateAsync(created.Id, Valid("New title", slug: null, author: null), created.Version, AdminId)).Value!;

            Assert.Equal("keep-me", updated.Slug);
            Assert.Equal("Original Author", updated.AuthorName);
            Assert.Equal("New title", updated.Title);
        }

        [Fact]
        public async Task Update_with_a_stale_version_is_a_conflict_and_changes_nothing()
        {
            var created = await CreateAsync(Valid());
            await _articles.UpdateAsync(created.Id, Valid("Edited by someone else"), created.Version, AdminId);

            var stale = await _articles.UpdateAsync(created.Id, Valid("My edit"), created.Version, AdminId);

            Assert.False(stale.Succeeded);
            Assert.Equal(ServiceError.Conflict, stale.Error);
            Assert.Contains("changed by someone else", stale.Message);
            Assert.Equal("Edited by someone else", (await _articles.GetForAdminAsync(created.Id))!.Title);
        }

        [Fact]
        public async Task Update_needs_a_version_and_an_existing_article()
        {
            var created = await CreateAsync(Valid());

            Assert.Equal(ServiceError.Validation, (await _articles.UpdateAsync(created.Id, Valid(), null, AdminId)).Error);
            Assert.Equal(ServiceError.NotFound, (await _articles.UpdateAsync(9999, Valid(), Guid.NewGuid(), AdminId)).Error);
        }

        [Fact]
        public async Task Update_cannot_take_another_articles_slug()
        {
            await CreateAsync(Valid("One", slug: "one"));
            var two = await CreateAsync(Valid("Two", slug: "two"));

            var result = await _articles.UpdateAsync(two.Id, Valid("Two", slug: "one"), two.Version, AdminId);

            Assert.Equal(ServiceError.Conflict, result.Error);
        }

        [Fact]
        public async Task An_article_can_keep_its_own_slug_when_saved_again()
        {
            var created = await CreateAsync(Valid(slug: "mine"));

            var result = await _articles.UpdateAsync(created.Id, Valid("Retitled", slug: "mine"), created.Version, AdminId);

            Assert.True(result.Succeeded, result.Message);
        }

        [Fact]
        public async Task Delete_hides_the_article_everywhere_but_keeps_the_row_and_restore_brings_it_back()
        {
            var created = await CreateAsync(Valid(published: true));

            var deleted = await _articles.DeleteAsync(created.Id, AdminId);

            Assert.True(deleted.Succeeded, deleted.Message);
            Assert.True(deleted.Value!.IsDeleted);
            Assert.Equal(AdminId, deleted.Value.DeletedByUserId);
            Assert.Null(await _articles.GetPublishedBySlugAsync(created.Slug));
            Assert.Empty(await _articles.ListPublishedAsync());
            Assert.Empty(await _articles.ListForAdminAsync(includeDeleted: false));
            Assert.Single(await _articles.ListForAdminAsync(includeDeleted: true));
            Assert.Equal(1, await _ctx.Db.Articles.IgnoreQueryFilters().CountAsync()); // never hard-deleted

            var restored = await _articles.RestoreAsync(created.Id, AdminId);

            Assert.True(restored.Succeeded, restored.Message);
            Assert.False(restored.Value!.IsDeleted);
            Assert.NotNull(await _articles.GetPublishedBySlugAsync(created.Slug));
        }

        [Fact]
        public async Task A_deleted_article_must_be_restored_before_it_can_be_edited()
        {
            var created = await CreateAsync(Valid());
            var deleted = (await _articles.DeleteAsync(created.Id, AdminId)).Value!;

            var result = await _articles.UpdateAsync(created.Id, Valid("Edit"), deleted.Version, AdminId);

            Assert.Equal(ServiceError.NotFound, result.Error);
        }

        [Fact]
        public async Task Restore_only_works_on_a_deleted_article()
        {
            var created = await CreateAsync(Valid());

            Assert.Equal(ServiceError.Validation, (await _articles.RestoreAsync(created.Id, AdminId)).Error);
            Assert.Equal(ServiceError.NotFound, (await _articles.RestoreAsync(9999, AdminId)).Error);
            Assert.Equal(ServiceError.NotFound, (await _articles.DeleteAsync(9999, AdminId)).Error);
        }

        [Fact]
        public async Task The_public_sees_published_articles_only_newest_first()
        {
            var older = await CreateAsync(Valid("Older", published: true));
            _ctx.Time.Advance(TimeSpan.FromDays(1));
            var newer = await CreateAsync(Valid("Newer", published: true));
            await CreateAsync(Valid("Draft only"));

            var listed = await _articles.ListPublishedAsync();

            Assert.Equal([newer.Id, older.Id], listed.Select(a => a.Id));
            Assert.All(listed, a => Assert.True(a.IsPublished));
            Assert.Null(await _articles.GetPublishedBySlugAsync("draft-only"));
            Assert.NotNull(await _articles.GetPublishedBySlugAsync("newer"));
        }

        [Fact]
        public async Task Admins_see_drafts_too_and_deleted_ones_when_asked()
        {
            var published = await CreateAsync(Valid("Live", published: true));
            var draft = await CreateAsync(Valid("Draft"));
            var gone = await CreateAsync(Valid("Gone", published: true));
            await _articles.DeleteAsync(gone.Id, AdminId);

            var withoutDeleted = await _articles.ListForAdminAsync(includeDeleted: false);
            var withDeleted = await _articles.ListForAdminAsync(includeDeleted: true);

            Assert.Equal(new[] { published.Id, draft.Id }.Order(), withoutDeleted.Select(a => a.Id).Order());
            Assert.Equal(3, withDeleted.Count);
            Assert.True(withDeleted.Single(a => a.Id == gone.Id).IsDeleted);
        }

        [Fact]
        public async Task The_sitemap_lists_only_published_articles_with_their_last_change()
        {
            var live = await CreateAsync(Valid("Live", published: true));
            await CreateAsync(Valid("Draft"));
            _ctx.Time.Advance(TimeSpan.FromDays(5));
            await _articles.UpdateAsync(live.Id, Valid("Live edited", published: true), live.Version, AdminId);

            var entries = await _articles.ListForSitemapAsync();

            var entry = Assert.Single(entries);
            Assert.Equal("live", entry.Slug);
            Assert.Equal(_ctx.Time.GetUtcNow().UtcDateTime, entry.LastModifiedUtc);
        }

        [Fact]
        public async Task Searching_by_slug_is_exact()
        {
            await CreateAsync(Valid("Wiring Basics", published: true));

            Assert.NotNull(await _articles.GetPublishedBySlugAsync("wiring-basics"));
            Assert.Null(await _articles.GetPublishedBySlugAsync("wiring"));
            Assert.Null(await _articles.GetPublishedBySlugAsync("wiring-basics-2"));
            Assert.Null(await _articles.GetPublishedBySlugAsync(""));
        }
    }
}
