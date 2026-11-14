using ElectricCenter.Server.Auth;
using ElectricCenter.Server.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ElectricCenter.Server.Controllers
{
    /// <summary>
    /// JWT auth. The short-lived access token is returned in the response body (the SPA keeps it
    /// in memory); the refresh token is set as an HttpOnly cookie and rotated on every refresh.
    /// </summary>
    [ApiController]
    [Route("api/auth")]
    [RequireSpaHeader]
    public class AuthController(IAuthService authService, IEmailVerificationService emailVerification) : ControllerBase
    {
        /// <summary>Starts sign-up: emails a 6-digit code. The account is created by <see cref="VerifyEmail"/>.</summary>
        [HttpPost("register")]
        [AllowAnonymous]
        [EnableRateLimiting(RateLimitPolicies.AuthStrict)]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken ct)
        {
            var result = await emailVerification.StartRegistrationAsync(request.FullName, request.Email, request.Phone, request.Password, ct);
            if (!result.Succeeded) return result.ToErrorResult();

            return Accepted(new VerificationRequiredResponse(
                VerificationRequiredResponse.VerificationSent,
                $"We've emailed a {EmailVerificationService.CodeLength}-digit code to {result.Value!.Email}.",
                VerificationDto.From(result.Value)));
        }

        [HttpPost("login")]
        [AllowAnonymous]
        [EnableRateLimiting(RateLimitPolicies.AuthStrict)]
        public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken ct)
        {
            var result = await authService.LoginAsync(request.Email, request.Password, ct);
            if (!result.Succeeded) return result.ToErrorResult();

            if (result.Value!.Verification is { } challenge)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new VerificationRequiredResponse(
                    VerificationRequiredResponse.EmailNotVerified,
                    $"Please verify your email first. We've sent a {EmailVerificationService.CodeLength}-digit code to {challenge.Email}.",
                    VerificationDto.From(challenge)));
            }
            return SessionResponse(result.Value.Session!);
        }

        /// <summary>Checks the emailed code. On success the email is verified and the user is signed in.</summary>
        [HttpPost("verify-email")]
        [AllowAnonymous]
        [EnableRateLimiting(RateLimitPolicies.AuthStrict)]
        public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailRequest request, CancellationToken ct)
        {
            var result = await emailVerification.VerifyAsync(request.VerificationId, request.Code, ct);
            if (!result.Succeeded) return result.ToErrorResult();
            return SessionResponse(await authService.CreateSessionAsync(result.Value!, ct));
        }

        [HttpPost("resend-verification")]
        [AllowAnonymous]
        [EnableRateLimiting(RateLimitPolicies.AuthStrict)]
        public async Task<IActionResult> ResendVerification([FromBody] ResendVerificationRequest request, CancellationToken ct)
        {
            var result = await emailVerification.ResendAsync(request.VerificationId, ct);
            return result.Succeeded ? Ok(VerificationDto.From(result.Value!)) : result.ToErrorResult();
        }

        [HttpPost("refresh")]
        [AllowAnonymous]
        [EnableRateLimiting(RateLimitPolicies.AuthRefresh)]
        public async Task<IActionResult> Refresh(CancellationToken ct)
        {
            var result = await authService.RefreshAsync(RefreshTokenCookie.Read(Request), ct);
            if (!result.Succeeded) RefreshTokenCookie.Clear(Response);
            return result.Succeeded ? SessionResponse(result.Value!) : result.ToErrorResult();
        }

        /// <summary>Anonymous on purpose: logging out must work even after the access token has expired.</summary>
        [HttpPost("logout")]
        [AllowAnonymous]
        [EnableRateLimiting(RateLimitPolicies.AuthRefresh)]
        public async Task<IActionResult> Logout(CancellationToken ct)
        {
            await authService.LogoutAsync(RefreshTokenCookie.Read(Request), ct);
            RefreshTokenCookie.Clear(Response);
            return NoContent();
        }

        [HttpPost("logout-all")]
        [Authorize]
        public async Task<IActionResult> LogoutAll(CancellationToken ct)
        {
            if (User.GetUserId() is not { } userId) return Unauthorized();
            await authService.LogoutAllAsync(userId, ct);
            RefreshTokenCookie.Clear(Response);
            return NoContent();
        }

        [HttpGet("me")]
        [Authorize]
        public async Task<IActionResult> Me(CancellationToken ct)
        {
            var user = User.GetUserId() is { } userId ? await authService.GetUserAsync(userId, ct) : null;
            return user is null ? Unauthorized() : Ok(UserDto.From(user));
        }

        [HttpPost("change-password")]
        [Authorize]
        [EnableRateLimiting(RateLimitPolicies.AuthStrict)]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request, CancellationToken ct)
        {
            if (User.GetUserId() is not { } userId) return Unauthorized();
            var result = await authService.ChangePasswordAsync(userId, request.CurrentPassword, request.NewPassword, ct);
            return result.Succeeded ? SessionResponse(result.Value!) : result.ToErrorResult();
        }

        private OkObjectResult SessionResponse(AuthSession session)
        {
            if (session.RefreshToken is not null) RefreshTokenCookie.Write(Response, session.RefreshToken);
            return Ok(new AuthResponse(session.AccessToken.Token, session.AccessToken.ExpiresAtUtc, UserDto.From(session.User)));
        }
    }
}
