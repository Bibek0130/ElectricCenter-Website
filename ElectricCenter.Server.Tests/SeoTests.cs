using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Xml.Linq;
using ElectricCenter.Server.Auth;
using ElectricCenter.Server.Contracts;
using ElectricCenter.Server.Data;
using ElectricCenter.Server.Data.Entities;
using ElectricCenter.Server.Seo;
using Microsoft.Extensions.DependencyInjection;

namespace ElectricCenter.Server.Tests
{
    /// <summary>
    /// What a search engine or a link-preview bot (neither runs JavaScript) receives: the page's own tags written into the
    /// HTML, real status codes, robots.txt and a sitemap.
    /// </summary>
    public class SeoTests(SeoApiFactory factory) : IClassFixture<SeoApiFactory>, IAsyncLifetime
    {
        private const string Base = "https://localhost"; // the test client's address; no Site:BaseUrl is set for this factory
        private static readonly SeoSiteData Data = SeoApiFactory.Data;

        public Task InitializeAsync() => factory.EnsureDatabaseAsync();
        public Task DisposeAsync() => Task.CompletedTask;

        private async Task<(HttpResponseMessage Response, string Html)> GetAsync(string path)
        {
            var response = await factory.CreateSpaClient().GetAsync(path);
            return (response, await response.Content.ReadAsStringAsync());
        }

        private static string Unique(string prefix = "Article") => $"{prefix} {Guid.NewGuid():N}"[..32];

        private async Task<AdminArticleDto> CreateArticleAsync(HttpClient admin, string title, bool published = true, string? summary = null,
            string? author = "Sita Rai", string? cover = null, string body = "## Wiring\n\nUse **proper** cable.")
        {
            var request = new SaveArticleRequest(title, null, summary ?? "A summary that search engines can show under the title.", body,
                cover, cover is null ? null : "Cover picture", author, published, null);
            var response = await admin.PostAsJsonAsync("/api/admin/articles", request);
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            return (await response.Content.ReadFromJsonAsync<AdminArticleDto>())!;
        }

        // ---------- fixed pages ----------

        [Fact]
        public async Task The_home_page_has_its_own_title_description_canonical_address_and_social_tags()
        {
            var (response, html) = await GetAsync("/");
            var page = Data.Pages["/"];

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.StartsWith("text/html", response.Content.Headers.ContentType!.ToString());
            Assert.Equal(Data.FormatTitle(page.Title), Html.Title(html));
            Assert.Equal(page.Description, Html.Meta(html, "name", "description"));
            Assert.Equal($"{Base}/", Html.Canonical(html));
            Assert.Equal("index, follow, max-image-preview:large", Html.Meta(html, "name", "robots"));
            Assert.Equal(Base, Html.Meta(html, "name", "site-base-url"));

            Assert.Equal("website", Html.Meta(html, "property", "og:type"));
            Assert.Equal(Data.FormatTitle(page.Title), Html.Meta(html, "property", "og:title"));
            Assert.Equal($"{Base}/", Html.Meta(html, "property", "og:url"));
            Assert.Equal($"{Base}{Data.Site.DefaultImage}", Html.Meta(html, "property", "og:image"));
            Assert.Equal(Data.Site.DefaultImageWidth.ToString(), Html.Meta(html, "property", "og:image:width"));
            Assert.Equal("summary_large_image", Html.Meta(html, "name", "twitter:card"));
            Assert.Equal($"{Base}{Data.Site.DefaultImage}", Html.Meta(html, "name", "twitter:image"));
            Assert.Equal(Data.Site.Name, Html.Meta(html, "property", "og:site_name"));
        }

        [Fact]
        public async Task The_templates_own_placeholder_title_and_description_are_replaced_not_duplicated()
        {
            var (_, html) = await GetAsync("/about");

            Assert.DoesNotContain("Default title from the template", html);
            Assert.DoesNotContain("Default description from the template", html);
            Assert.DoesNotContain("seo-head", html); // the marker comments are consumed
            Assert.DoesNotContain("seo-body", html);
            Assert.Equal(1, Html.Count(html, "<title>"));
            Assert.Equal(1, Html.Count(html, "<meta name=\"description\""));
            Assert.Contains("""<link rel="icon" """.TrimEnd(), html); // the rest of the template is untouched
            Assert.Contains("/assets/index-test.js", html);
        }

