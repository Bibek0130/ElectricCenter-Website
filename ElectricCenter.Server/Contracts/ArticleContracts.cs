using ElectricCenter.Server.Articles;
using ElectricCenter.Server.Data.Entities;

namespace ElectricCenter.Server.Contracts
{
    /// <summary>A card in the public list. No body.</summary>
    public sealed record ArticleSummaryDto(
        int Id,
        string Title,
        string Slug,
        string Summary,
        string? CoverImageUrl,
        string? CoverImageAlt,
        string AuthorName,
        DateTime PublishedAt,
        int ReadingMinutes)
    {
        public static ArticleSummaryDto From(ArticleSummary a) => new(
            a.Id, a.Title, a.Slug, a.Summary, a.CoverImageUrl, a.CoverImageAlt, a.AuthorName,
            a.PublishedAtUtc ?? a.CreatedAtUtc, a.ReadingMinutes);
    }

    /// <summary>A published article as the public sees it. The body is HTML, safe to render as-is (see <see cref="ArticleMarkdown"/>).</summary>
    public sealed record ArticleDto(
        int Id,
        string Title,
        string Slug,
        string Summary,
        string BodyHtml,
        string? CoverImageUrl,
        string? CoverImageAlt,
        string AuthorName,
        DateTime PublishedAt,
        DateTime UpdatedAt,
        int ReadingMinutes)
    {
        public static ArticleDto From(Article a) => new(
            a.Id, a.Title, a.Slug, a.Summary, ArticleMarkdown.ToHtml(a.BodyMarkdown), a.CoverImageUrl, a.CoverImageAlt,
            a.AuthorName, a.PublishedAtUtc ?? a.CreatedAtUtc, a.UpdatedAtUtc ?? a.PublishedAtUtc ?? a.CreatedAtUtc, a.ReadingMinutes);
    }

    /// <summary>A row in the admin list: like the public card, plus the state an admin needs to manage it.</summary>
    public sealed record AdminArticleSummaryDto(
        int Id,
        string Title,
        string Slug,
        string Summary,
        string? CoverImageUrl,
        string? CoverImageAlt,
        string AuthorName,
        bool IsPublished,
        DateTime? PublishedAt,
        DateTime UpdatedAt,
        bool IsDeleted,
        int ReadingMinutes)
    {
        public static AdminArticleSummaryDto From(ArticleSummary a) => new(
            a.Id, a.Title, a.Slug, a.Summary, a.CoverImageUrl, a.CoverImageAlt, a.AuthorName,
            a.IsPublished, a.PublishedAtUtc, a.UpdatedAtUtc ?? a.CreatedAtUtc, a.IsDeleted, a.ReadingMinutes);
    }

    /// <summary>Everything the editor needs, including the Markdown source and the <see cref="Version"/> to send back on save.</summary>
    public sealed record AdminArticleDto(
        int Id,
        string Title,
        string Slug,
        string Summary,
        string BodyMarkdown,
        string? CoverImageUrl,
        string? CoverImageAlt,
        string AuthorName,
        bool IsPublished,
        DateTime? PublishedAt,
        Guid Version,
        DateTime CreatedAt,
        DateTime? UpdatedAt,
        bool IsDeleted,
        DateTime? DeletedAt,
        int ReadingMinutes)
    {
        public static AdminArticleDto From(Article a) => new(
            a.Id, a.Title, a.Slug, a.Summary, a.BodyMarkdown, a.CoverImageUrl, a.CoverImageAlt, a.AuthorName,
            a.IsPublished, a.PublishedAtUtc, a.Version, a.CreatedAtUtc, a.UpdatedAtUtc, a.IsDeleted, a.DeletedAtUtc, a.ReadingMinutes);
    }

    /// <summary>
    /// Body for create and update. A blank <see cref="Slug"/> is generated from the title. A blank <see cref="AuthorName"/>
    /// means the signed-in admin (create) or "keep the current byline" (update). Update must also send the <see cref="Version"/> it last read.
    /// </summary>
    public sealed record SaveArticleRequest(
        string? Title,
        string? Slug,
        string? Summary,
        string? BodyMarkdown,
        string? CoverImageUrl,
        string? CoverImageAlt,
        string? AuthorName,
        bool IsPublished,
        Guid? Version)
    {
        public ArticleInput ToInput() => new(Title, Slug, Summary, BodyMarkdown, CoverImageUrl, CoverImageAlt, AuthorName, IsPublished);
    }

    public sealed record PreviewArticleRequest(string? Markdown);
}
