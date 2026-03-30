using ElectricCenter.Server.Services.Email.Interface;
using Microsoft.AspNetCore.Mvc;

namespace ElectricCenter.Server.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class WeatherForecastController : ControllerBase
    {

        private readonly IEmailSender _emailSender;
        private static readonly string[] Summaries =
        [
            "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
        ];

        public WeatherForecastController(IEmailSender emailSender)
        {
            _emailSender = emailSender;
        }

        //method for testing email sending
        public async Task<IActionResult> SendTestEmail() 
        {
            var receiver = "sua03@scolore.com";
            var subject = "Test Email";
            var message = "This is a test email sent from the WeatherForecastController.";

            await _emailSender.SendEmailAsync(receiver, subject, message);

            return Ok("Test email sent successfully.");


        }
        [HttpGet(Name = "GetWeatherForecast")]
        public IEnumerable<WeatherForecast> Get()
        {
            return Enumerable.Range(1, 5).Select(index => new WeatherForecast
            {
                Date = DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
                TemperatureC = Random.Shared.Next(-20, 55),
                Summary = Summaries[Random.Shared.Next(Summaries.Length)]
            })
            .ToArray();
        }
    }
}