        public static TheoryData<string> IndexablePaths => new(SeoApiFactory.Data.Pages.Where(p => p.Value.Indexable).Select(p => p.Key));

        [Theory]
        [MemberData(nameof(IndexablePaths))]
        public async Task Every_public_page_is_served_with_its_own_tags(string path)
        {
            var (response, html) = await GetAsync(path);
            var entry = Data.Pages[path];

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(Data.FormatTitle(entry.Title), Html.Title(html));
            Assert.Equal(entry.Description, Html.Meta(html, "name", "description"));
            Assert.Equal(path == "/" ? $"{Base}/" : $"{Base}{path}", Html.Canonical(html));
            Assert.Equal("index, follow, max-image-preview:large", Html.Meta(html, "name", "robots"));
            Assert.False(response.Headers.Contains("X-Robots-Tag"));
        }

        [Theory]
        [InlineData("/About")]
        [InlineData("/about/")]
        public async Task Addresses_differing_only_in_case_or_slashes_get_the_same_page_and_the_same_canonical_address(string path)
        {
            var (response, html) = await GetAsync(path);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal($"{Base}/about", Html.Canonical(html));
        }

        [Fact]
        public async Task The_home_page_describes_the_shop_as_a_local_business()
        {
            var (_, html) = await GetAsync("/");
            var jsonLd = Html.JsonLd(html)!.Value;
            var business = Html.Nodes(jsonLd, "ElectricalContractor").Single();

            Assert.Equal("https://schema.org", jsonLd.GetProperty("@context").GetString());
            Assert.Equal(Data.Business.Name, business.GetProperty("name").GetString());
            Assert.Equal(Data.Business.Phone, business.GetProperty("telephone").GetString());
            Assert.Equal("PostalAddress", business.GetProperty("address").GetProperty("@type").GetString());
            Assert.Equal(Data.Business.Address.Locality, business.GetProperty("address").GetProperty("addressLocality").GetString());
            Assert.Equal(Data.Business.Geo.Latitude, business.GetProperty("geo").GetProperty("latitude").GetDouble());
            Assert.Equal(Data.Business.OpeningHours.Length, business.GetProperty("openingHoursSpecification").GetArrayLength());
            Assert.Equal($"{Base}{Data.Site.Logo}", business.GetProperty("logo").GetString());
            Assert.Equal($"{Base}/", business.GetProperty("url").GetString());

            var website = Html.Nodes(jsonLd, "WebSite").Single();
            Assert.Equal($"{Base}/", website.GetProperty("url").GetString());
            Assert.Equal("/", Html.JsonLdRoute(html));
        }

        [Fact]
        public async Task The_faq_page_marks_up_exactly_the_questions_and_answers_it_shows()
        {
            var (_, html) = await GetAsync("/faq");
            var faq = Html.Nodes(Html.JsonLd(html)!.Value, "FAQPage").Single();
            var questions = faq.GetProperty("mainEntity").EnumerateArray().ToList();
            var noscript = Html.Noscript(html);

            Assert.Equal(Data.Faqs.Length, questions.Count);
            for (var i = 0; i < questions.Count; i++)
            {
                Assert.Equal(Data.Faqs[i].Question, questions[i].GetProperty("name").GetString());
                Assert.Equal(Data.Faqs[i].Answer, questions[i].GetProperty("acceptedAnswer").GetProperty("text").GetString());
                Assert.Contains(WebUtility.HtmlEncode(Data.Faqs[i].Question), noscript);
            }
        }

        [Fact]
        public async Task A_page_without_structured_data_has_no_json_ld_block()
        {
            var (_, html) = await GetAsync("/about");

            Assert.Null(Html.JsonLd(html));
        }

