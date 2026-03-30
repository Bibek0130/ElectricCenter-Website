//imports
import { Routes, Route, Navigate } from 'react-router-dom';
import CustomNav from './layout/MainLayout.jsx';

function App() {
    return(
        <>
            <Routes>
                <Route element={<CustomNav li={[
                    ["Home", "home"],
                    ["About Us", "about"],
                    ["Services", "services"],
                    ["Common Electrical Problem", "FAQ"]
                ]} />}>
                    <Route path="/" element={<Navigate to="/home" replace />} />

                    {/* 2. Your existing routes */}
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