namespace ElectricCenter.Server.Seo
{
    /// <summary>
    /// The site's public address, used in canonical links, link previews, the sitemap and structured data, which all need
    /// absolute URLs. Set <c>Site:BaseUrl</c> (env var <c>Site__BaseUrl</c>), e.g. "https://www.example.com". If it isn't set,
    /// the address the request arrived on is used, which is right whenever there's a single public address.
    /// </summary>
    public sealed class SiteUrls
    {
        private readonly string? _configured;

        public SiteUrls(IConfiguration configuration, ILogger<SiteUrls> logger)
        {
            var value = configuration["Site:BaseUrl"];
            if (string.IsNullOrWhiteSpace(value)) return;

            if (Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri) && uri.Scheme is "http" or "https")
            {
                // Scheme and host only: a trailing slash or a path would double up when pages are appended.
                _configured = uri.GetLeftPart(UriPartial.Authority);
            }
            else
            {
                logger.LogWarning("Site:BaseUrl \"{Value}\" is not an absolute http(s) URL, so it was ignored.", value);
            }
        }

        /// <summary>No trailing slash, e.g. "https://www.example.com".</summary>
        public string GetBaseUrl(HttpRequest request) => _configured ?? $"{request.Scheme}://{request.Host}";

        /// <summary>"/articles/x" -> "https://www.example.com/articles/x". Absolute URLs pass through.</summary>
        public static string Absolute(string baseUrl, string pathOrUrl) =>
            Uri.TryCreate(pathOrUrl, UriKind.Absolute, out var uri) && uri.Scheme is "http" or "https"
                ? pathOrUrl
                : baseUrl.TrimEnd('/') + (pathOrUrl.StartsWith('/') ? pathOrUrl : "/" + pathOrUrl);
    }
}
