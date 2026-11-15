import React, { useState, useEffect, useRef, Suspense, lazy, Component, ErrorInfo, ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import PurchaseToast from './components/PurchaseToast';
import { CampaignCountdownBanner, WhatsAppSupportButton } from './components/CampaignSupport';
import { NotesBazaarLogo } from './components/NotesBazaarLogo';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import { User, ExamType } from './types';
import { BUILTIN_CATALOG_NOTES, getSessionUser, saveSessionUser } from './utils/appScriptService';
import { isFounderEmail } from './utils/security';
import { applySeoMetadata, getRouteSeo } from './utils/seo';
import { motion, useScroll, useSpring, AnimatePresence } from 'motion/react';
import { ArrowUp } from 'lucide-react';

// Code-split secondary & portal routes for fast initial load
const Shop = lazy(() => import('./pages/Shop'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const Membership = lazy(() => import('./pages/Membership'));
const ThankYou = lazy(() => import('./pages/ThankYou'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const NotFound = lazy(() => import('./pages/NotFound'));

interface ErrorBoundaryProps {
  children: ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('NotesBazaar captured render error:', error, errorInfo);
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#FAFBFD] dark:bg-slate-950 p-6 text-center transition-colors">
          <div className="max-w-md bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800">
            <div className="flex justify-center mb-4">
              <NotesBazaarLogo variant="seal" size={64} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Display Reset</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              A temporary display glitch occurred. Tap below to reload NotesBazaar smoothly.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.hash = '#/';
                window.location.reload();
              }}
              className="w-full py-3 bg-primary hover:bg-primary-dark text-white font-semibold rounded-xl transition-all shadow-md active:scale-[0.98] cursor-pointer"
            >
              Reload NotesBazaar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const ScrollToTopAndSeo = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    applySeoMetadata(getRouteSeo(pathname));
  }, [pathname]);
  return null;
};

const ScrollProgressAndTopBtn: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 180, damping: 28, restDelta: 0.001 });
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 420);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <motion.div
        style={{ scaleX }}
        className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500 origin-left z-[60] pointer-events-none"
      />
      <AnimatePresence>
        {showTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.85, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 12 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Back to top"
            className="fixed bottom-24 md:bottom-7 right-4 sm:right-6 z-40 w-11 h-11 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white border border-slate-700/70 shadow-xl hover:bg-primary hover:border-primary flex items-center justify-center transition-colors cursor-pointer"
          >
            <ArrowUp size={18} />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
};

