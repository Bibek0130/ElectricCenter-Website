using ElectricCenter.Server.Data.Entities;
using ElectricCenter.Server.Electricians;

namespace ElectricCenter.Server.Data
{
    /// <summary>
    /// Catalog seed data. Categories are part of the schema (seeded by migration). The sample
    /// products are the catalog the site used to hard-code; they are only inserted in Development
    /// when Seed:SampleProducts is true and the Products table has never had a row.
    /// </summary>
    public static class SampleCatalog
    {
        public static readonly Category[] Categories =
        [
            new() { Id = 1, Name = "Circuit Breakers", SortOrder = 1 },
            new() { Id = 2, Name = "Wiring & Cables", SortOrder = 2 },
            new() { Id = 3, Name = "Switches & Sockets", SortOrder = 3 },
            new() { Id = 4, Name = "Lighting", SortOrder = 4 },
            new() { Id = 5, Name = "Power Tools", SortOrder = 5 },
            new() { Id = 6, Name = "Solar & Renewable", SortOrder = 6 },
        ];

        public static Product[] CreateSampleProducts() =>
        [
            P("Schneider 63A Double Pole MCB", 1, 2850, 10, 45, "Schneider Electric", "SCH-63A-DP", "High-performance miniature circuit breaker for residential and commercial use", "The Schneider Electric 63A Double Pole MCB provides reliable overload and short-circuit protection. Features thermal-magnetic trip mechanism, quick connection terminals, and DIN rail mounting. Ideal for main circuit protection.", true, new() { ["Ampere Rating"] = "63A", ["Poles"] = "2", ["Breaking Capacity"] = "10kA", ["Standard"] = "IEC 60898" }),
            P("ABB 32A RCBO 30mA", 1, 4200, 5, 30, "ABB", "ABB-32A-RCBO", "Combined MCB + RCD protection in single unit", "ABB RCBO combines overcurrent and earth leakage protection. 30mA sensitivity for personal protection. Suitable for final circuits in domestic and commercial installations.", true, new() { ["Ampere Rating"] = "32A", ["Sensitivity"] = "30mA", ["Type"] = "Type A", ["Poles"] = "1+N" }),
            P("Havells 18-Way Distribution Board", 1, 8500, 0, 15, "Havells", "HAV-DB-18W", "Surface mount distribution board with transparent cover", "Havells 18-way TPN distribution board. Double door design with padlock facility. Sturdy powder-coated steel enclosure with pre-fitted busbars.", false, new() { ["Ways"] = "18", ["Type"] = "TPN", ["IP Rating"] = "IP43", ["Mounting"] = "Surface" }),
            P("Polycab 4mm² Armoured Cable (100m)", 2, 18500, 8, 20, "Polycab", "POL-4MM-SWA", "XLPE insulated, SWA armoured cable for underground use", "Polycab 3-core 4mm² XLPE/SWA/PVC armoured cable. Suitable for underground and direct burial. High mechanical strength with steel wire armour.", true, new() { ["Size"] = "4mm²", ["Cores"] = "3", ["Length"] = "100m", ["Type"] = "XLPE/SWA/PVC" }),
            P("Finolex 2.5mm² House Wire (90m Roll)", 2, 3200, 0, 80, "Finolex", "FIN-2.5-FR", "FR-LSH insulated single core copper conductor", "Finolex FR-LSH 2.5mm² single core house wiring cable. Flame retardant, low smoke, zero halogen. Annealed bare copper conductor.", false, new() { ["Size"] = "2.5mm²", ["Length"] = "90m", ["Insulation"] = "FR-LSH", ["Conductor"] = "Copper" }),
            P("Legrand Arteor 2-Gang Switch", 3, 850, 15, 120, "Legrand", "LEG-ART-2G", "Premium modular switch with piano-key mechanism", "Legrand Arteor 2-gang 2-way switch. Elegant flat plate design. Screwless terminals. Robust polycarbonate frame with UV stabilizer.", true, new() { ["Gangs"] = "2", ["Current"] = "10A", ["Voltage"] = "240V", ["Type"] = "2-Way" }),
            P("Anchor Roma 13A Switched Socket", 3, 420, 0, 200, "Anchor", "ANC-ROM-13A", "3-pin switched socket with safety shutters", "Anchor Roma 13A 3-pin switched socket with neon indicator. Safety shutters on all pins. Child protection mechanism.", false, new() { ["Rating"] = "13A", ["Pins"] = "3", ["Mounting"] = "Flush", ["Feature"] = "Neon Indicator" }),
            P("Wipro 24W LED Panel Light", 4, 1850, 20, 60, "Wipro", "WIP-24W-PNL", "Ultra-slim recessed LED panel, warm white 3000K", "Wipro 24W square LED panel. Ultra-slim 8mm profile. 110 lm/W efficiency. Flicker-free driver. 3 year warranty. For offices and retail.", true, new() { ["Wattage"] = "24W", ["Lumens"] = "2640 lm", ["Color Temp"] = "3000K", ["Size"] = "300×300mm" }),
            P("Philips CorePro LED Bulb 9W E27", 4, 280, 0, 500, "Philips", "PHI-9W-E27", "Long-life LED bulb replacing 60W incandescent", "Philips CorePro 9W E27. 15,000 hour rated life. Instant full brightness. No warm-up. 2 year warranty.", false, new() { ["Wattage"] = "9W", ["Base"] = "E27", ["Color Temp"] = "6500K", ["Lumens"] = "806 lm" }),
            P("Bosch GSB 550W Impact Drill", 5, 5500, 12, 25, "Bosch", "BOS-GSB-550", "Impact drill with electronic speed control", "Bosch GSB 550 impact drill. 550W motor, 13mm keyless chuck. Variable speed with reverse. Includes carry case and bits.", true, new() { ["Power"] = "550W", ["Chuck"] = "13mm", ["Speed"] = "0–2800 rpm", ["Impact Rate"] = "44800 bpm" }),
            P("Fluke 117 True-RMS Multimeter", 5, 12500, 0, 12, "Fluke", "FLU-117-DMM", "Professional multimeter with NCV detection", "Fluke 117 True-RMS multimeter. AutoVolt AC/DC selection. Non-contact voltage detection. Min/Max/Avg recording. CAT III 600V.", false, new() { ["Type"] = "True-RMS", ["Safety"] = "CAT III 600V", ["Display"] = "6000 count", ["NCV"] = "Built-in" }),
            P("Waaree 400W Mono PERC Solar Panel", 6, 14800, 5, 40, "Waaree", "WAA-400W-PERC", "High-efficiency monocrystalline solar panel", "Waaree 400W Mono PERC solar panel. 21.5% efficiency. Anti-reflective tempered glass. 25-year linear power warranty.", true, new() { ["Wattage"] = "400W", ["Efficiency"] = "21.5%", ["Voc"] = "49.8V", ["Isc"] = "10.25A" }),
        ];

