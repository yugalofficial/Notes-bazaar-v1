import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Capture beforeinstallprompt globally as early as possible so hydration timing never misses it
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    promptListeners.forEach((cb) => cb());
  });

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null;
    promptListeners.forEach((cb) => cb());
  });
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if ((window.navigator as any).standalone === true) return true;
    if (document.referrer.includes('android-app://')) return true;
  } catch {}
  return false;
}

function detectIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isAppleMobile || isIPadOS;
}

function detectAndroid(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android/i.test(window.navigator.userAgent || '');
}

export function usePWAInstall() {
  const [hasPrompt, setHasPrompt] = useState<boolean>(() => Boolean(globalDeferredPrompt));
  const [isInstalled, setIsInstalled] = useState<boolean>(() => detectStandalone());
  const [isIOS] = useState<boolean>(() => detectIOS());
  const [isAndroid] = useState<boolean>(() => detectAndroid());

  useEffect(() => {
    const syncPrompt = () => {
      setHasPrompt(Boolean(globalDeferredPrompt));
      if (detectStandalone()) setIsInstalled(true);
    };

    promptListeners.add(syncPrompt);

    const onInstalled = () => {
      globalDeferredPrompt = null;
      setHasPrompt(false);
      setIsInstalled(true);
    };

    const mql = window.matchMedia('(display-mode: standalone)');
    const onDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) setIsInstalled(true);
    };

    window.addEventListener('appinstalled', onInstalled);
    if (mql.addEventListener) {
      mql.addEventListener('change', onDisplayModeChange);
    }

    return () => {
      promptListeners.delete(syncPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      if (mql.removeEventListener) {
        mql.removeEventListener('change', onDisplayModeChange);
      }
    };
  }, []);

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!globalDeferredPrompt) return 'unavailable';
    try {
      await globalDeferredPrompt.prompt();
      const { outcome } = await globalDeferredPrompt.userChoice;
      globalDeferredPrompt = null;
      setHasPrompt(false);
      promptListeners.forEach((cb) => cb());
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      return outcome;
    } catch {
      return 'unavailable';
    }
  }, []);

  return {
    isInstallable: hasPrompt && !isInstalled,
    isInstalled,
    isIOS,
    isAndroid,
    canShowAnyInstallGuide: !isInstalled && (hasPrompt || isIOS || isAndroid),
    install,
  };
}

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
