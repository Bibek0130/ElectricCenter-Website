/**
 * The text transforms behind the editor's toolbar. Each takes the current text and selection and returns the new
 * text and selection, so they're plain functions that don't touch the page.
 * @typedef {{ text: string, start: number, end: number }} Edit  `start`..`end` is the selected range.
 */

/** Wraps the selection (or a placeholder when nothing is selected) and leaves the wrapped text selected, ready to be typed over. */
export function wrapSelection({ text, start, end }, before, after, placeholder) {
    const selected = text.slice(start, end) || placeholder;
    return {
        text: text.slice(0, start) + before + selected + after + text.slice(end),
        start: start + before.length,
        end: start + before.length + selected.length,
    };
}

/** The whole lines the selection touches: [firstLineStart, lastLineEnd). */
function lineRange(text, start, end) {
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    // A selection that ends right after a newline doesn't include the next line.
    const probe = end > start && text[end - 1] === '\n' ? end - 1 : end;
    const nextBreak = text.indexOf('\n', probe);
    return [lineStart, nextBreak === -1 ? text.length : nextBreak];
}

/**
 * Adds a prefix to every selected line ("## ", "- ", "> ", "1. ", ...). If every non-empty line already has THIS
 * button's prefix, removes it instead, so the same button toggles.
 * @param {(index: number) => string} prefixFor  The prefix for the n-th line (numbers for ordered lists).
 * @param {RegExp} existing                       Matches the prefix this button adds (decides whether to toggle off).
 * @param {RegExp} [strip]                        What to clear before adding, so "## Title" becomes "### Title" rather
 *                                                than "### ## Title", and a "1." line becomes "-" rather than "- 1.".
 */
export function toggleLinePrefix({ text, start, end }, prefixFor, existing, strip = existing) {
    const [from, to] = lineRange(text, start, end);
    const lines = text.slice(from, to).split('\n');
    const content = lines.filter((line) => line.trim() !== '');
    const allPrefixed = content.length > 0 && content.every((line) => existing.test(line));

    let index = 0;
    const next = lines.map((line) => {
        if (line.trim() === '') return line;
        return allPrefixed ? line.replace(existing, '') : prefixFor(index++) + line.replace(strip, '');
    });

    const replaced = next.join('\n');
    return { text: text.slice(0, from) + replaced + text.slice(to), start: from, end: from + replaced.length };
}

const ANY_HEADING = /^#{2,6} /;
const ANY_LIST_MARKER = /^(?:[-*]|\d+\.) /;

export const bold = (edit) => wrapSelection(edit, '**', '**', 'bold text');
export const italic = (edit) => wrapSelection(edit, '*', '*', 'italic text');
export const heading2 = (edit) => toggleLinePrefix(edit, () => '## ', /^## /, ANY_HEADING);
export const heading3 = (edit) => toggleLinePrefix(edit, () => '### ', /^### /, ANY_HEADING);
export const bulletList = (edit) => toggleLinePrefix(edit, () => '- ', /^[-*] /, ANY_LIST_MARKER);
export const numberedList = (edit) => toggleLinePrefix(edit, (index) => `${index + 1}. `, /^\d+\. /, ANY_LIST_MARKER);
export const quote = (edit) => toggleLinePrefix(edit, () => '> ', /^> /);

/** [text](https://) with the address part selected, so a pasted link replaces it. */
export function link({ text, start, end }) {
    const label = text.slice(start, end) || 'link text';
    const url = 'https://';
    const insertion = `[${label}](${url})`;
    const urlStart = start + label.length + 3; // "[" + label + "]("
    return { text: text.slice(0, start) + insertion + text.slice(end), start: urlStart, end: urlStart + url.length };
}

/** ![description](url) as its own paragraph, with the description selected so it is the next thing typed. */
export function image({ text, start, end }, url) {
    const alt = text.slice(start, end) || 'image description';
    const lead = start > 0 && text[start - 1] !== '\n' ? '\n\n' : '';
    const trail = end < text.length && text[end] !== '\n' ? '\n\n' : '';
    const insertion = `${lead}![${alt}](${url})${trail}`;
    const altStart = start + lead.length + 2; // "![" after the lead
    return { text: text.slice(0, start) + insertion + text.slice(end), start: altStart, end: altStart + alt.length };
}

/**
 * Reads a Markdown file someone wrote elsewhere. If it opens with a "# Title" line, that becomes the article's title
 * and is dropped from the body (the title is shown separately, as the page's heading).
 * @returns {{ title: string | null, body: string }}
 */
export function parseMarkdownFile(content) {
    const text = String(content ?? '');
    // A file saved by Notepad starts with an invisible byte-order mark (code 0xFEFF); drop it.
    const normalized = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).replace(/\r\n?/g, '\n').trim();
    const match = /^# +(.+?) *(?:\n+|$)/.exec(normalized);
    if (!match) return { title: null, body: normalized };
    return { title: match[1].trim(), body: normalized.slice(match[0].length).trim() };
}
