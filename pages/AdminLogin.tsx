import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  AlertTriangle,
  ArrowLeft,
  Sparkles,
  LogIn,
  CheckCircle2
} from 'lucide-react';
import { motion } from 'motion/react';
import { auth, db, googleProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc, addDoc, collection } from 'firebase/firestore';
import { User } from '../types';
import { NotesBazaarLogo } from '../components/NotesBazaarLogo';
import { saveSessionUser } from '../utils/appScriptService';
import {
  isFounderEmail,
  getLocalVaultCredential,
  saveLocalVaultCredential,
  hashVaultPasscode,
  generateSaltHex,
  verifyVaultPasscode,
  checkAdminLockout,
  recordFailedAdminAttempt,
  resetAdminLockout,
  unlockAdminVaultSession,
  StoredVaultCredential
} from '../utils/security';

interface AdminLoginProps {
  user: User | null;
}

const AdminLogin: React.FC<AdminLoginProps> = ({ user }) => {
  const navigate = useNavigate();
  const [founderEmail, setFounderEmail] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [vaultCredential, setVaultCredential] = useState<StoredVaultCredential | null>(null);
  const [lockoutState, setLockoutState] = useState(checkAdminLockout());

  useEffect(() => {
    if (user?.role === 'admin') {
      navigate('/admin', { replace: true });
      return;
    }
    const localCred = getLocalVaultCredential();
    setVaultCredential(localCred);
  }, [user, navigate]);

  useEffect(() => {
    if (!lockoutState.locked) return;
    const timer = setInterval(() => {
      const next = checkAdminLockout();
      setLockoutState(next);
      if (!next.locked) {
        setError(null);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutState.locked]);

  const handleGoogleFounderLogin = async () => {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const email = (result.user.email || '').trim().toLowerCase();

      if (!isFounderEmail(email)) {
        await auth.signOut();
        setError(
          `Access Denied: "${email}" is not authorized as a NotesBazaar Founder Administrator. Please sign in on the Student Login page instead.`
        );
        setBusy(false);
        return;
      }

      const uid = result.user.uid;
      await setDoc(
        doc(db, 'admins', uid),
        {
          uid,
          email,
          grantedAt: new Date().toISOString()
        },
        { merge: true }
      );

      const appAdmin: User = {
        uid,
        email,
        displayName: result.user.displayName || 'NotesBazaar Founder',
        role: 'admin',
        purchasedNotes: [],
        membershipType: 'elite',
        referralCode: `ADMIN-${uid.substring(0, 6).toUpperCase()}`
      };

      await setDoc(
        doc(db, 'users', uid),
        {
          uid,
          email,
          displayName: appAdmin.displayName,
          role: 'admin',
          membershipType: 'elite',
          purchasedNotes: [],
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );

      // Load Firestore security credential if present
      try {
        const secSnap = await getDoc(doc(db, 'settings', 'admin_security'));
        if (secSnap.exists()) {
          const data = secSnap.data() as StoredVaultCredential;
          if (data?.salt && data?.hash) {
            saveLocalVaultCredential(data);
          }
        }
      } catch (e) {}

      resetAdminLockout();
      unlockAdminVaultSession(email);
      saveSessionUser(appAdmin);

      try {
        await addDoc(collection(db, 'activity_logs'), {
          uid,
          userEmail: email,
          action: 'ADMIN_PORTAL_LOGIN',
          details: 'Founder verified via dedicated /admin-login Google OAuth gate.',
          createdAt: new Date().toISOString()
        });
      } catch (e) {}

      navigate('/admin', { replace: true });
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setError(err?.message || 'Google authentication failed. Check popup blockers and try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleVaultPassphraseLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const lock = checkAdminLockout();
    if (lock.locked) {
      setLockoutState(lock);
      setError(`Too many failed attempts. Portal locked for ${lock.remainingSeconds}s.`);
      return;
    }

    const cleanEmail = founderEmail.trim().toLowerCase();
    if (!isFounderEmail(cleanEmail)) {
      const attempt = recordFailedAdminAttempt();
      setLockoutState(attempt);
      setError(
        attempt.locked
          ? `Unauthorized email. Security lockout active for ${attempt.remainingSeconds}s.`
          : `Access denied: not a recognized Founder email (${attempt.attempts}/5 attempts).`
      );
      return;
    }

    setBusy(true);
    try {
      let cred = vaultCredential || getLocalVaultCredential();

      // First-time Vault initialization if no credential exists yet
      if (!cred) {
        if (passphrase.length < 8) {
          setError('Initialize Vault passphrase with at least 8 characters.');
          setBusy(false);
          return;
        }
        if (passphrase !== confirmPassphrase) {
          setError('Passphrases do not match.');
          setBusy(false);
          return;
        }
        const salt = generateSaltHex(16);
        const hash = await hashVaultPasscode(passphrase, salt);
        cred = {
          salt,
          hash,
          updatedAt: new Date().toISOString(),
          updatedBy: cleanEmail
        };
        saveLocalVaultCredential(cred);
        setVaultCredential(cred);
      } else {
        const valid = await verifyVaultPasscode(passphrase, cred);
        if (!valid) {
          const attempt = recordFailedAdminAttempt();
          setLockoutState(attempt);
          setError(
            attempt.locked
              ? `Invalid Vault passphrase. Security lockout active for ${attempt.remainingSeconds}s.`
              : `Incorrect Admin Vault passphrase (${attempt.attempts}/5 attempts).`
          );
          setBusy(false);
          return;
        }
      }

      resetAdminLockout();
      unlockAdminVaultSession(cleanEmail);

      const founderUid = auth.currentUser?.uid || `founder_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
      const founderUser: User = {
        uid: founderUid,
        email: cleanEmail,
        displayName: 'NotesBazaar Founder',
        role: 'admin',
        purchasedNotes: [],
        membershipType: 'elite',
        referralCode: 'FOUNDER'
      };
      saveSessionUser(founderUser);
      setInfo('Security Vault unlocked. Entering Command Center...');
      navigate('/admin', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const isFirstSetup = !vaultCredential;

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center px-4 py-12 bg-[#FAFBFD] dark:bg-slate-950 transition-colors">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] p-8 md:p-10 shadow-2xl border border-slate-100 dark:border-slate-800 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-700 via-teal-600 to-emerald-600" />

        <div className="flex items-center justify-between mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-primary transition-colors"
          >
            <ArrowLeft size={14} /> Storefront
          </Link>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-widest">
            <Lock size={11} /> Restricted URL
          </span>
        </div>

        <div className="text-center mb-7">
          <div className="flex justify-center mb-4">
            <NotesBazaarLogo variant="seal" size={64} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-heading">
            Admin Command Portal
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1.5 leading-relaxed">
            Dedicated founder gateway to customize study material, PDF vaults, Razorpay keys, announcements, and orders.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold flex items-start gap-2.5">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {info && (
          <div className="mb-5 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-start gap-2.5">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            <span>{info}</span>
          </div>
        )}

        {/* Primary Recommended Method: Google Founder OAuth */}
        <button
          type="button"
          onClick={handleGoogleFounderLogin}
          disabled={busy}
          className="w-full py-3.5 px-5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs flex items-center justify-center gap-2.5 hover:bg-blue-700 dark:hover:bg-primary dark:hover:text-white transition-all shadow-lg cursor-pointer mb-5"
        >
          <LogIn size={16} />
          <span>Sign In with Founder Google Account</span>
        </button>

        <div className="relative flex items-center py-2 mb-5">
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
          <span className="shrink mx-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Or Vault Passphrase
          </span>
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
        </div>

        <form onSubmit={handleVaultPassphraseLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Authorized Founder Email
            </label>
            <input
              type="email"
              required
              disabled={lockoutState.locked}
              value={founderEmail}
              onChange={(e) => setFounderEmail(e.target.value)}
              placeholder="founder@domain.com"
              className="premium-input py-3.5 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isFirstSetup ? 'Create Security Vault Passphrase (Min 8 chars)' : 'Admin Vault Passphrase'}
            </label>
            <div className="relative">
              <input
                type={showPassphrase ? 'text' : 'password'}
                required
                minLength={8}
                disabled={lockoutState.locked}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="••••••••••••"
                className="premium-input py-3.5 pr-12 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassphrase((s) => !s)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                aria-label="Toggle passphrase visibility"
              >
                {showPassphrase ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {isFirstSetup && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Confirm Vault Passphrase
              </label>
              <input
                type={showPassphrase ? 'text' : 'password'}
                required
                minLength={8}
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                placeholder="••••••••••••"
                className="premium-input py-3.5 font-mono text-sm"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={busy || lockoutState.locked}
            className="w-full premium-button-primary py-3.5 text-xs"
          >
            {busy ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : lockoutState.locked ? (
              `Locked (${lockoutState.remainingSeconds}s)`
            ) : isFirstSetup ? (
              <>
                <Sparkles size={15} /> Initialize Vault &amp; Enter Admin
              </>
            ) : (
              <>
                <KeyRound size={15} /> Verify &amp; Open Admin Panel
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-500" /> Salted SHA-256 + RBAC
          </span>
          <Link to="/login" className="font-bold text-primary hover:underline">
            Student Login
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
