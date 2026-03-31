using Microsoft.AspNetCore.Mvc;
using ElectricCenter.Server.Services.Email.Interface;
using Microsoft.AspNetCore.Http.HttpResults;

namespace ElectricCenter.Server.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class EmailSenderController: ControllerBase
    {
        private readonly IEmailSender _emailSender;

        public EmailSenderController(IEmailSender emailSender)
        {
            _emailSender = emailSender;
        }

        //method for testing email sending
        [HttpPost]
        public async Task<IActionResult> SendTestEmail()
        {
            var receiver = "buzcx58471@minitts.net";
            var subject = "Test Email";
            var message = "This is a test email sent from the WeatherForecastController.";

            await _emailSender.SendEmailAsync(receiver, subject, message);

            return Ok("Email send sucessfully");
        }
    }
}
