import React, { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import PurchaseToast from './components/PurchaseToast';
import { NotesBazaarLogo } from './components/NotesBazaarLogo';
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetail from './pages/ProductDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';
import Membership from './pages/Membership';
import ThankYou from './pages/ThankYou';
import About from './pages/About';
import Contact from './pages/Contact';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import { User, ExamType, SiteSettings } from './types';
import { BUILTIN_CATALOG_NOTES, getSessionUser, saveSessionUser } from './utils/appScriptService';
import { isFounderEmail } from './utils/security';
import { motion, useScroll, useSpring, AnimatePresence } from 'motion/react';
import { ArrowUp, X, Sparkles } from 'lucide-react';

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

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'main'));
        if (snap.exists() && mountedRef.current) {
          setSiteSettings(snap.data() as SiteSettings);
        }
      } catch (e) {}
    };
    loadSettings();
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // 1. Check session user first for fast initial render
    try {
      const sessionUser = getSessionUser();
      if (sessionUser && mountedRef.current) {
        setUser(sessionUser);
        setAuthChecking(false);
      }
    } catch (sErr) {}

    // 2. Safety timeout: ensure routes stay responsive
    const failsafeTimer = setTimeout(() => {
      if (mountedRef.current) {
        setAuthChecking(false);
      }
    }, 1000);

    // 3. Firebase Auth Listener
    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser && mountedRef.current) {
          await mapFirebaseUserToAppUser(firebaseUser);
        } else if (mountedRef.current) {
          const su = getSessionUser();
          if (su) {
            setUser(su);
          } else {
            setUser(null);
          }
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
            file_url: item.fileUrl || '#',
            rating: item.rating || 4.9,
            reviews_count: item.reviewsCount || 120,
            is_bestseller: Boolean(item.isBestseller),
            students_bought: item.studentsBought || '500',
            created_at: new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      // Non-blocking: admin can also trigger live sync inside AdminDashboard
    }
  };

  const mapFirebaseUserToAppUser = async (fbUser: any) => {
    try {
      const userDocRef = doc(db, 'users', fbUser.uid);
      const userDoc = await getDoc(userDocRef);
      const userData = userDoc.exists() ? userDoc.data() : {};

      // Fetch purchased notes from live Firestore 'orders'
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
      } catch (e) {
        // Order lookup fallback silently handled via local session
      }

      const founder = isFounderEmail(fbUser.email);
      const role: 'admin' | 'user' = founder || userData.role === 'admin' ? 'admin' : 'user';

      const appUser: User = {
        uid: fbUser.uid,
        email: fbUser.email || '',
        displayName: userData.displayName || fbUser.displayName || fbUser.email?.split('@')[0] || 'Aspirant',
        role,
        purchasedNotes: purchasedIds,
        membershipType: userData.membershipType || 'none',
        membershipExpiry: userData.membershipExpiry,
        referralCode: userData.referralCode || `NB-${fbUser.uid.substring(0, 6).toUpperCase()}`,
      };

      // Create compliant Firestore user document if missing (strictly includes uid & purchasedNotes)
      if (!userDoc.exists()) {
        try {
          await setDoc(userDocRef, {
            uid: appUser.uid,
            email: appUser.email,
            displayName: appUser.displayName,
            role: founder ? 'admin' : 'user',
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
        } catch (e) {}
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
        <ScrollToTop />
        <ScrollProgressAndTopBtn />
        <div className="flex flex-col min-h-screen">
          {siteSettings?.announcement_enabled && siteSettings?.announcement_text && !announcementDismissed && (
            <div className="bg-gradient-to-r from-blue-800 via-teal-700 to-emerald-700 text-white text-xs font-bold px-4 py-2 flex items-center justify-center gap-3 relative z-50">
              <Sparkles size={13} className="shrink-0 text-amber-300" />
              <span className="truncate">{siteSettings.announcement_text}</span>
              <button
                onClick={() => setAnnouncementDismissed(true)}
                aria-label="Dismiss announcement"
                className="text-white/75 hover:text-white cursor-pointer shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <Navbar user={user} />
          <main className="flex-grow pb-20 md:pb-0">
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
                    <div className="min-h-[50vh] flex items-center justify-center">
                      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
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
                    <div className="min-h-[50vh] flex items-center justify-center">
                      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : user?.role === 'admin' ? (
                    <AdminDashboard user={user} />
                  ) : (
                    <Navigate to="/admin-login" />
                  )
                }
              />
            </Routes>
          </main>
          <PurchaseToast />
          <Footer />
        </div>
      </HashRouter>
    </ErrorBoundary>
  );
};

export default App;
