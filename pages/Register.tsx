import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  User as UserIcon,
  Mail,
  Lock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  signInWithPopup,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { NotesBazaarLogo } from '../components/NotesBazaarLogo';
import { loginWithAppScriptEmail } from '../utils/appScriptService';

const Register: React.FC = () => {
  const [authTab, setAuthTab] = useState<'password' | 'sheets'>('password');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        setEmail(result.user.email || '');
        setSuccess(true);
        setTimeout(() => {
          window.location.hash = '#/dashboard';
        }, 900);
      }
    } catch (err: any) {
      setError(err?.message || 'Google sign-up cancelled.');
      setGoogleLoading(false);
    }
  };

  const handlePasswordRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    if (!cleanName || cleanName.length < 2) {
      setError('Please enter your full name.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      if (cred.user) {
        await updateProfile(cred.user, { displayName: cleanName });
        try {
          await sendEmailVerification(cred.user);
          setVerificationSent(true);
        } catch {
          // Non-fatal if verification email throttled
        }
        setSuccess(true);
        setTimeout(() => {
          window.location.hash = '#/dashboard';
        }, 1200);
      }
    } catch (err: any) {
      if (err?.code === 'auth/operation-not-allowed') {
        setError(
          'Email/Password registration is not yet enabled in Firebase Console (Authentication → Sign-in method → Email/Password). Use "Sign Up with Google" or "Quick Email / Sheets" below.'
        );
      } else if (err?.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Try signing in instead.');
      } else {
        setError(err?.message || 'Registration failed.');
      }
      setLoading(false);
    }
  };

  const handleQuickSheetsRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please provide a valid student email address.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await loginWithAppScriptEmail(email, name);
      if (res.success && res.user) {
        setSuccess(true);
        setTimeout(() => {
          window.location.hash = '#/dashboard';
          window.location.reload();
        }, 1000);
      } else {
        setError(res.message || 'Failed to complete registration.');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check network.');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[36px] p-10 text-center shadow-2xl border border-slate-100 dark:border-slate-800 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-700 via-teal-600 to-emerald-500" />

          <div className="w-16 h-16 bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner rotate-3">
            <CheckCircle2 size={36} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 font-heading">Welcome to NotesBazaar!</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-4 leading-relaxed">
            Your student profile for <span className="font-bold text-slate-900 dark:text-white">{email}</span> is ready and synced to your dashboard.
          </p>
          {verificationSent && (
            <p className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl p-3 mb-5 border border-emerald-200 dark:border-emerald-900">
              We have sent a verification link to your inbox. Please confirm your email address.
            </p>
          )}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-950 rounded-xl text-xs font-bold text-teal-700 dark:text-teal-400 border border-slate-100 dark:border-slate-800">
            <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
            <span>Opening your student dashboard...</span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[88vh] flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[36px] p-8 sm:p-10 shadow-2xl shadow-slate-900/5 dark:shadow-none border border-slate-100 dark:border-slate-800 relative overflow-hidden transition-colors"
      >
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-700 via-teal-600 to-emerald-500" />

        <div className="text-center mb-6 relative z-10">
          <Link to="/" className="inline-flex items-center justify-center mb-4 group">
            <NotesBazaarLogo
              variant="seal"
              size={64}
              className="drop-shadow-md group-hover:scale-105 transition-transform duration-300"
            />
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-heading">
            Create Student Account
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5 font-medium">
            Your Study Partner for Instant Exam PDFs &amp; Revision
          </p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 px-4 py-3 rounded-2xl text-xs font-semibold flex items-start gap-2 border border-rose-100 dark:border-rose-900"
          >
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}

        <div className="space-y-4 relative z-10 mb-3">
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={googleLoading || loading}
            className="w-full py-3.5 px-5 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60"
          >
            {googleLoading ? (
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z" />
                <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z" />
              </svg>
            )}
            <span>{googleLoading ? 'Creating Account...' : 'Sign Up with Google'}</span>
          </button>

          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200/70 dark:border-slate-800">
            <button
              type="button"
              onClick={() => { setAuthTab('password'); setError(null); }}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                authTab === 'password'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Email &amp; Password
            </button>
            <button
              type="button"
              onClick={() => { setAuthTab('sheets'); setError(null); }}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                authTab === 'sheets'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Quick Email / Sheets
            </button>
          </div>
        </div>

        <form
          className="space-y-4 relative z-10"
          onSubmit={authTab === 'password' ? handlePasswordRegister : handleQuickSheetsRegister}
        >
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">
              Your Full Name
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50/80 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900 rounded-2xl px-5 py-3.5 pl-11 focus:outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-600 transition-all text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400"
                placeholder="e.g. Rahul Sharma"
              />
              <UserIcon className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">
              Student Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50/80 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900 rounded-2xl px-5 py-3.5 pl-11 focus:outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-600 transition-all text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400"
                placeholder="aspirant@exam.com"
              />
              <Mail className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
            </div>
          </div>

          {authTab === 'password' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">
                Create Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50/80 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900 rounded-2xl px-5 py-3.5 pl-11 focus:outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-600 transition-all text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400"
                  placeholder="Min. 6 characters"
                />
                <Lock className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
              </div>
            </div>
          )}

          <div className="pt-1">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                required
                className="mt-1 rounded border-slate-300 dark:border-slate-700 text-teal-600 focus:ring-teal-600 cursor-pointer"
              />
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                I agree to the{' '}
                <Link to="/terms" className="text-teal-700 dark:text-teal-400 font-bold hover:underline">
                  Terms
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-teal-700 dark:text-teal-400 font-bold hover:underline">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full py-3.5 bg-gradient-to-r from-blue-700 via-teal-600 to-emerald-600 hover:opacity-95 text-white rounded-2xl font-bold text-sm shadow-xl shadow-teal-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 mt-2"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Creating Student Profile...</span>
              </div>
            ) : (
              <>
                <span>Create Free Account</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2.5 pt-5 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Already have an account?{' '}
            <Link to="/login" className="text-teal-700 dark:text-teal-400 font-bold hover:underline">
              Sign In
            </Link>
          </p>
          <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            <ShieldCheck size={13} className="text-teal-600 dark:text-teal-400" />
            <span>Encrypted Registration · Instant Study Vault</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;
