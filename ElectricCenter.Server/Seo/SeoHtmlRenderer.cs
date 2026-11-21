using System.Net;
using System.Text;
using System.Text.RegularExpressions;

namespace ElectricCenter.Server.Seo
{
    /// <summary>The built index.html, read once. Null when there isn't one (development: Vite serves the pages instead).</summary>
    public sealed class SeoHtmlTemplate(IWebHostEnvironment environment)
    {
        private readonly Lazy<string?> _html = new(() =>
        {
            var file = environment.WebRootFileProvider.GetFileInfo("index.html");
            if (!file.Exists) return null;

            using var reader = new StreamReader(file.CreateReadStream(), Encoding.UTF8);
            return reader.ReadToEnd();
        });

        public string? Get() => _html.Value;
    }

    /// <summary>
    /// Writes a page's tags into the built index.html, so crawlers and link-preview bots (which don't run JavaScript)
    /// see the right title, description, canonical address, social tags and structured data. The same tags are kept up
    /// to date in the browser by useSeo, so what a visitor's tab shows agrees with what the server wrote.
    ///
    /// index.html marks the spots: everything between &lt;!--seo-head--&gt; and &lt;!--/seo-head--&gt; is replaced, and
    /// &lt;!--seo-body--&gt; (inside #root) receives a &lt;noscript&gt; version of the page. React clears #root when it starts,
    /// so people with JavaScript never see the fallback and never see a flash of unstyled content.
    /// </summary>
    public sealed partial class SeoHtmlRenderer
    {
        private const string HeadStart = "<!--seo-head-->";
        private const string HeadEnd = "<!--/seo-head-->";
        private const string BodyMarker = "<!--seo-body-->";

        public const string RobotsIndex = "index, follow, max-image-preview:large";
        public const string RobotsNoIndex = "noindex, nofollow";

        public string Render(string template, SeoPage page, string baseUrl, SeoSiteData data) =>
            InjectBody(InjectHead(template, BuildHead(page, baseUrl, data)), BuildFallback(page, data));

        private static string BuildHead(SeoPage page, string baseUrl, SeoSiteData data)
        {
            var site = data.Site;
            var canonical = page.Indexable && page.CanonicalPath is not null ? SiteUrls.Absolute(baseUrl, page.CanonicalPath) : null;
            // og:url is the page's address even when it isn't indexable (a checkout link someone shares); a 404 has none.
            var ogUrl = page.StatusCode == 200 ? SiteUrls.Absolute(baseUrl, page.CanonicalPath ?? page.RoutePath) : null;
            var ownImage = page.ImageUrl is not null;
            var image = SiteUrls.Absolute(baseUrl, page.ImageUrl ?? site.DefaultImage);
            var imageAlt = ownImage ? page.ImageAlt ?? page.Title : site.DefaultImageAlt;

            var head = new StringBuilder();
            head.Append("<title>").Append(H(page.Title)).Append("</title>\n");
            Meta(head, "name", "description", page.Description);
            Meta(head, "name", "robots", page.Indexable ? RobotsIndex : RobotsNoIndex);
            if (canonical is not null) head.Append("<link rel=\"canonical\" href=\"").Append(H(canonical)).Append("\">\n");
            Meta(head, "name", "site-base-url", baseUrl);

            Meta(head, "property", "og:site_name", site.Name);
            Meta(head, "property", "og:locale", site.Locale);
            Meta(head, "property", "og:type", page.OgType);
            Meta(head, "property", "og:title", page.Title);
            Meta(head, "property", "og:description", page.Description);
            Meta(head, "property", "og:url", ogUrl);
            Meta(head, "property", "og:image", image);
            Meta(head, "property", "og:image:alt", imageAlt);
            if (!ownImage)
            {
                // Known only for the site image; with the size, Facebook can draw the large card the first time a link is shared.
                Meta(head, "property", "og:image:width", site.DefaultImageWidth.ToString(System.Globalization.CultureInfo.InvariantCulture));
                Meta(head, "property", "og:image:height", site.DefaultImageHeight.ToString(System.Globalization.CultureInfo.InvariantCulture));
            }

            Meta(head, "name", "twitter:card", "summary_large_image");
            Meta(head, "name", "twitter:title", page.Title);
            Meta(head, "name", "twitter:description", page.Description);
            Meta(head, "name", "twitter:image", image);

            if (page.OgType == "article")
            {
                Meta(head, "property", "article:published_time", page.PublishedUtc is { } published ? SeoJsonLd.Iso(published) : null);
                Meta(head, "property", "article:modified_time", page.ModifiedUtc is { } modified ? SeoJsonLd.Iso(modified) : null);
                Meta(head, "property", "article:author", page.Author);
            }

            if (page.JsonLd.Count > 0)
            {
                // data-route lets the browser notice when this block describes a page the visitor has since left.
                head.Append("<script type=\"application/ld+json\" id=\"seo-jsonld\" data-route=\"").Append(H(page.RoutePath)).Append("\">")
                    .Append(SeoJsonLd.Serialize(page.JsonLd)).Append("</script>\n");
            }

            return head.ToString();
        }

