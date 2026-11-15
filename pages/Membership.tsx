import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Zap, Crown, Shield, ArrowRight, Star, CheckCircle2, CreditCard, Smartphone, Landmark } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { NotesBazaarLogo } from '../components/NotesBazaarLogo';
import { getSessionUser, recordLocalOrder, updateSessionMembership } from '../utils/appScriptService';
import { auth, db } from '../firebase';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';

const Membership: React.FC = () => {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<{
    id: 'basic' | 'pro' | 'elite';
    name: string;
    numericPrice: number;
  } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [activatedPlanName, setActivatedPlanName] = useState<string | null>(null);

  const plans = [
    {
      id: 'basic' as const,
      name: 'Standard Aspirant',
      price: 'Free',
      numericPrice: 0,
      period: 'Forever',
      features: ['Access to Sample Notes', 'Full-Screen Zoom Previews', 'Weekly Exam Newsletter', 'Mobile Reading View'],
      buttonText: 'Start for Free',
      recommended: false,
      icon: Shield,
      color: 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-200 dark:border-slate-800'
    },
    {
      id: 'pro' as const,
      name: 'Serious Pro',
      price: billingCycle === 'monthly' ? '₹199' : '₹149',
      numericPrice: billingCycle === 'monthly' ? 199 : 149,
      period: 'Per Month',
      features: [
        'Access to 50+ Premium Notes',
        'Strategy Mentorship PDFs',
        'Ad-free Experience',
        'Priority Email Support',
        'Download PDFs Instantly'
      ],
      buttonText: 'Go Pro Now',
      recommended: true,
      icon: Zap,
      color: 'bg-gradient-to-br from-blue-700 via-teal-700 to-emerald-600 text-white border-transparent shadow-xl shadow-teal-600/25'
    },
    {
      id: 'elite' as const,
      name: 'Topper Elite',
      price: billingCycle === 'monthly' ? '₹399' : '₹299',
      numericPrice: billingCycle === 'monthly' ? 399 : 299,
      period: 'Per Month',
      features: [
        'Unlimited Notes Vault Access',
        'Personalized Doubt Solving',
        'Print-Ready A4 PDF Packs',
        'Exclusive Topper Strategy Guides',
        'Lifetime Syllabus Updates'
      ],
      buttonText: 'Join Elite Club',
      recommended: false,
      icon: Crown,
      color: 'bg-slate-900 text-white border-slate-800 shadow-xl shadow-slate-900/20'
    }
  ];

  const handlePlanSelect = (plan: (typeof plans)[number]) => {
    const activeUser = getSessionUser();
    if (plan.id === 'basic') {
      navigate(activeUser ? '/shop' : '/register');
      return;
    }
    if (!activeUser) {
      navigate('/login');
      return;
    }
    setSelectedPlan({
      id: plan.id,
      name: plan.name,
      numericPrice: plan.numericPrice
    });
  };

  const confirmPlanPurchase = () => {
    if (!selectedPlan) return;
    setProcessing(true);
    const activeUser = getSessionUser();
    const paymentId = `plan_${selectedPlan.id}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const createdAt = new Date().toISOString();
    const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000;

    setTimeout(async () => {
      updateSessionMembership(selectedPlan.id);
      recordLocalOrder({
        id: paymentId,
        user_email: activeUser?.email || 'aspirant@notesbazaar.co',
        product_id: `membership_${selectedPlan.id}`,
        product_title: `${selectedPlan.name} (${billingCycle})`,
        amount: selectedPlan.numericPrice,
        status: 'paid',
        payment_id: paymentId,
        provider: 'razorpay_demo',
        payment_method: 'Razorpay UPI/Card',
        created_at: createdAt
      });

      if (auth.currentUser) {
        try {
          await addDoc(collection(db, 'orders'), {
            uid: auth.currentUser.uid,
            user_email: auth.currentUser.email || activeUser?.email || 'aspirant@notesbazaar.co',
            product_id: `membership_${selectedPlan.id}`,
            product_title: `${selectedPlan.name} (${billingCycle})`,
            amount: selectedPlan.numericPrice,
            status: 'paid',
            payment_id: paymentId,
            provider: 'razorpay_demo',
            payment_method: 'Razorpay UPI/Card',
            created_at: createdAt
          });
          await updateDoc(doc(db, 'users', auth.currentUser.uid), {
            membershipType: selectedPlan.id,
            membershipExpiry: expiry,
            updatedAt: createdAt
          });
        } catch (fsErr) {}
      }

      confetti({
        particleCount: 120,
        spread: 75,
        origin: { y: 0.6 },
        colors: ['#1D4ED8', '#0D9488', '#059669', '#F59E0B']
      });

      setProcessing(false);
      setActivatedPlanName(selectedPlan.name);
      setSelectedPlan(null);
    }, 900);
  };

  return (
    <div className="py-16 md:py-20 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14 space-y-5">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 rounded-full text-xs font-bold uppercase tracking-wider"
          >
            <Star size={14} fill="currentColor" />
            Join 50,000+ Aspirants
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white font-heading leading-tight">
            Choose Your Path to <span className="premium-gradient-text italic">Selection</span>
          </h1>
          <p className="text-base md:text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Flexible membership passes to unlock curated topper handwritten notes. Instant Razorpay activation via UPI, Cards, or Netbanking.
          </p>

          {activatedPlanName && (
            <div className="max-w-md mx-auto bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 px-5 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2">
              <CheckCircle2 size={18} />
              <span>{activatedPlanName} activated on your account!</span>
            </div>
          )}

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 pt-3">
            <span className={`text-sm font-bold transition-colors ${billingCycle === 'monthly' ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
              Monthly
            </span>
            <button
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
              aria-label="Toggle billing cycle"
              className="w-14 h-7 bg-slate-200 dark:bg-slate-800 rounded-full relative transition-colors hover:bg-slate-300 cursor-pointer"
            >
              <motion.div
                animate={{ x: billingCycle === 'monthly' ? 4 : 32 }}
                className="absolute top-1 left-0 w-5 h-5 bg-primary rounded-full shadow-sm"
              />
            </button>
            <span className={`text-sm font-bold transition-colors flex items-center gap-2 ${billingCycle === 'yearly' ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
              Yearly <span className="bg-amber-500 text-white px-2 py-0.5 rounded-md text-[10px] font-bold">SAVE 25%</span>
            </span>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`relative rounded-[32px] p-8 md:p-9 border-2 flex flex-col transition-all ${plan.color} ${
                plan.recommended ? 'lg:-translate-y-3' : ''
              }`}
            >
              {plan.recommended && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-500 text-white px-5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg">
                  Most Popular
                </div>
              )}

              <div className="mb-7">
                <div
                  className={`w-13 h-13 rounded-2xl flex items-center justify-center mb-5 ${
                    plan.id === 'pro'
                      ? 'bg-white/20 text-white'
                      : plan.id === 'elite'
                        ? 'bg-white/10 text-white'
                        : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400'
                  }`}
                >
                  <plan.icon size={26} />
                </div>
                <h3 className={`text-2xl font-bold mb-2 ${plan.id === 'basic' ? 'text-slate-900 dark:text-white' : 'text-white'}`}>
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl md:text-5xl font-bold">{plan.price}</span>
                  <span className="text-sm opacity-75 font-medium">/{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-3.5 mb-8 flex-grow">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm font-medium">
                    <div
                      className={`mt-0.5 p-0.5 rounded-full shrink-0 ${
                        plan.id === 'pro'
                          ? 'bg-white/20 text-white'
                          : plan.id === 'elite'
                            ? 'bg-white/10 text-white'
                            : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      <Check size={12} strokeWidth={3.5} />
                    </div>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handlePlanSelect(plan)}
                className={`w-full py-4 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  plan.id === 'pro'
                    ? 'bg-white text-blue-800 hover:bg-slate-50 shadow-xl'
                    : plan.id === 'basic'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-blue-700 dark:hover:bg-primary dark:hover:text-white'
                      : 'bg-gradient-to-r from-blue-600 to-emerald-600 text-white hover:opacity-95 shadow-xl'
                }`}
              >
                {plan.buttonText}
                <ArrowRight size={18} />
              </button>
            </motion.div>
          ))}
        </div>

        <div className="mt-14 text-center space-y-4">
          <div className="flex flex-wrap justify-center items-center gap-6 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5"><Smartphone size={14} className="text-primary" /> UPI &amp; QR</span>
            <span className="flex items-center gap-1.5"><CreditCard size={14} className="text-primary" /> Visa · Mastercard · RuPay</span>
            <span className="flex items-center gap-1.5"><Landmark size={14} className="text-primary" /> All Major Netbanking</span>
          </div>
          <p className="text-sm text-slate-400 font-medium max-w-lg mx-auto">
            Secured via Razorpay Payments. Cancel anytime from your dashboard.
          </p>
        </div>
      </div>

      {/* Membership Plan Razorpay Checkout Modal */}
      <AnimatePresence>
        {selectedPlan && (
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800"
            >
              <div className="bg-gradient-to-r from-blue-800 to-emerald-700 p-5 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <NotesBazaarLogo variant="mark" size={38} className="rounded-full" />
                  <div>
                    <h3 className="font-bold text-base text-white">{selectedPlan.name}</h3>
                    <p className="text-[11px] text-teal-100">Razorpay All-Services Activation</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPlan(null)}
                  className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-500 uppercase">Billing ({billingCycle})</span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white">₹{selectedPlan.numericPrice}</span>
                </div>

                <button
                  onClick={confirmPlanPurchase}
                  disabled={processing}
                  className="w-full premium-button-primary py-4"
                >
                  {processing ? 'Activating Membership...' : `Complete Payment (₹${selectedPlan.numericPrice})`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Membership;
