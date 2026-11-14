using ElectricCenter.Server.Auth;
using ElectricCenter.Server.Contracts;
using ElectricCenter.Server.Products;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ElectricCenter.Server.Controllers
{
    /// <summary>
    /// Product catalog. Anyone can browse; only admins can create, edit, delete or restore.
    /// Delete is always a soft delete: the row is flagged and hidden, never removed.
    /// </summary>
    [ApiController]
    [Route("api/products")]
    public class ProductsController(IProductService products) : ControllerBase
    {
        private bool IsAdmin => User.IsInRole(Roles.Admin);

        /// <param name="includeDeleted">Admins only: also return soft-deleted products (ignored for everyone else).</param>
        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> List(
            [FromQuery] string? search,
            [FromQuery] int? categoryId,
            [FromQuery] decimal? minPrice,
            [FromQuery] decimal? maxPrice,
            [FromQuery] string? sort,
            [FromQuery] bool includeDeleted,
            CancellationToken ct)
        {
            var items = await products.ListAsync(new ProductQuery(search, categoryId, minPrice, maxPrice, sort, includeDeleted && IsAdmin), ct);
            return Ok(new { items = items.Select(ProductDto.From), total = items.Count });
        }

        [HttpGet("{id:int}")]
        [AllowAnonymous]
        public async Task<IActionResult> Get(int id, CancellationToken ct)
        {
            var product = await products.GetAsync(id, includeDeleted: IsAdmin, ct);
            return product is null ? NotFound(new { message = "Product not found." }) : Ok(ProductDto.From(product));
        }

        [HttpPost]
        [Authorize(Policy = Policies.AdminOnly)]
        public async Task<IActionResult> Create([FromBody] SaveProductRequest request, CancellationToken ct)
        {
            if (User.GetUserId() is not { } userId) return Unauthorized();
            var result = await products.CreateAsync(request.ToInput(), userId, ct);
            return result.Succeeded
                ? CreatedAtAction(nameof(Get), new { id = result.Value!.Id }, ProductDto.From(result.Value))
                : result.ToErrorResult();
        }

        [HttpPut("{id:int}")]
        [Authorize(Policy = Policies.AdminOnly)]
        public async Task<IActionResult> Update(int id, [FromBody] SaveProductRequest request, CancellationToken ct)
        {
            if (User.GetUserId() is not { } userId) return Unauthorized();
            var result = await products.UpdateAsync(id, request.ToInput(), request.Version, userId, ct);
            return result.Succeeded ? Ok(ProductDto.From(result.Value!)) : result.ToErrorResult();
        }

        /// <summary>Soft delete. Returns the product (now flagged deleted) so the admin UI can offer "Undo".</summary>
        [HttpDelete("{id:int}")]
        [Authorize(Policy = Policies.AdminOnly)]
        public async Task<IActionResult> Delete(int id, CancellationToken ct)
        {
            if (User.GetUserId() is not { } userId) return Unauthorized();
            var result = await products.DeleteAsync(id, userId, ct);
            return result.Succeeded ? Ok(ProductDto.From(result.Value!)) : result.ToErrorResult();
        }

        [HttpPost("{id:int}/restore")]
        [Authorize(Policy = Policies.AdminOnly)]
        public async Task<IActionResult> Restore(int id, CancellationToken ct)
        {
            if (User.GetUserId() is not { } userId) return Unauthorized();
            var result = await products.RestoreAsync(id, userId, ct);
            return result.Succeeded ? Ok(ProductDto.From(result.Value!)) : result.ToErrorResult();
        }
    }

    [ApiController]
    [Route("api/categories")]
    public class CategoriesController(IProductService products) : ControllerBase
    {
        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> List(CancellationToken ct) =>
            Ok((await products.GetCategoriesAsync(ct)).Select(CategoryDto.From));
    }
}
