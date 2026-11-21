using System.Text.RegularExpressions;
using Markdig;
using Markdig.Renderers.Html;
using Markdig.Syntax;
using Markdig.Syntax.Inlines;

namespace ElectricCenter.Server.Articles
{
    /// <summary>
    /// Turns an article's Markdown into HTML the site can put on a page without further escaping.
    /// The author is a trusted admin, but the output is still made safe by construction:
    /// <list type="bullet">
    /// <item>Raw HTML in the Markdown is escaped, never passed through (so no &lt;script&gt;, iframes or inline handlers).</item>
    /// <item>Link URLs must be http(s), mailto, tel, a site-relative path or a #fragment; anything else (javascript:, data:, ...) becomes "#".</item>
    /// <item>Images must be https (or site-relative). Anything else is replaced by its alt text.</item>
    /// <item>No Markdig extension that adds attributes ({onclick=...}) is enabled.</item>
    /// </list>
    /// An article's title is the page's only &lt;h1&gt;, so a "# Heading" in the body is rendered as an &lt;h2&gt;.
    /// </summary>
    public static partial class ArticleMarkdown
    {
        private const int WordsPerMinute = 200;

        private static readonly MarkdownPipeline Pipeline = new MarkdownPipelineBuilder()
            .DisableHtml()
            .UsePipeTables()
            .UseAutoLinks()
            .UseEmphasisExtras()
            .Build();

        public static string ToHtml(string? markdown)
        {
            var document = Markdown.Parse(markdown ?? string.Empty, Pipeline);
            Sanitize(document);
            return document.ToHtml(Pipeline);
        }

        public static string ToPlainText(string? markdown) =>
            Markdown.ToPlainText(markdown ?? string.Empty, Pipeline).Trim();

        /// <summary>Whole minutes to read at ~200 words a minute, never less than 1.</summary>
        public static int ReadingMinutes(string? markdown)
        {
            var words = WordPattern().Count(ToPlainText(markdown));
            return Math.Max(1, (int)Math.Ceiling(words / (double)WordsPerMinute));
        }

        private static void Sanitize(MarkdownDocument document)
        {
            foreach (var heading in document.Descendants<HeadingBlock>())
                heading.Level = Math.Max(2, heading.Level);

            // ```csharp becomes class="language-csharp". The parser has already copied the info string into the block's
            // attributes, so reset those and keep only something that looks like a language name. It would be escaped
            // either way, but there's no reason to emit arbitrary text into an attribute.
            foreach (var code in document.Descendants<FencedCodeBlock>())
            {
                var attributes = code.GetAttributes();
                attributes.Id = null;
                attributes.Classes = null;
                attributes.Properties = null;
                if (code.Info is { } language && LanguagePattern().IsMatch(language))
                    attributes.AddClass("language-" + language);
            }

            // Materialize first: replacing an image changes the tree we're walking.
            foreach (var link in document.Descendants<LinkInline>().ToList())
            {
                // Markdig renders GetDynamicUrl() *instead of* Url when it's set (autolinks do), so that is the address
                // to judge. Checking Url alone let "<javascript:alert(1)>" through.
                var url = link.GetDynamicUrl is { } dynamicUrl ? dynamicUrl() : link.Url;

                if (link.IsImage)
                {
                    if (!IsSafeImageUrl(url))
                    {
                        // copyChildren: false, or the alt text would be written twice (once as the new literal, once as the old children).
                        link.ReplaceBy(new LiteralInline(AltText(link)), copyChildren: false);
                        continue;
                    }

                    var attributes = link.GetAttributes();
                    attributes.AddPropertyIfNotExist("loading", "lazy");
                    attributes.AddPropertyIfNotExist("decoding", "async");
                }
                else if (!IsSafeLinkUrl(url))
                {
                    link.GetDynamicUrl = null;
                    link.Url = "#";
                }
            }

            // "<https://example.com>" is its own node type (not a LinkInline), so the loop above never sees it.
            foreach (var autolink in document.Descendants<AutolinkInline>().ToList())
            {
                if (autolink.IsEmail || IsSafeLinkUrl(autolink.Url)) continue;
                autolink.ReplaceBy(new LiteralInline(autolink.Url), copyChildren: false); // shown as plain text, not clickable
            }
        }

        private static string AltText(LinkInline image) =>
            string.Concat(image.Descendants<LiteralInline>().Select(literal => literal.Content.ToString()));

        internal static bool IsSafeLinkUrl(string? url)
        {
            if (string.IsNullOrWhiteSpace(url) || HasControlCharacters(url)) return false;
            if (url.StartsWith('#')) return true;
            if (IsSiteRelative(url)) return true;

            return Uri.TryCreate(url, UriKind.Absolute, out var uri)
                && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps
                    || uri.Scheme == Uri.UriSchemeMailto || uri.Scheme == "tel");
        }

        internal static bool IsSafeImageUrl(string? url)
        {
            if (string.IsNullOrWhiteSpace(url) || HasControlCharacters(url)) return false;
            if (IsSiteRelative(url)) return true;
            return Uri.TryCreate(url, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps;
        }

        /// <summary>"/path" is ours; "//host/path" is protocol-relative, i.e. someone else's.</summary>
        private static bool IsSiteRelative(string url) =>
            url.StartsWith('/') && !url.StartsWith("//", StringComparison.Ordinal) && !url.Contains('\\');

        // Browsers silently drop tabs and newlines inside a URL, which is how "java\tscript:" sneaks past a scheme check.
        private static bool HasControlCharacters(string url) => url.Any(char.IsControl);

        [GeneratedRegex(@"\S+")]
        private static partial Regex WordPattern();

        [GeneratedRegex(@"^[A-Za-z0-9_+#.-]{1,30}$")]
        private static partial Regex LanguagePattern();
    }
}
