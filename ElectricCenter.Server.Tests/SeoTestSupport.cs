using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using ElectricCenter.Server.Auth;
using ElectricCenter.Server.Contracts;
using ElectricCenter.Server.Seo;
using Microsoft.AspNetCore.Hosting;

namespace ElectricCenter.Server.Tests
{
    /// <summary>
    /// The app with a stand-in web root (Fixtures/wwwroot: an index.html shaped like the client build's, and the
    /// seo-data.json that build writes), so the pages the SPA fallback serves can be inspected.
    /// </summary>
    public sealed class SeoApiFactory : AuthApiFactory
    {
        private readonly string? _siteBaseUrl;

        /// <summary>For xUnit's class fixture, which needs a constructor with no arguments.</summary>
        public SeoApiFactory() { }

        // xUnit allows a fixture only one public constructor, so the configured variant is built with WithBaseUrl.
        private SeoApiFactory(string siteBaseUrl) => _siteBaseUrl = siteBaseUrl;

        /// <summary>An app configured with <c>Site:BaseUrl</c>.</summary>
        public static SeoApiFactory WithBaseUrl(string siteBaseUrl) => new(siteBaseUrl);

        public static string WebRoot => Path.Combine(AppContext.BaseDirectory, "Fixtures", "wwwroot");

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.UseWebRoot(WebRoot);
            if (_siteBaseUrl is not null) builder.UseSetting("Site:BaseUrl", _siteBaseUrl);
        }

        public static SeoSiteData Data { get; } = JsonSerializer.Deserialize<SeoSiteData>(
            File.ReadAllText(Path.Combine(WebRoot, SeoSiteDataProvider.FileName)),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
    }

    public static class TestAccounts
    {
        public const string Password = "integration password";

        public static async Task<HttpClient> SignedInAsync(AuthApiFactory factory, params string[] roles)
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
    }

    /// <summary>Reads the bits of a rendered page the tests care about. Attribute values are HTML-decoded, as a browser would.</summary>
    public static partial class Html
    {
        public static string? Meta(string html, string attribute, string name)
        {
            var match = Regex.Match(html, $"""<meta {attribute}="{Regex.Escape(name)}" content="([^"]*)">""");
            return match.Success ? WebUtility.HtmlDecode(match.Groups[1].Value) : null;
        }

        public static string? Canonical(string html)
        {
            var match = CanonicalLink().Match(html);
            return match.Success ? WebUtility.HtmlDecode(match.Groups[1].Value) : null;
        }

        public static string? Title(string html)
        {
            var match = TitleTag().Match(html);
            return match.Success ? WebUtility.HtmlDecode(match.Groups[1].Value) : null;
        }

        public static int Count(string html, string pattern) => Regex.Matches(html, pattern).Count;

        /// <summary>The page's structured data, or null if it has none. Fails the test if there is a block that isn't valid JSON.</summary>
        public static JsonElement? JsonLd(string html)
        {
            var match = JsonLdScript().Match(html);
            if (!match.Success) return null;
            return JsonDocument.Parse(match.Groups[2].Value).RootElement.Clone();
        }

        public static string? JsonLdRoute(string html)
        {
            var match = JsonLdScript().Match(html);
            return match.Success ? WebUtility.HtmlDecode(match.Groups[1].Value) : null;
        }

        /// <summary>The nodes of the "@graph" with the given @type (a node's @type may be a string or an array).</summary>
        public static List<JsonElement> Nodes(JsonElement jsonLd, string type) =>
            jsonLd.GetProperty("@graph").EnumerateArray().Where(node =>
            {
                var t = node.GetProperty("@type");
                return t.ValueKind == JsonValueKind.Array ? t.EnumerateArray().Any(x => x.GetString() == type) : t.GetString() == type;
            }).ToList();

        public static string Noscript(string html)
        {
            var match = NoscriptBlock().Match(html);
            return match.Success ? match.Groups[1].Value : string.Empty;
        }

        [GeneratedRegex("""<link rel="canonical" href="([^"]*)">""")]
        private static partial Regex CanonicalLink();

        [GeneratedRegex("<title>(.*?)</title>", RegexOptions.Singleline)]
        private static partial Regex TitleTag();

        [GeneratedRegex("""<script type="application/ld\+json" id="seo-jsonld" data-route="([^"]*)">(.*?)</script>""", RegexOptions.Singleline)]
        private static partial Regex JsonLdScript();

        [GeneratedRegex("<noscript>(.*?)</noscript>", RegexOptions.Singleline)]
        private static partial Regex NoscriptBlock();
    }
}
