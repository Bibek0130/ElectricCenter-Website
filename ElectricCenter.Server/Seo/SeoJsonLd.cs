using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ElectricCenter.Server.Seo
{
    /// <summary>
    /// schema.org structured data (JSON-LD), which lets search engines show a business's address and hours, an
    /// article's date and author, and FAQ answers directly in results. Every value here is also visible on the page:
    /// Google ignores (or penalises) markup that describes things visitors can't see.
    /// </summary>
    public static class SeoJsonLd
    {
        private static readonly JsonSerializerOptions Options = new() { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };

        public static Dictionary<string, object?> LocalBusiness(SeoSiteData data, string baseUrl)
        {
            var b = data.Business;
            return new Dictionary<string, object?>
            {
                ["@type"] = new[] { "HardwareStore", "ElectricalContractor" },
                ["@id"] = $"{baseUrl}/#business",
                ["name"] = b.Name,
                ["description"] = b.Description,
                ["url"] = $"{baseUrl}/",
                ["telephone"] = b.Phone,
                ["image"] = SiteUrls.Absolute(baseUrl, data.Site.DefaultImage),
                ["logo"] = SiteUrls.Absolute(baseUrl, data.Site.Logo),
                ["foundingDate"] = b.FoundingYear.ToString(CultureInfo.InvariantCulture),
                ["address"] = new Dictionary<string, object?>
                {
                    ["@type"] = "PostalAddress",
                    ["streetAddress"] = b.Address.Street,
                    ["addressLocality"] = b.Address.Locality,
                    ["addressRegion"] = b.Address.Region,
                    ["addressCountry"] = b.Address.Country,
                },
                ["geo"] = new Dictionary<string, object?>
                {
                    ["@type"] = "GeoCoordinates",
                    ["latitude"] = b.Geo.Latitude,
                    ["longitude"] = b.Geo.Longitude,
                },
                ["hasMap"] = b.MapUrl,
                ["openingHoursSpecification"] = b.OpeningHours.Select(h => new Dictionary<string, object?>
                {
                    ["@type"] = "OpeningHoursSpecification",
                    ["dayOfWeek"] = h.Days,
                    ["opens"] = h.Opens,
                    ["closes"] = h.Closes,
                }).ToList(),
                ["areaServed"] = b.AreaServed.Select(place => new Dictionary<string, object?> { ["@type"] = "City", ["name"] = place }).ToList(),
            };
        }

        public static Dictionary<string, object?> WebSite(SeoSiteData data, string baseUrl) => new()
        {
            ["@type"] = "WebSite",
            ["@id"] = $"{baseUrl}/#website",
            ["url"] = $"{baseUrl}/",
            ["name"] = data.Site.Name,
            ["inLanguage"] = data.Site.Language,
            ["publisher"] = new Dictionary<string, object?> { ["@id"] = $"{baseUrl}/#business" },
        };

        public static Dictionary<string, object?> FaqPage(SeoSiteData data) => new()
        {
            ["@type"] = "FAQPage",
            ["mainEntity"] = data.Faqs.Select(faq => new Dictionary<string, object?>
            {
                ["@type"] = "Question",
                ["name"] = faq.Question,
                ["acceptedAnswer"] = new Dictionary<string, object?> { ["@type"] = "Answer", ["text"] = faq.Answer },
            }).ToList(),
        };

        /// <summary>The trail shown above a result: Home › Articles › This article.</summary>
        public static Dictionary<string, object?> Breadcrumbs(string baseUrl, params (string Name, string Path)[] trail) => new()
        {
            ["@type"] = "BreadcrumbList",
            ["itemListElement"] = trail.Select((step, index) => new Dictionary<string, object?>
            {
                ["@type"] = "ListItem",
                ["position"] = index + 1,
                ["name"] = step.Name,
                ["item"] = SiteUrls.Absolute(baseUrl, step.Path),
            }).ToList(),
        };

        public static Dictionary<string, object?> Article(
            SeoSiteData data, string baseUrl, string url, string headline, string description, string image,
            string author, DateTime publishedUtc, DateTime modifiedUtc) => new()
        {
            ["@type"] = "Article",
            ["@id"] = $"{url}#article",
            ["mainEntityOfPage"] = new Dictionary<string, object?> { ["@type"] = "WebPage", ["@id"] = url },
            ["headline"] = headline,
            ["description"] = description,
            ["image"] = new[] { image },
            ["datePublished"] = Iso(publishedUtc),
            ["dateModified"] = Iso(modifiedUtc),
            ["inLanguage"] = data.Site.Language,
            ["author"] = new Dictionary<string, object?> { ["@type"] = "Person", ["name"] = author },
            ["publisher"] = new Dictionary<string, object?>
            {
                ["@type"] = "Organization",
                ["name"] = data.Site.Name,
                ["logo"] = new Dictionary<string, object?> { ["@type"] = "ImageObject", ["url"] = SiteUrls.Absolute(baseUrl, data.Site.Logo) },
            },
        };

        /// <summary>One {"@context","@graph":[...]} document. The default encoder escapes &lt; &gt; &amp; and ', so it can sit safely inside a script tag.</summary>
        public static string Serialize(IEnumerable<IDictionary<string, object?>> nodes) =>
            JsonSerializer.Serialize(
                new Dictionary<string, object?> { ["@context"] = "https://schema.org", ["@graph"] = nodes.ToList() },
                Options);

        public static string Iso(DateTime utc) =>
            DateTime.SpecifyKind(utc, DateTimeKind.Utc).ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture);
    }
}
