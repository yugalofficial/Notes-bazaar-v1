import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Zap,
  Edit3,
  RefreshCw,
  Star,
  Users,
  Download,
  ShieldCheck,
  Award,
  ZoomIn,
  CreditCard,
  ChevronDown,
  HelpCircle
} from 'lucide-react';
import { motion, useScroll, useTransform, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { SiteSettings, ExamType } from '../types';
import { NotesBazaarLogo } from '../components/NotesBazaarLogo';
import { getSamplePagesByExam } from '../utils/sampleNotesPages';

const Home: React.FC = () => {
  const [settings, setSettings] = React.useState<SiteSettings | null>(null);
  const [openFaqIdx, setOpenFaqIdx] = React.useState<number | null>(0);
  const heroVisualRef = useRef<HTMLDivElement>(null);

  const faqs = [
    {
      q: 'Can I zoom and verify the handwriting before buying?',
      a: 'Yes! Every study pack lets you inspect full-screen Page 1 samples up to 300% zoom with mouse wheel, pinch, and drag-to-pan so you check handwriting clarity before paying.'
    },
    {
      q: 'Which Razorpay payment services are supported?',
      a: 'NotesBazaar supports all major Indian payment rails through Razorpay: Google Pay, PhonePe, Paytm UPI & QR, Visa/Mastercard/RuPay Cards, Netbanking (HDFC, SBI, ICICI, Axis), Wallets, and PayLater.'
    },
    {
      q: 'How quickly do I get the handwritten PDF after checkout?',
      a: 'Immediately after payment confirmation, your notes unlock inside your Student Dashboard and an automated email delivery link is sent directly via our AppScript mailer.'
    },
    {
      q: 'Do I receive syllabus updates and PYQ additions?',
      a: 'Yes! Every purchased study pack includes lifetime free access to updated editions pushed directly by the founder team.'
    }
  ];

  const { scrollYProgress } = useScroll({
    target: heroVisualRef,
    offset: ['start end', 'end start']
  });
  const sheetRotate = useTransform(scrollYProgress, [0, 1], [-2, 2]);
  const sheetY = useTransform(scrollYProgress, [0, 1], [16, -24]);

  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'main');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data() as SiteSettings);
        }
      } catch (err) {
        console.warn("Could not load settings from Firestore, using defaults:", err);
      }
    };
    fetchSettings();
  }, []);

  const sscSampleCover = getSamplePagesByExam(ExamType.SSC)[0];
  const upscSampleCover = getSamplePagesByExam(ExamType.UPSC)[0];

  const categories = [
    { name: 'SSC', label: 'SSC CGL & CHSL', count: '120+ Notes', color: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300', badge: 'SSC' },
    { name: 'Banking', label: 'IBPS & SBI PO', count: '85+ Notes', color: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300', badge: 'IBPS' },
    { name: 'UPSC', label: 'UPSC CSE Prelims & Mains', count: '200+ Notes', color: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300', badge: 'IAS' },
    { name: 'Railways', label: 'RRB NTPC & Group D', count: '50+ Notes', color: 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300', badge: 'RRB' }
  ];

  const featuredBundles = [
    {
      id: 'prod_upsc_hist_02',
      title: 'UPSC GS Paper 1: Modern Indian History',
      count: 'Timeline & Mains Charts',
      price: 499,
      originalPrice: 1499,
      img: upscSampleCover,
      tag: 'Best Seller',
      exam: 'UPSC'
    },
    {
      id: 'prod_ssc_math_01',
      title: 'Complete SSC Mathematics Topper Notes',
      count: 'Arithmetic & Advance Tricks',
      price: 299,
      originalPrice: 999,
      img: sscSampleCover,
      tag: 'Top Rated',
      exam: 'SSC'
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1
    }
  };

  return (
    <div className="pb-20 overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative pt-10 pb-20 md:pt-20 md:pb-28">
        <div className="absolute top-0 right-0 -z-10 w-full md:w-2/3 h-full bg-gradient-to-bl from-blue-600/8 via-teal-500/5 to-transparent rounded-bl-[100px] md:rounded-bl-[180px]" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            {/* Left Content */}
            <motion.div
              initial={{ x: -24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="space-y-7"
            >
              {/* Brand Crest Banner Lockup inspired by attached screenshot */}
              <div className="inline-flex items-center gap-3.5 px-4 py-2.5 bg-white dark:bg-slate-900 rounded-2xl shadow-premium border border-slate-100 dark:border-slate-800">
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

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.08] tracking-tight text-slate-900 dark:text-white">
                {settings?.hero_title || 'Master Your Exams with'}{' '}
                <span className="premium-gradient-text italic">Topper&apos;s</span>{' '}
                Handwritten Notes.
              </h1>

              <p className="text-base md:text-lg text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed font-medium">
                {settings?.hero_subtitle ||
                  'Your one-stop destination for concise, exam-oriented handwritten notes for SSC, Banking, UPSC, and Railways. Preview zoomed pages before you buy.'}
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <Link to="/shop" className="premium-button-primary group">
                  Explore Study Library
                  <ArrowRight className="group-hover:translate-x-1 transition-transform" size={18} />
                </Link>
                <Link to="/product/prod_ssc_math_01" className="premium-button-secondary">
                  <ZoomIn size={18} className="text-blue-700 dark:text-blue-400" />
                  Inspect Free Sample Page
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-4">
                <div className="flex -space-x-2.5">
                  {['AK', 'PR', 'SN', 'RK'].map((initials, idx) => (
                    <div
                      key={initials}
                      className={`w-10 h-10 rounded-xl border-2 border-white dark:border-slate-900 flex items-center justify-center text-xs font-bold text-white shadow-md ${
                        idx % 2 === 0 ? 'bg-blue-700' : 'bg-emerald-600'
                      }`}
                    >
                      {initials}
                    </div>
                  ))}
                  <div className="w-10 h-10 rounded-xl border-2 border-white dark:border-slate-900 bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center text-[11px] font-bold shadow-md">
                    50k+
                  </div>
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1 text-amber-400">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} size={14} fill="currentColor" />
                    ))}
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 ml-1">4.9/5</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Trusted by 50,000+ Government Exam Aspirants
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Right Content - Interactive Handwritten Notes Showcase */}
            <div ref={heroVisualRef} className="relative">
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                style={{ y: sheetY, rotate: sheetRotate }}
                className="relative z-10 rounded-[36px] bg-gradient-to-br from-blue-700 via-teal-700 to-emerald-600 p-4 sm:p-6 shadow-2xl shadow-blue-900/15"
              >
                {/* Brand Banner Strip */}
                <div className="flex items-center justify-between text-white pb-4 px-2">
                  <div className="flex items-center gap-3">
                    <NotesBazaarLogo variant="seal" size={48} className="shadow-lg rounded-full" />
                    <div>
                      <p className="font-heading font-extrabold text-base tracking-tight">CRACK YOUR EXAMS WITH US!</p>
                      <p className="text-xs text-teal-100">SSC · Banking · UPSC · Railways</p>
                    </div>
                  </div>
                  <span className="hidden sm:inline-block text-[11px] font-bold bg-white/15 backdrop-blur px-3 py-1.5 rounded-xl border border-white/20">
                    Full-Screen Zoom Preview
                  </span>
                </div>

                {/* Live Handwritten Page Preview Frame */}
                <Link
                  to="/product/prod_ssc_math_01"
                  className="block relative rounded-[24px] overflow-hidden bg-white shadow-xl group border border-white/40"
                >
                  <img
                    src={sscSampleCover}
                    className="w-full h-[380px] sm:h-[440px] object-cover object-top group-hover:scale-[1.03] transition-transform duration-700"
                    alt="NotesBazaar Handwritten Study Note Sample Page"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-transparent p-5 flex items-end justify-between gap-4">
                    <div className="text-white">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                        Live Sample Sheet • Click to Zoom
                      </p>
                      <p className="font-heading font-bold text-base sm:text-lg">
                        Complete SSC Mathematics Topper Notes
                      </p>
                    </div>
                    <span className="px-4 py-2 bg-white text-slate-900 rounded-xl font-bold text-xs shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                      Preview ₹299
                    </span>
                  </div>
                </Link>
              </motion.div>

              {/* Supporting Trust Cards */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="mt-4 grid grid-cols-2 gap-4"
              >
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 rounded-xl shrink-0">
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">All Razorpay Services</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">UPI, QR, Cards, Netbanking</p>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-xl shrink-0">
                    <Zap size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Instant Email &amp; PDF</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Immediate download unlock</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="grid md:grid-cols-3 gap-7"
        >
          <motion.div variants={itemVariants} className="white-texture-card p-8 group">
            <div className="w-13 h-13 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <Zap size={26} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2.5">Instant Email Delivery</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Unlock your PDF immediately after Razorpay confirmation and receive a permanent access link in your inbox.
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="white-texture-card p-8 group">
            <div className="w-13 h-13 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <Edit3 size={26} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2.5">Inspectable Handwriting</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Zoom up to 300% into sample handwritten pages before purchasing. Crisp ink diagrams, shortcuts, and neat layout.
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="white-texture-card p-8 group">
            <div className="w-13 h-13 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <RefreshCw size={26} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2.5">Free Syllabus Updates</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Receive updated editions for current exam patterns and new PYQ shortcuts directly in your student library.
            </p>
          </motion.div>
        </motion.div>
      </section>

      {/* Featured Bundles Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-900 dark:bg-slate-900/90 rounded-[36px] md:rounded-[48px] p-8 md:p-14 overflow-hidden relative border border-slate-800">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/15 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-600/15 rounded-full blur-[120px] pointer-events-none" />

            <div className="relative z-10">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
                <div className="max-w-xl">
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-2">
                    Topper Verified Study Packs
                  </p>
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
                    Save Big with Exam Master Packs
                  </h2>
                  <p className="text-slate-400 text-base">
                    Concise, exam-oriented handwritten material trusted by rankers at up to 70% student savings.
                  </p>
                </div>
                <Link
                  to="/shop"
                  className="px-6 py-3 bg-white text-slate-900 rounded-2xl font-bold text-sm hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-2 shrink-0"
                >
                  Browse Full Library <ArrowRight size={16} />
                </Link>
              </div>

              <div className="grid lg:grid-cols-2 gap-7">
                {featuredBundles.map((bundle) => (
                  <motion.div
                    key={bundle.id}
                    whileHover={{ y: -4 }}
                    className="bg-white/5 backdrop-blur-sm rounded-3xl p-6 border border-white/10 flex flex-col sm:flex-row gap-6 items-center group"
                  >
                    <div className="w-full sm:w-40 h-44 rounded-2xl overflow-hidden flex-shrink-0 bg-white border border-white/15">
                      <img
                        src={bundle.img}
                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                        alt={bundle.title}
                      />
                    </div>
                    <div className="flex-1 space-y-3 w-full">
                      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                        <span>{bundle.tag}</span>
                        <span className="text-slate-600">·</span>
                        <span className="text-slate-300">{bundle.count}</span>
                      </div>
                      <h3 className="text-xl font-bold text-white leading-tight">{bundle.title}</h3>
                      <div className="flex items-baseline gap-3">
                        <span className="text-2xl font-bold text-white">₹{bundle.price}</span>
                        <span className="text-sm text-slate-500 line-through">₹{bundle.originalPrice}</span>
                      </div>
                      <Link
                        to={`/product/${bundle.id}`}
                        className="w-full py-2.5 px-4 bg-white text-slate-900 rounded-xl font-bold text-sm hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center gap-2"
                      >
                        Preview &amp; Unlock Notes <ArrowRight size={15} />
                      </Link>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-10 border-y border-slate-200/70 dark:border-slate-800">
          {[
            { label: 'UPSC Selections', value: '10K+', icon: Award },
            { label: 'SSC Aspirants', value: '25K+', icon: Users },
            { label: 'Total Downloads', value: '5L+', icon: Download },
            { label: 'Study Access', value: '24/7', icon: ShieldCheck },
          ].map((stat, i) => (
            <div key={i} className="text-center space-y-1.5">
              <div className="flex justify-center text-primary mb-1">
                <stat.icon size={20} />
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Categories Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-3">
            Tailored for Major Government Exams
          </h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
            Every handwritten volume follows the latest exam syllabus, shortcuts, and PYQ trends.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((cat) => (
            <motion.div key={cat.name} whileHover={{ y: -6 }} className="group">
              <Link
                to={`/shop?exam=${cat.name}`}
                className="block p-7 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[28px] text-center shadow-sm hover:shadow-xl hover:border-primary/30 transition-all"
              >
                <div
                  className={`w-16 h-16 ${cat.color} rounded-2xl flex items-center justify-center text-lg font-heading font-extrabold mx-auto mb-5 group-hover:scale-110 transition-transform duration-300`}
                >
                  {cat.badge}
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{cat.label}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{cat.count}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Aspirant Trust & FAQ Section */}
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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="bg-gradient-to-r from-blue-700 via-teal-700 to-emerald-600 rounded-[36px] p-10 md:p-14 text-center text-white relative overflow-hidden shadow-xl">
          <div className="relative z-10 space-y-5 max-w-2xl mx-auto">
            <div className="flex justify-center">
              <NotesBazaarLogo variant="seal" size={64} className="shadow-lg rounded-full" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white">Ready to Crack Your Dream Exam?</h2>
            <p className="text-teal-50 text-base md:text-lg">
              Join thousands of aspirants mastering SSC, Banking, and UPSC with NotesBazaar handwritten material.
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