        [Fact]
        public async Task Without_javascript_a_visitor_still_gets_the_pages_heading_text_and_the_sites_links()
        {
            var (_, html) = await GetAsync("/services");
            var noscript = Html.Noscript(html);

            Assert.Contains("<h1>Our Services</h1>", noscript);
            Assert.Contains(WebUtility.HtmlEncode(Data.Pages["/services"].Description!), noscript);
            foreach (var link in Data.Nav) Assert.Contains($"""<a href="{link.To}">{link.Label}</a>""", noscript);
            Assert.Contains(Data.Business.Phone, noscript);
            Assert.Contains(Data.Business.Address.Street, noscript);
            Assert.Contains("""<div id="root"><noscript>""", html); // inside #root, which React clears when it starts
        }

        // ---------- pages that must stay out of search ----------

        [Theory]
        [InlineData("/login")]
        [InlineData("/register")]
        [InlineData("/verify-email")]
        [InlineData("/account")]
        [InlineData("/settings")]
        [InlineData("/products/checkout")]
        [InlineData("/products/confirmation")]
        [InlineData("/admin/articles/new")]
        [InlineData("/admin/articles/7/edit")]
        public async Task Account_checkout_and_admin_pages_are_kept_out_of_search_results(string path)
        {
            var (response, html) = await GetAsync(path);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode); // they are real pages
            Assert.Equal("noindex, nofollow", Html.Meta(html, "name", "robots"));
            Assert.Equal("noindex, nofollow", response.Headers.GetValues("X-Robots-Tag").Single());
            Assert.Null(Html.Canonical(html));
            Assert.Null(Html.JsonLd(html));
        }

        [Fact]
        public async Task These_pages_are_not_in_the_sitemap()
        {
            var sitemap = await factory.CreateSpaClient().GetStringAsync("/sitemap.xml");

            foreach (var path in new[] { "/login", "/register", "/account", "/settings", "/products/checkout", "/admin/articles/new" })
                Assert.DoesNotContain($"{Base}{path}<", sitemap);
        }

        // ---------- addresses that are not pages ----------

        [Theory]
        [InlineData("/nonexistent")]
        [InlineData("/products/some-product")]
        [InlineData("/articles/does-not-exist")]
        [InlineData("/electricians/999999")]
        [InlineData("/electricians/not-a-number")]
        [InlineData("/a/b/c/d")]
        public async Task An_address_that_is_not_a_page_is_a_real_404_that_search_engines_will_drop(string path)
        {
            var (response, html) = await GetAsync(path);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Equal("noindex, nofollow", Html.Meta(html, "name", "robots"));
            Assert.Equal("noindex, nofollow", response.Headers.GetValues("X-Robots-Tag").Single());
            Assert.Null(Html.Canonical(html));
            Assert.Contains("""<div id="root">""", html); // the app still loads, so its not-found page can show
        }

        [Fact]
        public async Task A_missing_file_is_a_plain_404_not_the_html_shell()
        {
            var (response, html) = await GetAsync("/assets/missing.js");

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.DoesNotContain("""<div id="root">""", html);
        }

