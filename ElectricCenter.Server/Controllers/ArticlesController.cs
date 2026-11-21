using ElectricCenter.Server.Articles;
using ElectricCenter.Server.Auth;
using ElectricCenter.Server.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ElectricCenter.Server.Controllers
{
    /// <summary>
    /// The public side of the articles: published ones only. A draft or deleted article is simply "not found" here,
    /// even for an admin; admins manage drafts through <see cref="AdminArticlesController"/>.
    /// </summary>
    [ApiController]
    [Route("api/articles")]
    [AllowAnonymous]
    public class ArticlesController(IArticleService articles) : ControllerBase
    {
        [HttpGet]
        public async Task<IActionResult> List(CancellationToken ct)
        {
            var items = await articles.ListPublishedAsync(ct);
            return Ok(new { items = items.Select(ArticleSummaryDto.From), total = items.Count });
        }

        [HttpGet("{slug}")]
        public async Task<IActionResult> Get(string slug, CancellationToken ct)
        {
            var article = await articles.GetPublishedBySlugAsync(slug.ToLowerInvariant(), ct);
            return article is null ? NotFound(new { message = "Article not found." }) : Ok(ArticleDto.From(article));
        }
    }

    /// <summary>
    /// Writing and managing articles. Admins only. Delete is always a soft delete: the row is flagged and hidden, never removed.
    /// </summary>
    [ApiController]
    [Route("api/admin/articles")]
    [Authorize(Policy = Policies.AdminOnly)]
    public class AdminArticlesController(IArticleService articles) : ControllerBase
    {
        /// <param name="includeDeleted">Also return soft-deleted articles.</param>
        [HttpGet]
        public async Task<IActionResult> List([FromQuery] bool includeDeleted, CancellationToken ct)
        {
            var items = await articles.ListForAdminAsync(includeDeleted, ct);
            return Ok(new { items = items.Select(AdminArticleSummaryDto.From), total = items.Count });
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> Get(int id, CancellationToken ct)
        {
            var article = await articles.GetForAdminAsync(id, ct);
            return article is null ? NotFound(new { message = "Article not found." }) : Ok(AdminArticleDto.From(article));
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] SaveArticleRequest request, CancellationToken ct)
        {
            if (User.GetUserId() is not { } userId) return Unauthorized();
            var result = await articles.CreateAsync(request.ToInput(), userId, ct);
            return result.Succeeded
                ? CreatedAtAction(nameof(Get), new { id = result.Value!.Id }, AdminArticleDto.From(result.Value))
                : result.ToErrorResult();
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] SaveArticleRequest request, CancellationToken ct)
        {
            if (User.GetUserId() is not { } userId) return Unauthorized();
            var result = await articles.UpdateAsync(id, request.ToInput(), request.Version, userId, ct);
            return result.Succeeded ? Ok(AdminArticleDto.From(result.Value!)) : result.ToErrorResult();
        }

        /// <summary>Soft delete. Returns the article (now flagged deleted) so the admin UI can offer "Undo".</summary>
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id, CancellationToken ct)
        {
            if (User.GetUserId() is not { } userId) return Unauthorized();
            var result = await articles.DeleteAsync(id, userId, ct);
            return result.Succeeded ? Ok(AdminArticleDto.From(result.Value!)) : result.ToErrorResult();
        }

        [HttpPost("{id:int}/restore")]
        public async Task<IActionResult> Restore(int id, CancellationToken ct)
        {
            if (User.GetUserId() is not { } userId) return Unauthorized();
            var result = await articles.RestoreAsync(id, userId, ct);
            return result.Succeeded ? Ok(AdminArticleDto.From(result.Value!)) : result.ToErrorResult();
        }

        /// <summary>
        /// Renders Markdown exactly as the public page will, so the editor's Preview tab can't disagree with what
        /// readers get (and the browser doesn't need its own Markdown engine).
        /// </summary>
        [HttpPost("preview")]
        public IActionResult Preview([FromBody] PreviewArticleRequest request)
        {
            var markdown = request.Markdown ?? string.Empty;
            if (markdown.Length > ArticleRules.BodyMaxLength)
                return BadRequest(new { message = $"The article text must be at most {ArticleRules.BodyMaxLength:N0} characters." });

            return Ok(new { html = ArticleMarkdown.ToHtml(markdown) });
        }
    }
}
