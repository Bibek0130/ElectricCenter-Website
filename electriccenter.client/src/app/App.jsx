//imports
import { Routes, Route, Navigate } from 'react-router-dom';
import CustomNav from './layout/MainLayout.jsx';
import LandingPage from '../features/landing page/LandingPage.jsx';
import ProductsPage from '../features/Product/pages/ProductsPage.jsx';
import ServicePage from '../features/service/pages/service.jsx';
import FAQPage from '../features/FAQ/FAQ page.jsx';
import AboutPage from '../../src/features/About Us/About Us.jsx';

function App() {
    return(
        <>
            <Routes>
                <Route element={<CustomNav li={[
                    ["Home", "home"],
                    ["Products", "products"],
                    ["About Us", "about"],
                    ["Services", "services"],
                    ["Common Electrical Problem", "FAQ"]
                ]} />}>

                    <Route path="/" element={<Navigate to="/home" />} /> 
                    <Route path="/products" element={<ProductsPage />}/>
                    <Route  path="/home" element={<LandingPage />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/services" element={<ServicePage />} />
                    <Route path="/faq" element={<FAQPage />} />
                </Route>
           </Routes>
        </>
    );
    }
export default App;