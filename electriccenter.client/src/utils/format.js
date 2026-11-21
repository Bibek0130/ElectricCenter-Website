/** Formats a number as Nepali Rupees, e.g. `formatCurrency(2850)` -> "Rs 2,850". */
export function formatCurrency(amount) {
    return `Rs ${Math.round(amount).toLocaleString('en-IN')}`;
}

/**
 * Applies a product's discount percentage to its price. Returns null when the product has no price
 * (the server withholds it while the "Show price" setting is off).
 */
export function discountedPrice(product) {
    if (typeof product.price !== 'number') return null;
    return product.discountPercent > 0 ? product.price * (1 - product.discountPercent / 100) : product.price;
}

/**
 * Whether a product's price may be shown. Both must hold: the site-wide "Show price" setting is on, AND the
 * product actually came back with a price. Admins receive prices even while the setting is off (the editor
 * needs them), so the setting alone has to be able to hide them; the second check covers the opposite case.
 * @param {{ price?: number|null }} product
 * @param {boolean} showPrice The site-wide setting (strictly `true` to show).
 */
export function isPriceVisible(product, showPrice) {
    return showPrice === true && typeof product.price === 'number';
}

/** "2026-11-21T10:00:00Z" -> "21 November 2026" (in the visitor's time zone); "" for anything that isn't a date. */
export function formatDate(iso) {
    if (!iso) return ''; // new Date(null) is 1 January 1970, which is how a draft ended up "published in 1970"
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Strips everything but leading `+` and digits, for building wa.me links. */
export function toWhatsAppNumber(phone) {
    return phone.replace(/(?!^\+)\D/g, '');
}
