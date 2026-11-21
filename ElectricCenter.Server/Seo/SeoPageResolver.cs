using System.Globalization;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using ElectricCenter.Server.Articles;
using ElectricCenter.Server.Electricians;

namespace ElectricCenter.Server.Seo
{
    /// <summary>What one URL should look like to a search engine or a link preview: tags, status code and fallback content.</summary>
    public sealed record SeoPage(
        int StatusCode,
        string RoutePath,
        string Title,
        string Description,
        string? CanonicalPath,
        bool Indexable,
        string OgType,
        string? ImageUrl,
        string? ImageAlt,
        string Heading,
        string? BodyHtml,
        IReadOnlyList<IDictionary<string, object?>> JsonLd,
        DateTime? PublishedUtc = null,
        DateTime? ModifiedUtc = null,
        string? Author = null);

    public interface ISeoPageResolver
    {
        Task<SeoPage> ResolveAsync(string requestPath, string baseUrl, CancellationToken ct = default);
    }

    public static partial class SeoPaths
    {
        /// <summary>"/About/" -> "/about"; "//" -> "/". Routes are case-insensitive and the query string never matters.</summary>
        public static string Normalize(string? path)
        {
            if (string.IsNullOrWhiteSpace(path)) return "/";

            var clean = RepeatedSlashes().Replace(path.Split('?', '#')[0].Trim().ToLowerInvariant(), "/");
            if (!clean.StartsWith('/')) clean = "/" + clean;
            if (clean.Length > 1) clean = clean.TrimEnd('/');
            return clean.Length == 0 ? "/" : clean;
        }

        /// <summary>For "/articles/wiring" and prefix "/articles/" gives "wiring"; null when there's nothing, or more, after the prefix.</summary>
        public static string? Segment(string path, string prefix)
        {
            if (!path.StartsWith(prefix, StringComparison.Ordinal)) return null;
            var rest = path[prefix.Length..];
            return rest.Length > 0 && !rest.Contains('/') ? rest : null;
        }

        [GeneratedRegex("/{2,}")]
        private static partial Regex RepeatedSlashes();
    }

    /// <summary>
    /// Works out the <see cref="SeoPage"/> for a request path: a fixed page from the build's seo-data.json, an article or
    /// an electrician's profile looked up in the database, or a real 404. Unknown addresses get a 404 *status*, so search
    /// engines drop them instead of indexing the home page's content under hundreds of made-up URLs.
    /// </summary>
    public sealed partial class SeoPageResolver(SeoSiteDataProvider dataProvider, IArticleService articles, IElectricianService electricians) : ISeoPageResolver
    {
        private const int ElectricianBioMaxLength = 600;

        public async Task<SeoPage> ResolveAsync(string requestPath, string baseUrl, CancellationToken ct = default)
        {
            var data = dataProvider.Get();
            var path = SeoPaths.Normalize(requestPath);

            if (SeoPaths.Segment(path, "/articles/") is { } slug) return await ArticleAsync(data, baseUrl, path, slug, ct);

            if (SeoPaths.Segment(path, "/electricians/") is { } idText
                && int.TryParse(idText, NumberStyles.None, CultureInfo.InvariantCulture, out var electricianId))
                return await ElectricianAsync(data, baseUrl, path, electricianId, ct);

            // The admin screens (editing an article, ...) are real routes that must never be indexed.
            if (path.StartsWith("/admin/", StringComparison.Ordinal))
                return Plain(data, path, 200, "Admin", "Admin area.", indexable: false);

            if (data.Pages.TryGetValue(path, out var entry)) return await StaticAsync(data, baseUrl, path, entry, ct);

            // Without seo-data.json the list of real routes is unknown, so don't 404 a page that exists.
            return data.IsFallback
                ? Plain(data, path, 200, data.Site.Name, data.Site.DefaultDescription, indexable: true, canonical: path)
                : NotFound(data, path);
        }

        private async Task<SeoPage> StaticAsync(SeoSiteData data, string baseUrl, string path, SeoPageEntry entry, CancellationToken ct)
        {
            var graph = new List<IDictionary<string, object?>>();
            foreach (var schema in entry.Schema ?? [])
            {
                switch (schema)
                {
                    case "business": graph.Add(SeoJsonLd.LocalBusiness(data, baseUrl)); break;
                    case "website": graph.Add(SeoJsonLd.WebSite(data, baseUrl)); break;
                    case "faq" when data.Faqs.Length > 0: graph.Add(SeoJsonLd.FaqPage(data)); break;
                }
            }

            // The article list is a page's worth of links; give no-JavaScript crawlers the real ones.
            string? body = path == "/articles" ? await ArticleListHtmlAsync(ct) : path == "/faq" ? FaqHtml(data) : null;

            return new SeoPage(
                200, path, data.FormatTitle(entry.Title), entry.Description ?? data.Site.DefaultDescription,
                entry.Indexable ? path : null, entry.Indexable, "website", null, null,
                entry.Heading ?? entry.Title, body, graph);
        }

