// Imported (not written as '/src/assets/...' strings) so Vite bundles and fingerprints them.
// A literal '/src/...' path only works under the dev server; it 404s in the production build.
import mainShowroom from '../assets/MainShowroom.jpg';
import electricalSupplies from '../assets/electricalSupplies.jpg';
import panchamukhi from '../assets/panchamukhi.jpeg';

export const shopImages = [
    { url: mainShowroom, caption: 'Our Main Showroom' },
    { url: electricalSupplies, caption: 'Electrical Supplies' },
    { url: panchamukhi, caption: 'Our Shop' },
];

export const services = [
    { title: 'Electrical Installation', desc: 'Complete wiring and installation for homes, offices, and factories. We handle everything from load calculations to final testing.', icon: '🏗️' },
    { title: 'Maintenance & Repair', desc: 'Preventive and corrective maintenance for all electrical systems. Fast response, reliable fixes.', icon: '🛠️' },
    { title: 'Consultation & Design', desc: 'Expert electrical design and consultation for projects of any scale.', icon: '📐' },
    { title: 'Bulk Supply & Wholesale', desc: 'Special pricing for contractors, builders and bulk buyers. Custom quotes available.', icon: '📦' },
];

export const whyChooseUs = [
    { icon: '🏆', title: '20+ Years Experience', desc: 'Trusted by thousands of customers since 2005' },
    { icon: '📦', title: '500+ Products', desc: 'Largest selection of electrical goods in Kathmandu' },
    { icon: '🚚', title: 'Fast Delivery', desc: 'Same-day delivery within Kathmandu valley' },
    { icon: '💯', title: 'Quality Guarantee', desc: 'All products certified and warranty backed' },
];
