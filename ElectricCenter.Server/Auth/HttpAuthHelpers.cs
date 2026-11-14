using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace ElectricCenter.Server.Auth
{
    /// <summary>
    /// The refresh token lives only in this cookie: HttpOnly (no JS access), Secure,
    /// SameSite=Strict and scoped to /api/auth so it is never sent to any other endpoint.
    /// </summary>
    public static class RefreshTokenCookie
    {
        public const string Name = "ec_refresh";
        public const string Path = "/api/auth";

        public static string? Read(HttpRequest request) => request.Cookies[Name];

        public static void Write(HttpResponse response, IssuedRefreshToken token) =>
            response.Cookies.Append(Name, token.Value, BuildOptions(new DateTimeOffset(token.ExpiresAtUtc, TimeSpan.Zero)));

        public static void Clear(HttpResponse response) => response.Cookies.Delete(Name, BuildOptions(expires: null));

        private static CookieOptions BuildOptions(DateTimeOffset? expires) => new()
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Path = Path,
            Expires = expires,
            IsEssential = true,
        };
    }

    /// <summary>
    /// CSRF guard for the cookie-authenticated auth endpoints. A cross-site HTML form
    /// can't set custom headers, and a cross-site fetch that sets one needs a CORS
    /// preflight this API never approves, so requiring the header blocks forged requests.
    /// </summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    public sealed class RequireSpaHeaderAttribute : ActionFilterAttribute
    {
        public const string HeaderName = "X-Requested-With";

        public override void OnActionExecuting(ActionExecutingContext context)
        {
            if (string.IsNullOrWhiteSpace(context.HttpContext.Request.Headers[HeaderName]))
            {
                context.Result = new BadRequestObjectResult(new { message = $"Missing {HeaderName} header." });
            }
        }
    }

    public static class ClaimsPrincipalExtensions
    {
        public static Guid? GetUserId(this ClaimsPrincipal principal) =>
            Guid.TryParse(principal.FindFirstValue(AuthClaims.Subject), out var id) ? id : null;
    }

    public static class ServiceResultExtensions
    {
        /// <summary>Maps a failed <see cref="ServiceResult{T}"/> to an HTTP response with a { message } body.</summary>
        public static IActionResult ToErrorResult<T>(this ServiceResult<T> result) => result.Error switch
        {
            ServiceError.Validation => new BadRequestObjectResult(new { message = result.Message }),
            ServiceError.Conflict => new ConflictObjectResult(new { message = result.Message }),
            ServiceError.InvalidCredentials or ServiceError.Unauthorized => new UnauthorizedObjectResult(new { message = result.Message }),
            ServiceError.Forbidden => new ObjectResult(new { message = result.Message }) { StatusCode = StatusCodes.Status403Forbidden },
            ServiceError.NotFound => new NotFoundObjectResult(new { message = result.Message }),
            ServiceError.TooManyRequests => new ObjectResult(new { message = result.Message }) { StatusCode = StatusCodes.Status429TooManyRequests },
            ServiceError.Unavailable => new ObjectResult(new { message = result.Message }) { StatusCode = StatusCodes.Status503ServiceUnavailable },
            _ => throw new InvalidOperationException("ToErrorResult called on a successful result."),
        };
    }
}