        /// <summary>What a visitor without JavaScript (or a crawler that doesn't run it) gets: the page's text and the site's links.</summary>
        private static string BuildFallback(SeoPage page, SeoSiteData data)
        {
            var html = new StringBuilder("<noscript>");
            html.Append("<header><p><a href=\"/\">").Append(H(data.Site.Name)).Append("</a></p>");
            if (data.Nav.Length > 0)
            {
                html.Append("<nav aria-label=\"Main\"><ul>");
                foreach (var link in data.Nav)
                    html.Append("<li><a href=\"").Append(H(link.To)).Append("\">").Append(H(link.Label)).Append("</a></li>");
                html.Append("</ul></nav>");
            }

            html.Append("</header><main><h1>").Append(H(page.Heading)).Append("</h1>");
            if (page.StatusCode == 200) html.Append("<p>").Append(H(page.Description)).Append("</p>");
            html.Append(page.BodyHtml); // already HTML: escaped text, or rendered by ArticleMarkdown
            html.Append("</main>");

            var address = data.Business.Address;
            html.Append("<footer><p>").Append(H(data.Business.Name)).Append(", ").Append(H(address.Street)).Append(", ")
                .Append(H(address.Locality)).Append(". Phone: <a href=\"tel:").Append(H(data.Business.Phone.Replace("-", string.Empty)))
                .Append("\">").Append(H(data.Business.Phone)).Append("</a></p></footer></noscript>");
            return html.ToString();
        }

        private static string InjectHead(string template, string head)
        {
            var start = template.IndexOf(HeadStart, StringComparison.Ordinal);
            var end = template.IndexOf(HeadEnd, StringComparison.Ordinal);
            if (start >= 0 && end > start) return string.Concat(template.AsSpan(0, start), head, template.AsSpan(end + HeadEnd.Length));

            // The markers are missing (index.html was edited, or a build step stripped the comments). Still produce one
            // title and one description rather than two of each.
            var stripped = DescriptionMeta().Replace(TitleTag().Replace(template, string.Empty), string.Empty);
            var close = stripped.IndexOf("</head>", StringComparison.OrdinalIgnoreCase);
            return close < 0 ? head + stripped : stripped.Insert(close, head);
        }

        private static string InjectBody(string html, string fallback)
        {
            if (html.Contains(BodyMarker, StringComparison.Ordinal)) return html.Replace(BodyMarker, fallback, StringComparison.Ordinal);
            return EmptyRoot().Replace(html, $"<div id=\"root\">{fallback}</div>", 1);
        }

        private static void Meta(StringBuilder head, string attribute, string name, string? content)
        {
            if (!string.IsNullOrEmpty(content))
                head.Append("<meta ").Append(attribute).Append("=\"").Append(name).Append("\" content=\"").Append(H(content)).Append("\">\n");
        }

        private static string H(string? text) => WebUtility.HtmlEncode(text ?? string.Empty);

        [GeneratedRegex(@"<title>.*?</title>\s*", RegexOptions.IgnoreCase | RegexOptions.Singleline)]
        private static partial Regex TitleTag();

        [GeneratedRegex(@"<meta\s+name=""description""[^>]*>\s*", RegexOptions.IgnoreCase)]
        private static partial Regex DescriptionMeta();

        [GeneratedRegex(@"<div\s+id=""root""\s*>\s*</div>", RegexOptions.IgnoreCase)]
        private static partial Regex EmptyRoot();
    }
}
