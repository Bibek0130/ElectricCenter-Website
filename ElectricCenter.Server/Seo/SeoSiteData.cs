using System.Text.Json;
using System.Text.Json.Serialization;

namespace ElectricCenter.Server.Seo
{
    // These mirror toServerData() in electriccenter.client/src/seo/siteSeo.js, which is where the values are written.
    // Property names match case-insensitively, so the JSON's camelCase maps straight onto them.

    public sealed record SeoSite(
        string Name, string TitleSuffix, string Locale, string Language, string DefaultDescription,
        string DefaultImage, string DefaultImageAlt, int DefaultImageWidth, int DefaultImageHeight,
        string Logo, string ThemeColor);

    public sealed record SeoAddress(string Street, string Locality, string Region, string Country);

    public sealed record SeoGeo(double Latitude, double Longitude);

    public sealed record SeoOpeningHours(string[] Days, string Opens, string Closes);

    public sealed record SeoBusiness(
        string Name, string Description, int FoundingYear, string Phone, SeoAddress Address, SeoGeo Geo,
        SeoOpeningHours[] OpeningHours, string[] AreaServed, string MapUrl);

    public sealed record SeoNavLink(string Label, string To);

    /// <summary>A page with a fixed address. A <see cref="Robots"/> value containing "noindex" keeps it out of search results and the sitemap.</summary>
    public sealed record SeoPageEntry(string Title, string? Description, string? Heading, string? Robots, string[]? Schema)
    {
        public bool Indexable => Robots is null || !Robots.Contains("noindex", StringComparison.OrdinalIgnoreCase);
    }

    public sealed record SeoTemplate(string Title, string Description);

    public sealed record SeoFaq(string Id, string Question, string Answer);

    public sealed record SeoSiteData(
        SeoSite Site,
        SeoBusiness Business,
        SeoNavLink[] Nav,
        Dictionary<string, SeoPageEntry> Pages,
        Dictionary<string, SeoTemplate> Templates,
        SeoFaq[] Faqs)
    {
        /// <summary>True when the build's seo-data.json couldn't be read. Pages then get generic tags instead of a 404.</summary>
        [JsonIgnore]
        public bool IsFallback { get; init; }

        /// <summary>Adds the site name to a page title unless it's already in it (same rule as formatTitle in siteSeo.js).</summary>
        public string FormatTitle(string? title) =>
            string.IsNullOrWhiteSpace(title) ? Site.Name
            : title.Contains(Site.Name, StringComparison.Ordinal) ? title
            : title + Site.TitleSuffix;
    }

    /// <summary>
    /// Loads the SEO data the client build wrote next to index.html (wwwroot/seo-data.json). That file is generated from
    /// the same module the browser uses, so the server and the browser can't disagree about a page's title.
    /// </summary>
    public sealed class SeoSiteDataProvider
    {
        public const string FileName = "seo-data.json";

        private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true, AllowTrailingCommas = true };

        private readonly Lazy<SeoSiteData> _data;

        public SeoSiteDataProvider(IWebHostEnvironment environment, ILogger<SeoSiteDataProvider> logger) =>
            _data = new Lazy<SeoSiteData>(() => Load(environment, logger));

        public SeoSiteData Get() => _data.Value;

        private static SeoSiteData Load(IWebHostEnvironment environment, ILogger logger)
        {
            try
            {
                var file = environment.WebRootFileProvider.GetFileInfo(FileName);
                if (!file.Exists)
                {
                    // Normal in development, where Vite serves the pages and there's no wwwroot.
                    logger.LogInformation("{File} not found in the web root: using generic page tags. (Build the client to generate it.)", FileName);
                    return Fallback();
                }

                using var stream = file.CreateReadStream();
                var data = JsonSerializer.Deserialize<SeoSiteData>(stream, JsonOptions);
                if (data?.Site is null || data.Business is null || data.Pages is null)
                    throw new JsonException($"{FileName} is missing required sections.");

                return data with { Nav = data.Nav ?? [], Templates = data.Templates ?? [], Faqs = data.Faqs ?? [] };
            }
            catch (Exception ex) when (ex is JsonException or IOException)
            {
                logger.LogError(ex, "Could not read {File}: using generic page tags. Rebuild the client.", FileName);
                return Fallback();
            }
        }

        /// <summary>Just enough for a valid page. Nothing in it is page-specific, so every route is treated as a real one.</summary>
        public static SeoSiteData Fallback() => new(
            new SeoSite(
                "Panchamukhi Electric Center", " | Panchamukhi Electric Center", "en_NP", "en",
                "Panchamukhi Electric Center — electrical products, wiring supplies and vetted electrician booking in Kathmandu, Nepal.",
                "/og-default.jpg", "Panchamukhi Electric Center", 1200, 630, "/logo-512.png", "#dc2626"),
            new SeoBusiness(
                "Panchamukhi Electric Center", "Electrical products and electricians in Kathmandu, Nepal.", 1995, "+977-9841445050",
                new SeoAddress("Kharibot, Kumarigal", "Kathmandu", "Bagmati", "NP"), new SeoGeo(27.714095, 85.354542),
                [], [], "https://www.google.com/maps"),
            [], [], [], [])
        {
            IsFallback = true,
        };
    }
}
