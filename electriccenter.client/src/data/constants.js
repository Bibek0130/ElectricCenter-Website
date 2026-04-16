export const COLORS = {
    red: "#DC2626",
    redDark: "#991B1B",
    redLight: "#FEE2E2",
    white: "#FFFFFF",
    offWhite: "#FFF9F9",
    gray50: "#F9FAFB",
    gray100: "#F3F4F6",
    gray200: "#E5E7EB",
    gray400: "#9CA3AF",
    gray600: "#4B5563",
    gray800: "#1F2937",
    gray900: "#111827",
};

const style = (obj) => obj;

/* ──────────────── DATA ──────────────── */
export const shopImages = [
    { url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80", caption: "Our Main Showroom" },
    { url: "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=1200&q=80", caption: "Electrical Supplies" },
    { url: "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=1200&q=80", caption: "Professional Tools" },
    { url: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=1200&q=80", caption: "Expert Team" },
    { url: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=1200&q=80", caption: "Quality Products" },
];

const products = [
    { id: 1, name: "Circuit Breakers", desc: "MCB & MCCB for residential and commercial use", price: "From NPR 450", icon: "⚡", category: "Protection" },
    { id: 2, name: "Wiring Cables", desc: "PVC insulated copper & aluminum cables", price: "From NPR 25/m", icon: "🔌", category: "Wiring" },
    { id: 3, name: "LED Lights", desc: "Energy-efficient lighting for all spaces", price: "From NPR 350", icon: "💡", category: "Lighting" },
    { id: 4, name: "Distribution Boards", desc: "Complete panel boards and enclosures", price: "From NPR 2,500", icon: "🔲", category: "Panels" },
    { id: 5, name: "Switches & Sockets", desc: "Modular switches, outlets and accessories", price: "From NPR 120", icon: "🔧", category: "Fittings" },
    { id: 6, name: "Conduits & Pipes", desc: "PVC and steel conduit systems", price: "From NPR 80/m", icon: "🪛", category: "Wiring" },
    { id: 7, name: "Transformers", desc: "Step-up and step-down transformers", price: "From NPR 8,000", icon: "🔋", category: "Power" },
    { id: 8, name: "Electric Motors", desc: "Single & three-phase induction motors", price: "From NPR 5,500", icon: "⚙️", category: "Power" },
    { id: 9, name: "Earthing Materials", desc: "Earthing rods, clamps and compounds", price: "From NPR 1,200", icon: "🌍", category: "Protection" },
];

const services = [
    { title: "Electrical Installation", desc: "Complete wiring and installation for homes, offices, and factories. We handle everything from load calculations to final testing.", icon: "🏗️", color: COLORS.red },
    { title: "Maintenance & Repair", desc: "Preventive and corrective maintenance for all electrical systems. Fast response, reliable fixes.", icon: "🛠️", color: COLORS.redDark },
    { title: "Energy Auditing", desc: "Professional energy audits to reduce consumption and cut electricity bills by up to 30%.", icon: "📊", color: COLORS.red },
    { title: "Solar System Supply", desc: "Supply of solar panels, inverters, batteries and all associated equipment.", icon: "☀️", color: COLORS.redDark },
    { title: "Consultation & Design", desc: "Expert electrical design and consultation for projects of any scale.", icon: "📐", color: COLORS.red },
    { title: "Bulk Supply & Wholesale", desc: "Special pricing for contractors, builders and bulk buyers. Custom quotes available.", icon: "📦", color: COLORS.redDark },
];
