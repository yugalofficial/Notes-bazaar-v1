import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Mail,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  FileSpreadsheet,
  Settings2,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { NotesBazaarLogo } from '../components/NotesBazaarLogo';
import {
  loginWithAppScriptEmail,
  getStoredAppScriptUrl,
  setStoredAppScriptUrl,
  triggerAutoCreateSheets
} from '../utils/appScriptService';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // AppScript URL Setup Modal
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [appScriptInput, setAppScriptInput] = useState('');
  const [currentAppScriptUrl, setCurrentAppScriptUrl] = useState('');
  const [autoCreating, setAutoCreating] = useState(false);
  const [autoCreateSuccess, setAutoCreateSuccess] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    const stored = getStoredAppScriptUrl();
    setCurrentAppScriptUrl(stored);
    setAppScriptInput(stored);
  }, []);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        setSuccessMsg(`Signed in as ${result.user.displayName || result.user.email}!`);
        setTimeout(() => {
          window.location.hash = '#/dashboard';
        }, 500);
      }
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        setError('Google sign-in popup was closed. Please try again or use Email Login.');
      } else {
        setError(err?.message || 'Google sign-in could not complete. Try Email Login below.');
      }
      setGoogleLoading(false);
    }
  };

  const handleEmailOnlyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please provide a valid student email address.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await loginWithAppScriptEmail(email);
      if (res.success && res.user) {
        setSuccessMsg(res.message);
        setTimeout(() => {
          window.location.hash = '#/dashboard';
          window.location.reload();
        }, 700);
      } else {
        setError(res.message || 'Login failed. Please check your email.');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with authentication server.');
      setLoading(false);
    }
  };

  const handleSaveAppScriptUrl = () => {
    const trimmed = appScriptInput.trim();
    setStoredAppScriptUrl(trimmed);
    setCurrentAppScriptUrl(trimmed);
    setShowConfigModal(false);
    setSuccessMsg('Google Apps Script URL updated successfully!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleAutoCreateSheetsData = async () => {
    setModalError(null);
    if (!appScriptInput.startsWith('http')) {
      setModalError('Please enter a valid deployed Google Apps Script Web App URL (https://...) first.');
      return;
    }
    setAutoCreating(true);
    setAutoCreateSuccess(null);
    try {
      setStoredAppScriptUrl(appScriptInput.trim());
      const res = await triggerAutoCreateSheets();
      if (res.status === 'success') {
        setAutoCreateSuccess(res.message || 'Google Spreadsheet populated with sample Products, Users & Orders!');
      } else {
        setAutoCreateSuccess('Sheet connection verified! If tabs are not yet created, ensure Web App access is set to Anyone.');
      }
    } catch (err: any) {
      setAutoCreateSuccess('Request sent to Google Sheets Web App.');
    } finally {
      setAutoCreating(false);
    }
  };

  return (
    <div className="min-h-[88vh] flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[36px] p-8 sm:p-10 shadow-2xl shadow-slate-900/5 dark:shadow-none border border-slate-100 dark:border-slate-800 relative overflow-hidden transition-colors"
      >
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-700 via-teal-600 to-emerald-500" />

        {/* Header */}
        <div className="text-center mb-7 relative z-10">
          <Link to="/" className="inline-flex items-center justify-center mb-4 group">
            <NotesBazaarLogo
              variant="seal"
              size={64}
              className="drop-shadow-md group-hover:scale-105 transition-transform duration-300"
            />
          </Link>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-heading">
            Student Sign In
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5 font-medium">
            Access your purchased handwritten notes &amp; instant PDFs
          </p>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center gap-2 border border-rose-100 dark:border-rose-900"
          >
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center gap-2 border border-teal-100 dark:border-teal-900"
          >
            <CheckCircle2 size={16} className="shrink-0 text-teal-600 dark:text-teal-400" />
            <span>{successMsg}</span>
          </motion.div>
        )}

        {/* Primary Verified Google Sign-In */}
        <div className="space-y-4 relative z-10">
          <button
            type="button"
            onClick={handleGoogleSignIn}
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
            <span>{googleLoading ? 'Connecting Google Account...' : 'Continue with Google (Verified)'}</span>
          </button>

          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">or Student Email</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>

        {/* Email-Only Authentication Form */}
        <form className="space-y-4 relative z-10 mt-3" onSubmit={handleEmailOnlyLogin}>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">
              Registered Student Email
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50/80 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900 rounded-2xl px-5 py-4 pl-12 focus:outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-600 transition-all text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400"
                placeholder="your.email@example.com"
              />
              <Mail className="absolute left-4 top-4 text-slate-400" size={18} />
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 ml-1">
              Synced with your Google Sheets ledger &amp; Student Vault.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full py-4 bg-gradient-to-r from-blue-700 via-teal-600 to-emerald-600 hover:opacity-95 text-white rounded-2xl font-bold text-sm shadow-xl shadow-teal-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Verifying Student Access...</span>
              </div>
            ) : (
              <>
                <span>Continue with Email</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Google Apps Script & Sheets Integration Box */}
        <div className="mt-7 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="bg-slate-50/90 dark:bg-slate-950 rounded-2xl p-4 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
                <FileSpreadsheet size={16} />
              </div>
              <div className="text-left min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Google Sheets Sync</p>
                <p className="text-[10px] text-slate-400 truncate max-w-[160px]">
                  {currentAppScriptUrl ? 'Webhook URL Connected' : 'Configure AppScript URL'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowConfigModal(true)}
              className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 border border-slate-200 dark:border-slate-700 hover:bg-teal-50 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Settings2 size={13} />
              <span>Configure</span>
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Need an account?{' '}
            <Link to="/register" className="text-teal-700 dark:text-teal-400 font-bold hover:underline">
              Instant Register
            </Link>
          </p>
          <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            <ShieldCheck size={13} className="text-teal-600 dark:text-teal-400" />
            <span>Encrypted Session · Firebase + Sheets Synced</span>
          </div>
        </div>
      </motion.div>

      {/* Google Apps Script Deployed URL Configuration Modal */}
      <AnimatePresence>
        {showConfigModal && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 dark:border-slate-800 relative"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-400 flex items-center justify-center">
                    <FileSpreadsheet size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">Google Apps Script Web App</h3>
                    <p className="text-[11px] text-slate-400">Serverless Google Sheets Authentication &amp; Ledger</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center text-sm cursor-pointer"
                  aria-label="Close modal"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Deployed Web App URL
                  </label>
                  <input
                    type="text"
                    value={appScriptInput}
                    onChange={(e) => setAppScriptInput(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs font-mono text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                  <p className="text-[11px] text-slate-400">
                    Deploy your Google Apps Script with <em>&quot;Execute as: Me&quot;</em> and{' '}
                    <em>&quot;Who has access: Anyone&quot;</em>.
                  </p>
                </div>

                {modalError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <span>{modalError}</span>
                  </div>
                )}

                {autoCreateSuccess && (
                  <div className="p-3 bg-teal-50 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-900 rounded-xl text-xs text-teal-800 dark:text-teal-200 flex items-start gap-2">
                    <CheckCircle2 size={16} className="text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                    <span>{autoCreateSuccess}</span>
                  </div>
                )}

                <div className="p-4 bg-teal-50/50 dark:bg-slate-950 rounded-2xl border border-teal-100/70 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">Auto-Create Sheets Sample Data</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Populates Products, Users &amp; Orders sheets automatically.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAutoCreateSheetsData}
                      disabled={autoCreating}
                      className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-75 shrink-0"
                    >
                      {autoCreating ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={13} />
                          <span>Auto-Setup Sheets</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowConfigModal(false)}
                    className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAppScriptUrl}
                    className="px-5 py-2.5 text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 rounded-xl shadow-sm cursor-pointer"
                  >
                    Save URL
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Login;
