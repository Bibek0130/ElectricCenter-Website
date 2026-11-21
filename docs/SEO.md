# SEO and articles

This is how the site tells search engines (and WhatsApp, Facebook and the like) what each page is, and how admins publish articles that can rank.

## What's in place

| What | Where |
|---|---|
| A **title, description and "official address" (canonical link)** for every page, written into the page's HTML so crawlers don't have to run JavaScript | server (`ElectricCenter.Server/Seo`) |
| **Link previews** (Open Graph and X/Twitter tags): a title, description and picture when someone shares a page on WhatsApp or Facebook | same |
| **Structured data** (JSON-LD): the shop as a local business (address, phone, opening hours, map position), the FAQ, each article (author, dates), breadcrumbs | same |
| **`/robots.txt`** and **`/sitemap.xml`** (pages, published articles, electrician profiles) | same |
| **Real 404s** for addresses that aren't pages (they used to show the home page, which search engines treat as a duplicate) | same |
| **`/home` and `/index.html` redirect (301) to `/`**, so the home page has one address | same |
| **`noindex`** on login, account, checkout, settings and admin pages | same, plus `src/seo/siteSeo.js` |
| **Articles**: a list at `/articles`, a page per article at `/articles/{slug}`, and an admin editor | `src/features/articles`, `ElectricCenter.Server/Articles` |
| The **round brand logo** in the header, footer, browser tab, home-screen icon, structured data and the 1200×630 **share image** | `electriccenter.client/public` |

## How a page gets its SEO

The site is a single-page app: the browser downloads one HTML file and JavaScript draws the page. Crawlers and link-preview bots mostly don't run that JavaScript, so on their own they'd see an empty page with one title for everything. So the **server** fills in each page's tags before sending it:

1. All the site-wide facts live in one file, [`src/seo/siteSeo.js`](../electriccenter.client/src/seo/siteSeo.js): the business details, the page titles and descriptions, the navigation, the FAQ.
2. `npm run build` copies them to `seo-data.json` next to `index.html` (a small plugin in `vite.config.js`).
3. When a page is requested, the server reads that file, works out which page it is (an article and an electrician profile are looked up in the database), and writes the tags into `index.html` where the `<!--seo-head-->` markers are. It also puts a `<noscript>` copy of the page's text and links inside `#root`: crawlers that don't run JavaScript read it, and React replaces it the moment the app starts, so visitors never see it.
4. In the browser, `useSeo` keeps the tab title, description and canonical link correct as people move between pages. It starts from what the server wrote, so nothing flickers.

Because the browser and the server read the **same** data, they can't disagree about a page's title.

## Changing the logo

Everything comes from one picture. These files in `electriccenter.client/public` are all made from it:

| File | Used for |
|---|---|
| `logo.png` | the header and footer (`SITE.logo` in `siteSeo.js` sets the path), and the logo in the structured data. Cropped to the ring, with transparent corners |
| `favicon-32.png`, `favicon-48.png`, `favicon-192.png` | the browser tab and Android (Google wants multiples of 48 px) |
| `apple-touch-icon.png` | the iPhone home-screen icon (white square; iOS rounds the corners itself) |
| `og-default.jpg` | the 1200×630 picture shown when a page without its own picture is shared |

To change the logo, replace `logo.png` and rebuild the other four from it. A browser keeps tab icons for a long time, so you may need a hard refresh to see a new one, and Google updates the icon beside your result the next time it visits.

The lettering around the ring can't be read below about 100 px, so the name is also written beside the logo in the header and footer. For sharper results at large sizes, replace `logo.png` with a bigger picture or an SVG; the current one is about 250 px across.

## Adding or changing a page

