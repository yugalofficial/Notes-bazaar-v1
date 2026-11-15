import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Download,
  Share,
  PlusSquare,
  Smartphone,
  X,
  WifiOff,
  MoreVertical,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePWAInstall, useOnlineStatus } from '../utils/usePWAInstall';
import { NotesBazaarLogo } from './NotesBazaarLogo';

const DISMISS_SESSION_KEY = 'notesbazaar_pwa_banner_dismissed';

/**
 * Step-by-step instructions modal for iOS Safari & Android Chrome fallback
 */
const InstallGuideModal: React.FC<{
  open: boolean;
  isIOS: boolean;
  onClose: () => void;
}> = ({ open, isIOS, onClose }) => {
  const [platformTab, setPlatformTab] = useState<'android' | 'ios'>(isIOS ? 'ios' : 'android');

  useEffect(() => {
    setPlatformTab(isIOS ? 'ios' : 'android');
  }, [isIOS, open]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[90] bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Install NotesBazaar App Guide"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-t-[28px] sm:rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 pb-safe"
          >
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <NotesBazaarLogo variant="seal" size={44} className="shrink-0" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                    Install NotesBazaar App
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Home-screen app experience on Android &amp; iOS
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close install guide"
                className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center cursor-pointer shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-950 mb-5">
              <button
                type="button"
                onClick={() => setPlatformTab('android')}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  platformTab === 'android'
                    ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-teal-300 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Android (Chrome)
              </button>
              <button
                type="button"
                onClick={() => setPlatformTab('ios')}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  platformTab === 'ios'
                    ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-teal-300 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                iPhone / iPad (iOS)
              </button>
            </div>

            {platformTab === 'ios' ? (
              <ol className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
                <li className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                  <span className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-center shrink-0">
                    1
                  </span>
                  <div className="space-y-0.5">
                    <p className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                      Tap the Share icon <Share size={14} className="text-blue-600" />
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Open this site in Safari and tap the Share square-with-arrow button in the bottom/top bar.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                  <span className="w-7 h-7 rounded-lg bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-bold text-xs flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div className="space-y-0.5">
                    <p className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                      Choose &ldquo;Add to Home Screen&rdquo; <PlusSquare size={14} className="text-teal-600" />
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Scroll down the share sheet and tap &ldquo;Add to Home Screen&rdquo;, then tap <strong>Add</strong>.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3 p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/50">
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-900 dark:text-emerald-200 font-medium">
                    NotesBazaar launches full-screen from your Home Screen with offline cached study notes.
                  </p>
                </li>
              </ol>
            ) : (
              <ol className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
                <li className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                  <span className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-center shrink-0">
                    1
                  </span>
                  <div className="space-y-0.5">
                    <p className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                      Tap Chrome Menu <MoreVertical size={14} className="text-blue-600" />
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      If no automatic Install prompt appeared, open Chrome&apos;s top-right 3-dot menu.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                  <span className="w-7 h-7 rounded-lg bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-bold text-xs flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div className="space-y-0.5">
                    <p className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                      Tap &ldquo;Install app&rdquo; or &ldquo;Add to Home screen&rdquo;
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Confirm Install—Android generates an installable WebAPK app icon right inside your app drawer.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3 p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/50">
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-900 dark:text-emerald-200 font-medium">
                    Cached Firestore data remains readable during flaky mobile data connections.
                  </p>
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs cursor-pointer"
            >
              Got it
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

/**
 * Custom BeforeInstallPrompt + iOS Safari Banner encouraging PWA installation
 */
export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(DISMISS_SESSION_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [guideOpen, setGuideOpen] = useState(false);

  // Respect mobile product sticky buy bar & clean modal experience
  const isProductRoute = pathname.startsWith('/product/');
  const shouldRender = !isInstalled && !dismissed && !isProductRoute && (isInstallable || isIOS || isAndroid);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_SESSION_KEY, '1');
    } catch {}
  };

  const handleInstallAction = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'unavailable') {
        setGuideOpen(true);
      }
      return;
    }
    setGuideOpen(true);
  };

  return (
    <>
      <AnimatePresence>
        {shouldRender && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-[76px] md:bottom-6 left-3 right-3 sm:left-auto sm:right-20 z-30 sm:w-[360px]"
          >
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xl flex items-center gap-3">
              <NotesBazaarLogo variant="mark" size={40} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                  Get the NotesBazaar App
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {isIOS
                    ? 'Add to iPhone/iPad Home Screen'
                    : 'Fast Android & offline study access'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleInstallAction}
                className="min-h-[38px] px-3.5 py-2 bg-gradient-to-r from-blue-700 to-emerald-600 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md hover:opacity-95 transition-opacity shrink-0 cursor-pointer"
              >
                {isIOS && !isInstallable ? <Share size={13} /> : <Download size={13} />}
                <span>{isIOS && !isInstallable ? 'Install' : 'Install'}</span>
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Dismiss install banner"
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <InstallGuideModal open={guideOpen} isIOS={isIOS} onClose={() => setGuideOpen(false)} />
    </>
  );
};

/**
 * Compact trigger mounted in Navigation/Drawer so users can install at any time
 */
export const PWAInstallButton: React.FC<{ variant?: 'compact' | 'drawer'; onAfterClick?: () => void }> = ({
  variant = 'compact',
  onAfterClick,
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [guideOpen, setGuideOpen] = useState(false);

  if (isInstalled) return null;
  if (!isInstallable && !isIOS && !isAndroid) return null;

  const handleClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'unavailable') {
        setGuideOpen(true);
      } else {
        onAfterClick?.();
      }
      return;
    }
    setGuideOpen(true);
  };

  if (variant === 'drawer') {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-blue-50 to-emerald-50 dark:from-blue-950/40 dark:to-emerald-950/40 border border-teal-200/70 dark:border-teal-800/60 text-slate-900 dark:text-white font-bold text-sm cursor-pointer min-h-[44px]"
        >
          <span className="flex items-center gap-2.5">
            <Smartphone size={18} className="text-primary" />
            <span>{isIOS && !isInstallable ? 'Install App (iOS)' : 'Install App'}</span>
          </span>
          <Download size={16} className="text-primary" />
        </button>
        <InstallGuideModal open={guideOpen} isIOS={isIOS} onClose={() => setGuideOpen(false)} />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200/80 dark:border-teal-800 font-bold text-xs hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        title="Install NotesBazaar App"
      >
        <Download size={14} />
        <span>Install App</span>
      </button>
      <InstallGuideModal open={guideOpen} isIOS={isIOS} onClose={() => setGuideOpen(false)} />
    </>
  );
};

/**
 * Displays strictly when the user's connection drops offline
 */
export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-amber-600 text-white text-xs font-bold text-center overflow-hidden"
        >
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-2">
            <WifiOff size={14} />
            <span>Offline Mode — Showing cached Firestore study catalog &amp; notes.</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
