using ElectricCenter.Server.Seo;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging.Abstractions;

namespace ElectricCenter.Server.Tests
{
    public class SeoPathsTests
    {
        [Theory]
        [InlineData("/", "/")]
        [InlineData("", "/")]
        [InlineData(null, "/")]
        [InlineData("   ", "/")]
        [InlineData("/About", "/about")]
        [InlineData("/about/", "/about")]
        [InlineData("//about", "/about")]
        [InlineData("/about//", "/about")]
        [InlineData("about", "/about")]
        [InlineData("/about?x=1#top", "/about")]
        [InlineData("/Articles/Wiring-Basics/", "/articles/wiring-basics")]
        [InlineData("///", "/")]
        public void Normalize_gives_one_form_to_every_spelling_of_an_address(string? input, string expected) =>
            Assert.Equal(expected, SeoPaths.Normalize(input));

        [Theory]
        [InlineData("/articles/wiring", "/articles/", "wiring")]
        [InlineData("/articles/", "/articles/", null)]
        [InlineData("/articles", "/articles/", null)]
        [InlineData("/articles/a/b", "/articles/", null)]
        [InlineData("/electricians/12", "/electricians/", "12")]
        [InlineData("/other/12", "/electricians/", null)]
        public void Segment_returns_the_single_part_after_the_prefix(string path, string prefix, string? expected) =>
            Assert.Equal(expected, SeoPaths.Segment(path, prefix));
    }

    public class SiteUrlsTests
    {
        private static SiteUrls With(string? baseUrl)
        {
            var settings = baseUrl is null ? [] : new Dictionary<string, string?> { ["Site:BaseUrl"] = baseUrl };
            var configuration = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
            return new SiteUrls(configuration, NullLogger<SiteUrls>.Instance);
        }

        private static HttpRequest Request(string scheme, string host)
        {
            var context = new DefaultHttpContext();
            context.Request.Scheme = scheme;
            context.Request.Host = new HostString(host);
            return context.Request;
        }

        [Fact]
        public void Without_configuration_the_address_the_request_arrived_on_is_used()
        {
            Assert.Equal("https://shop.example", With(null).GetBaseUrl(Request("https", "shop.example")));
            Assert.Equal("http://localhost:5172", With("").GetBaseUrl(Request("http", "localhost:5172")));
        }

        [Theory]
        [InlineData("https://www.example.com", "https://www.example.com")]
        [InlineData("https://www.example.com/", "https://www.example.com")]
        [InlineData("  https://www.example.com/some/path?x=1  ", "https://www.example.com")]
        [InlineData("http://example.com:8080/", "http://example.com:8080")]
        public void A_configured_address_wins_and_is_reduced_to_scheme_and_host(string configured, string expected) =>
            Assert.Equal(expected, With(configured).GetBaseUrl(Request("https", "other.example")));

        [Theory]
        [InlineData("not a url")]
        [InlineData("www.example.com")]
        [InlineData("ftp://example.com")]
        [InlineData("javascript:alert(1)")]
        public void A_configured_value_that_is_not_a_web_address_is_ignored(string configured) =>
            Assert.Equal("https://real.example", With(configured).GetBaseUrl(Request("https", "real.example")));

        [Theory]
        [InlineData("https://x.example", "/a/b", "https://x.example/a/b")]
        [InlineData("https://x.example/", "/a", "https://x.example/a")]
        [InlineData("https://x.example", "a", "https://x.example/a")]
        [InlineData("https://x.example", "https://cdn.example/i.jpg", "https://cdn.example/i.jpg")]
        public void Absolute_joins_paths_and_leaves_full_addresses_alone(string baseUrl, string path, string expected) =>
            Assert.Equal(expected, SiteUrls.Absolute(baseUrl, path));
    }

    public class SeoSiteDataProviderTests : IDisposable
    {
        private readonly string _directory = Path.Combine(Path.GetTempPath(), $"seo-{Guid.NewGuid():N}");

