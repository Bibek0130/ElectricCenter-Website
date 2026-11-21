using System.Text.RegularExpressions;
using ElectricCenter.Server.Articles;

namespace ElectricCenter.Server.Tests
{
    public class ArticleMarkdownTests
    {
        [Fact]
        public void Renders_ordinary_markdown()
        {
            var html = ArticleMarkdown.ToHtml("""
                ## Choosing an MCB

                An **MCB** protects a circuit. See the [product list](/products).

                - 16A for lighting
                - 32A for sockets
                """);

            Assert.Contains("<h2>Choosing an MCB</h2>", html);
            Assert.Contains("<strong>MCB</strong>", html);
            Assert.Contains("""<a href="/products">product list</a>""", html);
            Assert.Contains("<li>16A for lighting</li>", html);
        }

        [Fact]
        public void A_top_level_heading_becomes_h2_because_the_article_title_is_the_pages_h1()
        {
            var html = ArticleMarkdown.ToHtml("# Big heading\n\nSetext heading\n=============\n\n### Small");

            Assert.DoesNotContain("<h1", html);
            Assert.Contains("<h2>Big heading</h2>", html);
            Assert.Contains("<h2>Setext heading</h2>", html);
            Assert.Contains("<h3>Small</h3>", html);
        }

        [Theory]
        [InlineData("<script>alert(1)</script>")]
        [InlineData("<img src=x onerror=alert(1)>")]
        [InlineData("<iframe src=\"https://evil.example\"></iframe>")]
        [InlineData("<a href=\"javascript:alert(1)\" onclick=\"alert(2)\">x</a>")]
        [InlineData("<div onmouseover=\"alert(1)\">hover</div>")]
        public void Raw_html_is_escaped_never_passed_through(string attack)
        {
            var html = ArticleMarkdown.ToHtml($"Before\n\n{attack}\n\nAfter {attack} inline");

            Assert.DoesNotContain("<script", html, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("<iframe", html, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("<img", html, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("<div", html, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("<a href=\"javascript", html, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("&lt;", html); // shown as text instead
        }

        [Theory]
        [InlineData("javascript:alert(1)")]
        [InlineData("JaVaScRiPt:alert(1)")]
        [InlineData("vbscript:msgbox(1)")]
        [InlineData("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==")]
        [InlineData("file:///etc/passwd")]
        [InlineData("//evil.example/phish")]
        [InlineData("jav&#x09;ascript:alert(1)")]
        [InlineData("jav&#x0A;ascript:alert(1)")]
        [InlineData("&#106;avascript:alert(1)")]
        public void Dangerous_link_targets_are_neutralised(string url)
        {
            var html = ArticleMarkdown.ToHtml($"[click me]({url})");

            Assert.Contains("""<a href="#">click me</a>""", html);
            Assert.DoesNotContain("javascript", html, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("evil.example", html);
        }

        [Theory]
        [InlineData("https://example.com/page", "https://example.com/page")]
        [InlineData("http://example.com/page", "http://example.com/page")]
        [InlineData("mailto:shop@example.com", "mailto:shop@example.com")]
        [InlineData("tel:+9779841445050", "tel:+9779841445050")]
        [InlineData("/electricians", "/electricians")]
        [InlineData("#wiring", "#wiring")]
        public void Ordinary_link_targets_are_kept(string url, string expectedHref)
        {
            var html = ArticleMarkdown.ToHtml($"[link]({url})");

            Assert.Contains($"""<a href="{expectedHref}">link</a>""", html);
        }

        [Fact]
        public void Autolinks_are_made_clickable_and_unsafe_ones_are_shown_as_text()
        {
            Assert.Contains("""<a href="https://example.com">""", ArticleMarkdown.ToHtml("Visit https://example.com today"));
            Assert.Contains("""<a href="https://example.com/x">""", ArticleMarkdown.ToHtml("See <https://example.com/x>"));
            Assert.Contains("""<a href="mailto:shop@example.com">""", ArticleMarkdown.ToHtml("Mail <shop@example.com>"));

            var unsafeLink = ArticleMarkdown.ToHtml("Click <javascript:alert(1)> now");
            Assert.DoesNotContain("<a ", unsafeLink);
            Assert.Contains("javascript:alert(1)", unsafeLink); // visible as text, which is harmless
        }

        /// <summary>
        /// Whatever the input, the output must never contain an active tag, an event-handler attribute, or a
        /// script-bearing URL. Checked as invariants over a corpus of known attack shapes rather than one string each.
        /// </summary>
        [Theory]
        [InlineData("<javascript:alert(1)>")]
        [InlineData("<data:text/html,<script>alert(1)</script>>")]
        [InlineData("<vbscript:msgbox(1)>")]
        [InlineData("[![logo](https://example.com/i.jpg)](javascript:alert(1))")]
        [InlineData("[x](/a \"t\\\" onmouseover=alert(1) x=\\\"\")")]
        [InlineData("![a\" onerror=\"alert(1)](https://example.com/i.jpg)")]
        [InlineData("![x](https://example.com/i.jpg \"t\\\" onload=alert(1)\")")]
        [InlineData("`<script>alert(1)</script>`")]
        [InlineData("```html\n<script>alert(1)</script>\n```")]
        [InlineData("```\"><script>alert(1)</script>\n```")]
        [InlineData("<svg onload=alert(1)>")]
        [InlineData("<style>body{display:none}</style>")]
        [InlineData("<form action=\"javascript:alert(1)\"><button>x</button></form>")]
        [InlineData("| a |\n|---|\n| <script>alert(1)</script> |")]
        [InlineData("[x]: javascript:alert(1)\n\n[x]")]
        [InlineData("&lt;script&gt;alert(1)&lt;/script&gt;")]
        [InlineData("<!-- --><script>alert(1)</script>")]
        [InlineData("www.example.com/\"onmouseover=\"alert(1)")]
        [InlineData("https://example.com/\"onmouseover=\"alert(1)")]
        public void Hostile_input_never_produces_active_content(string markdown) =>
            AssertOnlySafeHtml(ArticleMarkdown.ToHtml(markdown));

        // ---- an allowlist check of the rendered HTML, so these tests don't depend on how any one attack is spelled ----

        private static readonly HashSet<string> AllowedTags =
            ["p", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "a", "strong", "em", "del", "code", "pre", "blockquote",
             "hr", "br", "img", "table", "thead", "tbody", "tr", "th", "td"];

        // A well-formed tag whose attribute values are all quoted (Markdig always double-quotes them).
        private static readonly Regex TagPattern = new(
            """<(/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s=/>"']+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*/?>""");

        private static readonly Regex AttributePattern = new(
            """\s+([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?""");

        /// <summary>
        /// Every tag must be on the allowlist with allowlisted attributes, links must go somewhere safe, and no stray "&lt;"
        /// may be left over (text must have been escaped). Hostile text may *appear* (inside an escaped attribute value or as
        /// visible text) but can never become markup.
        /// </summary>
        private static void AssertOnlySafeHtml(string html)
        {
            foreach (Match tag in TagPattern.Matches(html))
            {
                var name = tag.Groups[2].Value.ToLowerInvariant();
                Assert.True(AllowedTags.Contains(name), $"Unexpected tag <{name}> in: {html}");

                foreach (Match attribute in AttributePattern.Matches(tag.Groups[3].Value))
                {
                    var attributeName = attribute.Groups[1].Value.ToLowerInvariant();
                    var value = System.Net.WebUtility.HtmlDecode(attribute.Groups[2].Success ? attribute.Groups[2].Value : attribute.Groups[3].Value);

                    switch (attributeName)
                    {
                        case "href":
                            Assert.Matches(@"^(#|/(?!/)|https?:|mailto:|tel:)", value);
                            Assert.DoesNotContain(value, char.IsControl);
                            break;
                        case "src":
                            Assert.Matches(@"^(https:|/(?!/))", value);
                            Assert.DoesNotContain(value, char.IsControl);
                            break;
                        case "title" or "alt":
                            break; // inert text: it was parsed as a quoted value, so it can't break out of the attribute
                        case "loading":
                            Assert.Equal("lazy", value);
                            break;
                        case "decoding":
                            Assert.Equal("async", value);
                            break;
                        case "style": // pipe-table column alignment, and nothing else
                            Assert.Matches(@"^text-align:\s*(left|right|center);?$", value);
                            break;
                        case "class": // fenced code blocks: language-xyz
                            Assert.Matches(@"^language-[\w+#.-]+$", value);
                            break;
                        default:
                            Assert.Fail($"Unexpected attribute '{attributeName}' on <{name}> in: {html}");
                            break;
                    }
                }
            }

            Assert.DoesNotContain('<', TagPattern.Replace(html, string.Empty));
        }

        [Fact]
        public void Https_images_are_kept_and_lazy_loaded()
        {
            var html = ArticleMarkdown.ToHtml("![A 63A MCB](https://res.cloudinary.com/demo/image/upload/mcb.jpg)");

            Assert.Contains("""src="https://res.cloudinary.com/demo/image/upload/mcb.jpg" """.TrimEnd(), html);
            Assert.Contains("""alt="A 63A MCB" """.TrimEnd(), html);
            Assert.Contains("""loading="lazy" """.TrimEnd(), html);
            Assert.Contains("""decoding="async" """.TrimEnd(), html);
        }

        [Theory]
        [InlineData("http://example.com/insecure.jpg")]
        [InlineData("javascript:alert(1)")]
        [InlineData("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")]
        [InlineData("//evil.example/x.jpg")]
        [InlineData("ftp://example.com/x.jpg")]
        public void Images_that_are_not_https_are_replaced_by_their_alt_text(string url)
        {
            var html = ArticleMarkdown.ToHtml($"Look: ![wiring diagram]({url}) done");

            Assert.DoesNotContain("<img", html);
            Assert.Contains("Look: wiring diagram done", html);
        }

        [Fact]
        public void Tables_and_strikethrough_work()
        {
            var html = ArticleMarkdown.ToHtml("| Wire | Amps |\n|---|---|\n| 1.5mm | 10 |\n\n~~old~~");

            Assert.Contains("<table>", html);
            Assert.Contains("<td>1.5mm</td>", html);
            Assert.Contains("<del>old</del>", html);
        }

        [Fact]
        public void Attribute_injection_syntax_is_not_supported()
        {
            var html = ArticleMarkdown.ToHtml("[x](/a){onclick=\"alert(1)\"}\n\n## Heading {#evil .cls onmouseover=alert(1)}");

            // The braces stay visible as plain text; what must never happen is a *tag* carrying a handler or an id.
            Assert.DoesNotMatch(@"<[^>]*\bon\w+\s*=", html);
            Assert.DoesNotMatch(@"<[^>]*\bid\s*=", html);
            Assert.Contains("""<a href="/a">x</a>""", html);
        }

        [Theory]
        [InlineData("[x][ref]\n\n[ref]: javascript:alert(1)")]
        [InlineData("[ref]\n\n[ref]: javascript:alert(1)")]
        [InlineData("[x]( javascript:alert(1) )")]
        [InlineData("[x](<javascript:alert(1)>)")]
        public void Reference_style_and_oddly_spaced_links_are_neutralised_too(string markdown)
        {
            var html = ArticleMarkdown.ToHtml(markdown);

            Assert.DoesNotContain("href=\"javascript", html, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public void Null_and_empty_input_render_nothing()
        {
            Assert.Equal(string.Empty, ArticleMarkdown.ToHtml(null).Trim());
            Assert.Equal(string.Empty, ArticleMarkdown.ToHtml("").Trim());
            Assert.Equal(string.Empty, ArticleMarkdown.ToPlainText(null));
        }

        [Fact]
        public void Plain_text_strips_the_markup()
        {
            var text = ArticleMarkdown.ToPlainText("## Title\n\nSome **bold** and a [link](/x).");

            Assert.Contains("Some bold and a link.", text);
            Assert.DoesNotContain("*", text);
            Assert.DoesNotContain("](", text);
        }

        [Theory]
        [InlineData("", 1)]
        [InlineData("a few words only", 1)]
        public void Reading_time_is_at_least_one_minute(string markdown, int expected) =>
            Assert.Equal(expected, ArticleMarkdown.ReadingMinutes(markdown));

        [Fact]
        public void Reading_time_rounds_up_at_about_200_words_a_minute()
        {
            Assert.Equal(1, ArticleMarkdown.ReadingMinutes(string.Join(' ', Enumerable.Repeat("word", 200))));
            Assert.Equal(2, ArticleMarkdown.ReadingMinutes(string.Join(' ', Enumerable.Repeat("word", 201))));
            Assert.Equal(5, ArticleMarkdown.ReadingMinutes(string.Join(' ', Enumerable.Repeat("word", 1000))));
        }
    }

    public class ArticleSlugTests
    {
        [Theory]
        [InlineData("Why Surge Protectors Matter in Kathmandu", "why-surge-protectors-matter-in-kathmandu")]
        [InlineData("  Hello,   World!!  ", "hello-world")]
        [InlineData("Café Électrique", "cafe-electrique")]
        [InlineData("MCB vs. RCCB: 5 Differences", "mcb-vs-rccb-5-differences")]
        [InlineData("---", "")]
        [InlineData("", "")]
        [InlineData(null, "")]
        [InlineData("विद्युत सुरक्षा", "")] // nothing in Devanagari survives; the service supplies a fallback
        public void Slugify_makes_a_clean_url_segment(string? title, string expected) =>
            Assert.Equal(expected, ArticleRules.Slugify(title));

        [Fact]
        public void Slugify_cuts_long_titles_at_a_word_boundary()
        {
            var slug = ArticleRules.Slugify(string.Join(' ', Enumerable.Repeat("electrical", 20)));

            Assert.True(slug.Length <= ArticleRules.SlugMaxLength);
            Assert.DoesNotContain("--", slug);
            Assert.False(slug.EndsWith('-'));
            Assert.Matches(ArticleRules.SlugPattern(), slug);
            Assert.EndsWith("electrical", slug); // not "...electri"
        }

        [Theory]
        [InlineData("wiring-basics", true)]
        [InlineData("a", true)]
        [InlineData("2024-guide", true)]
        [InlineData("Wiring-Basics", false)]
        [InlineData("wiring--basics", false)]
        [InlineData("-wiring", false)]
        [InlineData("wiring-", false)]
        [InlineData("wiring basics", false)]
        [InlineData("wiring_basics", false)]
        [InlineData("wiring/basics", false)]
        [InlineData("", false)]
        public void Slug_pattern_accepts_only_lowercase_words_joined_by_single_hyphens(string slug, bool valid) =>
            Assert.Equal(valid, ArticleRules.SlugPattern().IsMatch(slug));
    }
}
