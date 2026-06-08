import { useState, useEffect, useCallback, useReducer, createContext, useContext } from "react";
import './ProductStyles.css';
import { MOCK_PRODUCTS, MOCK_CATEGORIES } from '../../../data/constants'
// ─────────────────────────────────────────────
// MOCK DATA  (replace fetch calls with real API)
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// API SERVICE  (swap mock data for real calls)
// ─────────────────────────────────────────────
const API_BASE = "https://localhost:7001/api"; // ← change to your backend URL

const api = {
    // Products
    async getProducts(filters = {}) {
        // REAL: const res = await fetch(`${API_BASE}/products?${new URLSearchParams(filters)}`);
        // REAL: return res.json();
        await delay(300);
        let items = [...MOCK_PRODUCTS];
        if (filters.search) {
            const q = filters.search.toLowerCase();
            items = items.filter(p => p.name.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q));
        }
        if (filters.categoryId) items = items.filter(p => p.categoryId === Number(filters.categoryId));
        if (filters.minPrice) items = items.filter(p => discounted(p) >= Number(filters.minPrice));
        if (filters.maxPrice) items = items.filter(p => discounted(p) <= Number(filters.maxPrice));
        if (filters.sort === "price_asc") items.sort((a, b) => discounted(a) - discounted(b));
        else if (filters.sort === "price_desc") items.sort((a, b) => discounted(b) - discounted(a));
        else if (filters.sort === "name") items.sort((a, b) => a.name.localeCompare(b.name));
        return { items, total: items.length };
    },
    async getCategories() {
        // REAL: const res = await fetch(`${API_BASE}/categories`); return res.json();
        await delay(100);
        return MOCK_CATEGORIES;
    },
    async placeOrder(orderData) {
        // REAL: const res = await fetch(`${API_BASE}/orders`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(orderData) });
        // REAL: return res.json();
        await delay(1200);
        return { id: Math.floor(Math.random() * 9000 + 1000), orderNumber: `VX-${Date.now().toString().slice(-8)}`, ...orderData, status: "Confirmed" };
    },
};

const delay = ms => new Promise(r => setTimeout(r, ms));
const discounted = p => p.discountPercent > 0 ? p.price * (1 - p.discountPercent / 100) : p.price;
const fmt = n => `₹${Math.round(n).toLocaleString("en-IN")}`;

// ─────────────────────────────────────────────
// CART CONTEXT
// ─────────────────────────────────────────────
const CartCtx = createContext(null);

function cartReducer(state, action) {
    switch (action.type) {
        case "ADD": {
            const exists = state.find(i => i.id === action.product.id);
            if (exists) return state.map(i => i.id === action.product.id ? { ...i, qty: i.qty + 1 } : i);
            return [...state, { ...action.product, qty: 1, unitPrice: discounted(action.product) }];
        }
        case "UPDATE": return state.map(i => i.id === action.id ? { ...i, qty: action.qty } : i).filter(i => i.qty > 0);
        case "REMOVE": return state.filter(i => i.id !== action.id);
        case "CLEAR": return [];
        default: return state;
    }
}

function CartProvider({ children }) {
    const saved = (() => { try { return JSON.parse(localStorage.getItem("vx_cart") || "[]"); } catch { return []; } })();
    const [items, dispatch] = useReducer(cartReducer, saved);
    useEffect(() => { localStorage.setItem("vx_cart", JSON.stringify(items)); }, [items]);
    const subtotal = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
    const count = items.reduce((s, i) => s + i.qty, 0);
    return <CartCtx.Provider value={{ items, dispatch, subtotal, count }}>{children}</CartCtx.Provider>;
}

const useCart = () => useContext(CartCtx);