        private async Task<SeoPage> ArticleAsync(SeoSiteData data, string baseUrl, string path, string slug, CancellationToken ct)
        {
            var article = await articles.GetPublishedBySlugAsync(slug, ct);
            if (article is null) return NotFound(data, path, "Article not found");

            var canonical = $"/articles/{article.Slug}";
            var url = SiteUrls.Absolute(baseUrl, canonical);
            var published = article.PublishedAtUtc ?? article.CreatedAtUtc;
            var modified = article.UpdatedAtUtc ?? published;
            var image = article.CoverImageUrl ?? SiteUrls.Absolute(baseUrl, data.Site.DefaultImage);
            var imageAlt = article.CoverImageUrl is null ? data.Site.DefaultImageAlt : article.CoverImageAlt ?? article.Title;

            var body = new StringBuilder();
            body.Append("<p>By ").Append(H(article.AuthorName)).Append(" · <time datetime=\"").Append(SeoJsonLd.Iso(published)).Append("\">")
                .Append(published.ToString("MMMM d, yyyy", CultureInfo.InvariantCulture)).Append("</time> · ")
                .Append(article.ReadingMinutes).Append(" min read</p>");
            if (article.CoverImageUrl is not null)
                body.Append("<p><img src=\"").Append(H(article.CoverImageUrl)).Append("\" alt=\"").Append(H(imageAlt)).Append("\"></p>");
            body.Append(ArticleMarkdown.ToHtml(article.BodyMarkdown));

            return new SeoPage(
                200, path, data.FormatTitle(article.Title), article.Summary, canonical, Indexable: true, "article",
                article.CoverImageUrl, imageAlt, article.Title, body.ToString(),
                [
                    SeoJsonLd.Article(data, baseUrl, url, article.Title, article.Summary, image, article.AuthorName, published, modified),
                    SeoJsonLd.Breadcrumbs(baseUrl, ("Home", "/"), ("Articles", "/articles"), (article.Title, canonical)),
                ],
                published, modified, article.AuthorName);
        }

        private async Task<SeoPage> ElectricianAsync(SeoSiteData data, string baseUrl, string path, int id, CancellationToken ct)
        {
            var electrician = await electricians.GetAsync(id, includeDeleted: false, ct);
            if (electrician is null) return NotFound(data, path, "Electrician not found");

            var values = new Dictionary<string, string>
            {
                ["name"] = electrician.Name,
                ["location"] = electrician.Location,
                ["years"] = electrician.YearsExperience.ToString(CultureInfo.InvariantCulture),
            };
            data.Templates.TryGetValue("electrician", out var template);
            var title = Fill(template?.Title ?? "{name} – Electrician in {location}", values);
            var description = Fill(
                template?.Description ?? "{name} is a vetted electrician in {location} with {years} years of experience.", values);

            var canonical = $"/electricians/{electrician.Id}";
            var specialties = string.Join(", ", electrician.Specialties.Select(s => s.Specialty));
            var bio = electrician.Bio.Length > ElectricianBioMaxLength ? electrician.Bio[..ElectricianBioMaxLength] + "…" : electrician.Bio;
            var body = $"<p>{H(electrician.Location)} · {electrician.YearsExperience} years of experience"
                + (specialties.Length > 0 ? $" · {H(specialties)}" : string.Empty) + $"</p><p>{H(bio)}</p>";

            // A link preview needs an https picture; fall back to the site image for anything else.
            var photo = electrician.PhotoUrl is { } p && p.StartsWith("https://", StringComparison.OrdinalIgnoreCase) ? p : null;

            return new SeoPage(
                200, path, data.FormatTitle(title), description, canonical, Indexable: true, "website",
                photo, photo is null ? null : electrician.Name, electrician.Name, body,
                [SeoJsonLd.Breadcrumbs(baseUrl, ("Home", "/"), ("Electricians", "/electricians"), (electrician.Name, canonical))]);
        }

        private async Task<string> ArticleListHtmlAsync(CancellationToken ct)
        {
            var items = await articles.ListPublishedAsync(ct);
            if (items.Count == 0) return string.Empty;

            var html = new StringBuilder("<ul>");
            foreach (var item in items)
                html.Append("<li><a href=\"/articles/").Append(H(item.Slug)).Append("\">").Append(H(item.Title)).Append("</a> – ").Append(H(item.Summary)).Append("</li>");
            return html.Append("</ul>").ToString();
        }

        private static string FaqHtml(SeoSiteData data)
        {
            var html = new StringBuilder();
            foreach (var faq in data.Faqs)
                html.Append("<h2>").Append(H(faq.Question)).Append("</h2><p>").Append(H(faq.Answer)).Append("</p>");
            return html.ToString();
        }

        private static SeoPage NotFound(SeoSiteData data, string path, string heading = "Page not found") => new(
            404, path, data.FormatTitle(heading), data.Site.DefaultDescription, null, Indexable: false, "website", null, null, heading,
            "<p>We couldn't find that page. Try one of the links above.</p>", []);

        private static SeoPage Plain(SeoSiteData data, string path, int status, string title, string description, bool indexable, string? canonical = null) => new(
            status, path, data.FormatTitle(title), description, indexable ? canonical : null, indexable, "website", null, null, title, null, []);

        private static string Fill(string template, Dictionary<string, string> values) =>
            Placeholder().Replace(template, m => values.TryGetValue(m.Groups[1].Value, out var v) ? v : m.Value);

        private static string H(string? text) => WebUtility.HtmlEncode(text ?? string.Empty);

        [GeneratedRegex(@"\{(\w+)\}")]
        private static partial Regex Placeholder();
    }
}
