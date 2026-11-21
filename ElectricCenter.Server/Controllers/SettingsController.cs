using ElectricCenter.Server.Auth;
using ElectricCenter.Server.Contracts;
using ElectricCenter.Server.Settings;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ElectricCenter.Server.Controllers
{
    /// <summary>
    /// Site-wide switches. Anyone can read them (the storefront needs to know, e.g., whether to show prices);
    /// only admins can change them.
    /// </summary>
    [ApiController]
    [Route("api/settings")]
    public class SettingsController(ISiteSettingsService settings) : ControllerBase
    {
        // Never cached: a stale answer would keep prices visible (or hidden) after an admin flips the switch.
        [HttpGet]
        [AllowAnonymous]
        [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
        public async Task<IActionResult> Get(CancellationToken ct) =>
            Ok(SiteSettingsDto.From(await settings.GetAsync(ct)));

        [HttpPut]
        [Authorize(Policy = Policies.AdminOnly)]
        public async Task<IActionResult> Update([FromBody] UpdateSiteSettingsRequest request, CancellationToken ct)
        {
            if (User.GetUserId() is not { } userId) return Unauthorized();
            var result = await settings.UpdateAsync(request.ToInput(), userId, ct);
            return result.Succeeded ? Ok(SiteSettingsDto.From(result.Value!)) : result.ToErrorResult();
        }
    }
}
