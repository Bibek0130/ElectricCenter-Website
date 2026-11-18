using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ElectricCenter.Server.Auth;
using Microsoft.Extensions.Options;

namespace ElectricCenter.Server.Uploads
{
    /// <summary>Bound from "Cloudinary". The API secret must come from user-secrets or an environment variable.</summary>
    public sealed class CloudinaryOptions
    {
        public const string SectionName = "Cloudinary";
        public const string HttpClientName = "cloudinary";

        public string CloudName { get; set; } = string.Empty;
        public string ApiKey { get; set; } = string.Empty;
        public string ApiSecret { get; set; } = string.Empty;

        /// <summary>Folder (Cloudinary "asset folder"/public-id prefix) all uploads go into.</summary>
        public string Folder { get; set; } = "electriccenter";

        public bool IsConfigured =>
            !string.IsNullOrWhiteSpace(CloudName) && !string.IsNullOrWhiteSpace(ApiKey) && !string.IsNullOrWhiteSpace(ApiSecret);
    }

    public static class ImageRules
    {
        public const long MaxBytes = 5 * 1024 * 1024;
        public static readonly IReadOnlyList<string> AllowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];

        /// <summary>Resizes anything larger than this on Cloudinary's side, so a 20 MP phone photo isn't stored or served at full size.</summary>
        public const string IncomingTransformation = "c_limit,w_1600,h_1600";

