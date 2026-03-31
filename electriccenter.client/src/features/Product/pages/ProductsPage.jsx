import { useState, useEffect } from "react";

// ─── Mock Data (replace with your .NET Core API call) ───────────────────────
const MOCK_PRODUCTS = [
    { id: 1, name: "Wireless Noise-Cancelling Headphones", category: "LED Bulb", price: 129.99, stock: 42, rating: 4.7, image: "https://placehold.co/400x300/1a1a2e/e0e0ff?text=Headphones" },
    { id: 2, name: "Ergonomic Office Chair", category: "Fan", price: 349.00, stock: 15, rating: 4.5, image: "https://placehold.co/400x300/1a1a2e/e0e0ff?text=Chair" },
    { id: 3, name: "Stainless Steel Water Bottle", category: "Cooler", price: 34.99, stock: 120, rating: 4.8, image: "https://placehold.co/400x300/1a1a2e/e0e0ff?text=Bottle" },
    { id: 4, name: "Mechanical Keyboard TKL", category: "Switches", price: 89.99, stock: 30, rating: 4.6, image: "https://placehold.co/400x300/1a1a2e/e0e0ff?text=Keyboard" },
    { id: 5, name: "Minimalist Desk Lamp", category: "Fan", price: 59.00, stock: 0, rating: 4.3, image: "https://placehold.co/400x300/1a1a2e/e0e0ff?text=Lamp" },
    { id: 6, name: "Bamboo Cutting Board Set", category: "Wire", price: 44.95, stock: 68, rating: 4.9, image: "https://placehold.co/400x300/1a1a2e/e0e0ff?text=Cutting+Board" },
    { id: 7, name: "Smart Fitness Tracker", category: "Wall light", price: 79.99, stock: 25, rating: 4.4, image: "https://placehold.co/400x300/1a1a2e/e0e0ff?text=Tracker" },
    { id: 8, name: "Linen Throw Blanket", category: "Wire", price: 65.00, stock: 50, rating: 4.7, image: "https://placehold.co/400x300/1a1a2e/e0e0ff?text=Blanket" },
];

const CATEGORIES = ["All", ...Array.from(new Set(MOCK_PRODUCTS.map(p => p.category)))];

// ─── Star Rating Component ───────────────────────────────────────────────────
function StarRating({ rating }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
            {[1, 2, 3, 4, 5].map(star => (
                <svg key={star} width="14" height="14" viewBox="0 0 24 24" fill={star <= Math.round(rating) ? "#f5c842" : "none"} stroke="#f5c842" strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
            ))}
            <span style={{ fontSize: "12px", color: "#aaa", marginLeft: "4px" }}>{rating.toFixed(1)}</span>
        </div>
    );
}

// ─── Product Card ────────────────────────────────────────────────────────────
function ProductCard({ product, index }) {
    const [hovered, setHovered] = useState(false);
    const isOutOfStock = product.stock === 0;

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                background: hovered ? "#1e1e35" : "#16162a",
                border: hovered ? "1px solid #5c5cff" : "1px solid #2a2a44",
                borderRadius: "16px",
                overflow: "hidden",
                transition: "all 0.25s ease",
                transform: hovered ? "translateY(-6px)" : "translateY(0)",
                boxShadow: hovered ? "0 16px 40px rgba(92,92,255,0.2)" : "0 4px 16px rgba(0,0,0,0.3)",
                cursor: "pointer",
                animation: `fadeSlideUp 0.4s ease forwards`,
                animationDelay: `${index * 0.07}s`,
                opacity: 0,
            }}
        >
            {/* Image */}
            <div style={{ position: "relative", overflow: "hidden" }}>
                <img
                    src={product.image}
                    alt={product.name}
                    style={{ width: "100%", height: "180px", objectFit: "cover", display: "block", transition: "transform 0.35s ease", transform: hovered ? "scale(1.05)" : "scale(1)" }}
                />
                <span style={{
                    position: "absolute", top: "12px", left: "12px",
                    background: "rgba(92,92,255,0.85)", color: "#fff",
                    fontSize: "11px", fontWeight: 600, letterSpacing: "0.5px",
                    padding: "3px 10px", borderRadius: "20px", backdropFilter: "blur(6px)",
                }}>
                    {product.category}
                </span>
                {isOutOfStock && (
                    <div style={{
                        position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <span style={{ color: "#ff6b6b", fontWeight: 700, fontSize: "14px", letterSpacing: "1px", textTransform: "uppercase" }}>Out of Stock</span>
                    </div>
                )}
            </div>

            {/* Body */}
            <div style={{ padding: "16px" }}>
                <h3 style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 600, color: "#e8e8ff", lineHeight: 1.4, fontFamily: "'DM Sans', sans-serif" }}>
                    {product.name}
                </h3>

                <StarRating rating={product.rating} />

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "14px" }}>
                    <span style={{ fontSize: "20px", fontWeight: 700, color: "#7b7bff", fontFamily: "monospace" }}>
                        ${product.price.toFixed(2)}
                    </span>
                    <span style={{ fontSize: "12px", color: isOutOfStock ? "#ff6b6b" : "#5ddfb0" }}>
                        {isOutOfStock ? "Unavailable" : `${product.stock} in stock`}
                    </span>
                </div>

                <button
                    disabled={isOutOfStock}
                    style={{
                        marginTop: "14px", width: "100%",
                        padding: "10px 0", borderRadius: "10px", border: "none",
                        background: isOutOfStock ? "#2a2a44" : hovered ? "#5c5cff" : "#3a3a7a",
                        color: isOutOfStock ? "#555" : "#fff",
                        fontSize: "13px", fontWeight: 600, cursor: isOutOfStock ? "not-allowed" : "pointer",
                        transition: "background 0.2s ease",
                        fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.3px",
                    }}
                >
                    {isOutOfStock ? "Unavailable" : "Add to Cart"}
                </button>
            </div>
        </div>
    );
}