        public SeoSiteDataProviderTests() => Directory.CreateDirectory(_directory);

        public void Dispose() => Directory.Delete(_directory, recursive: true);

        private sealed class FakeEnvironment(string webRoot) : IWebHostEnvironment
        {
            public string WebRootPath { get; set; } = webRoot;
            public IFileProvider WebRootFileProvider { get; set; } = new PhysicalFileProvider(webRoot);
            public string ApplicationName { get; set; } = "Tests";
            public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
            public string ContentRootPath { get; set; } = webRoot;
            public string EnvironmentName { get; set; } = "Testing";
        }

        private SeoSiteDataProvider Provider() => new(new FakeEnvironment(_directory), NullLogger<SeoSiteDataProvider>.Instance);

        [Fact]
        public void Reads_the_file_the_client_build_writes()
        {
            File.Copy(Path.Combine(SeoApiFactory.WebRoot, SeoSiteDataProvider.FileName), Path.Combine(_directory, SeoSiteDataProvider.FileName));

            var data = Provider().Get();

            Assert.False(data.IsFallback);
            Assert.Equal("Panchamukhi Electric Center", data.Site.Name);
            Assert.True(data.Pages.ContainsKey("/faq"));
            Assert.Contains("faq", data.Pages["/faq"].Schema!);
            Assert.False(data.Pages["/login"].Indexable);
            Assert.True(data.Pages["/about"].Indexable);
            Assert.NotEmpty(data.Faqs);
            Assert.NotEmpty(data.Nav);
            Assert.Equal("{name} – Electrician in {location}", data.Templates["electrician"].Title);
        }

        [Fact]
        public void Without_the_file_it_falls_back_to_generic_data_that_treats_every_route_as_real()
        {
            var data = Provider().Get();

            Assert.True(data.IsFallback);
            Assert.False(string.IsNullOrWhiteSpace(data.Site.Name));
            Assert.Empty(data.Pages);
        }

        [Theory]
        [InlineData("not json at all")]
        [InlineData("{}")]
        [InlineData("{\"site\": null}")]
        public void A_broken_file_falls_back_instead_of_taking_the_site_down(string content)
        {
            File.WriteAllText(Path.Combine(_directory, SeoSiteDataProvider.FileName), content);

            Assert.True(Provider().Get().IsFallback);
        }

        [Fact]
        public void The_title_rule_matches_the_clients_formatTitle()
        {
            var data = SeoApiFactory.Data;

            Assert.Equal($"About Us{data.Site.TitleSuffix}", data.FormatTitle("About Us"));
            Assert.Equal(data.Pages["/"].Title, data.FormatTitle(data.Pages["/"].Title)); // already has the site name
            Assert.Equal(data.Site.Name, data.FormatTitle(""));
            Assert.Equal(data.Site.Name, data.FormatTitle(null));
        }
    }

    public class SeoHtmlRendererTests
    {
        private static readonly SeoSiteData Data = SeoApiFactory.Data;
        private static readonly SeoHtmlRenderer Renderer = new();
        private const string Base = "https://shop.example";

        private static SeoPage Page(string title = "A page", string description = "About the page.", string? canonical = "/a-page", bool indexable = true,
            int status = 200, string? body = null, string heading = "A heading", string? image = null) =>
            new(status, canonical ?? "/x", title, description, canonical, indexable, "website", image, null, heading, body, []);

        private const string WithMarkers =
            "<html><head><!--seo-head--><title>old</title><meta name=\"description\" content=\"old\"><!--/seo-head--></head><body><div id=\"root\"><!--seo-body--></div></body></html>";

        private const string WithoutMarkers =
            "<html><head><title>old</title>\n<meta name=\"description\" content=\"old\" />\n<meta charset=\"utf-8\"></head><body><div id=\"root\"></div></body></html>";