        /// <summary>Detects JPEG, PNG or WebP from the file's first bytes (the client-sent content type and extension are not trusted).</summary>
        public static string? DetectType(ReadOnlySpan<byte> header)
        {
            if (header.Length >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF) return "image/jpeg";
            if (header.Length >= 8 && header[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A })) return "image/png";
            if (header.Length >= 12 && header[..4].SequenceEqual("RIFF"u8) && header[8..12].SequenceEqual("WEBP"u8)) return "image/webp";
            return null;
        }
    }

    public sealed record UploadedImage(string Url, string PublicId, int Width, int Height, long Bytes);

    public interface IImageUploadService
    {
        Task<ServiceResult<UploadedImage>> UploadAsync(Stream content, long length, string? fileName, CancellationToken ct = default);
    }

    /// <summary>
    /// Uploads to Cloudinary with a *signed* request made from the server, so the API secret never
    /// reaches the browser. Only the resulting https URL is stored in our database.
    /// </summary>
    public sealed class CloudinaryImageUploadService(
        IHttpClientFactory httpClientFactory,
        IOptions<CloudinaryOptions> options,
        TimeProvider timeProvider,
        ILogger<CloudinaryImageUploadService> logger) : IImageUploadService
    {
        public async Task<ServiceResult<UploadedImage>> UploadAsync(Stream content, long length, string? fileName, CancellationToken ct = default)
        {
            var settings = options.Value;
            if (!settings.IsConfigured)
                return ServiceResult<UploadedImage>.Fail(ServiceError.Unavailable, "Image uploads aren't set up yet. Ask the site owner to configure Cloudinary.");

            if (length <= 0) return ServiceResult<UploadedImage>.Fail(ServiceError.Validation, "Choose an image to upload.");
            if (length > ImageRules.MaxBytes)
                return ServiceResult<UploadedImage>.Fail(ServiceError.Validation, $"The image is too large. The limit is {ImageRules.MaxBytes / (1024 * 1024)} MB.");

            // Read into memory (≤ 5 MB) so the content can be checked before anything leaves our server.
            using var buffer = new MemoryStream((int)length);
            await content.CopyToAsync(buffer, ct);
            if (buffer.Length > ImageRules.MaxBytes)
                return ServiceResult<UploadedImage>.Fail(ServiceError.Validation, $"The image is too large. The limit is {ImageRules.MaxBytes / (1024 * 1024)} MB.");

            var bytes = buffer.GetBuffer().AsSpan(0, (int)buffer.Length);
            var contentType = ImageRules.DetectType(bytes);
            if (contentType is null)
                return ServiceResult<UploadedImage>.Fail(ServiceError.Validation, "That file isn't a supported image. Use a JPG, PNG or WebP.");

            var timestamp = timeProvider.GetUtcNow().ToUnixTimeSeconds().ToString();
            var signedParams = new SortedDictionary<string, string>(StringComparer.Ordinal)
            {
                ["folder"] = settings.Folder,
                ["timestamp"] = timestamp,
                ["transformation"] = ImageRules.IncomingTransformation,
            };

            using var form = new MultipartFormDataContent();
            foreach (var (key, value) in signedParams) form.Add(new StringContent(value), key);
            form.Add(new StringContent(settings.ApiKey), "api_key");
            form.Add(new StringContent(Sign(signedParams, settings.ApiSecret)), "signature");
            var file = new ByteArrayContent(buffer.GetBuffer(), 0, (int)buffer.Length);
            file.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(contentType);
            form.Add(file, "file", SafeFileName(fileName, contentType));

            try
            {
                var client = httpClientFactory.CreateClient(CloudinaryOptions.HttpClientName);
                using var response = await client.PostAsync($"https://api.cloudinary.com/v1_1/{Uri.EscapeDataString(settings.CloudName)}/image/upload", form, ct);
                var json = await response.Content.ReadAsStringAsync(ct);

                if (!response.IsSuccessStatusCode)
                {
                    logger.LogWarning("Cloudinary rejected an upload ({Status}): {Body}", (int)response.StatusCode, Truncate(json, 500));
                    return ServiceResult<UploadedImage>.Fail(ServiceError.Unavailable, "The image service rejected the upload. Please try again.");
                }

                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;
                var url = root.GetProperty("secure_url").GetString();
                if (string.IsNullOrWhiteSpace(url) || !url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                    return ServiceResult<UploadedImage>.Fail(ServiceError.Unavailable, "The image service returned an unexpected response.");

                return ServiceResult<UploadedImage>.Ok(new UploadedImage(
                    url,
                    root.GetProperty("public_id").GetString() ?? string.Empty,
                    root.TryGetProperty("width", out var w) ? w.GetInt32() : 0,
                    root.TryGetProperty("height", out var h) ? h.GetInt32() : 0,
                    root.TryGetProperty("bytes", out var b) ? b.GetInt64() : buffer.Length));
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException or KeyNotFoundException)
            {
                if (ct.IsCancellationRequested) throw;
                logger.LogError(ex, "Cloudinary upload failed.");
                return ServiceResult<UploadedImage>.Fail(ServiceError.Unavailable, "Couldn't reach the image service. Please try again.");
            }
        }

        /// <summary>
        /// Cloudinary signature: the signed params sorted by name, joined as "k=v&amp;k=v", with the API
        /// secret appended, SHA-1 hashed, hex lowercase. (api_key, file and resource_type aren't signed.)
        /// </summary>
        public static string Sign(IEnumerable<KeyValuePair<string, string>> parameters, string apiSecret)
        {
            var toSign = string.Join("&", parameters.OrderBy(p => p.Key, StringComparer.Ordinal).Select(p => $"{p.Key}={p.Value}")) + apiSecret;
            return Convert.ToHexString(SHA1.HashData(Encoding.UTF8.GetBytes(toSign))).ToLowerInvariant();
        }

        private static string SafeFileName(string? fileName, string contentType)
        {
            var extension = contentType switch { "image/png" => ".png", "image/webp" => ".webp", _ => ".jpg" };
            var stem = Path.GetFileNameWithoutExtension(fileName ?? string.Empty);
            var clean = new string(stem.Where(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_').Take(60).ToArray());
            return (clean.Length > 0 ? clean : "upload") + extension;
        }

        private static string Truncate(string value, int max) => value.Length <= max ? value : value[..max];
    }
}
