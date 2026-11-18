using ElectricCenter.Server.Auth;
using ElectricCenter.Server.Uploads;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ElectricCenter.Server.Controllers
{
    /// <summary>
    /// Image uploads for the admin forms (product photos, electrician photos, past-work photos).
    /// The file goes to Cloudinary; only the returned URL is saved with the product or electrician.
    /// </summary>
    [ApiController]
    [Route("api/uploads")]
    [Authorize(Policy = Policies.AdminOnly)]
    public class UploadsController(IImageUploadService images) : ControllerBase
    {
        /// <summary>multipart/form-data with a single "file" field (JPG, PNG or WebP, up to 5 MB).</summary>
        [HttpPost("image")]
        [EnableRateLimiting(RateLimitPolicies.Upload)]
        [RequestSizeLimit(ImageRules.MaxBytes + 64 * 1024)] // the file plus multipart framing
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadImage(IFormFile? file, CancellationToken ct)
        {
            if (file is null) return BadRequest(new { message = "Choose an image to upload." });

            await using var stream = file.OpenReadStream();
            var result = await images.UploadAsync(stream, file.Length, file.FileName, ct);
            if (!result.Succeeded) return result.ToErrorResult();

            var image = result.Value!;
            return Ok(new { url = image.Url, width = image.Width, height = image.Height });
        }
    }
}