1. Add the `<Route>` in `src/app/App.jsx`.
2. Add an entry to `PAGES` in `src/seo/siteSeo.js`: `title` (the site name is added for you), `description` (70–160 characters), `heading` (the page's `<h1>`). Add `robots: ROBOTS_NOINDEX` for a page that shouldn't appear in search (accounts, checkout, admin).
3. Run `npm test`. A test fails if a route has no entry (the server would answer it with a 404) or an entry has no route (it would put a dead page in the sitemap), and others check title and description lengths and that no two pages share a title.
4. If you added or renamed a *property* in `siteSeo.js`, update the matching records in `ElectricCenter.Server/Seo/SeoSiteData.cs`, then regenerate `ElectricCenter.Server.Tests/Fixtures/wwwroot/seo-data.json` from `toServerData()`. A test tells you when the two have drifted apart.

The shop's address, phone number and hours are in `BUSINESS` in the same file. The footer, the map section and the FAQ answers repeat them as text, so change those too. Search engines compare structured data with what's on the page.

## Writing articles (for admins)

Sign in as an admin, open **Articles**, and press **New article**. Nothing goes live until you press **Publish**; **Save draft** keeps it private.

- **Title**: what searchers see first. Keep it under 60 characters and say what the article is about (*"How to choose the right MCB for your home"*, not *"Tips"*).
- **Web address**: made from the title as you type. Once an article is live, changing it breaks every link to it, so the editor warns you.
- **Summary**: shown under the title in Google (70–160 characters works best) and on the article card.
- **Cover image**: shown on the card and when the link is shared. Add a short description of the picture (it's read aloud to blind visitors and used by image search).
- **Article text** is written in Markdown. The toolbar inserts the formatting for you, and **Preview** shows exactly what readers will see. Import a `.md` file if you wrote it elsewhere.

  | You type | You get |
  |---|---|
  | `## Heading` | a section heading (use these; the title is already the top-level heading) |
  | `### Smaller heading` | a sub-heading |
  | `**bold**`, `*italic*` | **bold**, *italic* |
  | `- item` or `1. item` | a bulleted or numbered list |
  | `[our products](/products)` | a link (a path on this site, or a full `https://…` address) |
  | `![describe the picture](https://…)` | a picture (the **Image** button uploads one for you) |
  | `> a quote` | a quote |

What helps an article rank: one clear topic; 300 words or more; short sections with `##` headings; links to your [products](/products) and [electricians](/electricians) where they fit; a cover image. The panel on the right of the editor shows how it will look in search results and ticks these off as you go.

Things worth knowing:
- Raw HTML in the text is shown as text, not run. That's deliberate, for safety.
- If two admins edit the same article, the second save is refused with a message instead of overwriting the first.
- Deleting is reversible: **Show deleted articles**, then **Restore**. A deleted article's web address stays reserved.
- A published article appears in `sitemap.xml` straight away. Search engines pick it up the next time they visit; **Request indexing** in Google Search Console (below) speeds up the first ones.

## After you deploy

1. Set **`Site__BaseUrl`** (see [DEPLOY.md](DEPLOY.md), step 6) to `https://panchamukhielectriccenter.com.np`.
2. **[Google Search Console](https://search.google.com/search-console)**: add the site, verify it (a DNS record is the most reliable way), then under **Sitemaps** submit `https://panchamukhielectriccenter.com.np/sitemap.xml`. Use **URL Inspection → Request indexing** on the home page and your first articles.
3. **[Google Business Profile](https://business.google.com)**: claim the shop. For a local shop this does more for "electrical shop Kathmandu" searches than anything on the website. Use the *exact* name, address and phone that the website shows.
4. Check the markup with Google's [Rich Results Test](https://search.google.com/test/rich-results) on the home page and an article. Paste a link into a [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) to see the share preview (and press *Scrape again* after changing an article's picture).
5. To see a page as a crawler does, request it without JavaScript: `curl -s https://panchamukhielectriccenter.com.np/ | head -60`. The right title, canonical link and JSON-LD should be right there.

## Honest limits

- **FAQ rich results**: the FAQ markup is correct, but since 2023 Google shows expandable FAQ answers in results only for well-known government and health sites. Don't expect it. It does no harm, and other engines and AI assistants read it.
- **Article markup** (author, dates, image) helps search engines understand the page. It isn't a ranking boost on its own; good content and links are.
- **Prices**: there is no product markup, because product pages don't have their own addresses yet. When they do, leave out the price from the markup while "Show prices" is off (Settings).
- **Speed** counts toward ranking and hasn't been touched yet: the home page's big slideshow image is loaded by JavaScript, the fonts block the first paint, the Google Map loads on the home page, and the whole app is one 148 KB (gzipped) script. These are the next things to fix.
- **Not done yet**: a page per product (`/products/:id`) so products can rank and be shared; article categories or tags; scheduled publishing; paging in the article list (it shows the newest 200); marking Nepali-language articles with `lang="ne"`.
