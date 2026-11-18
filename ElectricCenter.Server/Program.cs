using System.Threading.RateLimiting;
using ElectricCenter.Server.Auth;
using ElectricCenter.Server.Data;
using ElectricCenter.Server.Electricians;
using ElectricCenter.Server.Uploads;
using ElectricCenter.Server.Products;
using ElectricCenter.Server.Services.Email.Interface;
using ElectricCenter.Server.Services.Email.Service;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// ---------- Database (MySQL 8 via the Microting fork of Pomelo, which supports EF Core 10) ----------
var connectionString = builder.Configuration.GetConnectionString("Default");
builder.Services.AddDbContext<AppDbContext>(options =>
    // A fixed server version avoids opening a connection just to detect it (and works at design time).
    options.UseMySql(connectionString ?? string.Empty, new MySqlServerVersion(new Version(8, 0, 36)), mysql =>
        // Free-tier hosts often sleep or drop idle connections; retry transient failures.
        mysql.EnableRetryOnFailure(maxRetryCount: 5, maxRetryDelay: TimeSpan.FromSeconds(10), errorNumbersToAdd: null)));

// ---------- Authentication: JWT bearer access tokens + rotating refresh-token cookie ----------
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddOptions<JwtOptions>()
    .Bind(builder.Configuration.GetSection(JwtOptions.SectionName))
    .Validate(o => o.IsValid(out _), "Invalid Jwt settings (Jwt:SigningKey must be at least 32 bytes; see docs/AUTH.md).")
    .ValidateOnStart();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IOptions<JwtOptions>>((bearer, jwt) =>
    {
        bearer.MapInboundClaims = false; // keep "sub"/"role"/"email" as-is instead of long ClaimTypes URIs
        bearer.TokenValidationParameters = JwtTokenService.CreateValidationParameters(jwt.Value);
    });

builder.Services.AddAuthorizationBuilder()
    .AddPolicy(Policies.AdminOnly, policy => policy.RequireRole(Roles.Admin));

builder.Services.AddSingleton<IPasswordHasher>(new BcryptPasswordHasher());
builder.Services.AddSingleton<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.Configure<EmailVerificationOptions>(builder.Configuration.GetSection(EmailVerificationOptions.SectionName));
builder.Services.AddScoped<IEmailVerificationService, EmailVerificationService>();
builder.Services.AddScoped<IUserManagementService, UserManagementService>();
builder.Services.AddScoped<IProductService, ProductService>();
builder.Services.AddScoped<IElectricianService, ElectricianService>();

// ---------- Rate limiting for the auth endpoints (per client IP) ----------
// Behind a reverse proxy, enable forwarded headers (ASPNETCORE_FORWARDEDHEADERS_ENABLED=true) so this sees the real client IP.
var authStrictPerMinute = builder.Configuration.GetValue("RateLimiting:AuthStrictPerMinute", 10);
var authRefreshPerMinute = builder.Configuration.GetValue("RateLimiting:AuthRefreshPerMinute", 60);
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = (context, ct) =>
        new ValueTask(context.HttpContext.Response.WriteAsJsonAsync(new { message = "Too many attempts. Please wait a minute and try again." }, ct));

    options.AddPolicy(RateLimitPolicies.AuthStrict, http => RateLimitPartition.GetFixedWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = authStrictPerMinute, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));

    options.AddPolicy(RateLimitPolicies.Upload, http => RateLimitPartition.GetFixedWindowLimiter(
        http.User.Identity?.Name ?? http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));

    options.AddPolicy(RateLimitPolicies.AuthRefresh, http => RateLimitPartition.GetFixedWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = authRefreshPerMinute, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});

// ---------- Email (OTP codes) ----------
// With SMTP configured, real email is sent. Without it, Development logs each email (including the
// OTP code) to the console so sign-up can still be tested; other environments refuse to start below.
var smtpSection = builder.Configuration.GetSection(SmtpOptions.SectionName);
var smtpConfigured = smtpSection.Get<SmtpOptions>()?.IsConfigured ?? false;
builder.Services.Configure<SmtpOptions>(smtpSection);
if (smtpConfigured)
    builder.Services.AddTransient<IEmailSender, EmailSender>();
else
    builder.Services.AddTransient<IEmailSender, DevelopmentEmailSender>();

builder.Services.AddHttpClient();

// ---------- Image uploads (Cloudinary) ----------
builder.Services.Configure<CloudinaryOptions>(builder.Configuration.GetSection(CloudinaryOptions.SectionName));
builder.Services.AddHttpClient(CloudinaryOptions.HttpClientName, c => c.Timeout = TimeSpan.FromSeconds(60));
builder.Services.AddScoped<IImageUploadService, CloudinaryImageUploadService>();
builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "ConnectionStrings:Default is not set. Use `dotnet user-secrets` in development or the ConnectionStrings__Default environment variable in production (see docs/AUTH.md).");
}

if (!smtpConfigured)
{
    if (!app.Environment.IsDevelopment() && !app.Environment.IsEnvironment("Testing"))
    {
        throw new InvalidOperationException(
            "Email:Smtp is not configured, so verification codes can't be sent. Set Email__Smtp__Host, __Port, __UserName, __Password and __FromAddress (see docs/AUTH.md).");
    }
    app.Logger.LogWarning("Email:Smtp is not configured: verification emails are written to this log instead of being sent.");
}

await DatabaseInitializer.InitializeAsync(app.Services);

app.UseDefaultFiles();
app.MapStaticAssets();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference("/api-docs");
}
app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapControllers();

// Liveness probe for the host (Render's health check). Deliberately doesn't touch the database, so a sleeping free-tier DB can't fail a deploy.
app.MapGet("/healthz", () => Results.Text("ok"));

app.MapFallbackToFile("/index.html");

app.Run();

/// <summary>Exposed for integration tests (WebApplicationFactory).</summary>
public partial class Program;
