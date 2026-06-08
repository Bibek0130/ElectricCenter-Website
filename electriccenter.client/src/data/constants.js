
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
    { url: "./src/assets/MainShowroom.jpg", caption: "Our Main Showroom" },
    { url: "./src/assets/electricalSupplies.jpg", caption: "Electrical Supplies" },
    { url: "./src/assets/panchamukhi.jpeg", caption: "Our Shop" },
];

const MOCK_CATEGORIES = [
    { id: 1, name: "Circuit Breakers" },
    { id: 2, name: "Wiring & Cables" },
    { id: 3, name: "Switches & Sockets" },
    { id: 4, name: "Lighting" },
    { id: 5, name: "Power Tools" },
    { id: 6, name: "Solar & Renewable" },
];

const MOCK_PRODUCTS = [
    { id: 1, name: "Schneider 63A Double Pole MCB", categoryId: 1, categoryName: "Circuit Breakers", price: 2850, discountPercent: 10, stock: 45, brand: "Schneider Electric", sku: "SCH-63A-DP", shortDescription: "High-performance miniature circuit breaker for residential and commercial use", description: "The Schneider Electric 63A Double Pole MCB provides reliable overload and short-circuit protection. Features thermal-magnetic trip mechanism, quick connection terminals, and DIN rail mounting. Ideal for main circuit protection.", isFeatured: true, specs: { "Ampere Rating": "63A", "Poles": "2", "Breaking Capacity": "10kA", "Standard": "IEC 60898" } },
    { id: 2, name: "ABB 32A RCBO 30mA", categoryId: 1, categoryName: "Circuit Breakers", price: 4200, discountPercent: 5, stock: 30, brand: "ABB", sku: "ABB-32A-RCBO", shortDescription: "Combined MCB + RCD protection in single unit", description: "ABB RCBO combines overcurrent and earth leakage protection. 30mA sensitivity for personal protection. Suitable for final circuits in domestic and commercial installations.", isFeatured: true, specs: { "Ampere Rating": "32A", "Sensitivity": "30mA", "Type": "Type A", "Poles": "1+N" } },
    { id: 3, name: "Havells 18-Way Distribution Board", categoryId: 1, categoryName: "Circuit Breakers", price: 8500, discountPercent: 0, stock: 15, brand: "Havells", sku: "HAV-DB-18W", shortDescription: "Surface mount distribution board with transparent cover", description: "Havells 18-way TPN distribution board. Double door design with padlock facility. Sturdy powder-coated steel enclosure with pre-fitted busbars.", isFeatured: false, specs: { "Ways": "18", "Type": "TPN", "IP Rating": "IP43", "Mounting": "Surface" } },
    { id: 4, name: "Polycab 4mm² Armoured Cable (100m)", categoryId: 2, categoryName: "Wiring & Cables", price: 18500, discountPercent: 8, stock: 20, brand: "Polycab", sku: "POL-4MM-SWA", shortDescription: "XLPE insulated, SWA armoured cable for underground use", description: "Polycab 3-core 4mm² XLPE/SWA/PVC armoured cable. Suitable for underground and direct burial. High mechanical strength with steel wire armour.", isFeatured: true, specs: { "Size": "4mm²", "Cores": "3", "Length": "100m", "Type": "XLPE/SWA/PVC" } },
    { id: 5, name: "Finolex 2.5mm² House Wire (90m Roll)", categoryId: 2, categoryName: "Wiring & Cables", price: 3200, discountPercent: 0, stock: 80, brand: "Finolex", sku: "FIN-2.5-FR", shortDescription: "FR-LSH insulated single core copper conductor", description: "Finolex FR-LSH 2.5mm² single core house wiring cable. Flame retardant, low smoke, zero halogen. Annealed bare copper conductor.", isFeatured: false, specs: { "Size": "2.5mm²", "Length": "90m", "Insulation": "FR-LSH", "Conductor": "Copper" } },
    { id: 6, name: "Legrand Arteor 2-Gang Switch", categoryId: 3, categoryName: "Switches & Sockets", price: 850, discountPercent: 15, stock: 120, brand: "Legrand", sku: "LEG-ART-2G", shortDescription: "Premium modular switch with piano-key mechanism", description: "Legrand Arteor 2-gang 2-way switch. Elegant flat plate design. Screwless terminals. Robust polycarbonate frame with UV stabilizer.", isFeatured: true, specs: { "Gangs": "2", "Current": "10A", "Voltage": "240V", "Type": "2-Way" } },
    { id: 7, name: "Anchor Roma 13A Switched Socket", categoryId: 3, categoryName: "Switches & Sockets", price: 420, discountPercent: 0, stock: 200, brand: "Anchor", sku: "ANC-ROM-13A", shortDescription: "3-pin switched socket with safety shutters", description: "Anchor Roma 13A 3-pin switched socket with neon indicator. Safety shutters on all pins. Child protection mechanism.", isFeatured: false, specs: { "Rating": "13A", "Pins": "3", "Mounting": "Flush", "Feature": "Neon Indicator" } },
    { id: 8, name: "Wipro 24W LED Panel Light", categoryId: 4, categoryName: "Lighting", price: 1850, discountPercent: 20, stock: 60, brand: "Wipro", sku: "WIP-24W-PNL", shortDescription: "Ultra-slim recessed LED panel, warm white 3000K", description: "Wipro 24W square LED panel. Ultra-slim 8mm profile. 110 lm/W efficiency. Flicker-free driver. 3 year warranty. For offices and retail.", isFeatured: true, specs: { "Wattage": "24W", "Lumens": "2640 lm", "Color Temp": "3000K", "Size": "300×300mm" } },
    { id: 9, name: "Philips CorePro LED Bulb 9W E27", categoryId: 4, categoryName: "Lighting", price: 280, discountPercent: 0, stock: 500, brand: "Philips", sku: "PHI-9W-E27", shortDescription: "Long-life LED bulb replacing 60W incandescent", description: "Philips CorePro 9W E27. 15,000 hour rated life. Instant full brightness. No warm-up. 2 year warranty.", isFeatured: false, specs: { "Wattage": "9W", "Base": "E27", "Color Temp": "6500K", "Lumens": "806 lm" } },
    { id: 10, name: "Bosch GSB 550W Impact Drill", categoryId: 5, categoryName: "Power Tools", price: 5500, discountPercent: 12, stock: 25, brand: "Bosch", sku: "BOS-GSB-550", shortDescription: "Impact drill with electronic speed control", description: "Bosch GSB 550 impact drill. 550W motor, 13mm keyless chuck. Variable speed with reverse. Includes carry case and bits.", isFeatured: true, specs: { "Power": "550W", "Chuck": "13mm", "Speed": "0–2800 rpm", "Impact Rate": "44800 bpm" } },
    { id: 11, name: "Fluke 117 True-RMS Multimeter", categoryId: 5, categoryName: "Power Tools", price: 12500, discountPercent: 0, stock: 12, brand: "Fluke", sku: "FLU-117-DMM", shortDescription: "Professional multimeter with NCV detection", description: "Fluke 117 True-RMS multimeter. AutoVolt AC/DC selection. Non-contact voltage detection. Min/Max/Avg recording. CAT III 600V.", isFeatured: false, specs: { "Type": "True-RMS", "Safety": "CAT III 600V", "Display": "6000 count", "NCV": "Built-in" } },
    { id: 12, name: "Waaree 400W Mono PERC Solar Panel", categoryId: 6, categoryName: "Solar & Renewable", price: 14800, discountPercent: 5, stock: 40, brand: "Waaree", sku: "WAA-400W-PERC", shortDescription: "High-efficiency monocrystalline solar panel", description: "Waaree 400W Mono PERC solar panel. 21.5% efficiency. Anti-reflective tempered glass. 25-year linear power warranty.", isFeatured: true, specs: { "Wattage": "400W", "Efficiency": "21.5%", "Voc": "49.8V", "Isc": "10.25A" } },
];


export const services = [
    { title: "Electrical Installation", desc: "Complete wiring and installation for homes, offices, and factories. We handle everything from load calculations to final testing.", icon: "🏗️", color: COLORS.red },
    { title: "Maintenance & Repair", desc: "Preventive and corrective maintenance for all electrical systems. Fast response, reliable fixes.", icon: "🛠️", color: COLORS.redDark },
    { title: "Consultation & Design", desc: "Expert electrical design and consultation for projects of any scale.", icon: "📐", color: COLORS.red },
    { title: "Bulk Supply & Wholesale", desc: "Special pricing for contractors, builders and bulk buyers. Custom quotes available.", icon: "📦", color: COLORS.redDark },
];
