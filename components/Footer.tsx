import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Send, Mail, Shield, CheckCircle2, BookOpen, MessageSquare } from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { SiteSettings } from '../types';
import { NotesBazaarLogo } from './NotesBazaarLogo';

const Footer: React.FC = () => {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'main');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data() as SiteSettings);
        }
      } catch (e) {
        console.warn("Could not load settings in Footer:", e);
      }
    };
    fetchSettings();
  }, []);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim() || !newsletterEmail.includes('@')) return;
    try {
      localStorage.setItem('notesbazaar_newsletter_email', newsletterEmail.trim());
    } catch (err) {}
    setSubscribed(true);
    setNewsletterEmail('');
    setTimeout(() => setSubscribed(false), 4000);
  };

  return (
    <footer className="bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 pt-16 pb-24 md:pb-12 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-14">
          {/* Brand */}
          <div className="space-y-5">
            <Link to="/" className="flex items-center gap-3 group">
              <NotesBazaarLogo
                variant="seal"
                size={54}
                className="drop-shadow-sm group-hover:scale-105 transition-transform duration-300 shrink-0"
              />
              <div>
                <span className="text-xl font-bold font-heading text-slate-900 dark:text-white block leading-tight">
                  Notes<span className="text-primary">Bazaar</span>
                </span>
                <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">
                  Your Study Partner
                </span>
              </div>
            </Link>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-sm">
              {settings?.brand_tagline ||
                'Your one-stop destination for concise, exam-oriented handwritten notes for SSC, Banking, UPSC, and Government Exams.'}
            </p>
            <div className="flex items-center gap-3">
              <Link
                to="/shop"
                className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-primary hover:text-white transition-all flex items-center gap-1.5"
              >
                <BookOpen size={14} /> Library
              </Link>
              <Link
                to="/contact"
                className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-primary hover:text-white transition-all flex items-center gap-1.5"
              >
                <MessageSquare size={14} /> Support
              </Link>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-bold mb-5 text-slate-900 dark:text-white uppercase text-xs tracking-widest">Company</h4>
            <ul className="space-y-3.5 text-sm font-medium text-slate-500 dark:text-slate-400">
              <li><Link to="/about" className="hover:text-primary transition-colors">About Our Mission</Link></li>
              <li><Link to="/contact" className="hover:text-primary transition-colors">Contact Support</Link></li>
              <li><Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link></li>
              <li><Link to="/admin-login" className="hover:text-primary transition-colors">Admin Portal Login</Link></li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4 className="font-bold mb-5 text-slate-900 dark:text-white uppercase text-xs tracking-widest">Exam Hubs</h4>
            <ul className="space-y-3.5 text-sm font-medium text-slate-500 dark:text-slate-400">
              <li><Link to="/shop?exam=SSC" className="hover:text-primary transition-colors">SSC CGL &amp; CHSL</Link></li>
              <li><Link to="/shop?exam=Banking" className="hover:text-primary transition-colors">Banking &amp; IBPS</Link></li>
              <li><Link to="/shop?exam=UPSC" className="hover:text-primary transition-colors">UPSC Civil Services</Link></li>
              <li><Link to="/shop?exam=Railways" className="hover:text-primary transition-colors">Railways RRB</Link></li>
            </ul>
          </div>

          {/* Newsletter */}
          <div className="space-y-4">
            <h4 className="font-bold text-slate-900 dark:text-white uppercase text-xs tracking-widest">Exam Alerts</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Get topper strategies, free GK capsules, and syllabus updates directly in your inbox.
            </p>
            <form onSubmit={handleSubscribe} className="relative">
              <input
                type="email"
                required
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder="Enter student email"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-4 pr-12 py-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
              <button
                type="submit"
                aria-label="Subscribe to exam alerts"
                className="absolute right-1.5 top-1.5 bg-gradient-to-r from-blue-700 to-emerald-600 text-white p-2 rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
              >
                <Send size={16} />
              </button>
            </form>
            {subscribed && (
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Subscribed! Watch your inbox for topper prep alerts.
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <p>© {new Date().getFullYear()} NotesBazaar. Crack Your Exams With Us!</p>
          <div className="flex flex-wrap items-center gap-6">
            <span className="flex items-center gap-2">
              <Shield size={14} className="text-primary" /> UPI · Cards · Netbanking · Razorpay
            </span>
            <Link to="/contact" className="flex items-center gap-2 hover:text-primary transition-colors">
              <Mail size={14} className="text-primary" /> {settings?.contact_email || 'support@notesbazaar.co'}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
