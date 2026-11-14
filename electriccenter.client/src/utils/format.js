/** Formats a number as Nepali Rupees, e.g. `formatCurrency(2850)` -> "Rs 2,850". */
export function formatCurrency(amount) {
    return `Rs ${Math.round(amount).toLocaleString('en-IN')}`;
}

/** Applies a product's discount percentage to its price. */
export function discountedPrice(product) {
    return product.discountPercent > 0 ? product.price * (1 - product.discountPercent / 100) : product.price;
}

/** Strips everything but leading `+` and digits, for building wa.me links. */
export function toWhatsAppNumber(phone) {
    return phone.replace(/(?!^\+)\D/g, '');
}
