using System.Net.Http.Headers;
using System.Net.Http.Json;
using ElectricCenter.Server.Electricians;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ElectricCenter.Server.Controllers
{
    public record WhatsAppBookingDetails(string? CustomerPhone, string? Location, string? Problem);

    /// <summary>
    /// Identifies the electrician by id only. The recipient number and name are looked up
    /// server-side, so a caller can't use the business account to message arbitrary numbers.
    /// </summary>
    public record WhatsAppNotifyRequest(int ElectricianId, WhatsAppBookingDetails Booking);

    /// <summary>
    /// Sends a WhatsApp Business Cloud API template message to an electrician when a
    /// booking comes in. Requires WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, and
    /// optionally WHATSAPP_TEMPLATE_NAME to be set as environment variables (see
    /// .env.example at the repo root). If they aren't set, this returns 503 so the
    /// client falls back to the click-to-chat strategy instead of failing the booking.
    /// Requires a signed-in user (bookings require login), and only ever messages the
    /// WhatsApp number stored for the electrician being booked.
    /// </summary>
    [ApiController]
    [Route("api/whatsapp")]
    [Authorize]
    public class WhatsAppController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IElectricianService _electricians;

        public WhatsAppController(IConfiguration configuration, IHttpClientFactory httpClientFactory, IElectricianService electricians)
        {
            _configuration = configuration;
            _httpClientFactory = httpClientFactory;
            _electricians = electricians;
        }

        [HttpPost("notify")]
        public async Task<IActionResult> Notify([FromBody] WhatsAppNotifyRequest request, CancellationToken ct)
        {
            var electrician = await _electricians.GetAsync(request.ElectricianId, includeDeleted: false, ct);
            if (electrician is null) return NotFound(new { message = "Electrician not found." });

            var booking = request.Booking;
            if (string.IsNullOrWhiteSpace(booking?.CustomerPhone) || string.IsNullOrWhiteSpace(booking.Location) || string.IsNullOrWhiteSpace(booking.Problem))
                return BadRequest(new { message = "Customer phone, location and problem are required." });

            var token = _configuration["WHATSAPP_TOKEN"];
            var phoneNumberId = _configuration["WHATSAPP_PHONE_NUMBER_ID"];
            var templateName = _configuration["WHATSAPP_TEMPLATE_NAME"] ?? "booking_notification";

            if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(phoneNumberId))
            {
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new
                {
                    message = "WhatsApp Cloud API is not configured (missing WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID).",
                });
            }

            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

            var payload = new
            {
                messaging_product = "whatsapp",
                to = electrician.WhatsAppNumber,
                type = "template",
                template = new
                {
                    name = templateName,
                    language = new { code = "en_US" },
                    components = new object[]
                    {
                        new
                        {
                            type = "body",
                            parameters = new object[]
                            {
                                new { type = "text", text = electrician.Name },
                                new { type = "text", text = Truncate(booking.CustomerPhone, 30) },
                                new { type = "text", text = Truncate(booking.Location, 200) },
                                new { type = "text", text = Truncate(booking.Problem, 500) },
                            },
                        },
                    },
                },
            };

            var response = await client.PostAsJsonAsync(
                $"https://graph.facebook.com/v19.0/{phoneNumberId}/messages",
                payload);

            if (!response.IsSuccessStatusCode)
            {
                var details = await response.Content.ReadAsStringAsync();
                return StatusCode((int)response.StatusCode, new { message = "WhatsApp Cloud API request failed.", details });
            }

            return Ok(new { status = "sent" });
        }

        private static string Truncate(string value, int max) => value.Length <= max ? value.Trim() : value[..max].Trim();
    }
}