// ─── Main Products Page ──────────────────────────────────────────────────────
export default function ProductsPage() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState("");
    const [activeCategory, setActiveCategory] = useState("All");
    const [sortBy, setSortBy] = useState("default");

    // ── Fetch from API ────────────────────────────────────────────────────────
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                setLoading(true);

                // TODO: Replace this URL with your actual .NET Core API endpoint
                // const res = await fetch("https://your-api.com/api/products");
                // const data = await res.json();
                // setProducts(data);

                // Mock data — remove once API is ready
                await new Promise(r => setTimeout(r, 800));
                setProducts(MOCK_PRODUCTS);
            } catch (err) {
                setError("Failed to load products. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, []);

    // ── Filter & Sort ─────────────────────────────────────────────────────────
    const filtered = products
        .filter(p => activeCategory === "All" || p.category === activeCategory)
        .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
            if (sortBy === "price-asc") return a.price - b.price;
            if (sortBy === "price-desc") return b.price - a.price;
            if (sortBy === "rating") return b.rating - a.rating;
            return 0;
        });

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Sora:wght@700;800&display=swap');
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        * { box-sizing: border-box; }
        body { margin: 0; }
        input::placeholder { color: #555; }
        select option { background: #1a1a2e; }
      `}</style>

            <div style={{ minHeight: "100vh", background: "#0e0e1c", fontFamily: "'DM Sans', sans-serif", padding: "40px 24px" }}>
                {/* Header */}
                <div style={{ maxWidth: "1200px", margin: "0 auto 36px" }}>
                    <h1 style={{ margin: 0, fontSize: "36px", fontFamily: "'Sora', sans-serif", fontWeight: 800, color: "#e8e8ff", letterSpacing: "-0.5px" }}>
                        Our Products
                    </h1>
                    <p style={{ margin: "8px 0 0", color: "#666", fontSize: "15px" }}>
                        {loading ? "Loading..." : `${filtered.length} product${filtered.length !== 1 ? "s" : ""} found`}
                    </p>
                </div>

                {/* Controls */}
                <div style={{ maxWidth: "1200px", margin: "0 auto 28px", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
                    <input
                        type="text"
                        placeholder="Search products..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            flex: "1", minWidth: "200px", padding: "10px 16px",
                            background: "#16162a", border: "1px solid #2a2a44", borderRadius: "10px",
                            color: "#e8e8ff", fontSize: "14px", outline: "none",
                        }}
                    />
                    <select
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value)}
                        style={{
                            padding: "10px 16px", background: "#16162a", border: "1px solid #2a2a44",
                            borderRadius: "10px", color: "#e8e8ff", fontSize: "14px", outline: "none", cursor: "pointer",
                        }}
                    >
                        <option value="default">Sort: Default</option>
                        <option value="price-asc">Price: Low → High</option>
                        <option value="price-desc">Price: High → Low</option>
                        <option value="rating">Top Rated</option>
                    </select>
                </div>

                {/* Category Tabs */}
                <div style={{ maxWidth: "1200px", margin: "0 auto 28px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            style={{
                                padding: "7px 18px", borderRadius: "20px", border: "1px solid",
                                borderColor: activeCategory === cat ? "#5c5cff" : "#2a2a44",
                                background: activeCategory === cat ? "#5c5cff" : "transparent",
                                color: activeCategory === cat ? "#fff" : "#888",
                                fontSize: "13px", fontWeight: 500, cursor: "pointer",
                                transition: "all 0.2s ease",
                            }}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* States */}
                {loading && (
                    <div style={{ textAlign: "center", color: "#555", padding: "80px 0", fontSize: "15px" }}>
                        Loading products...
                    </div>
                )}
                {error && (
                    <div style={{ textAlign: "center", color: "#ff6b6b", padding: "80px 0", fontSize: "15px" }}>
                        {error}
                    </div>
                )}
                {!loading && !error && filtered.length === 0 && (
                    <div style={{ textAlign: "center", color: "#555", padding: "80px 0", fontSize: "15px" }}>
                        No products match your search.
                    </div>
                )}

                {/* Product Grid */}
                {!loading && !error && (
                    <div style={{
                        maxWidth: "1200px", margin: "0 auto",
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                        gap: "20px",
                    }}>
                        {filtered.map((product, i) => (
                            <ProductCard key={product.id} product={product} index={i} />
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