        [Theory]
        [InlineData(WithMarkers)]
        [InlineData(WithoutMarkers)] // an index.html whose marker comments were lost still gets one title and one description
        public void Replaces_the_templates_title_and_description_rather_than_adding_to_them(string template)
        {
            var html = Renderer.Render(template, Page("New title", "New description."), Base, Data);

            Assert.Equal(1, Html.Count(html, "<title>"));
            Assert.Equal("New title", Html.Title(html));
            Assert.Equal(1, Html.Count(html, "<meta name=\"description\""));
            Assert.Equal("New description.", Html.Meta(html, "name", "description"));
            Assert.DoesNotContain("content=\"old\"", html);
            Assert.DoesNotContain("<title>old", html);
        }

        [Theory]
        [InlineData(WithMarkers)]
        [InlineData(WithoutMarkers)]
        public void Puts_the_noscript_fallback_inside_the_root_element(string template)
        {
            var html = Renderer.Render(template, Page(heading: "Wiring tips"), Base, Data);

            Assert.Contains("<div id=\"root\"><noscript>", html);
            Assert.Contains("<h1>Wiring tips</h1>", html);
            Assert.Contains("</noscript></div>", html);
        }

        [Fact]
        public void Keeps_the_rest_of_the_template_intact()
        {
            var html = Renderer.Render(WithoutMarkers, Page(), Base, Data);

            Assert.Contains("<meta charset=\"utf-8\">", html);
            Assert.StartsWith("<html><head>", html);
            Assert.EndsWith("</body></html>", html);
        }

        [Fact]
        public void A_page_kept_out_of_the_index_gets_noindex_and_no_canonical_link()
        {
            var html = Renderer.Render(WithMarkers, Page(canonical: null, indexable: false), Base, Data);

            Assert.Equal("noindex, nofollow", Html.Meta(html, "name", "robots"));
            Assert.Null(Html.Canonical(html));
        }

        [Fact]
        public void A_404_page_has_no_address_in_its_social_tags_and_no_description_in_the_fallback()
        {
            var html = Renderer.Render(WithMarkers, Page(canonical: null, indexable: false, status: 404, heading: "Page not found"), Base, Data);

            Assert.Null(Html.Meta(html, "property", "og:url"));
            Assert.DoesNotContain("About the page.", Html.Noscript(html));
        }

        [Fact]
        public void Values_are_escaped_in_attributes_and_text()
        {
            var html = Renderer.Render(WithMarkers, Page("Tom & \"Jerry\" <b>", "It's <i>fine</i> & \"quoted\"", body: null, heading: "<h1>x</h1>"), Base, Data);

            Assert.Equal("Tom & \"Jerry\" <b>", Html.Title(html));
            Assert.Equal("It's <i>fine</i> & \"quoted\"", Html.Meta(html, "name", "description"));
            Assert.Contains("&lt;h1&gt;x&lt;/h1&gt;", Html.Noscript(html));
            Assert.DoesNotContain("<b>", html);
            Assert.DoesNotContain("<i>fine", html);
        }

        [Fact]
        public void A_pages_own_image_is_used_for_previews_and_the_site_image_is_the_fallback()
        {
            var own = Renderer.Render(WithMarkers, Page(image: "https://cdn.example/p.jpg"), Base, Data);
            var fallback = Renderer.Render(WithMarkers, Page(), Base, Data);

            Assert.Equal("https://cdn.example/p.jpg", Html.Meta(own, "property", "og:image"));
            Assert.Null(Html.Meta(own, "property", "og:image:width"));
            Assert.Equal($"{Base}{Data.Site.DefaultImage}", Html.Meta(fallback, "property", "og:image"));
            Assert.NotNull(Html.Meta(fallback, "property", "og:image:width"));
        }

        [Fact]
        public void A_phone_number_in_the_fallback_is_a_working_tel_link()
        {
            var html = Renderer.Render(WithMarkers, Page(), Base, Data);

            Assert.Contains("href=\"tel:+9779841445050\"", Html.Noscript(html));
        }
    }
}
