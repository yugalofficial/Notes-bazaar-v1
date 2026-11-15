import React, { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Zap,
  Edit3,
  RefreshCw,
  Star,
  Download,
  ShieldCheck,
  ZoomIn,
  CreditCard,
  ChevronDown,
  HelpCircle,
  BookOpen,
  CheckCircle2,
  FileText,
  Clock
} from 'lucide-react';
import { motion, useScroll, useTransform, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { SiteSettings, ExamType, Note } from '../types';
import { NotesBazaarLogo } from '../components/NotesBazaarLogo';
import { getSafePreviewImages, getSamplePagesByExam } from '../utils/sampleNotesPages';
import { BUILTIN_CATALOG_NOTES } from '../utils/appScriptService';
import { setStructuredDataJsonLd } from '../utils/seo';

const Home: React.FC = () => {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [catalogNotes, setCatalogNotes] = useState<Note[]>(BUILTIN_CATALOG_NOTES);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);
  const heroVisualRef = useRef<HTMLDivElement>(null);

  const faqs = [
    {
      q: 'What is included in NotesBazaar – Static GK 2026 (₹99)?',
      a: 'It includes 170+ comprehensive exam-ready pages updated up to December 2025 covering Nobel Prizes & Awards, National Parks, Rivers & Dams, Indian Dances, Art & Culture, Superlatives, Important Days, Sports Trophies, Ports/Airports/Power Plants, and Govt Schemes.'
    },
    {
      q: 'Can I zoom and inspect the note layout before purchasing?',
      a: 'Yes! Every study pack lets you inspect full-screen Page 1 samples up to 300% zoom with mouse wheel, pinch, and drag-to-pan so you check handwriting and layout clarity before paying.'
    },
    {
      q: 'Which Razorpay payment services are supported?',
      a: 'NotesBazaar supports all major Indian payment rails through Razorpay: Google Pay, PhonePe, Paytm UPI & QR, Visa/Mastercard/RuPay Cards, Netbanking (HDFC, SBI, ICICI, Axis), Wallets, and PayLater.'
    },
    {
      q: 'How quickly do I get the PDF after payment verification?',
      a: 'Immediately after Razorpay signature verification, your notes unlock inside your Student Dashboard Library alongside an invoice receipt and email delivery notification.'
    }
  ];

  const { scrollYProgress } = useScroll({
    target: heroVisualRef,
    offset: ['start end', 'end start']
  });
  const sheetRotate = useTransform(scrollYProgress, [0, 1], [-1.5, 1.5]);
  const sheetY = useTransform(scrollYProgress, [0, 1], [12, -18]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'main'));
        if (docSnap.exists()) {
          setSettings(docSnap.data() as SiteSettings);
        }
      } catch {
        // Use defaults
      }

      try {
        const prodSnap = await getDocs(collection(db, 'products'));
        if (!prodSnap.empty) {
          const loaded: Note[] = prodSnap.docs
            .map((d) => {
              const item = d.data();
              return {
                id: d.id,
                title: item.title,
                category: item.category || 'Study Material',
                examType: (item.exam_type || ExamType.SSC) as ExamType,
                description: item.description || '',
                price: Number(item.price || 0),
                originalPrice: item.original_price ? Number(item.original_price) : undefined,
                previewImages: item.preview_images || [],
                fileUrl: item.file_url || '',
                rating: Number(item.rating || 0),
                reviewsCount: Number(item.reviews_count || 0),
                isBestseller: Boolean(item.is_bestseller),
                pagesCount: item.pages_count,
                updatedLabel: item.updated_label,
                isEnabled: item.is_enabled !== false,
                isArchived: Boolean(item.is_archived),
                createdAt: item.created_at,
              };
            })
            .filter((n) => n.isEnabled !== false && !n.isArchived);
          if (loaded.length > 0) setCatalogNotes(loaded);
        }
      } catch {
        // Fallback to BUILTIN_CATALOG_NOTES
      }
    };
    fetchData();

    setStructuredDataJsonLd('nb-home-schema', {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          name: 'NotesBazaar',
          slogan: 'Your Study Partner',
          url: window.location.origin,
          description:
            'Digital marketplace for exam-oriented handwritten PDF notes for SSC, Railways, Banking, State PSC, and UPSC.',
        },
        {
          '@type': 'FAQPage',
          mainEntity: faqs.map((item) => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: { '@type': 'Answer', text: item.a },
          })),
        },
      ],
    });

    return () => setStructuredDataJsonLd('nb-home-schema', null);
  }, []);

  const staticGkProduct =
    catalogNotes.find((n) => n.id === 'prod_static_gk_2026') || BUILTIN_CATALOG_NOTES[0];
  const staticGkCover = getSafePreviewImages(
    staticGkProduct.examType,
    staticGkProduct.previewImages,
    staticGkProduct.title + ' ' + staticGkProduct.id
  )[0];

  const bestsellers = catalogNotes.filter((n) => n.isBestseller).slice(0, 3);
  const recentlyAdded = [...catalogNotes]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 3);

  const categories = [
    { name: 'SSC', label: 'SSC CGL, CHSL & MTS', desc: 'Quant, Static GK, Reasoning & English', color: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300', badge: 'SSC' },
    { name: 'Banking', label: 'IBPS & SBI PO/Clerk', desc: 'Puzzles, Seating & Banking Awareness', color: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300', badge: 'IBPS' },
    { name: 'Railways', label: 'RRB NTPC & Group D', desc: 'General Science, Static GK & Math', color: 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300', badge: 'RRB' },
    { name: 'UPSC', label: 'UPSC CSE & State PSC', desc: 'GS Papers, Chronology & Value-Add', color: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300', badge: 'PSC' }
  ];

  return (
    <div className="pb-20 overflow-x-clip">
      {/* Hero Section */}
      <section className="relative pt-10 pb-16 md:pt-16 md:pb-24">
        <div className="absolute top-0 right-0 -z-10 w-full md:w-2/3 h-full bg-gradient-to-bl from-blue-600/8 via-teal-500/5 to-transparent rounded-bl-[100px] md:rounded-bl-[180px]" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-14 items-center">
            {/* Left Content */}
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="space-y-6"
            >
              <div className="inline-flex items-center gap-3.5 px-4 py-2.5 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800">
                <NotesBazaarLogo variant="seal" size={44} className="shrink-0" />
                <div className="pr-2">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                    NotesBazaar • Your Study Partner
                  </p>
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    CRACK YOUR EXAMS WITH US!
                  </p>
                </div>
              </div>

              <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold leading-[1.08] tracking-tight text-slate-900 dark:text-white text-balance">
                {settings?.hero_title || 'Exam-Ready Handwritten'}{' '}
                <span className="premium-gradient-text italic">Digital PDF</span>{' '}
                Study Notes.
              </h1>

              <p className="text-base md:text-lg text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed font-medium">
                {settings?.hero_subtitle ||
                  'Concise, syllabus-aligned PDF study resources for SSC, Banking, Railways, State PSC & UPSC. Inspect sample pages with full-screen zoom before you unlock.'}
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-1">
                <Link to="/product/prod_static_gk_2026" className="premium-button-primary group">
                  <span>Static GK 2026 — ₹{staticGkProduct.price}</span>
                  <ArrowRight className="group-hover:translate-x-1 transition-transform" size={18} />
                </Link>
                <Link to="/shop" className="premium-button-secondary">
                  <BookOpen size={18} className="text-blue-700 dark:text-blue-400" />
                  <span>Browse All Notes</span>
                </Link>
              </div>

              {/* Trust Strip */}
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-200/70 dark:border-slate-800 max-w-lg">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-600" /> Verified Pay
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Razorpay SSL Gateway</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <ZoomIn size={14} className="text-blue-600" /> 300% Preview
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Inspect Before Buying</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Download size={14} className="text-teal-600" /> Instant PDF
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Library + Email Link</p>
                </div>
              </div>
            </motion.div>

            {/* Right Content - Featured Flagship Product Card: Static GK 2026 */}
            <div ref={heroVisualRef} className="relative">
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                style={{ y: sheetY, rotate: sheetRotate }}
                className="relative z-10 rounded-[36px] bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4 sm:p-6 shadow-2xl shadow-blue-950/25 border border-slate-800"
              >
                <div className="flex items-center justify-between text-white pb-4 px-1">
                  <div className="flex items-center gap-3">
                    <NotesBazaarLogo variant="seal" size={44} className="shadow-lg rounded-full" />
                    <div>
                      <p className="font-heading font-extrabold text-sm sm:text-base tracking-tight text-amber-300">
                        FEATURED RELEASE • 2026 EDITION
                      </p>
                      <p className="text-xs text-slate-300">Updated up to December 2025 · 170+ Pages</p>
                    </div>
                  </div>
                  <span className="hidden sm:inline-block text-[11px] font-bold bg-amber-500/20 text-amber-300 px-3 py-1 rounded-xl border border-amber-400/30">
                    86% OFF
                  </span>
                </div>

                <Link
                  to="/product/prod_static_gk_2026"
                  className="block relative rounded-[24px] overflow-hidden bg-white shadow-xl group border border-white/20"
                >
                  <img
                    src={staticGkCover}
                    className="w-full h-[270px] sm:h-[360px] object-cover object-top group-hover:scale-[1.03] transition-transform duration-700"
                    alt="NotesBazaar – Static GK 2026 Sample Handwritten Sheet"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/95 via-slate-950/60 to-transparent p-4 sm:p-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                    <div className="text-white">
                      <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                        Digital PDF Notes · SSC, Railways, Banking, State PSC
                      </p>
                      <p className="font-heading font-bold text-base sm:text-xl leading-snug">
                        {staticGkProduct.title}
                      </p>
                    </div>
                    <span className="self-start sm:self-auto px-4 py-2 bg-amber-400 text-slate-950 rounded-xl font-extrabold text-xs shrink-0 group-hover:bg-emerald-400 transition-colors tabular-nums">
                      ₹{staticGkProduct.price}{' '}
                      <span className="line-through opacity-60 font-semibold ml-1">
                        ₹{staticGkProduct.originalPrice || 699}
                      </span>
                    </span>
                  </div>
                </Link>
              </motion.div>

              {/* Supporting Payment & Delivery Highlights */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 rounded-xl shrink-0">
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Razorpay Verified</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">UPI, Cards, Netbanking &amp; Wallets</p>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-xl shrink-0">
                    <Zap size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Instant Digital Access</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Dashboard Library + Email Link</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Flagship Product Spotlight: Static GK 2026 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] p-6 sm:p-10 shadow-sm grid lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400">
              <FileText size={15} /> Flagship Competitive Exam Resource
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-white font-heading">
              NotesBazaar – Static GK 2026
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              {staticGkProduct.description}
            </p>
            <div className="grid sm:grid-cols-2 gap-2.5 pt-1">
              {(staticGkProduct.keyTopics || []).slice(0, 10).map((topic, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                  <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>{topic}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-950 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 space-y-5">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Student Launch Price</p>
                <div className="flex items-baseline gap-2.5 mt-1">
                  <span className="text-4xl font-black text-slate-900 dark:text-white tabular-nums">
                    ₹{staticGkProduct.price}
                  </span>
                  <span className="text-base text-slate-400 line-through tabular-nums">
                    ₹{staticGkProduct.originalPrice || 699}
                  </span>
                </div>
              </div>
              <span className="px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                Save ₹{(staticGkProduct.originalPrice || 699) - staticGkProduct.price}
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400 font-medium border-y border-slate-200 dark:border-slate-800 py-4">
              <div className="flex justify-between">
                <span>Format</span>
                <span className="font-bold text-slate-900 dark:text-white">Digital PDF Notes (170+ Pages)</span>
              </div>
              <div className="flex justify-between">
                <span>Coverage</span>
                <span className="font-bold text-slate-900 dark:text-white">Updated up to Dec 2025</span>
              </div>
              <div className="flex justify-between">
                <span>Target Exams</span>
                <span className="font-bold text-slate-900 dark:text-white">SSC, Railways, Banking, PSC</span>
              </div>
            </div>

            <Link
              to="/product/prod_static_gk_2026"
              className="w-full premium-button-primary py-3.5 flex items-center justify-center gap-2"
            >
              <span>Inspect Preview &amp; Unlock ₹{staticGkProduct.price}</span>
              <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      {/* Bestselling Resources */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-primary mb-1.5">
              Most Popular Guides
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Bestselling Study Packs
            </h2>
          </div>
          <Link to="/shop" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
            View All Digital Notes <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {bestsellers.map((item) => {
            const cover = getSafePreviewImages(item.examType, item.previewImages, item.title + ' ' + item.id)[0];
            const discountPct =
              item.originalPrice && item.originalPrice > item.price
                ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
                : 0;
            return (
              <Link
                key={item.id}
                to={`/product/${item.id}`}
                className="group bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 hover:shadow-xl transition-all flex flex-col"
              >
                <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 mb-4 relative">
                  <img
                    src={cover}
                    loading="lazy"
                    alt={item.title}
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                  />
                  {discountPct > 0 && (
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold">
                      {discountPct}% OFF
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                  {item.examType} · {item.pagesCount || 'Digital PDF'}
                </p>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1 mb-2 group-hover:text-primary transition-colors line-clamp-2">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 flex-1">
                  {item.description}
                </p>
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-baseline gap-2 tabular-nums">
                    <span className="text-xl font-black text-slate-900 dark:text-white">₹{item.price}</span>
                    {item.originalPrice && (
                      <span className="text-xs text-slate-400 line-through">₹{item.originalPrice}</span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-primary flex items-center gap-1">
                    Preview <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Recently Added Products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1">
              Latest Catalog Releases
            </p>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Recently Added PDFs</h2>
          </div>
          <Link to="/shop" className="text-xs font-bold text-primary hover:underline">
            Explore Catalog →
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {recentlyAdded.map((note) => (
            <Link
              key={note.id}
              to={`/product/${note.id}`}
              className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 hover:border-primary/40 transition-all flex items-start gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                PDF
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {note.examType} {note.updatedLabel ? `· ${note.updatedLabel}` : ''}
                </p>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate mt-0.5">{note.title}</h3>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-black text-sm text-slate-900 dark:text-white tabular-nums">₹{note.price}</span>
                  <span className="text-[11px] font-bold text-primary">View Details →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Why Choose NotesBazaar */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-xs font-extrabold uppercase tracking-widest text-primary mb-2">Why Choose NotesBazaar</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Built for Focused Exam Revision &amp; Secure Delivery
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-7">
          <div className="white-texture-card p-8">
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-5">
              <Zap size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Verified Instant Unlock</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Server-side Razorpay signature verification unlocks your PDF in your Library immediately after checkout.
            </p>
          </div>

          <div className="white-texture-card p-8">
            <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-5">
              <Edit3 size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">300% Zoom Sample Pages</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Inspect typography, tables, and diagrams up to 300% zoom before buying—no blind purchases.
            </p>
          </div>

          <div className="white-texture-card p-8">
            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mb-5">
              <RefreshCw size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Current Syllabus Focus</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Concise topic coverage aligned with current SSC, Railway, Banking, and State PSC patterns.
            </p>
          </div>
        </div>
      </section>

      {/* Exam Category Navigation */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-4xl font-bold text-slate-900 dark:text-white mb-3">
            Explore by Competitive Exam
          </h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto text-sm sm:text-base">
            Filter study material directly for your upcoming exam cycle.
          </p>
        </div>

        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {categories.map((cat) => (
            <motion.div key={cat.name} whileHover={{ y: -5 }} className="group">
              <Link
                to={`/shop?exam=${cat.name}`}
                className="block p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[24px] text-center shadow-sm hover:shadow-xl hover:border-primary/30 transition-all h-full"
              >
                <div
                  className={`w-14 h-14 ${cat.color} rounded-2xl flex items-center justify-center text-base font-heading font-extrabold mx-auto mb-4 group-hover:scale-110 transition-transform`}
                >
                  {cat.badge}
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">{cat.label}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{cat.desc}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-9">
          <div className="inline-flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest mb-2">
            <HelpCircle size={14} /> Quick Answers
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((item, idx) => {
            const isOpen = openFaqIdx === idx;
            return (
              <div
                key={idx}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 font-bold text-sm text-slate-900 dark:text-white cursor-pointer"
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-primary transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="bg-gradient-to-r from-blue-700 via-teal-700 to-emerald-600 rounded-[36px] p-10 md:p-14 text-center text-white relative overflow-hidden shadow-xl">
          <div className="relative z-10 space-y-5 max-w-2xl mx-auto">
            <div className="flex justify-center">
              <NotesBazaarLogo variant="seal" size={64} className="shadow-lg rounded-full" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white">Ready to Start Focused Revision?</h2>
            <p className="text-teal-50 text-base md:text-lg">
              Create your student account and unlock verified digital PDF notes for SSC, Banking, Railways, and PSC.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
              <Link
                to="/register"
                className="px-8 py-3.5 bg-white text-blue-800 rounded-2xl font-bold text-sm shadow-lg hover:bg-slate-50 transition-all"
              >
                Create Free Account
              </Link>
              <Link
                to="/shop"
                className="px-8 py-3.5 bg-slate-900/30 text-white rounded-2xl font-bold text-sm border border-white/25 hover:bg-slate-900/50 transition-all"
              >
                Explore All Notes
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
