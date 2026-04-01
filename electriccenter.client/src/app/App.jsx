//imports
import { Routes, Route, Navigate } from 'react-router-dom';
import CustomNav from './layout/MainLayout.jsx';
import LandingPage from '../features/landing page/LandingPage.jsx';
import ProductsPage from '../features/Product/pages/ProductsPage.jsx';
import ServicePage from '../features/service/pages/service.jsx';

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
                   
                    <Route path="/products" element={<ProductsPage />}/>
                    <Route index path="/home" element={<LandingPage />} />
                    <Route path="/about" element={<h1>About Us</h1>} />
                    <Route path="/services" element={<ServicePage />} />
                    <Route path="/faq" element={<h1>Electrical FAQ</h1>} />
                </Route>
           </Routes>
        </>
    );
    }
export default App;