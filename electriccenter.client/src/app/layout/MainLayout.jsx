import { Outlet } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar.jsx';
import Footer from '../../components/layout/Footer.jsx';
import { useRouteSeo } from '../../seo/useSeo.js';

function MainLayout() {
    useRouteSeo(); // title, description and canonical link for the current page (dynamic pages set their own)

    return (
        <>
            <Navbar />
            <main style={{ flex: 1 }}>
                <Outlet />
            </main>
            <Footer />
        </>
    );
}

export default MainLayout;
