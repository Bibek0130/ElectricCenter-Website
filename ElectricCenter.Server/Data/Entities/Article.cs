namespace ElectricCenter.Server.Data.Entities
{
    /// <summary>
    /// A blog-style article written by an admin. The body is stored as Markdown and rendered to HTML when it's read,
    /// so improving the renderer later fixes every existing article. A draft (<see cref="IsPublished"/> false) is
    /// visible to admins only. Like products, articles are never hard-deleted (see <see cref="ISoftDeletable"/>).
    /// </summary>
    public class Article : ISoftDeletable, IVersioned
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;

        /// <summary>The article's URL (/articles/{Slug}). Unique across all articles, deleted ones included, so a restore can't clash.</summary>
        public string Slug { get; set; } = string.Empty;

        /// <summary>One or two sentences. Used as the meta description search engines show, and on the article cards.</summary>
        public string Summary { get; set; } = string.Empty;

        public string BodyMarkdown { get; set; } = string.Empty;

        /// <summary>Estimated minutes to read, worked out when the article is saved so lists don't have to load the body.</summary>
        public int ReadingMinutes { get; set; } = 1;

        public string? CoverImageUrl { get; set; }

        /// <summary>Describes the cover image for screen readers and image search. Falls back to the title when blank.</summary>
        public string? CoverImageAlt { get; set; }

        /// <summary>The byline. Defaults to the admin who created the article.</summary>
        public string AuthorName { get; set; } = string.Empty;

        public bool IsPublished { get; set; }

        /// <summary>
        /// When the article first went live. Kept if it's later unpublished and republished, so the public date
        /// (and the date search engines have recorded) doesn't jump.
        /// </summary>
        public DateTime? PublishedAtUtc { get; set; }

        public Guid Version { get; set; }
        public DateTime CreatedAtUtc { get; set; }
        public Guid? CreatedByUserId { get; set; }
        public DateTime? UpdatedAtUtc { get; set; }
        public Guid? UpdatedByUserId { get; set; }

        public bool IsDeleted { get; set; }
        public DateTime? DeletedAtUtc { get; set; }
        public Guid? DeletedByUserId { get; set; }
    }
}