        [Fact]
        public async Task An_unknown_api_address_is_a_json_404_not_a_page()
        {
            var (response, html) = await GetAsync("/api/nope");

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.DoesNotContain("<html", html, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public async Task Other_methods_on_a_page_address_do_not_get_the_page()
        {
            var response = await factory.CreateSpaClient().PostAsync("/about", null);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        // ---------- one address for the home page ----------

        [Theory]
        [InlineData("/home")]
        [InlineData("/HOME")]
        [InlineData("/home/")]
        [InlineData("/index.html")]
        public async Task Other_addresses_for_the_home_page_redirect_permanently_to_the_one_real_address(string path)
        {
            var response = await factory.CreateSpaClient().GetAsync(path);

            Assert.Equal(HttpStatusCode.MovedPermanently, response.StatusCode);
            Assert.Equal("/", response.Headers.Location!.OriginalString);
        }

        // ---------- the API stays crawlable but out of results ----------

        [Theory]
        [InlineData("/api/products")]
        [InlineData("/api/articles")]
        [InlineData("/api/settings")]
        public async Task The_api_is_marked_noindex_so_it_never_appears_in_results(string path)
        {
            var response = await factory.CreateSpaClient().GetAsync(path);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal("noindex", response.Headers.GetValues("X-Robots-Tag").Single());
        }

        // ---------- robots.txt and the sitemap ----------

        [Fact]
        public async Task Robots_txt_allows_everything_including_the_api_the_pages_need_and_points_at_the_sitemap()
        {
            var response = await factory.CreateSpaClient().GetAsync("/robots.txt");
            var text = await response.Content.ReadAsStringAsync();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.StartsWith("text/plain", response.Content.Headers.ContentType!.ToString());
            Assert.Contains("User-agent: *", text);
            Assert.Contains("Allow: /", text);
            Assert.Contains($"Sitemap: {Base}/sitemap.xml", text);
            // Google runs the page's JavaScript, which fetches products and articles from /api. Blocking it would show Google empty pages.
            Assert.DoesNotContain("Disallow", text);
        }

        [Fact]
        public async Task The_sitemap_is_valid_xml_listing_the_public_pages_with_absolute_addresses()
        {
            var response = await factory.CreateSpaClient().GetAsync("/sitemap.xml");
            var xml = XDocument.Parse(await response.Content.ReadAsStringAsync());
            XNamespace ns = "http://www.sitemaps.org/schemas/sitemap/0.9";
            var urls = xml.Root!.Elements(ns + "url").Select(u => u.Element(ns + "loc")!.Value).ToList();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.StartsWith("application/xml", response.Content.Headers.ContentType!.ToString());
            Assert.Equal(ns + "urlset", xml.Root.Name);
            foreach (var path in Data.Pages.Where(p => p.Value.Indexable).Select(p => p.Key))
                Assert.Contains(path == "/" ? $"{Base}/" : $"{Base}{path}", urls);
            Assert.All(urls, url => Assert.StartsWith($"{Base}/", url));
            Assert.Equal(urls.Count, urls.Distinct().Count());
        }

        [Fact]
        public async Task The_sitemap_lists_published_articles_and_electricians_but_not_drafts_or_deleted_ones()
        {
            var admin = await TestAccounts.SignedInAsync(factory, Roles.Admin);
            var live = await CreateArticleAsync(admin, Unique("Live"));
            var draft = await CreateArticleAsync(admin, Unique("Draft"), published: false);
            var gone = await CreateArticleAsync(admin, Unique("Gone"));
            Assert.Equal(HttpStatusCode.OK, (await admin.DeleteAsync($"/api/admin/articles/{gone.Id}")).StatusCode);
            var (visibleId, deletedId) = await AddElectriciansAsync();

            var sitemap = await factory.CreateSpaClient().GetStringAsync("/sitemap.xml");

            Assert.Contains($"{Base}/articles/{live.Slug}<", sitemap);
            Assert.DoesNotContain($"/articles/{draft.Slug}<", sitemap);
            Assert.DoesNotContain($"/articles/{gone.Slug}<", sitemap);
            Assert.Contains($"{Base}/electricians/{visibleId}<", sitemap);
            Assert.DoesNotContain($"/electricians/{deletedId}<", sitemap);
            Assert.Matches($@"/articles/{live.Slug}</loc><lastmod>\d{{4}}-\d\d-\d\dT\d\d:\d\d:\d\dZ</lastmod>", sitemap);
        }

        [Fact]
        public async Task The_sitemap_escapes_addresses_so_it_stays_valid_xml()
        {
            var admin = await TestAccounts.SignedInAsync(factory, Roles.Admin);
            var request = new SaveArticleRequest(Unique("Tom & Jerry"), "tom-and-jerry-" + Guid.NewGuid().ToString("N")[..8], "A summary.", "Body text.", null, null, null, true, null);
            Assert.Equal(HttpStatusCode.Created, (await admin.PostAsJsonAsync("/api/admin/articles", request)).StatusCode);

            var response = await factory.CreateSpaClient().GetAsync("/sitemap.xml");

            XDocument.Parse(await response.Content.ReadAsStringAsync()); // throws if it isn't well-formed
        }

        // ---------- article pages ----------

        [Fact]
        public async Task A_published_article_page_has_article_tags_structured_data_and_the_full_text()
        {
            var admin = await TestAccounts.SignedInAsync(factory, Roles.Admin);
            var title = Unique("Choosing an MCB");
            var article = await CreateArticleAsync(admin, title, summary: "Pick the right breaker rating for your home.", author: "Sita Rai",
                cover: "https://res.cloudinary.com/demo/image/upload/mcb.jpg", body: "## Rating\n\nPick **16A** for lighting.\n\n- one\n- two");

            var (response, html) = await GetAsync($"/articles/{article.Slug}");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal($"{title} | {Data.Site.Name}", Html.Title(html));
            Assert.Equal("Pick the right breaker rating for your home.", Html.Meta(html, "name", "description"));
            Assert.Equal($"{Base}/articles/{article.Slug}", Html.Canonical(html));
            Assert.Equal("article", Html.Meta(html, "property", "og:type"));
            Assert.Equal("https://res.cloudinary.com/demo/image/upload/mcb.jpg", Html.Meta(html, "property", "og:image"));
            Assert.Equal("Cover picture", Html.Meta(html, "property", "og:image:alt"));
            Assert.Null(Html.Meta(html, "property", "og:image:width")); // the size is only known for the site image
            Assert.Equal("Sita Rai", Html.Meta(html, "property", "article:author"));
            Assert.Matches(@"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$", Html.Meta(html, "property", "article:published_time"));
            Assert.NotNull(Html.Meta(html, "property", "article:modified_time"));

            var jsonLd = Html.JsonLd(html)!.Value;
            var node = Html.Nodes(jsonLd, "Article").Single();
            Assert.Equal(title, node.GetProperty("headline").GetString());
            Assert.Equal("Pick the right breaker rating for your home.", node.GetProperty("description").GetString());
            Assert.Equal("Sita Rai", node.GetProperty("author").GetProperty("name").GetString());
            Assert.Equal(Data.Site.Name, node.GetProperty("publisher").GetProperty("name").GetString());
            Assert.Equal("https://res.cloudinary.com/demo/image/upload/mcb.jpg", node.GetProperty("image")[0].GetString());
            Assert.Equal($"{Base}/articles/{article.Slug}", node.GetProperty("mainEntityOfPage").GetProperty("@id").GetString());
            Assert.Matches(@"^\d{4}-\d\d-\d\dT", node.GetProperty("datePublished").GetString());
            Assert.Equal($"/articles/{article.Slug}", Html.JsonLdRoute(html));

            var crumbs = Html.Nodes(jsonLd, "BreadcrumbList").Single().GetProperty("itemListElement").EnumerateArray().ToList();
            Assert.Equal(["Home", "Articles", title], crumbs.Select(c => c.GetProperty("name").GetString()));
            Assert.Equal([1, 2, 3], crumbs.Select(c => c.GetProperty("position").GetInt32()));
            Assert.Equal($"{Base}/articles", crumbs[1].GetProperty("item").GetString());

            var noscript = Html.Noscript(html);
            Assert.Contains($"<h1>{title}</h1>", noscript);
            Assert.Contains("<h2>Rating</h2>", noscript);
            Assert.Contains("<strong>16A</strong>", noscript);
            Assert.Contains("<li>two</li>", noscript);
            Assert.Contains("By Sita Rai", noscript);
        }

        [Fact]
        public async Task An_article_without_a_cover_image_falls_back_to_the_site_image_for_previews()
        {
            var admin = await TestAccounts.SignedInAsync(factory, Roles.Admin);
            var article = await CreateArticleAsync(admin, Unique("No cover"));

            var (_, html) = await GetAsync($"/articles/{article.Slug}");

            Assert.Equal($"{Base}{Data.Site.DefaultImage}", Html.Meta(html, "property", "og:image"));
            Assert.Equal(Data.Site.DefaultImageAlt, Html.Meta(html, "property", "og:image:alt"));
            Assert.Equal(Data.Site.DefaultImageWidth.ToString(), Html.Meta(html, "property", "og:image:width"));
        }

        [Fact]
        public async Task A_draft_or_deleted_article_has_no_page_and_publishing_creates_it()
        {
            var admin = await TestAccounts.SignedInAsync(factory, Roles.Admin);
            var article = await CreateArticleAsync(admin, Unique("Lifecycle"), published: false);

            Assert.Equal(HttpStatusCode.NotFound, (await GetAsync($"/articles/{article.Slug}")).Response.StatusCode);

            var published = await admin.PutAsJsonAsync($"/api/admin/articles/{article.Id}",
                new SaveArticleRequest(article.Title, article.Slug, article.Summary, article.BodyMarkdown, null, null, null, true, article.Version));
            Assert.Equal(HttpStatusCode.OK, published.StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await GetAsync($"/articles/{article.Slug}")).Response.StatusCode);

            Assert.Equal(HttpStatusCode.OK, (await admin.DeleteAsync($"/api/admin/articles/{article.Id}")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await GetAsync($"/articles/{article.Slug}")).Response.StatusCode);
        }

        [Fact]
        public async Task The_article_list_page_links_to_each_published_article_without_javascript()
        {
            var admin = await TestAccounts.SignedInAsync(factory, Roles.Admin);
            var live = await CreateArticleAsync(admin, Unique("Listed"), summary: "Listed summary text.");
            var draft = await CreateArticleAsync(admin, Unique("Unlisted draft"), published: false);

            var (_, html) = await GetAsync("/articles");
            var noscript = Html.Noscript(html);

            Assert.Contains($"""<a href="/articles/{live.Slug}">{live.Title}</a>""", noscript);
            Assert.Contains("Listed summary text.", noscript);
            Assert.DoesNotContain(draft.Slug, html);
        }

        [Fact]
        public async Task Hostile_article_text_is_escaped_everywhere_it_appears()
        {
            var admin = await TestAccounts.SignedInAsync(factory, Roles.Admin);
            var title = "\"><script>alert(1)</script> " + Guid.NewGuid().ToString("N")[..6];
            var summary = "</script><script>alert(2)</script><!--";
            var author = "<img src=x onerror=alert(3)>";
            var article = await CreateArticleAsync(admin, title, summary: summary, author: author,
                body: "<script>alert(5)</script>\n\n[x](javascript:alert(6))\n\n<noscript></noscript></div>");

            var (response, html) = await GetAsync($"/articles/{article.Slug}");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            // No attacker-controlled markup anywhere in the page.
            Assert.DoesNotContain("<script>alert", html);
            Assert.DoesNotContain("<img src=x", html);
            Assert.DoesNotContain("javascript:alert", html);
            Assert.DoesNotContain("<noscript></noscript>", html);
            // The title is still shown, as text, and the attribute values round-trip exactly.
            Assert.Equal($"{title} | {Data.Site.Name}", Html.Title(html));
            Assert.Equal(summary, Html.Meta(html, "name", "description"));
            Assert.Equal(author, Html.Meta(html, "property", "article:author"));
            // The JSON-LD is still valid JSON that carries the exact original text (and so can't have been cut short).
            var node = Html.Nodes(Html.JsonLd(html)!.Value, "Article").Single();
            Assert.Equal(title, node.GetProperty("headline").GetString());
            Assert.Equal(summary, node.GetProperty("description").GetString());
            Assert.Equal(author, node.GetProperty("author").GetProperty("name").GetString());
            // Exactly one pair of script tags (the template's module script and the one JSON-LD block).
            Assert.Equal(2, Html.Count(html, "<script"));
            Assert.Equal(2, Html.Count(html, "</script>"));
        }

        // ---------- electrician pages ----------

        [Fact]
        public async Task An_electricians_profile_has_its_own_title_description_and_breadcrumbs()
        {
            var (visibleId, deletedId) = await AddElectriciansAsync();

            var (response, html) = await GetAsync($"/electricians/{visibleId}");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal($"Ram Thapa – Electrician in Kumarigal | {Data.Site.Name}", Html.Title(html));
            Assert.Contains("12 years of experience", Html.Meta(html, "name", "description"));
            Assert.Equal($"{Base}/electricians/{visibleId}", Html.Canonical(html));
            Assert.Contains("<h1>Ram Thapa</h1>", Html.Noscript(html));
            Assert.Contains("Wiring", Html.Noscript(html));
            Assert.DoesNotContain("9800000000", html); // the booking number is never put in a page's source

            var crumbs = Html.Nodes(Html.JsonLd(html)!.Value, "BreadcrumbList").Single().GetProperty("itemListElement").EnumerateArray().ToList();
            Assert.Equal(["Home", "Electricians", "Ram Thapa"], crumbs.Select(c => c.GetProperty("name").GetString()));

            Assert.Equal(HttpStatusCode.NotFound, (await GetAsync($"/electricians/{deletedId}")).Response.StatusCode);
        }

        [Fact]
        public async Task A_profile_picture_that_is_not_https_is_not_used_for_the_link_preview()
        {
            int id;
            using (var scope = factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var electrician = NewElectrician("Insecure Photo");
                electrician.PhotoUrl = "http://insecure.example/me.jpg";
                db.Electricians.Add(electrician);
                await db.SaveChangesAsync();
                id = electrician.Id;
            }

            var (_, html) = await GetAsync($"/electricians/{id}");

            Assert.Equal($"{Base}{Data.Site.DefaultImage}", Html.Meta(html, "property", "og:image"));
        }

        // ---------- the public address ----------

        [Fact]
        public async Task A_configured_base_url_is_used_everywhere_instead_of_the_address_the_request_arrived_on()
        {
            using var configured = SeoApiFactory.WithBaseUrl("https://www.example.com/");
            await configured.EnsureDatabaseAsync();
            var client = configured.CreateSpaClient();

            var html = await client.GetStringAsync("/about");
            var robots = await client.GetStringAsync("/robots.txt");
            var sitemap = await client.GetStringAsync("/sitemap.xml");

            Assert.Equal("https://www.example.com/about", Html.Canonical(html));
            Assert.Equal("https://www.example.com", Html.Meta(html, "name", "site-base-url"));
            Assert.StartsWith("https://www.example.com/", Html.Meta(html, "property", "og:image"));
            Assert.Contains("Sitemap: https://www.example.com/sitemap.xml", robots);
            Assert.Contains("<loc>https://www.example.com/about</loc>", sitemap);
            Assert.DoesNotContain("localhost", html + robots + sitemap);
        }

        [Fact]
        public async Task A_base_url_that_is_not_a_web_address_is_ignored()
        {
            using var misconfigured = SeoApiFactory.WithBaseUrl("not a url");
            await misconfigured.EnsureDatabaseAsync();

            var html = await misconfigured.CreateSpaClient().GetStringAsync("/about");

            Assert.Equal($"{Base}/about", Html.Canonical(html));
        }

        // ---------- helpers ----------

        private static Electrician NewElectrician(string name, bool deleted = false) => new()
        {
            Name = name,
            Location = "Kumarigal",
            YearsExperience = 12,
            RateAmount = 500,
            RateUnit = RateUnit.Visit,
            WhatsAppNumber = "+9779800000000",
            Bio = "Experienced electrician for homes & offices.",
            Version = Guid.NewGuid(),
            CreatedAtUtc = DateTime.UtcNow,
            IsDeleted = deleted,
            DeletedAtUtc = deleted ? DateTime.UtcNow : null,
            Specialties = [new ElectricianSpecialty { Specialty = "Wiring" }],
        };

        private async Task<(int VisibleId, int DeletedId)> AddElectriciansAsync()
        {
            using var scope = factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var visible = NewElectrician("Ram Thapa");
            var deleted = NewElectrician("Removed Person", deleted: true);
            db.Electricians.AddRange(visible, deleted);
            await db.SaveChangesAsync();
            return (visible.Id, deleted.Id);
        }
    }
}
