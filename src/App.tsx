import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { StoreProvider } from './context/StoreContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { ToastContainer } from './components/ToastContainer';
import { HomePage } from './pages/HomePage';

const ShopPage = lazy(() => import('./pages/ShopPage').then((m) => ({ default: m.ShopPage })));
const ProductDetailPage = lazy(() =>
  import('./pages/ProductDetailPage').then((m) => ({ default: m.ProductDetailPage }))
);
const RepairPage = lazy(() =>
  import('./pages/RepairPage').then((m) => ({ default: m.RepairPage }))
);
const ContactPage = lazy(() =>
  import('./pages/ContactPage').then((m) => ({ default: m.ContactPage }))
);
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));

function PageFallback({ dark = false }: { dark?: boolean }) {
  return (
    <div
      className={`min-h-[60vh] flex items-center justify-center ${
        dark ? 'bg-[#0B0B0C] text-[#C5A46D] min-h-screen' : 'bg-[#F5F2EB] text-[#85693A]'
      }`}
    >
      <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

function StorefrontLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F2EB] text-[#0A0A0B]">
      <Navbar />
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname + location.search}
            initial={{ opacity: 0.92 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0.92 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
      <CartDrawer />
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <StoreProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route element={<StorefrontLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/boutique" element={<ShopPage />} />
              <Route path="/produit/:slug" element={<ProductDetailPage />} />
              <Route path="/reparation" element={<RepairPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="*" element={<HomePage />} />
            </Route>
            <Route
              path="/admin"
              element={
                <Suspense fallback={<PageFallback dark />}>
                  <AdminPage />
                </Suspense>
              }
            />
            <Route
              path="/admin/*"
              element={
                <Suspense fallback={<PageFallback dark />}>
                  <AdminPage />
                </Suspense>
              }
            />
          </Routes>
          <ToastContainer />
        </BrowserRouter>
      </StoreProvider>
    </MotionConfig>
  );
}
