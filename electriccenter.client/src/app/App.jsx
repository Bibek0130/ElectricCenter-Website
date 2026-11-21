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
import { ROLES } from '../features/auth/context.js';
import { SettingsProvider } from '../features/settings/SettingsProvider.jsx';
import SettingsPage from '../features/settings/pages/SettingsPage.jsx';
import ArticlesPage from '../features/articles/pages/ArticlesPage.jsx';
import ArticlePage from '../features/articles/pages/ArticlePage.jsx';
import ArticleEditorPage from '../features/articles/pages/ArticleEditorPage.jsx';
import NotFoundPage from '../features/notfound/NotFoundPage.jsx';

function App() {
    return (
        <AuthProvider>
            <SettingsProvider>
                <CartProvider>
                    <Toaster position="bottom-center" toastOptions={{ duration: 3000 }} />
                    <Routes>
                        <Route element={<MainLayout />}>
                            {/* The home page is "/". /home used to show it too; the server redirects it (301) and so does this. */}
                            <Route path="/" element={<LandingPage />} />
                            <Route path="/home" element={<Navigate to="/" replace />} />
                            <Route path="/electricians" element={<ElectriciansPage />} />
                            <Route path="/electricians/:electricianId" element={<ElectricianProfilePage />} />
                            {/* Checkout stays open to guests; booking an electrician requires login (see ElectricianProfilePage). */}
                            <Route path="/products" element={<ProductsPage />} />
                            <Route path="/products/checkout" element={<CheckoutPage />} />
                            <Route path="/products/confirmation" element={<ConfirmationPage />} />
                            <Route path="/about" element={<AboutPage />} />
                            <Route path="/services" element={<ServicesPage />} />
                            <Route path="/faq" element={<FaqPage />} />
                            <Route path="/articles" element={<ArticlesPage />} />
                            <Route path="/articles/:slug" element={<ArticlePage />} />
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/register" element={<RegisterPage />} />
                            <Route path="/verify-email" element={<VerifyEmailPage />} />
                            <Route element={<ProtectedRoute />}>
                                <Route path="/account" element={<AccountPage />} />
                            </Route>
                            {/* Admin-only: a UX guard. PUT /api/settings enforces the Admin role itself. */}
                            <Route element={<ProtectedRoute roles={[ROLES.Admin]} />}>
                                <Route path="/settings" element={<SettingsPage />} />
                            </Route>
                            {/* Admin-only: a UX guard. The /api/admin/articles endpoints enforce the Admin role themselves. */}
                            <Route element={<ProtectedRoute roles={[ROLES.Admin]} />}>
                                <Route path="/admin/articles/new" element={<ArticleEditorPage />} />
                                <Route path="/admin/articles/:articleId/edit" element={<ArticleEditorPage />} />
                            </Route>
                            <Route path="*" element={<NotFoundPage />} />
                        </Route>
                    </Routes>
                </CartProvider>
            </SettingsProvider>
        </AuthProvider>
    );
}

export default App;
