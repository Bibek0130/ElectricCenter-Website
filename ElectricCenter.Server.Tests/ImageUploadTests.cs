using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using ElectricCenter.Server.Auth;
using ElectricCenter.Server.Contracts;
using ElectricCenter.Server.Uploads;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace ElectricCenter.Server.Tests
{
    public class ImageUploadServiceTests
    {
        private static readonly byte[] Jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10, 0x4A, 0x46, 0x49, 0x46, 0, 1];
        private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0x0D];
        private static readonly byte[] Webp = [.. "RIFF"u8.ToArray(), 1, 2, 3, 4, .. "WEBPVP8 "u8.ToArray()];

        private sealed class FakeHandler(HttpStatusCode status, string body) : HttpMessageHandler
        {
            public HttpRequestMessage? Request { get; private set; }
            public Dictionary<string, string> Fields { get; } = [];
            public int Calls { get; private set; }

            protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
            {
                Calls++;
                Request = request;
                if (request.Content is MultipartFormDataContent form)
                {
                    foreach (var part in form)
                    {
                        var name = part.Headers.ContentDisposition?.Name?.Trim('"') ?? "";
                        Fields[name] = part.Headers.ContentDisposition?.FileName is not null ? $"<file:{part.Headers.ContentDisposition.FileName.Trim('"')}>" : await part.ReadAsStringAsync(ct);
                    }
                }
                return new HttpResponseMessage(status) { Content = new StringContent(body) };
            }
        }

        private sealed class FakeFactory(HttpMessageHandler handler) : IHttpClientFactory
        {
            public HttpClient CreateClient(string name) => new(handler, disposeHandler: false);
        }

        private static (CloudinaryImageUploadService Service, FakeHandler Handler) Create(
            HttpStatusCode status = HttpStatusCode.OK,
            string? body = null,
            CloudinaryOptions? options = null)
        {
            var handler = new FakeHandler(status, body ?? """{"secure_url":"https://res.cloudinary.com/demo/image/upload/v1/electriccenter/abc.jpg","public_id":"electriccenter/abc","width":800,"height":600,"bytes":12345}""");
            var settings = options ?? new CloudinaryOptions { CloudName = "demo", ApiKey = "key123", ApiSecret = "secret456", Folder = "electriccenter" };
            var time = new MutableTimeProvider(new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero));
            return (new CloudinaryImageUploadService(new FakeFactory(handler), Options.Create(settings), time, NullLogger<CloudinaryImageUploadService>.Instance), handler);
        }

        private static Task<ServiceResult<UploadedImage>> UploadAsync(CloudinaryImageUploadService service, byte[] bytes, string name = "photo.jpg") =>
            service.UploadAsync(new MemoryStream(bytes), bytes.Length, name);

        [Fact]
        public void Signature_matches_the_documented_cloudinary_algorithm()
        {
            // Params sorted by name, joined with &, secret appended, SHA-1 hex.
            var signature = CloudinaryImageUploadService.Sign(
                new Dictionary<string, string> { ["timestamp"] = "1315060510", ["public_id"] = "sample_image" }, "abcd");

            Assert.Equal("b4ad47fb4e25c7bf5f92a20089f9db59bc302313", signature); // value from Cloudinary's own docs
        }

        [Fact]
        public async Task Valid_image_is_uploaded_with_a_signed_request_and_the_secure_url_is_returned()
        {
            var (service, handler) = Create();

            var result = await UploadAsync(service, Jpeg, "My Shop Photo!.JPG");

            Assert.True(result.Succeeded, result.Message);
            Assert.Equal("https://res.cloudinary.com/demo/image/upload/v1/electriccenter/abc.jpg", result.Value!.Url);
            Assert.Equal(800, result.Value.Width);

            Assert.Equal("https://api.cloudinary.com/v1_1/demo/image/upload", handler.Request!.RequestUri!.ToString());
            Assert.Equal("key123", handler.Fields["api_key"]);
            Assert.Equal("electriccenter", handler.Fields["folder"]);
            Assert.Equal("1767225600", handler.Fields["timestamp"]);
            Assert.Equal(ImageRules.IncomingTransformation, handler.Fields["transformation"]);
            Assert.Equal("<file:MyShopPhoto.jpg>", handler.Fields["file"]); // sanitized name, extension from the real type

            var expected = CloudinaryImageUploadService.Sign(new Dictionary<string, string>
            {
                ["folder"] = "electriccenter", ["timestamp"] = "1767225600", ["transformation"] = ImageRules.IncomingTransformation,
            }, "secret456");
            Assert.Equal(expected, handler.Fields["signature"]);
            Assert.DoesNotContain("secret456", string.Join("|", handler.Fields.Values)); // the secret never leaves the server
        }

        [Fact]
        public async Task Png_and_webp_are_accepted()
        {
            var (service, _) = Create();
            Assert.True((await UploadAsync(service, Png, "a.png")).Succeeded);
            Assert.True((await UploadAsync(service, Webp, "a.webp")).Succeeded);
        }

        [Theory]
        [InlineData("<?php echo 1; ?>")]
        [InlineData("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>")]
        [InlineData("GIF89a......")]
        [InlineData("MZ executable disguised as a photo")]
        public async Task Non_image_content_is_rejected_regardless_of_the_file_name(string content)
        {
            var (service, handler) = Create();

            var result = await UploadAsync(service, System.Text.Encoding.UTF8.GetBytes(content), "photo.jpg");

            Assert.Equal(ServiceError.Validation, result.Error);
            Assert.Equal(0, handler.Calls); // nothing was sent to Cloudinary
        }

        [Fact]
        public async Task Oversized_and_empty_files_are_rejected_before_any_upload()
        {
            var (service, handler) = Create();

            var tooBig = await service.UploadAsync(new MemoryStream(), ImageRules.MaxBytes + 1, "big.jpg");
            var empty = await service.UploadAsync(new MemoryStream(), 0, "empty.jpg");

            Assert.Equal(ServiceError.Validation, tooBig.Error);
            Assert.Contains("too large", tooBig.Message);
            Assert.Equal(ServiceError.Validation, empty.Error);
            Assert.Equal(0, handler.Calls);
        }

        [Fact]
        public async Task A_stream_longer_than_its_declared_length_is_still_capped()
        {
            var (service, handler) = Create();
            var lying = new MemoryStream([.. Jpeg, .. new byte[ImageRules.MaxBytes]]);

            var result = await service.UploadAsync(lying, length: 100, "x.jpg");

            Assert.Equal(ServiceError.Validation, result.Error);
            Assert.Equal(0, handler.Calls);
        }

        [Fact]
        public async Task Unconfigured_cloudinary_reports_unavailable_without_calling_out()
        {
            var (service, handler) = Create(options: new CloudinaryOptions());

            var result = await UploadAsync(service, Jpeg);

            Assert.Equal(ServiceError.Unavailable, result.Error);
            Assert.Contains("configure Cloudinary", result.Message);
            Assert.Equal(0, handler.Calls);
        }

        [Theory]
        [InlineData(HttpStatusCode.BadRequest, """{"error":{"message":"Invalid Signature"}}""")]
        [InlineData(HttpStatusCode.OK, "not json")]
        [InlineData(HttpStatusCode.OK, """{"secure_url":"http://insecure.example/x.jpg","public_id":"x"}""")]
        public async Task Cloudinary_errors_and_odd_responses_become_a_friendly_failure(HttpStatusCode status, string body)
        {
            var (service, _) = Create(status, body);

            var result = await UploadAsync(service, Jpeg);

            Assert.Equal(ServiceError.Unavailable, result.Error);
            Assert.DoesNotContain("Invalid Signature", result.Message); // upstream details aren't leaked to the browser
        }
    }

    public class ImageUploadApiTests(AuthApiFactory factory) : IClassFixture<AuthApiFactory>, IAsyncLifetime
    {
        private const string Password = "integration password";

        public Task InitializeAsync() => factory.EnsureDatabaseAsync();
        public Task DisposeAsync() => Task.CompletedTask;

        private async Task<HttpClient> SignedInClientAsync(params string[] roles)
        {
            var email = $"user-{Guid.NewGuid():N}@example.com";
            await factory.CreateUserAsync(email, Password, verified: true, roles);
            var client = factory.CreateSpaClient();
            var login = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, Password));
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", (await login.Content.ReadFromJsonAsync<AuthResponse>())!.AccessToken);
            return client;
        }

        private static MultipartFormDataContent FileForm(byte[] bytes, string name = "photo.jpg")
        {
            var form = new MultipartFormDataContent();
            var file = new ByteArrayContent(bytes);
            file.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
            form.Add(file, "file", name);
            return form;
        }

        [Fact]
        public async Task Only_admins_can_upload()
        {
            var jpeg = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10 };

            Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateSpaClient().PostAsync("/api/uploads/image", FileForm(jpeg))).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await (await SignedInClientAsync(Roles.Customer)).PostAsync("/api/uploads/image", FileForm(jpeg))).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await (await SignedInClientAsync(Roles.Electrician)).PostAsync("/api/uploads/image", FileForm(jpeg))).StatusCode);
        }

        [Fact]
        public async Task Admin_upload_without_a_file_is_a_400_and_without_cloudinary_config_is_a_503()
        {
            var admin = await SignedInClientAsync(Roles.Admin);

            var noFile = await admin.PostAsync("/api/uploads/image", new MultipartFormDataContent());
            Assert.Equal(HttpStatusCode.BadRequest, noFile.StatusCode);

            // The test host has no Cloudinary settings, so a valid-looking image reports "not set up" (503), not a crash.
            var unconfigured = await admin.PostAsync("/api/uploads/image", FileForm(new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10, 0x4A }));
            Assert.Equal(HttpStatusCode.ServiceUnavailable, unconfigured.StatusCode);
            Assert.Contains("configure Cloudinary", await unconfigured.Content.ReadAsStringAsync());
        }
    }
}
