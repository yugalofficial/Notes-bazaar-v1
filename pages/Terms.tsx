import React from 'react';
import { motion } from 'motion/react';
import { FileText, ShieldCheck, AlertCircle, Scale, CreditCard, Download } from 'lucide-react';

const Terms: React.FC = () => {
  const sections = [
    {
      title: 'Acceptance of Terms',
      icon: Scale,
      content:
        'By accessing and using NotesBazaar, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our platform.',
    },
    {
      title: 'Intellectual Property',
      icon: FileText,
      content:
        'All handwritten study materials, formula sheets, and content on NotesBazaar are protected by copyright laws. You are granted a personal, non-exclusive license to use the purchased material for personal exam preparation only.',
    },
    {
      title: 'Purchases and Payments',
      icon: CreditCard,
      content:
        'All digital purchases are final once file access is unlocked. We use secure Razorpay & PayPal payment gateways supporting UPI, QR, Credit/Debit Cards, Netbanking, and Wallets.',
    },
    {
      title: 'Digital Delivery',
      icon: Download,
      content:
        'Digital PDF study packs are unlocked instantaneously in your Student Dashboard and dispatched via email upon verified payment confirmation.',
    },
    {
      title: 'Prohibited Uses',
      icon: AlertCircle,
      content:
        'You may not redistribute, resell, or publicly re-upload the purchased PDFs. Unauthorized distribution results in immediate account suspension and legal action.',
    },
  ];

  return (
    <div className="pb-24">
      {/* Header */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-primary/10 dark:bg-primary/15 -z-10" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <div className="w-16 h-16 bg-primary/20 text-primary rounded-3xl flex items-center justify-center mx-auto mb-4">
              <ShieldCheck size={32} />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
              Terms of Service
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Please review our licensing and usage guidelines carefully before purchasing study materials.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16">
        <div className="bg-white dark:bg-slate-900 rounded-[40px] p-8 md:p-16 shadow-premium border border-slate-100 dark:border-slate-800 space-y-12 transition-colors">
          {sections.map((section, i) => (
            <div key={i} className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
              <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center flex-shrink-0">
                <section.icon size={24} />
              </div>
              <div className="space-y-2.5">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{section.title}</h3>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{section.content}</p>
              </div>
            </div>
          ))}

          <div className="pt-10 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Last Updated: November 2026</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Terms;
