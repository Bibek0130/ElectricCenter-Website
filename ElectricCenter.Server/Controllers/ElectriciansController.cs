using ElectricCenter.Server.Auth;
using ElectricCenter.Server.Contracts;
using ElectricCenter.Server.Electricians;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ElectricCenter.Server.Controllers
{
    /// <summary>
    /// Electrician directory. Anyone can browse; only admins can create, edit, delete or restore.
    /// Delete is always a soft delete: the row is flagged and hidden, never removed.
    /// </summary>
    [ApiController]
    [Route("api/electricians")]
    public class ElectriciansController(IElectricianService electricians) : ControllerBase
    {
        private bool IsAdmin => User.IsInRole(Roles.Admin);

        /// <param name="sort">price_asc | price_desc | availability | experience (default: recommended).</param>
        /// <param name="includeDeleted">Admins only: also return soft-deleted electricians (ignored for everyone else).</param>
        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> List(
            [FromQuery] string? search,
            [FromQuery] string? specialty,
            [FromQuery] string? sort,
            [FromQuery] bool includeDeleted,
            CancellationToken ct)
        {
            var items = await electricians.ListAsync(new ElectricianQuery(search, specialty, sort, includeDeleted && IsAdmin), ct);
            return Ok(new { items = items.Select(ElectricianDto.From), total = items.Count });
        }

        /// <summary>The fixed list of specialties admins choose from (used for the filter pills and the form).</summary>
        [HttpGet("specialties")]
        [AllowAnonymous]
        public IActionResult Specialties() => Ok(ElectricianRules.Specialties);

        [HttpGet("{id:int}")]
        [AllowAnonymous]
        public async Task<IActionResult> Get(int id, CancellationToken ct)
        {
            var electrician = await electricians.GetAsync(id, includeDeleted: IsAdmin, ct);
            return electrician is null ? NotFound(new { message = "Electrician not found." }) : Ok(ElectricianDto.From(electrician));
        }

        [HttpPost]
        [Authorize(Policy = Policies.AdminOnly)]
        public async Task<IActionResult> Create([FromBody] SaveElectricianRequest request, CancellationToken ct)
        {
            if (User.GetUserId() is not { } userId) return Unauthorized();
            var result = await electricians.CreateAsync(request.ToInput(), userId, ct);
            return result.Succeeded
                ? CreatedAtAction(nameof(Get), new { id = result.Value!.Id }, ElectricianDto.From(result.Value))
                : result.ToErrorResult();
        }

        [HttpPut("{id:int}")]
        [Authorize(Policy = Policies.AdminOnly)]
        public async Task<IActionResult> Update(int id, [FromBody] SaveElectricianRequest request, CancellationToken ct)
        {
            if (User.GetUserId() is not { } userId) return Unauthorized();
            var result = await electricians.UpdateAsync(id, request.ToInput(), request.Version, userId, ct);
            return result.Succeeded ? Ok(ElectricianDto.From(result.Value!)) : result.ToErrorResult();
        }

        /// <summary>Soft delete. Returns the electrician (now flagged deleted) so the admin UI can offer "Undo".</summary>
        [HttpDelete("{id:int}")]
        [Authorize(Policy = Policies.AdminOnly)]
        public async Task<IActionResult> Delete(int id, CancellationToken ct)
        {
            if (User.GetUserId() is not { } userId) return Unauthorized();
            var result = await electricians.DeleteAsync(id, userId, ct);
            return result.Succeeded ? Ok(ElectricianDto.From(result.Value!)) : result.ToErrorResult();
        }

        [HttpPost("{id:int}/restore")]
        [Authorize(Policy = Policies.AdminOnly)]
        public async Task<IActionResult> Restore(int id, CancellationToken ct)
        {
            if (User.GetUserId() is not { } userId) return Unauthorized();
            var result = await electricians.RestoreAsync(id, userId, ct);
            return result.Succeeded ? Ok(ElectricianDto.From(result.Value!)) : result.ToErrorResult();
        }
    }
}
