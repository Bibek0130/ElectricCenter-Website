using System.Globalization;
using System.Security;
using System.Text;
using ElectricCenter.Server.Articles;
using ElectricCenter.Server.Electricians;

namespace ElectricCenter.Server.Seo
{
    /// <summary>robots.txt and sitemap.xml: the two files crawlers ask for first.</summary>
    public static class SeoDocuments
    {
        /// <summary>
        /// Everything is crawlable on purpose. Utility pages (login, checkout, admin) are kept out of results with a
        /// noindex tag instead, which only works if crawlers are allowed to see it. /api/ is deliberately NOT blocked:
        /// Google runs the page's JavaScript, and that JavaScript fetches products and articles from /api/. Block it and
        /// Google sees empty pages. (API responses carry "X-Robots-Tag: noindex", so they don't appear in results.)
        /// </summary>
        public static string Robots(string baseUrl) => $"User-agent: *\nAllow: /\n\nSitemap: {baseUrl}/sitemap.xml\n";

        public static string Sitemap(string baseUrl, IEnumerable<(string Path, DateTime? LastModifiedUtc)> entries)
        {
            var xml = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");
            foreach (var (path, lastModified) in entries)
            {
                xml.Append("  <url><loc>").Append(SecurityElement.Escape(SiteUrls.Absolute(baseUrl, path))).Append("</loc>");
                if (lastModified is { } when) xml.Append("<lastmod>").Append(when.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture)).Append("</lastmod>");
                xml.Append("</url>\n");
            }

            return xml.Append("</urlset>\n").ToString();
        }
    }

    public static class SeoEndpoints
    {
        public static IServiceCollection AddSeo(this IServiceCollection services)
        {
            services.AddSingleton<SiteUrls>();
            services.AddSingleton<SeoSiteDataProvider>();
            services.AddSingleton<SeoHtmlTemplate>();
            services.AddSingleton<SeoHtmlRenderer>();
            services.AddScoped<ISeoPageResolver, SeoPageResolver>();
            return services;
        }

        /// <summary>Rules that must run before routing picks an endpoint. Call after UseHttpsRedirection.</summary>
        public static IApplicationBuilder UseSeoRules(this IApplicationBuilder app) => app.Use(async (context, next) =>
        {
            var request = context.Request;
            var path = request.Path.Value ?? "/";
            var reading = HttpMethods.IsGet(request.Method) || HttpMethods.IsHead(request.Method);

            // The home page lives at "/". These two addresses used to show it too: send them (and any links or
            // rankings they collected) to the one real address with a permanent redirect.
            if (reading && (path.Equals("/home", StringComparison.OrdinalIgnoreCase)
                || path.Equals("/home/", StringComparison.OrdinalIgnoreCase)
                || path.Equals("/index.html", StringComparison.OrdinalIgnoreCase)))
            {
                context.Response.Redirect("/", permanent: true);
                return;
            }

            // The API is for the site's own pages, not for search results. (It must stay crawlable; see SeoDocuments.Robots.)
            if (path.Equals("/api", StringComparison.OrdinalIgnoreCase) || path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase))
            {
                context.Response.OnStarting(() =>
                {
                    context.Response.Headers["X-Robots-Tag"] = "noindex";
                    return Task.CompletedTask;
                });
            }

            await next();
        });

        public static IEndpointRouteBuilder MapSeo(this IEndpointRouteBuilder app)
        {
            app.MapGet("/robots.txt", (HttpContext context, SiteUrls urls) =>
            {
                context.Response.Headers.CacheControl = "public, max-age=600";
                return Results.Text(SeoDocuments.Robots(urls.GetBaseUrl(context.Request)), "text/plain", Encoding.UTF8);
            });

            app.MapGet("/sitemap.xml", async (HttpContext context, SiteUrls urls, SeoSiteDataProvider dataProvider,
                IArticleService articles, IElectricianService electricians, CancellationToken ct) =>
            {
                var data = dataProvider.Get();
                var entries = new List<(string Path, DateTime? LastModifiedUtc)>();

                // Fixed pages: the indexable ones, in the order the build listed them (the home page first).
                if (data.IsFallback) entries.Add(("/", null));
                entries.AddRange(data.Pages.Where(p => p.Value.Indexable).Select(p => (p.Key, (DateTime?)null)));

                entries.AddRange((await articles.ListForSitemapAsync(ct)).Select(a => ($"/articles/{a.Slug}", (DateTime?)a.LastModifiedUtc)));

                var people = await electricians.ListAsync(new ElectricianQuery(null, null, null, false), ct);
                entries.AddRange(people.Select(e => ($"/electricians/{e.Id}", (DateTime?)(e.UpdatedAtUtc ?? e.CreatedAtUtc))));

                context.Response.Headers.CacheControl = "public, max-age=600";
                return Results.Text(SeoDocuments.Sitemap(urls.GetBaseUrl(context.Request), entries), "application/xml", Encoding.UTF8);
            });

            // Every other address without a file extension is a page of the single-page app. Addresses that look
            // like files (/missing.js) fall through to a plain 404 instead of returning the HTML shell.
            app.MapFallback("{*path:nonfile}", async (HttpContext context, SiteUrls urls, SeoHtmlTemplate template,
                ISeoPageResolver resolver, SeoHtmlRenderer renderer, SeoSiteDataProvider dataProvider, CancellationToken ct) =>
            {
                var path = context.Request.Path.Value ?? "/";
                var reading = HttpMethods.IsGet(context.Request.Method) || HttpMethods.IsHead(context.Request.Method);
                if (!reading || path.Equals("/api", StringComparison.OrdinalIgnoreCase) || path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase))
                    return Results.NotFound(new { message = "Not found." });

                var html = template.Get();
                if (html is null) return Results.NotFound(); // development: Vite serves the pages, not this server

                var baseUrl = urls.GetBaseUrl(context.Request);
                var page = await resolver.ResolveAsync(path, baseUrl, ct);

                // Revalidate every time: the HTML changes when an article is published, and the assets it points to are fingerprinted.
                context.Response.Headers.CacheControl = "no-cache";
                if (!page.Indexable) context.Response.Headers["X-Robots-Tag"] = SeoHtmlRenderer.RobotsNoIndex;

                return Results.Content(renderer.Render(html, page, baseUrl, dataProvider.Get()), "text/html", Encoding.UTF8, page.StatusCode);
            });

            return app;
        }
    }
}
