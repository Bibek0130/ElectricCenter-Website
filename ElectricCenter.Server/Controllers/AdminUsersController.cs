using ElectricCenter.Server.Auth;
using ElectricCenter.Server.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ElectricCenter.Server.Controllers
{
    /// <summary>Account management for admins: create electrician/admin accounts, assign roles, deactivate, reset passwords.</summary>
    [ApiController]
    [Route("api/admin/users")]
    [Authorize(Policy = Policies.AdminOnly)]
    public class AdminUsersController(IUserManagementService users, TimeProvider timeProvider) : ControllerBase
    {
        private DateTime UtcNow => timeProvider.GetUtcNow().UtcDateTime;

        [HttpGet]
        public async Task<IActionResult> List(CancellationToken ct)
        {
            var now = UtcNow;
            return Ok((await users.ListAsync(ct)).Select(u => AdminUserDto.From(u, now)));
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateUserRequest request, CancellationToken ct)
        {
            var result = await users.CreateAsync(request.FullName, request.Email, request.Phone, request.Password, request.Roles, ct);
            return result.Succeeded
                ? StatusCode(StatusCodes.Status201Created, AdminUserDto.From(result.Value!, UtcNow))
                : result.ToErrorResult();
        }

        [HttpPut("{id:guid}/roles")]
        public async Task<IActionResult> SetRoles(Guid id, [FromBody] SetRolesRequest request, CancellationToken ct)
        {
            if (User.GetUserId() is not { } actingUserId) return Unauthorized();
            var result = await users.SetRolesAsync(actingUserId, id, request.Roles, ct);
            return result.Succeeded ? Ok(AdminUserDto.From(result.Value!, UtcNow)) : result.ToErrorResult();
        }

        [HttpPut("{id:guid}/active")]
        public async Task<IActionResult> SetActive(Guid id, [FromBody] SetActiveRequest request, CancellationToken ct)
        {
            if (User.GetUserId() is not { } actingUserId) return Unauthorized();
            var result = await users.SetActiveAsync(actingUserId, id, request.IsActive, ct);
            return result.Succeeded ? Ok(AdminUserDto.From(result.Value!, UtcNow)) : result.ToErrorResult();
        }

        [HttpPost("{id:guid}/reset-password")]
        public async Task<IActionResult> ResetPassword(Guid id, [FromBody] ResetPasswordRequest request, CancellationToken ct)
        {
            var result = await users.ResetPasswordAsync(id, request.NewPassword, ct);
            return result.Succeeded ? NoContent() : result.ToErrorResult();
        }
    }
}
