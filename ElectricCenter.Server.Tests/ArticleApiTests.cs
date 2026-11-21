using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using ElectricCenter.Server.Auth;
using ElectricCenter.Server.Contracts;

namespace ElectricCenter.Server.Tests
{
    public class ArticleApiTests(AuthApiFactory factory) : IClassFixture<AuthApiFactory>, IAsyncLifetime
    {
        private const string Password = "integration password";

        public Task InitializeAsync() => factory.EnsureDatabaseAsync();
        public Task DisposeAsync() => Task.CompletedTask;

        private sealed record ItemList<T>(List<T> Items, int Total);

        private async Task<HttpClient> SignedInClientAsync(params string[] roles)
        {
            var email = $"user-{Guid.NewGuid():N}@example.com";
            await factory.CreateUserAsync(email, Password, verified: true, roles);
            var client = factory.CreateSpaClient();
            var login = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, Password));
            Assert.Equal(HttpStatusCode.OK, login.StatusCode);
            var token = (await login.Content.ReadFromJsonAsync<AuthResponse>())!.AccessToken;
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            return client;
        }

        /// <summary>A title unique to this test run, so tests sharing the database never see each other's articles.</summary>
        private static string Unique(string prefix = "Article") => $"{prefix} {Guid.NewGuid():N}"[..32];

        private static SaveArticleRequest NewArticle(string? title = null, string? slug = null, bool published = false, Guid? version = null,
            string body = "## Heading\n\nSome **bold** text.", string? cover = null) =>
            new(title ?? Unique(), slug, "A short summary that search engines can show under the title.", body, cover,
                cover is null ? null : "Cover description", "Sita Rai", published, version);

        private static async Task<AdminArticleDto> CreateAsync(HttpClient admin, SaveArticleRequest request)
        {
            var response = await admin.PostAsJsonAsync("/api/admin/articles", request);
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            return (await response.Content.ReadFromJsonAsync<AdminArticleDto>())!;
        }

        [Fact]
        public async Task Anyone_can_read_published_articles_but_not_drafts()
        {
            var admin = await SignedInClientAsync(Roles.Admin);
            var anonymous = factory.CreateSpaClient();
            var live = await CreateAsync(admin, NewArticle(published: true));
            var draft = await CreateAsync(admin, NewArticle());

            var list = (await anonymous.GetFromJsonAsync<ItemList<ArticleSummaryDto>>("/api/articles"))!;

            Assert.Contains(list.Items, a => a.Slug == live.Slug);
            Assert.DoesNotContain(list.Items, a => a.Slug == draft.Slug);
            Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync($"/api/articles/{live.Slug}")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"/api/articles/{draft.Slug}")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync("/api/articles/does-not-exist")).StatusCode);
        }

        [Fact]
        public async Task Even_an_admin_gets_not_found_for_a_draft_on_the_public_endpoint()
        {
            var admin = await SignedInClientAsync(Roles.Admin);
            var draft = await CreateAsync(admin, NewArticle());

            Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync($"/api/articles/{draft.Slug}")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync($"/api/admin/articles/{draft.Id}")).StatusCode); // admins use their own endpoint
        }

        [Fact]
        public async Task The_public_article_carries_rendered_safe_html_and_no_markdown_source()
        {
            var admin = await SignedInClientAsync(Roles.Admin);
            var hostile = "## Safe heading\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(2))\n\n![x](http://insecure.example/a.jpg)";
            var created = await CreateAsync(admin, NewArticle(published: true, body: hostile));

            var raw = await factory.CreateSpaClient().GetStringAsync($"/api/articles/{created.Slug}");
            var article = (await factory.CreateSpaClient().GetFromJsonAsync<ArticleDto>($"/api/articles/{created.Slug}"))!;

            Assert.Contains("<h2>Safe heading</h2>", article.BodyHtml);
            Assert.DoesNotContain("<script", article.BodyHtml, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("javascript:", article.BodyHtml, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("<img", article.BodyHtml);
            Assert.DoesNotContain("bodyMarkdown", raw, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("isPublished", raw, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("version", raw, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public async Task A_public_slug_lookup_ignores_case()
        {
            var admin = await SignedInClientAsync(Roles.Admin);
            var created = await CreateAsync(admin, NewArticle(published: true));

            var response = await factory.CreateSpaClient().GetAsync($"/api/articles/{created.Slug.ToUpperInvariant()}");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        [Fact]
        public async Task Only_admins_can_use_the_admin_endpoints()
        {
            var admin = await SignedInClientAsync(Roles.Admin);
            var created = await CreateAsync(admin, NewArticle());
            var anonymous = factory.CreateSpaClient();
            var customer = await SignedInClientAsync(Roles.Customer);
            var electrician = await SignedInClientAsync(Roles.Electrician);

            foreach (var (client, expected) in new[] { (anonymous, HttpStatusCode.Unauthorized), (customer, HttpStatusCode.Forbidden), (electrician, HttpStatusCode.Forbidden) })
            {
                Assert.Equal(expected, (await client.GetAsync("/api/admin/articles")).StatusCode);
                Assert.Equal(expected, (await client.GetAsync($"/api/admin/articles/{created.Id}")).StatusCode);
                Assert.Equal(expected, (await client.PostAsJsonAsync("/api/admin/articles", NewArticle())).StatusCode);
                Assert.Equal(expected, (await client.PutAsJsonAsync($"/api/admin/articles/{created.Id}", NewArticle(version: created.Version))).StatusCode);
                Assert.Equal(expected, (await client.DeleteAsync($"/api/admin/articles/{created.Id}")).StatusCode);
                Assert.Equal(expected, (await client.PostAsync($"/api/admin/articles/{created.Id}/restore", null)).StatusCode);
                Assert.Equal(expected, (await client.PostAsJsonAsync("/api/admin/articles/preview", new PreviewArticleRequest("x"))).StatusCode);
            }
        }

        [Fact]
        public async Task Admin_round_trip_create_edit_publish_unpublish_delete_restore()
        {
            var admin = await SignedInClientAsync(Roles.Admin);
            var anonymous = factory.CreateSpaClient();

            var created = await CreateAsync(admin, NewArticle("Round trip article", slug: $"round-trip-{Guid.NewGuid():N}"[..28]));
            Assert.False(created.IsPublished);
            Assert.Null(created.PublishedAt);
            Assert.Equal("Sita Rai", created.AuthorName);
            Assert.Contains("**bold**", created.BodyMarkdown);

            // Edit and publish in one save.
            var edited = await admin.PutAsJsonAsync($"/api/admin/articles/{created.Id}", NewArticle("Round trip, edited", created.Slug, published: true, version: created.Version));
            Assert.Equal(HttpStatusCode.OK, edited.StatusCode);
            var published = (await edited.Content.ReadFromJsonAsync<AdminArticleDto>())!;
            Assert.True(published.IsPublished);
            Assert.NotNull(published.PublishedAt);
            Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync($"/api/articles/{created.Slug}")).StatusCode);

            // Unpublish: gone for the public, kept (with its date) for admins.
            var unpublished = (await (await admin.PutAsJsonAsync($"/api/admin/articles/{created.Id}", NewArticle("Round trip, edited", created.Slug, published: false, version: published.Version)))
                .Content.ReadFromJsonAsync<AdminArticleDto>())!;
            Assert.False(unpublished.IsPublished);
            Assert.Equal(published.PublishedAt, unpublished.PublishedAt);
            Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"/api/articles/{created.Slug}")).StatusCode);

            // Delete is soft; restore brings it back as a draft.
            var deleted = await admin.DeleteAsync($"/api/admin/articles/{created.Id}");
            Assert.Equal(HttpStatusCode.OK, deleted.StatusCode);
            Assert.True((await deleted.Content.ReadFromJsonAsync<AdminArticleDto>())!.IsDeleted);
            var withoutDeleted = (await admin.GetFromJsonAsync<ItemList<AdminArticleSummaryDto>>("/api/admin/articles"))!;
            var withDeleted = (await admin.GetFromJsonAsync<ItemList<AdminArticleSummaryDto>>("/api/admin/articles?includeDeleted=true"))!;
            Assert.DoesNotContain(withoutDeleted.Items, a => a.Id == created.Id);
            Assert.Contains(withDeleted.Items, a => a.Id == created.Id && a.IsDeleted);

            var restored = await admin.PostAsync($"/api/admin/articles/{created.Id}/restore", null);
            Assert.Equal(HttpStatusCode.OK, restored.StatusCode);
            Assert.False((await restored.Content.ReadFromJsonAsync<AdminArticleDto>())!.IsDeleted);
        }

        [Fact]
        public async Task A_blank_address_is_generated_from_the_title_and_a_duplicate_one_is_a_409()
        {
            var admin = await SignedInClientAsync(Roles.Admin);
            var title = Unique("Wiring Guide");

            var first = await CreateAsync(admin, NewArticle(title));
            var second = await CreateAsync(admin, NewArticle(title));

            Assert.StartsWith("wiring-guide-", first.Slug);
            Assert.Equal($"{first.Slug}-2", second.Slug);

            var clash = await admin.PostAsJsonAsync("/api/admin/articles", NewArticle(Unique(), slug: first.Slug));
            Assert.Equal(HttpStatusCode.Conflict, clash.StatusCode);
            Assert.Contains("already used", await clash.Content.ReadAsStringAsync());
        }

        [Fact]
        public async Task Saving_with_an_out_of_date_version_is_a_409()
        {
            var admin = await SignedInClientAsync(Roles.Admin);
            var created = await CreateAsync(admin, NewArticle());
            Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync($"/api/admin/articles/{created.Id}", NewArticle(created.Title, created.Slug, version: created.Version))).StatusCode);

            var stale = await admin.PutAsJsonAsync($"/api/admin/articles/{created.Id}", NewArticle(created.Title, created.Slug, version: created.Version));

            Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
            Assert.Contains("changed by someone else", await stale.Content.ReadAsStringAsync());
        }

        [Fact]
        public async Task Validation_errors_come_back_as_400_with_a_message()
        {
            var admin = await SignedInClientAsync(Roles.Admin);

            var response = await admin.PostAsJsonAsync("/api/admin/articles", NewArticle() with { Summary = "" });

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Contains("summary", await response.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public async Task Missing_articles_are_404()
        {
            var admin = await SignedInClientAsync(Roles.Admin);

            Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync("/api/admin/articles/999999")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await admin.DeleteAsync("/api/admin/articles/999999")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await admin.PostAsync("/api/admin/articles/999999/restore", null)).StatusCode);
        }

        [Fact]
        public async Task A_cover_image_must_be_https()
        {
            var admin = await SignedInClientAsync(Roles.Admin);

            var insecure = await admin.PostAsJsonAsync("/api/admin/articles", NewArticle(cover: "http://example.com/a.jpg"));
            var secure = await admin.PostAsJsonAsync("/api/admin/articles", NewArticle(cover: "https://res.cloudinary.com/demo/image/upload/a.jpg"));

            Assert.Equal(HttpStatusCode.BadRequest, insecure.StatusCode);
            Assert.Equal(HttpStatusCode.Created, secure.StatusCode);
        }

        [Fact]
        public async Task Preview_renders_markdown_exactly_as_the_public_page_will()
        {
            var admin = await SignedInClientAsync(Roles.Admin);
            var markdown = "# Title\n\nText with <b>raw html</b> and [a link](https://example.com).";

            var response = await admin.PostAsJsonAsync("/api/admin/articles/preview", new PreviewArticleRequest(markdown));
            var html = (await response.Content.ReadFromJsonAsync<Dictionary<string, string>>())!["html"];

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Contains("<h2>Title</h2>", html);
            Assert.Contains("&lt;b&gt;raw html&lt;/b&gt;", html);
            Assert.Contains("""<a href="https://example.com">a link</a>""", html);

            var created = await CreateAsync(admin, NewArticle(published: true, body: markdown));
            var published = (await factory.CreateSpaClient().GetFromJsonAsync<ArticleDto>($"/api/articles/{created.Slug}"))!;
            Assert.Equal(html, published.BodyHtml);
        }

        [Fact]
        public async Task Preview_refuses_text_longer_than_an_article_may_be()
        {
            var admin = await SignedInClientAsync(Roles.Admin);

            var response = await admin.PostAsJsonAsync("/api/admin/articles/preview", new PreviewArticleRequest(new string('x', 50_001)));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }
    }
}