const RouteFallbackSpinner = () => (
  <div className="min-h-[55vh] flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    try {
      const sessionUser = getSessionUser();
      if (sessionUser && mountedRef.current) {
        setUser(sessionUser);
        setAuthChecking(false);
      }
    } catch {}

    const failsafeTimer = setTimeout(() => {
      if (mountedRef.current) {
        setAuthChecking(false);
      }
    }, 1000);

    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser && mountedRef.current) {
          await mapFirebaseUserToAppUser(firebaseUser);
        } else if (mountedRef.current) {
          const su = getSessionUser();
          setUser(su || null);
          setAuthChecking(false);
        }
      });
    } catch (e) {
      console.warn('Auth state listener initialization warning:', e);
      setAuthChecking(false);
    }

    return () => {
      mountedRef.current = false;
      clearTimeout(failsafeTimer);
      unsubscribe();
    };
  }, []);

  const seedInitialDataForFounder = async () => {
    try {
      const productsRef = collection(db, 'products');
      const snapshot = await getDocs(productsRef);
      if (snapshot.empty) {
        for (const item of BUILTIN_CATALOG_NOTES) {
          await setDoc(doc(db, 'products', item.id), {
            id: item.id,
            title: item.title,
            category: item.category,
            exam_type: item.examType || ExamType.SSC,
            description: item.description,
            price: item.price,
            original_price: item.originalPrice || item.price * 2,
            preview_images: item.previewImages || [],
            file_url: item.fileUrl || '',
            pages_count: item.pagesCount || '',
            updated_label: item.updatedLabel || '',
            exam_suitability: item.examSuitability || [],
            key_topics: item.keyTopics || [],
            is_enabled: item.isEnabled !== false,
            download_limit: item.downloadLimit || 10,
            rating: item.rating || 0,
            reviews_count: item.reviewsCount || 0,
            is_bestseller: Boolean(item.isBestseller),
            students_bought: item.studentsBought || '0',
            created_at: new Date().toISOString(),
          });
        }
      }
    } catch {}
  };

  const mapFirebaseUserToAppUser = async (fbUser: any) => {
    try {
      const userDocRef = doc(db, 'users', fbUser.uid);
      const userDoc = await getDoc(userDocRef);
      const userData = userDoc.exists() ? userDoc.data() : {};

      let purchasedIds: string[] = Array.isArray(userData.purchasedNotes) ? userData.purchasedNotes : [];
      try {
        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, where('user_email', '==', fbUser.email));
        const orderSnapshot = await getDocs(q);
        const orderProductIds = orderSnapshot.docs
          .filter((d) => d.data().status === 'paid')
          .map((d) => d.data().product_id)
          .filter(Boolean);
        purchasedIds = Array.from(new Set([...purchasedIds, ...orderProductIds]));
      } catch {}

      const founder = isFounderEmail(fbUser.email);
      const role: 'admin' | 'user' = founder || userData.role === 'admin' ? 'admin' : 'user';

      const appUser: User = {
        uid: fbUser.uid,
        email: fbUser.email || '',
        displayName: userData.displayName || fbUser.displayName || fbUser.email?.split('@')[0] || 'Aspirant',
        role,
        status: userData.status || 'active',
        emailVerified: Boolean(fbUser.emailVerified),
        purchasedNotes: purchasedIds,
        membershipType: userData.membershipType || 'none',
        membershipExpiry: userData.membershipExpiry,
        referralCode: userData.referralCode || `NB-${fbUser.uid.substring(0, 6).toUpperCase()}`,
      };

      if (!userDoc.exists()) {
        try {
          await setDoc(userDocRef, {
            uid: appUser.uid,
            email: appUser.email,
            displayName: appUser.displayName,
            role: founder ? 'admin' : 'user',
            status: 'active',
            emailVerified: appUser.emailVerified,
            purchasedNotes: appUser.purchasedNotes,
            membershipType: appUser.membershipType,
            referralCode: appUser.referralCode,
            createdAt: new Date().toISOString(),
          });
        } catch (createErr) {
          console.warn('User profile sync note:', createErr);
        }
      }

      if (founder) {
        try {
          await setDoc(
            doc(db, 'admins', fbUser.uid),
            {
              uid: fbUser.uid,
              email: appUser.email,
              grantedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch {}
        seedInitialDataForFounder();
      }

      saveSessionUser(appUser);
      if (mountedRef.current) {
        setUser(appUser);
        setAuthChecking(false);
      }
    } catch (error) {
      console.warn('User auth resolution finished with fallback:', error);
      if (mountedRef.current) setAuthChecking(false);
    }
  };

  return (
    <ErrorBoundary>
      <HashRouter>
        <ScrollToTopAndSeo />
        <ScrollProgressAndTopBtn />
        <div className="flex flex-col min-h-screen">
          <CampaignCountdownBanner />
          <Navbar user={user} />
          <main className="flex-grow pb-20 md:pb-0">
            <Suspense fallback={<RouteFallbackSpinner />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/membership" element={<Membership />} />
                <Route path="/product/:id" element={<ProductDetail user={user} />} />
                <Route path="/thank-you" element={<ThankYou />} />
                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />

                <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
                <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />
                <Route path="/admin-login" element={<AdminLogin user={user} />} />

                <Route
                  path="/dashboard"
                  element={
                    authChecking ? (
                      <RouteFallbackSpinner />
                    ) : user ? (
                      <Dashboard user={user} />
                    ) : (
                      <Navigate to="/login" />
                    )
                  }
                />
                <Route
                  path="/admin/*"
                  element={
                    authChecking ? (
                      <RouteFallbackSpinner />
                    ) : user?.role === 'admin' ? (
                      <AdminDashboard user={user} />
                    ) : (
                      <Navigate to="/admin-login" />
                    )
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </main>
          <PurchaseToast />
          <WhatsAppSupportButton />
          <Footer />
        </div>
      </HashRouter>
    </ErrorBoundary>
  );
};

export default App;
