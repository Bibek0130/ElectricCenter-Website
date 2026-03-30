//imports
import { Routes, Route, Navigate } from 'react-router-dom';
import CustomNav from './layout/MainLayout.jsx';
import LandingPage from '../features/landing page/LandingPage.jsx';

function App() {
    return(
        <>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route element={<CustomNav li={[
                    ["Home", "home"],
                    ["About Us", "about"],
                    ["Services", "services"],
                    ["Common Electrical Problem", "FAQ"]
                ]} />}>
                   

                    <Route path="/home" element={<h1>Home Page</h1>} />
                    <Route path="/about" element={<h1>About Us</h1>} />
                    <Route path="/services" element={<h1>Our Services</h1>} />
                    <Route path="/faq" element={<h1>Electrical FAQ</h1>} />
                </Route>
           </Routes>
        </>
    );
    }
export default App;