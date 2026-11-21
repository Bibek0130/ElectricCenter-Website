import { describe, expect, it } from 'vitest';
import {
    bold, bulletList, heading2, heading3, image, italic, link, numberedList, parseMarkdownFile, quote, toggleLinePrefix, wrapSelection,
} from './markdownEditing.js';

/** Builds an edit from text with the selection marked by [ and ] (and a caret as an empty selection marked by |). */
function edit(marked) {
    const caret = marked.indexOf('|');
    if (caret >= 0) return { text: marked.replace('|', ''), start: caret, end: caret };
    const start = marked.indexOf('[');
    const end = marked.indexOf(']') - 1;
    return { text: marked.replace('[', '').replace(']', ''), start, end };
}

/** The inverse: the result with its selection marked. */
const show = ({ text, start, end }) => (start === end ? `${text.slice(0, start)}|${text.slice(start)}` : `${text.slice(0, start)}[${text.slice(start, end)}]${text.slice(end)}`);

describe('inline formatting', () => {
    it('wraps the selection and keeps it selected', () => {
        expect(show(bold(edit('make [this] bold')))).toBe('make **[this]** bold');
        expect(show(italic(edit('make [this] slanted')))).toBe('make *[this]* slanted');
    });

    it('inserts a selected placeholder when nothing is selected', () => {
        expect(show(bold(edit('a |b')))).toBe('a **[bold text]**b');
        expect(show(italic(edit('|')))).toBe('*[italic text]*');
    });

    it('wrapSelection works with any marker', () => {
        expect(show(wrapSelection(edit('[x]'), '~~', '~~', 'p'))).toBe('~~[x]~~');
    });
});

describe('line formatting', () => {
    it('turns the current line into a heading', () => {
        expect(heading2(edit('intro\nWiring| basics\noutro')).text).toBe('intro\n## Wiring basics\noutro');
        expect(heading3(edit('Tip|')).text).toBe('### Tip');
    });

    it('changes the level of a heading that is already there instead of stacking markers', () => {
        expect(heading3(edit('## Wiring|')).text).toBe('### Wiring');
    });

    it('toggles a heading off only when pressed on the same level', () => {
        expect(heading3(edit('### Wiring|')).text).toBe('Wiring');
    });

    it('turns one kind of list into the other instead of stacking markers', () => {
        expect(bulletList(edit('[1. a\n2. b]')).text).toBe('- a\n- b');
        expect(numberedList(edit('[- a\n- b]')).text).toBe('1. a\n2. b');
    });

    it('toggles a heading off when pressed again', () => {
        expect(heading2(edit('## Wiring|')).text).toBe('Wiring');
    });

    it('makes a bulleted list from every selected line, skipping blank ones', () => {
        const result = bulletList(edit('[one\ntwo\n\nthree]'));
        expect(result.text).toBe('- one\n- two\n\n- three');
    });

    it('numbers a list from 1 and toggles it off', () => {
        const numbered = numberedList(edit('[a\nb\nc]'));
        expect(numbered.text).toBe('1. a\n2. b\n3. c');
        expect(numberedList({ text: numbered.text, start: 0, end: numbered.text.length }).text).toBe('a\nb\nc');
    });

    it('does not include the next line when the selection ends right after a line break', () => {
        const text = 'one\ntwo\nthree';
        const result = quote({ text, start: 0, end: 'one\ntwo\n'.length });
        expect(result.text).toBe('> one\n> two\nthree');
    });

    it('only touches the lines the selection reaches', () => {
        const result = bulletList(edit('keep\n[change]\nkeep'));
        expect(result.text).toBe('keep\n- change\nkeep');
        expect(show(result)).toBe('keep\n[- change]\nkeep');
    });

    it('leaves a selection that is entirely blank alone', () => {
        expect(toggleLinePrefix(edit('|'), () => '- ', /^- /).text).toBe('');
    });
});

describe('link', () => {
    it('wraps the selection and selects the address to fill in', () => {
        const result = link(edit('see [our shop] today'));
        expect(result.text).toBe('see [our shop](https://) today');
        expect(result.text.slice(result.start, result.end)).toBe('https://');
    });

    it('uses a placeholder label when nothing is selected', () => {
        expect(link(edit('|')).text).toBe('[link text](https://)');
    });
});

describe('image', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/mcb.jpg';

    it('inserts the picture with a description selected, ready to be replaced', () => {
        const result = image(edit('|'), url);
        expect(result.text).toBe(`![image description](${url})`);
        expect(result.text.slice(result.start, result.end)).toBe('image description');
    });

    it('uses the selected text as the description', () => {
        const result = image(edit('[A 63A MCB]'), url);
        expect(result.text).toBe(`![A 63A MCB](${url})`);
    });

    it('keeps the picture in a paragraph of its own', () => {
        const result = image(edit('before| after'), url);
        expect(result.text).toBe(`before\n\n![image description](${url})\n\n after`);
        expect(result.text.slice(result.start, result.end)).toBe('image description');
    });
});

describe('parseMarkdownFile', () => {
    it('takes a leading "# Title" as the title and drops it from the body', () => {
        expect(parseMarkdownFile('# Choosing an MCB\n\nFirst paragraph.\n\n## Rating\n')).toEqual({
            title: 'Choosing an MCB',
            body: 'First paragraph.\n\n## Rating',
        });
    });

    it('leaves a file without a leading heading as the body', () => {
        expect(parseMarkdownFile('Just text.\n\n## Section')).toEqual({ title: null, body: 'Just text.\n\n## Section' });
        expect(parseMarkdownFile('## Section first\n\ntext').title).toBeNull();
    });

    it('does not mistake a hash tag or a later heading for the title', () => {
        expect(parseMarkdownFile('#hashtag not a heading').title).toBeNull();
        expect(parseMarkdownFile('Intro\n\n# Later heading').title).toBeNull();
    });

    it('copes with Windows line endings and a byte-order mark', () => {
        const withBom = String.fromCharCode(0xfeff) + '# Title\r\n\r\nBody line one.\r\nBody line two.';
        expect(parseMarkdownFile(withBom)).toEqual({ title: 'Title', body: 'Body line one.\nBody line two.' });
    });

    it('copes with an empty file', () => {
        expect(parseMarkdownFile('')).toEqual({ title: null, body: '' });
        expect(parseMarkdownFile(undefined)).toEqual({ title: null, body: '' });
    });
});