// ─────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────
const ToastCtx = createContext(null);
function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const show = useCallback((msg, type = "success") => {
        const id = Date.now();
        setToasts(t => [...t, { id, msg, type }]);
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
    }, []);
    return (
        <ToastCtx.Provider value={show}>
            {children}
            <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
                {toasts.map(t => (
                    <div key={t.id} style={{ background: t.type === "error" ? "#b91c1c" : "#15803d", color: "#fff", padding: "10px 16px", borderRadius: 8, fontSize: 14, fontWeight: 500, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", animation: "slideDown 0.2s ease", maxWidth: 320 }}>
                        {t.type === "success" ? "✓ " : "✕ "}{t.msg}
                    </div>
                ))}
            </div>
        </ToastCtx.Provider>
    );
}
const useToast = () => useContext(ToastCtx);

// ─────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────
export default function App() {
    const [page, setPage] = useState("products"); // products | checkout | confirmation
    const [orderResult, setOrderResult] = useState(null);

    return (
        <CartProvider>
            <ToastProvider>
                <div style={{ fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", background: "#f9fafb", color: "#111827" }}>
                    <Navbar onCartClick={() => { }} page={page} setPage={setPage} />
                    {page === "products" && <ProductsPage setPage={setPage} />}
                    {page === "checkout" && <CheckoutPage setPage={setPage} setOrderResult={setOrderResult} />}
                    {page === "confirmation" && <ConfirmationPage order={orderResult} setPage={setPage} />}
                </div>
            </ToastProvider>
        </CartProvider>
    );
}

// ─────────────────────────────────────────────
// NAVBAR
// ─────────────────────────────────────────────
function Navbar({ page, setPage }) {
    const { count } = useCart();
    const [cartOpen, setCartOpen] = useState(false);

    return (
        <>
            <div style={{ background: "#7f1d1d", color: "#fca5a5", fontSize: 12, padding: "6px 0", textAlign: "center" }}>
                ⚡ Free shipping on orders over ₹5,000 &nbsp;|&nbsp; Call: +91 9840425631
            </div>
            <nav style={{ background: "#dc2626", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
                <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", gap: 16, height: 60 }}>
                    <button onClick={() => setPage("products")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 26 }}>⚡</span>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 26, color: "#fecaca", letterSpacing: 2 }}>
                            Panchamukhi<span style={{ color: "#fff" }}>Electric</span>
                        </span>
                    </button>
                    <div style={{ flex: 1 }} />
                    {page !== "checkout" && (
                        <button onClick={() => setCartOpen(true)} style={{ position: "relative", background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 44, height: 44, borderRadius: 10, cursor: "pointer", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            🛒
                            {count > 0 && (
                                <span style={{ position: "absolute", top: -6, right: -6, background: "#fff", color: "#dc2626", fontSize: 11, fontWeight: 800, width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    {count}
                                </span>
                            )}
                        </button>
                    )}
                </div>
            </nav>
            <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} setPage={setPage} />
        </>
    );
}

// ─────────────────────────────────────────────
// CART DRAWER
// ─────────────────────────────────────────────
function CartDrawer({ open, onClose, setPage }) {
    const { items, dispatch, subtotal, count } = useCart();
    const shippingFree = subtotal >= 5000;
    const shipping = shippingFree ? 0 : 150;
    const total = subtotal + shipping;

    return (
        <>
            {open && <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200 }} />}
            <div style={{ position: "fixed", top: 0, right: 0, height: "100vh", width: 400, maxWidth: "100vw", background: "#fff", zIndex: 201, display: "flex", flexDirection: "column", transform: open ? "translateX(0)" : "translateX(100%)", transition: "transform 0.3s ease", boxShadow: "-8px 0 30px rgba(0,0,0,0.12)" }}>
                {/* Header */}
                <div style={{ padding: "18px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                        <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 700 }}>🛒 Cart</span>
                        <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 8 }}>{count} item{count !== 1 ? "s" : ""}</span>
                    </div>
                    <button onClick={onClose} style={{ background: "#f3f4f6", border: "none", width: 34, height: 34, borderRadius: "50%", cursor: "pointer", fontSize: 16 }}>✕</button>
                </div>

                {/* Items */}
                <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
                    {items.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
                            <div style={{ fontSize: 48 }}>🛒</div>
                            <p style={{ marginTop: 12, fontWeight: 500 }}>Your cart is empty</p>
                        </div>
                    ) : items.map(item => (
                        <div key={item.id} style={{ display: "flex", gap: 12, padding: "14px 0", borderBottom: "1px solid #f3f4f6" }}>
                            <div style={{ width: 60, height: 60, background: "#fee2e2", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>⚡</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</p>
                                <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>{fmt(item.unitPrice)} each</p>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <div style={{ display: "flex", alignItems: "center", border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden" }}>
                                        <button onClick={() => dispatch({ type: "UPDATE", id: item.id, qty: item.qty - 1 })} style={{ width: 28, height: 28, background: "#f9fafb", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>−</button>
                                        <span style={{ width: 32, textAlign: "center", fontSize: 13, fontWeight: 600 }}>{item.qty}</span>
                                        <button onClick={() => dispatch({ type: "UPDATE", id: item.id, qty: item.qty + 1 })} style={{ width: 28, height: 28, background: "#f9fafb", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>+</button>
                                    </div>
                                    <span style={{ marginLeft: "auto", fontWeight: 700, fontSize: 14 }}>{fmt(item.unitPrice * item.qty)}</span>
                                    <button onClick={() => dispatch({ type: "REMOVE", id: item.id })} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, opacity: 0.5 }}>🗑</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                {items.length > 0 && (
                    <div style={{ padding: "16px 20px", borderTop: "1px solid #e5e7eb", background: "#f9fafb" }}>
                        {!shippingFree && (
                            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 10, textAlign: "center" }}>
                                Add {fmt(5000 - subtotal)} more for free shipping!
                            </p>
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 14, color: "#6b7280" }}>Subtotal</span>
                            <span style={{ fontSize: 14, fontWeight: 600 }}>{fmt(subtotal)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                            <span style={{ fontSize: 14, color: "#6b7280" }}>Shipping</span>
                            <span style={{ fontSize: 14, fontWeight: 600, color: shippingFree ? "#15803d" : "#111827" }}>{shippingFree ? "FREE" : fmt(shipping)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                            <span style={{ fontWeight: 700 }}>Total</span>
                            <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 800 }}>{fmt(total)}</span>
                        </div>
                        <button onClick={() => { onClose(); setPage("checkout"); }} style={{ width: "100%", background: "#dc2626", color: "#fff", border: "none", padding: "13px", borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                            Proceed to Checkout →
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}

// ─────────────────────────────────────────────
// PRODUCTS PAGE
// ─────────────────────────────────────────────
function ProductsPage() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [filters, setFilters] = useState({ search: "", categoryId: "", minPrice: "", maxPrice: "", sort: "default" });
    const toast = useToast();
    const { dispatch: cartDispatch } = useCart();
    const [cartOpen, setCartOpen] = useState(false);

    useEffect(() => {
        api.getCategories().then(setCategories);
    }, []);

    useEffect(() => {
        setLoading(true);
        const active = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
        api.getProducts(active).then(r => { setProducts(r.items); setLoading(false); });
    }, [filters]);

    const addToCart = (product) => {
        cartDispatch({ type: "ADD", product });
        toast(`${product.name} added to cart!`);
        setCartOpen(true);
    };

    return (
        <>
            <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} setPage={() => { }} />

            {/* Hero banner */}
            <div style={{ background: "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)", color: "#fff", padding: "36px 20px", textAlign: "center" }}>
                <h1 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 42, fontWeight: 800, marginBottom: 6, letterSpacing: 1 }}>
                    ⚡ Electrical Products
                </h1>
                <p style={{ fontSize: 15, color: "#fca5a5", maxWidth: 480, margin: "0 auto 20px" }}>
                    Premium components from top brands. Fast delivery across Nepal.
                </p>
                {/* Search bar */}
                <div style={{ maxWidth: 500, margin: "0 auto", display: "flex", background: "#fff", borderRadius: 10, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
                    <input
                        value={filters.search}
                        onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                        placeholder="Search products, brands, SKUs…"
                        style={{ flex: 1, padding: "12px 16px", border: "none", fontSize: 14, outline: "none", color: "#111827" }}
                    />
                    <button style={{ background: "#dc2626", color: "#fff", border: "none", padding: "0 20px", fontSize: 16, cursor: "pointer" }}>🔍</button>
                </div>
            </div>

            {/* Category pills */}
            <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", overflowX: "auto" }}>
                <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 20px", display: "flex", gap: 8, padding: "10px 20px" }}>
                    <Pill active={!filters.categoryId} onClick={() => setFilters(f => ({ ...f, categoryId: "" }))}>All</Pill>
                    {categories.map(c => (
                        <Pill key={c.id} active={filters.categoryId === c.id} onClick={() => setFilters(f => ({ ...f, categoryId: f.categoryId === c.id ? "" : c.id }))}>
                            {c.name}
                        </Pill>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 20px", display: "grid", gridTemplateColumns: "220px 1fr", gap: 24 }}>
                {/* Sidebar */}
                <aside>
                    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, position: "sticky", top: 80 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                            <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 700 }}>Filters</span>
                            <button onClick={() => setFilters({ search: "", categoryId: "", minPrice: "", maxPrice: "", sort: "default" })} style={{ fontSize: 12, color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>Reset all</button>
                        </div>

                        <SideSection title="Price Range (₹)">
                            <div style={{ display: "flex", gap: 8 }}>
                                <input type="number" placeholder="Min" value={filters.minPrice} onChange={e => setFilters(f => ({ ...f, minPrice: e.target.value }))} style={inputSm} />
                                <input type="number" placeholder="Max" value={filters.maxPrice} onChange={e => setFilters(f => ({ ...f, maxPrice: e.target.value }))} style={inputSm} />
                            </div>
                        </SideSection>

                        <SideSection title="Sort By">
                            {[["default", "Newest"], ["price_asc", "Price: Low → High"], ["price_desc", "Price: High → Low"], ["name", "Name A→Z"]].map(([v, l]) => (
                                <label key={v} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 8, cursor: "pointer" }}>
                                    <input type="radio" name="sort" checked={filters.sort === v} onChange={() => setFilters(f => ({ ...f, sort: v }))} style={{ accentColor: "#dc2626" }} />
                                    {l}
                                </label>
                            ))}
                        </SideSection>
                    </div>
                </aside>

                {/* Grid */}
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <p style={{ fontSize: 14, color: "#6b7280" }}>
                            {loading ? "Loading…" : `${products.length} product${products.length !== 1 ? "s" : ""} found`}
                        </p>
                    </div>

                    {loading ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 18 }}>
                            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
                        </div>
                    ) : products.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "80px 0", color: "#9ca3af" }}>
                            <div style={{ fontSize: 48 }}>🔍</div>
                            <p style={{ fontSize: 18, fontWeight: 600, marginTop: 12 }}>No products found</p>
                            <p style={{ fontSize: 14, marginTop: 4 }}>Try adjusting your search or filters</p>
                        </div>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 18 }}>
                            {products.map(p => (
                                <ProductCard key={p.id} product={p} onView={() => setSelected(p)} onAdd={() => addToCart(p)} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {selected && <ProductModal product={selected} onClose={() => setSelected(null)} onAdd={() => { addToCart(selected); setSelected(null); }} />}
        </>
    );
}

function Pill({ active, onClick, children }) {
    return (
        <button onClick={onClick} style={{ padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${active ? "#dc2626" : "#e5e7eb"}`, background: active ? "#dc2626" : "#fff", color: active ? "#fff" : "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s" }}>
            {children}
        </button>
    );
}

function SideSection({ title, children }) {
    return (
        <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: "1px solid #f3f4f6" }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#6b7280", marginBottom: 12 }}>{title}</p>
            {children}
        </div>
    );
}

const inputSm = { flex: 1, padding: "7px 10px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 13, outline: "none", width: "100%" };

function SkeletonCard() {
    return (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <div style={{ height: 180, background: "#f3f4f6", animation: "pulse 1.5s ease-in-out infinite" }} />
            <div style={{ padding: 14 }}>
                {[80, 60, 100, 40].map((w, i) => (
                    <div key={i} style={{ height: 10, background: "#f3f4f6", borderRadius: 4, marginBottom: 8, width: `${w}%`, animation: "pulse 1.5s ease-in-out infinite" }} />
                ))}
            </div>
        </div>
    );
}

function ProductCard({ product, onView, onAdd }) {
    const [hover, setHover] = useState(false);
    const dp = discounted(product);
    const hasDiscount = product.discountPercent > 0;

    return (
        <div
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden", cursor: "pointer", transition: "all 0.2s", transform: hover ? "translateY(-3px)" : "none", boxShadow: hover ? "0 8px 24px rgba(220,38,38,0.12)" : "0 1px 3px rgba(0,0,0,0.05)", position: "relative" }}
            onClick={onView}
        >
            {hasDiscount && <div style={{ position: "absolute", top: 10, left: 10, background: "#dc2626", color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20, zIndex: 1 }}>−{product.discountPercent}%</div>}
            {product.isFeatured && !hasDiscount && <div style={{ position: "absolute", top: 10, left: 10, background: "#b91c1c", color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20, zIndex: 1 }}>★ Featured</div>}
            {product.stock === 0 && <div style={{ position: "absolute", top: 10, right: 10, background: "#6b7280", color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20, zIndex: 1 }}>Sold Out</div>}

            {/* Image area */}
            <div style={{ height: 175, background: "linear-gradient(135deg, #fff1f2, #fef2f2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52, position: "relative", overflow: "hidden" }}>
                <span style={{ filter: "grayscale(0.2)", transition: "transform 0.3s", transform: hover ? "scale(1.1)" : "scale(1)" }}>⚡</span>
            </div>

            <div style={{ padding: "12px 14px 14px" }}>
                <p style={{ fontSize: 10, color: "#dc2626", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>{product.categoryName}</p>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", color: "#111827" }}>{product.name}</h3>
                <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.5 }}>{product.shortDescription}</p>

                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
                    <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 800 }}>{fmt(dp)}</span>
                    {hasDiscount && <span style={{ fontSize: 12, color: "#9ca3af", textDecoration: "line-through" }}>{fmt(product.price)}</span>}
                </div>

                <button
                    onClick={e => { e.stopPropagation(); onAdd(); }}
                    disabled={product.stock === 0}
                    style={{ width: "100%", background: product.stock === 0 ? "#e5e7eb" : "#dc2626", color: product.stock === 0 ? "#9ca3af" : "#fff", border: "none", padding: "9px", borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: product.stock === 0 ? "not-allowed" : "pointer", transition: "background 0.15s" }}
                >
                    {product.stock === 0 ? "Out of Stock" : "+ Add to Cart"}
                </button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// PRODUCT MODAL
// ─────────────────────────────────────────────
function ProductModal({ product, onClose, onAdd }) {
    const [qty, setQty] = useState(1);
    const dp = discounted(product);
    const hasDiscount = product.discountPercent > 0;
    const savings = hasDiscount ? (product.price - dp) * qty : 0;

    return (
        <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 780, maxHeight: "90vh", overflowY: "auto", position: "relative", animation: "fadeUp 0.25s ease" }}>
                <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, background: "#f3f4f6", border: "none", width: 34, height: 34, borderRadius: "50%", cursor: "pointer", fontSize: 16, zIndex: 1 }}>✕</button>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr" }}>
                    {/* Image */}
                    <div style={{ background: "linear-gradient(135deg, #fff1f2, #fee2e2)", borderRadius: "16px 0 0 16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 90, minHeight: 320, position: "relative" }}>
                        ⚡
                        {hasDiscount && <div style={{ position: "absolute", top: 16, left: 16, background: "#dc2626", color: "#fff", padding: "5px 12px", borderRadius: 20, fontWeight: 700, fontSize: 13 }}>SAVE {product.discountPercent}%</div>}
                    </div>

                    {/* Info */}
                    <div style={{ padding: "28px 26px 24px" }}>
                        <p style={{ fontSize: 11, color: "#dc2626", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{product.categoryName}</p>
                        <h2 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 800, margin: "6px 0 8px", lineHeight: 1.2 }}>{product.name}</h2>
                        {product.brand && <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}>Brand: <strong>{product.brand}</strong></p>}
                        {product.sku && <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>SKU: <code style={{ background: "#f3f4f6", padding: "1px 5px", borderRadius: 4 }}>{product.sku}</code></p>}
                        <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.7, marginBottom: 14 }}>{product.description}</p>

                        {/* Price */}
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 32, fontWeight: 800 }}>{fmt(dp)}</span>
                            {hasDiscount && <span style={{ fontSize: 17, color: "#9ca3af", textDecoration: "line-through" }}>{fmt(product.price)}</span>}
                        </div>
                        {hasDiscount && qty > 0 && (
                            <p style={{ fontSize: 13, color: "#dc2626", fontWeight: 700, marginBottom: 10 }}>You save {fmt(savings)}</p>
                        )}
                        <p style={{ fontSize: 13, fontWeight: 600, color: product.stock > 0 ? "#15803d" : "#dc2626", marginBottom: 16 }}>
                            {product.stock > 10 ? `✓ In Stock (${product.stock} units)` : product.stock > 0 ? `⚠ Only ${product.stock} left!` : "✗ Out of Stock"}
                        </p>

                        {/* Specs */}
                        {product.specs && Object.keys(product.specs).length > 0 && (
                            <div style={{ background: "#f9fafb", borderRadius: 8, padding: "10px 14px", marginBottom: 18 }}>
                                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#6b7280", marginBottom: 8 }}>Specifications</p>
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                    <tbody>
                                        {Object.entries(product.specs).map(([k, v]) => (
                                            <tr key={k}>
                                                <td style={{ fontSize: 12, color: "#6b7280", padding: "3px 0", width: "45%" }}>{k}</td>
                                                <td style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{v}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Qty + Add */}
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <div style={{ display: "flex", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
                                <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 36, height: 42, background: "#f9fafb", border: "none", cursor: "pointer", fontSize: 18, fontWeight: 700 }}>−</button>
                                <span style={{ width: 44, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700 }}>{qty}</span>
                                <button onClick={() => setQty(q => Math.min(product.stock, q + 1))} style={{ width: 36, height: 42, background: "#f9fafb", border: "none", cursor: "pointer", fontSize: 18, fontWeight: 700 }}>+</button>
                            </div>
                            <button
                                onClick={() => { for (let i = 0; i < qty; i++) onAdd(); }}
                                disabled={product.stock === 0}
                                style={{ flex: 1, background: "#dc2626", color: "#fff", border: "none", height: 42, borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer" }}
                            >
                                🛒 Add to Cart
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// CHECKOUT PAGE
// ─────────────────────────────────────────────
function CheckoutPage({ setPage, setOrderResult }) {
    const { items, subtotal, dispatch: cartDispatch } = useCart();
    const toast = useToast();
    const [step, setStep] = useState(0); // 0=review, 1=shipping, 2=payment
    const [loading, setLoading] = useState(false);

    const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
    const [address, setAddress] = useState({ fullName: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "", country: "India", phone: "" });
    const [payment, setPayment] = useState({ method: "card", cardNumber: "", expiry: "", cvv: "", upiId: "" });

    const shippingCost = subtotal >= 5000 ? 0 : 150;
    const total = subtotal + shippingCost;

    if (items.length === 0) {
        return (
            <div style={{ textAlign: "center", padding: "80px 24px" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🛒</div>
                <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Your cart is empty</p>
                <button onClick={() => setPage("products")} style={primaryBtn}>Browse Products</button>
            </div>
        );
    }

    const placeOrder = async () => {
        setLoading(true);
        try {
            const result = await api.placeOrder({
                items: items.map(i => ({ productId: i.id, productName: i.name, quantity: i.qty, unitPrice: i.unitPrice })),
                customerName: customer.name, customerEmail: customer.email, customerPhone: customer.phone,
                shippingAddress: address,
                paymentMethod: payment.method,
                subtotal, shippingCost, total,
            });
            cartDispatch({ type: "CLEAR" });
            setOrderResult(result);
            setPage("confirmation");
        } catch {
            toast("Failed to place order. Please try again.", "error");
        } finally {
            setLoading(false);
        }
    };

    const STEPS = ["Review Cart", "Shipping", "Payment"];

    return (
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px" }}>
            {/* Breadcrumb */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
                {STEPS.map((s, i) => (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: i <= step ? "#dc2626" : "#e5e7eb", color: i <= step ? "#fff" : "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                                {i < step ? "✓" : i + 1}
                            </div>
                            <span style={{ fontSize: 14, fontWeight: i === step ? 700 : 400, color: i === step ? "#111827" : "#9ca3af" }}>{s}</span>
                        </div>
                        {i < STEPS.length - 1 && <div style={{ width: 32, height: 2, background: i < step ? "#dc2626" : "#e5e7eb" }} />}
                    </div>
                ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>
                {/* Main panel */}
                <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24 }}>
                    {/* Step 0: Cart Review */}
                    {step === 0 && (
                        <>
                            <h2 style={sectionTitle}>Review Your Items</h2>
                            {items.map(item => (
                                <div key={item.id} style={{ display: "flex", gap: 14, padding: "14px 0", borderBottom: "1px solid #f3f4f6" }}>
                                    <div style={{ width: 64, height: 64, background: "#fff1f2", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>⚡</div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{item.name}</p>
                                        <p style={{ color: "#6b7280", fontSize: 13 }}>Qty: {item.qty} × {fmt(item.unitPrice)}</p>
                                    </div>
                                    <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 800 }}>{fmt(item.unitPrice * item.qty)}</span>
                                </div>
                            ))}
                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
                                <button onClick={() => setPage("products")} style={outlineBtn}>← Keep Shopping</button>
                                <button onClick={() => setStep(1)} style={primaryBtn}>Continue to Shipping →</button>
                            </div>
                        </>
                    )}

                    {/* Step 1: Shipping */}
                    {step === 1 && (
                        <>
                            <h2 style={sectionTitle}>Shipping Details</h2>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                                <FormField label="Full Name *" value={customer.name} onChange={v => setCustomer(p => ({ ...p, name: v }))} />
                                <FormField label="Email *" type="email" value={customer.email} onChange={v => setCustomer(p => ({ ...p, email: v }))} />
                                <FormField label="Phone" value={customer.phone} onChange={v => setCustomer(p => ({ ...p, phone: v }))} />
                                <FormField label="Delivery Address *" value={address.addressLine1} onChange={v => setAddress(p => ({ ...p, addressLine1: v }))} span2 />
                                <FormField label="Area / Landmark" value={address.addressLine2} onChange={v => setAddress(p => ({ ...p, addressLine2: v }))} span2 />
                                <FormField label="City *" value={address.city} onChange={v => setAddress(p => ({ ...p, city: v }))} />
                                <FormField label="State *" value={address.state} onChange={v => setAddress(p => ({ ...p, state: v }))} />
                                <FormField label="PIN Code *" value={address.postalCode} onChange={v => setAddress(p => ({ ...p, postalCode: v }))} />
                            </div>
                            <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
                                <button onClick={() => setStep(0)} style={outlineBtn}>← Back</button>
                                <button onClick={() => { if (!customer.name || !customer.email || !address.addressLine1 || !address.city) { toast("Please fill required fields", "error"); return; } setStep(2); }} style={primaryBtn}>Continue to Payment →</button>
                            </div>
                        </>
                    )}

                    {/* Step 2: Payment */}
                    {step === 2 && (
                        <>
                            <h2 style={sectionTitle}>Payment Method</h2>
                            <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
                                {[["card", "💳 Card"], ["upi", "📱 UPI"], ["netbanking", "🏦 Net Banking"], ["cod", "💵 Cash on Delivery"]].map(([val, label]) => (
                                    <button key={val} onClick={() => setPayment(p => ({ ...p, method: val }))} style={{ padding: "9px 14px", border: `2px solid ${payment.method === val ? "#dc2626" : "#e5e7eb"}`, borderRadius: 8, background: payment.method === val ? "#fff1f2" : "#fff", color: payment.method === val ? "#dc2626" : "#374151", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {payment.method === "card" && (
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                                    <FormField label="Card Number" placeholder="1234 5678 9012 3456" value={payment.cardNumber} onChange={v => setPayment(p => ({ ...p, cardNumber: v }))} span2 />
                                    <FormField label="Expiry (MM/YY)" placeholder="12/26" value={payment.expiry} onChange={v => setPayment(p => ({ ...p, expiry: v }))} />
                                    <FormField label="CVV" placeholder="•••" value={payment.cvv} onChange={v => setPayment(p => ({ ...p, cvv: v }))} />
                                    <div style={{ gridColumn: "1/-1", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#15803d" }}>
                                        🔒 Mock payment — no real charges made. All data is client-side only.
                                    </div>
                                </div>
                            )}
                            {payment.method === "upi" && (
                                <FormField label="UPI ID" placeholder="yourname@upi" value={payment.upiId} onChange={v => setPayment(p => ({ ...p, upiId: v }))} />
                            )}
                            {payment.method === "netbanking" && (
                                <div style={{ background: "#f9fafb", borderRadius: 8, padding: "14px 16px", fontSize: 14, color: "#6b7280" }}>
                                    You'll be redirected to your bank's payment portal after confirming the order.
                                </div>
                            )}
                            {payment.method === "cod" && (
                                <div style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: 8, padding: "14px 16px", fontSize: 14, color: "#92400e" }}>
                                    💵 Pay <strong>{fmt(total)}</strong> when your order arrives. COD available for orders under ₹20,000.
                                </div>
                            )}

                            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                                <button onClick={() => setStep(1)} style={outlineBtn}>← Back</button>
                                <button onClick={placeOrder} disabled={loading} style={{ ...primaryBtn, opacity: loading ? 0.7 : 1, flex: 1 }}>
                                    {loading ? "Placing Order…" : `✓ Place Order · ${fmt(total)}`}
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Order Summary */}
                <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, position: "sticky", top: 80 }}>
                    <h3 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #dc2626" }}>Order Summary</h3>
                    {items.map(i => (
                        <div key={i.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                            <span style={{ color: "#6b7280", maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.name} ×{i.qty}</span>
                            <span style={{ fontWeight: 600, flexShrink: 0 }}>{fmt(i.unitPrice * i.qty)}</span>
                        </div>
                    ))}
                    <hr style={{ margin: "12px 0", borderColor: "#f3f4f6", borderStyle: "solid" }} />
                    <SummaryRow label="Subtotal" value={fmt(subtotal)} />
                    <SummaryRow label="Shipping" value={shippingCost === 0 ? "FREE" : fmt(shippingCost)} green={shippingCost === 0} />
                    <hr style={{ margin: "12px 0", borderColor: "#f3f4f6", borderStyle: "solid" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 16 }}>Total</span>
                        <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 800, color: "#dc2626" }}>{fmt(total)}</span>
                    </div>
                    {shippingCost > 0 && (
                        <p style={{ fontSize: 12, color: "#6b7280", marginTop: 8, background: "#f9fafb", padding: "8px 10px", borderRadius: 6 }}>
                            Add {fmt(5000 - subtotal)} more for free shipping!
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

function SummaryRow({ label, value, green }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 14, color: "#6b7280" }}>{label}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: green ? "#15803d" : "#111827" }}>{value}</span>
        </div>
    );
}

function FormField({ label, value, onChange, type = "text", placeholder, span2 }) {
    return (
        <div style={{ gridColumn: span2 ? "1/-1" : undefined }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>{label}</label>
            <input
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={e => onChange(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
            />
        </div>
    );
}

// ─────────────────────────────────────────────
// CONFIRMATION PAGE
// ─────────────────────────────────────────────
function ConfirmationPage({ order, setPage }) {
    return (
        <div style={{ maxWidth: 520, margin: "60px auto", padding: "0 20px", textAlign: "center" }}>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: "48px 36px" }}>
                <div style={{ width: 72, height: 72, background: "#dcfce7", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 20px" }}>✓</div>
                <h2 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Order Confirmed!</h2>
                <p style={{ color: "#6b7280", marginBottom: 6 }}>Thank you for your purchase.</p>
                <p style={{ color: "#dc2626", fontWeight: 700, fontSize: 18, marginBottom: 24 }}>Order #{order?.orderNumber}</p>
                <div style={{ background: "#f9fafb", borderRadius: 10, padding: "16px 20px", marginBottom: 24, textAlign: "left" }}>
                    <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>Confirmation sent to</p>
                    <p style={{ fontWeight: 600, fontSize: 14 }}>{order?.customerEmail}</p>
                </div>
                <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 28 }}>We'll notify you when your order is dispatched. Expected delivery: 3–5 business days.</p>
                <button onClick={() => setPage("products")} style={{ ...primaryBtn, width: "100%" }}>
                    Continue Shopping
                </button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const primaryBtn = { background: "#dc2626", color: "#fff", border: "none", padding: "10px 22px", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" };
const outlineBtn = { background: "#fff", color: "#374151", border: "1px solid #d1d5db", padding: "10px 20px", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" };
const sectionTitle = { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 20, paddingBottom: 12, borderBottom: "2px solid #dc2626" };
