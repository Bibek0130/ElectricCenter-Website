import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import MainLayout from './layout/MainLayout.jsx';
import LandingPage from '../features/landing/LandingPage.jsx';
import AboutPage from '../features/about/AboutPage.jsx';
import ServicesPage from '../features/services/ServicesPage.jsx';
import FaqPage from '../features/faq/FaqPage.jsx';
import ProductsPage from '../features/products/pages/ProductsPage.jsx';
import CheckoutPage from '../features/products/pages/CheckoutPage.jsx';
import ConfirmationPage from '../features/products/pages/ConfirmationPage.jsx';
import { CartProvider } from '../features/products/cart/CartContext.jsx';
import ElectriciansPage from '../features/electricians/pages/ElectriciansPage.jsx';
import ElectricianProfilePage from '../features/electricians/pages/ElectricianProfilePage.jsx';
import { AuthProvider } from '../features/auth/AuthContext.jsx';
import ProtectedRoute from '../features/auth/components/ProtectedRoute.jsx';
import LoginPage from '../features/auth/pages/LoginPage.jsx';
import RegisterPage from '../features/auth/pages/RegisterPage.jsx';
import AccountPage from '../features/auth/pages/AccountPage.jsx';
import VerifyEmailPage from '../features/auth/pages/VerifyEmailPage.jsx';

function App() {
    return (
        <AuthProvider>
            <CartProvider>
                <Toaster position="bottom-center" toastOptions={{ duration: 3000 }} />
                <Routes>
                    <Route element={<MainLayout />}>
                        <Route path="/" element={<Navigate to="/home" replace />} />
                        <Route path="/home" element={<LandingPage />} />
                        <Route path="/electricians" element={<ElectriciansPage />} />
                        <Route path="/electricians/:electricianId" element={<ElectricianProfilePage />} />
                        {/* Checkout stays open to guests; booking an electrician requires login (see ElectricianProfilePage). */}
                        <Route path="/products" element={<ProductsPage />} />
                        <Route path="/products/checkout" element={<CheckoutPage />} />
                        <Route path="/products/confirmation" element={<ConfirmationPage />} />
                        <Route path="/about" element={<AboutPage />} />
                        <Route path="/services" element={<ServicesPage />} />
                        <Route path="/faq" element={<FaqPage />} />
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/register" element={<RegisterPage />} />
                        <Route path="/verify-email" element={<VerifyEmailPage />} />
                        <Route element={<ProtectedRoute />}>
                            <Route path="/account" element={<AccountPage />} />
                        </Route>
                        <Route path="*" element={<Navigate to="/home" replace />} />
                    </Route>
                </Routes>
            </CartProvider>
        </AuthProvider>
    );
}

export default App;
