import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Clock, ArrowRight, MessageCircle, X } from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { SiteSettings } from '../types';

export const CampaignCountdownBanner: React.FC = () => {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [remainingMs, setRemainingMs] = useState<number>(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'main'));
        if (snap.exists()) {
          setSettings(snap.data() as SiteSettings);
        }
      } catch {
        // Ignore silent offline read
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const expiresAt = settings?.campaign_expires_at;
    if (!expiresAt) {
      setRemainingMs(0);
      return;
    }
    const targetMs = new Date(expiresAt).getTime();
    if (Number.isNaN(targetMs)) {
      setRemainingMs(0);
      return;
    }

    const updateTick = () => {
      const diff = targetMs - Date.now();
      setRemainingMs(diff > 0 ? diff : 0);
    };
    updateTick();
    const id = setInterval(updateTick, 1000);
    return () => clearInterval(id);
  }, [settings?.campaign_expires_at]);

  if (dismissed || !settings?.announcement_enabled) return null;

  const hasValidCountdown = Boolean(settings.campaign_expires_at && remainingMs > 0);
  const bannerText = settings.campaign_title || settings.announcement_text;
  if (!bannerText && !hasValidCountdown) return null;

  const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remainingMs / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((remainingMs / (1000 * 60)) % 60);
  const secs = Math.floor((remainingMs / 1000) % 60);

  const targetHref = settings.campaign_product_id
    ? `/product/${settings.campaign_product_id}`
    : '/shop';

  return (
    <div className="bg-slate-900 dark:bg-slate-950 text-white border-b border-slate-800 px-4 py-2.5 text-xs">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 font-medium">
          {hasValidCountdown && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/30 tabular-nums">
              <Clock size={12} />
              {days > 0 ? `${days}d ` : ''}
              {String(hours).padStart(2, '0')}h:{String(mins).padStart(2, '0')}m:{String(secs).padStart(2, '0')}s
            </span>
          )}
          <span className="text-slate-100">{bannerText}</span>
          {settings.promo_code && Number(settings.promo_discount_percent) > 0 && (
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded font-mono font-bold border border-emerald-500/30">
              CODE: {settings.promo_code} ({settings.promo_discount_percent}% OFF)
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <Link
            to={targetHref}
            className="inline-flex items-center gap-1 font-bold text-teal-300 hover:text-teal-200 transition-colors"
          >
            View Offer <ArrowRight size={13} />
          </Link>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss announcement"
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export const WhatsAppSupportButton: React.FC = () => {
  const [whatsappNumber, setWhatsappNumber] = useState<string>('');
  const { pathname } = useLocation();

  useEffect(() => {
    const loadWhatsApp = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'main'));
        if (snap.exists()) {
          const d = snap.data() as SiteSettings;
          const clean = String(d.whatsapp_number || '').replace(/[^0-9]/g, '');
          if (clean.length >= 10) {
            setWhatsappNumber(clean);
          }
        }
      } catch {
        // Ignore silent failure
      }
    };
    loadWhatsApp();
  }, []);

  if (!whatsappNumber) return null;

  const isProductRoute = pathname.startsWith('/product/');
  const mobileBottomClass = isProductRoute ? 'bottom-[142px]' : 'bottom-[78px]';
  const waHref = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    'Hello NotesBazaar Support, I have a question regarding study material PDFs / order verification.'
  )}`;

  return (
    <a
      href={waHref}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with NotesBazaar Support on WhatsApp"
      className={`fixed ${mobileBottomClass} md:bottom-6 left-4 md:left-6 z-30 inline-flex items-center justify-center gap-2 min-w-[44px] min-h-[44px] px-3.5 sm:px-4 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xl shadow-emerald-900/25 transition-all hover:scale-105`}
    >
      <MessageCircle size={18} />
      <span className="hidden sm:inline">WhatsApp Support</span>
    </a>
  );
};