        /// <summary>The electrician the site used to hard-code (Development seed only; production starts empty).</summary>
        public static Electrician[] CreateSampleElectricians() =>
        [
            new()
            {
                Name = "Udhav Mainali",
                Location = "Kumarigal, Kathmandu",
                YearsExperience = 20,
                IsContractor = true,
                RateAmount = 1000,
                RateUnit = RateUnit.Service,
                WhatsAppNumber = "+9779841445050",
                Bio = "Electrician and contractor with 20 years of experience across every kind of electrical work — house and industrial wiring, panel upgrades, solar and inverter systems, generators, smart-home and lighting setups, and appliance and AC repair. Takes on both small repair jobs and full contracting projects. The Rs 1,000 rate covers the service visit and consultation.",
                Specialties = ElectricianRules.Specialties.Select(s => new ElectricianSpecialty { Specialty = s }).ToList(),
                Version = Guid.NewGuid(),
            },
        ];

        private static Product P(string name, int categoryId, decimal price, int discount, int stock, string brand, string sku,
            string shortDescription, string description, bool featured, Dictionary<string, string> specs) => new()
        {
            Name = name,
            CategoryId = categoryId,
            Price = price,
            DiscountPercent = discount,
            Stock = stock,
            Brand = brand,
            Sku = sku,
            ShortDescription = shortDescription,
            Description = description,
            IsFeatured = featured,
            Specs = specs,
            Version = Guid.NewGuid(),
        };
    }
}
