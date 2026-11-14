using ElectricCenter.Server.Auth;
using ElectricCenter.Server.Services.Email.Interface;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ElectricCenter.Server.Controllers
{
    /// <summary>SMTP smoke test. Admin-only, and it only ever emails the calling admin.</summary>
    [ApiController]
    [Route("api/email/test")]
    [Authorize(Policy = Policies.AdminOnly)]
    public class EmailSenderController(IEmailSender emailSender) : ControllerBase
    {
        [HttpPost]
        public async Task<IActionResult> SendTestEmail()
        {
            var receiver = User.FindFirst(AuthClaims.Email)?.Value;
            if (string.IsNullOrWhiteSpace(receiver)) return BadRequest(new { message = "Your account has no email address." });

            await emailSender.SendEmailAsync(receiver, "Electric Center test email", "This is a test email from the Electric Center server. SMTP is working.");
            return Ok(new { message = $"Test email sent to {receiver}." });
        }
    }
}
