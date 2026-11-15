
import React, { useState, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { User } from '../types';
import { 
  Home, 
  BookOpen, 
  CreditCard, 
  User as UserIcon, 
  Menu, 
  X, 
  Search, 
  ShoppingBag,
  LayoutDashboard,
  ShieldCheck,
  LogOut,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

import { NotesBazaarLogo } from './NotesBazaarLogo';

interface NavbarProps {
  user: User | null;
}

const Navbar: React.FC<NavbarProps> = ({ user }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (e) {
      console.warn("Storage item read failed:", e);
    }
    try {
      if (window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
    } catch (e) {
      console.warn("matchMedia read failed:", e);
    }
    return 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {
      console.warn("Storage item write failed:", e);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    try {
      const { saveSessionUser } = await import('../utils/appScriptService');
      saveSessionUser(null);
    } catch (e) {}
    try {
      await signOut(auth);
    } catch (e) {}
    window.location.hash = '#/';
    window.location.reload();
  };

  const navLinks = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'All Products', path: '/shop', icon: BookOpen },
    { name: 'Membership', path: '/membership', icon: CreditCard },
    { name: 'About', path: '/about', icon: ShieldCheck },
    { name: 'Contact', path: '/contact', icon: UserIcon },
  ];

  return (
    <>
      {/* Top Navbar */}
      <nav 
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-sm border-b border-slate-100/80 dark:border-slate-800/80 py-3'
            : 'bg-transparent py-4'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center gap-4">
            {/* Brand Logo Lockup */}
            <Link to="/" className="flex items-center gap-2.5 group shrink-0">
              <NotesBazaarLogo
                variant="mark"
                size={42}
                className="drop-shadow-sm group-hover:scale-105 transition-transform duration-300"
              />
              <span className="text-xl font-bold font-heading text-slate-900 dark:text-white tracking-tight whitespace-nowrap shrink-0">
                Notes<span className="text-primary">Bazaar</span>
              </span>
            </Link>

            {/* Desktop Center Nav */}
            <div className="hidden md:flex items-center gap-6 lg:gap-7">
              {navLinks.map((link) => (
                <NavLink 
                  key={link.path}
                  to={link.path} 
                  className={({isActive}) => `text-sm font-semibold transition-colors whitespace-nowrap shrink-0 relative py-1 ${
                    isActive
                      ? 'text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:rounded-full'
                      : 'text-slate-600 dark:text-slate-300 hover:text-primary'
                  }`}
                >
                  {link.name}
                </NavLink>
              ))}
            </div>

            {/* Desktop Right Actions */}
            <div className="hidden md:flex items-center gap-3 shrink-0">
              <button 
                onClick={toggleTheme}
                className="p-2.5 text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-amber-400 hover:bg-slate-100/80 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                aria-label="Toggle color theme"
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              {user ? (
                <div className="flex items-center gap-3 pl-2 border-l border-slate-200 dark:border-slate-800">
                  <Link 
                    to={user.role === 'admin' ? "/admin" : "/dashboard"} 
                    className="flex items-center gap-2.5 group whitespace-nowrap shrink-0"
                  >
                    <div className="text-right hidden lg:block">
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-200 leading-tight">{user.displayName}</p>
                      <p className="text-[10px] text-primary font-bold uppercase tracking-wider">{user.role}</p>
                    </div>
                    <div className="w-9 h-9 bg-gradient-to-br from-blue-700 to-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
                      {user.displayName.charAt(0).toUpperCase()}
                    </div>
                  </Link>
                  <button 
                    onClick={handleLogout}
                    className="p-2 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors cursor-pointer"
                    title="Logout"
                    aria-label="Sign out"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 pl-2 border-l border-slate-200 dark:border-slate-800">
                  <Link to="/login" className="text-slate-600 dark:text-slate-300 font-semibold text-sm hover:text-primary px-3 py-2 whitespace-nowrap shrink-0">
                    Login
                  </Link>
                  <Link to="/shop" className="bg-gradient-to-r from-blue-700 to-emerald-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:shadow-lg hover:shadow-teal-600/20 transition-all whitespace-nowrap shrink-0">
                    Explore Notes
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <div className="flex md:hidden items-center gap-2">
              <button 
                onClick={toggleTheme}
                className="p-2 text-slate-500 dark:text-slate-400 rounded-lg"
                aria-label="Toggle color theme"
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)} 
                className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                aria-label="Open menu"
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Sidebar Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMenuOpen(false)}
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
              />
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 bottom-0 w-72 max-w-[85vw] bg-white dark:bg-slate-900 z-50 md:hidden shadow-2xl p-6 flex flex-col overflow-y-auto"
              >
                <div className="flex justify-between items-center mb-6">
                  <span className="font-heading font-bold text-xl text-slate-900 dark:text-white">Menu</span>
                  <button onClick={() => setIsMenuOpen(false)} aria-label="Close menu" className="p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"><X size={20} strokeWidth={1.5} /></button>
                </div>

                <div className="space-y-3 flex-grow">
                  {navLinks.map((link) => (
                    <Link 
                      key={link.path}
                      to={link.path} 
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium transition-all hover:pl-4 group"
                    >
                      <link.icon size={20} strokeWidth={1.5} className="text-slate-400 group-hover:text-primary transition-colors" />
                      {link.name}
                    </Link>
                  ))}
                  {user && (
                    <Link 
                      to={user.role === 'admin' ? "/admin" : "/dashboard"} 
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium transition-all hover:pl-4 group"
                    >
                      {user.role === 'admin' ? <ShieldCheck size={20} strokeWidth={1.5} className="text-slate-400 group-hover:text-primary transition-colors" /> : <LayoutDashboard size={20} strokeWidth={1.5} className="text-slate-400 group-hover:text-primary transition-colors" />}
                      Dashboard
                    </Link>
                  )}
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                  {user ? (
                    <button 
                      onClick={handleLogout}
                      className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-bold"
                    >
                      <LogOut size={18} />
                      Logout
                    </button>
                  ) : (
                    <div className="grid gap-3">
                      <Link to="/login" onClick={() => setIsMenuOpen(false)} className="w-full py-3 text-center text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-xl">Login</Link>
                      <Link to="/register" onClick={() => setIsMenuOpen(false)} className="w-full py-3 text-center bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium rounded-xl shadow-lg">Get Started</Link>
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </nav>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-t border-slate-100 dark:border-slate-800 px-4 sm:px-6 py-2 flex justify-between items-center pb-safe shadow-[0_-10px_25px_rgba(0,0,0,0.03)]">
        <NavLink to="/" className={({isActive}) => `mobile-nav-item dark:text-slate-300 ${isActive ? 'active' : ''}`}>
          {({isActive}) => (
            <>
              <Home size={22} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className={`text-[10px] font-bold uppercase tracking-tighter ${isActive ? 'opacity-100' : 'opacity-60'}`}>Home</span>
              {isActive && <motion.div layoutId="nav-indicator" className="absolute -bottom-2 w-1 h-1 bg-primary rounded-full" />}
            </>
          )}
        </NavLink>
        <NavLink to="/shop" className={({isActive}) => `mobile-nav-item dark:text-slate-300 ${isActive ? 'active' : ''}`}>
          {({isActive}) => (
            <>
              <BookOpen size={22} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className={`text-[10px] font-bold uppercase tracking-tighter ${isActive ? 'opacity-100' : 'opacity-60'}`}>Library</span>
              {isActive && <motion.div layoutId="nav-indicator" className="absolute -bottom-2 w-1 h-1 bg-primary rounded-full" />}
            </>
          )}
        </NavLink>
        <NavLink to="/membership" className={({isActive}) => `mobile-nav-item dark:text-slate-300 ${isActive ? 'active' : ''}`}>
          {({isActive}) => (
            <>
              <CreditCard size={22} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className={`text-[10px] font-bold uppercase tracking-tighter ${isActive ? 'opacity-100' : 'opacity-60'}`}>Plans</span>
              {isActive && <motion.div layoutId="nav-indicator" className="absolute -bottom-2 w-1 h-1 bg-primary rounded-full" />}
            </>
          )}
        </NavLink>
        <NavLink to={user ? (user.role === 'admin' ? "/admin" : "/dashboard") : "/login"} className={({isActive}) => `mobile-nav-item dark:text-slate-300 ${isActive ? 'active' : ''}`}>
          {({isActive}) => (
            <>
              <UserIcon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className={`text-[10px] font-bold uppercase tracking-tighter ${isActive ? 'opacity-100' : 'opacity-60'}`}>Profile</span>
              {isActive && <motion.div layoutId="nav-indicator" className="absolute -bottom-2 w-1 h-1 bg-primary rounded-full" />}
            </>
          )}
        </NavLink>
      </div>
    </>
  );
};

export default Navbar;
