import React from 'react';
import { motion } from 'motion/react';
import { Shield, Lock, Eye, FileText, UserCheck, Globe } from 'lucide-react';

const Privacy: React.FC = () => {
  const sections = [
    {
      title: 'Information We Collect',
      icon: Eye,
      content:
        'We collect information you provide directly to us, such as when you create an account, make a purchase, or contact us for support. This includes your name, email address, and verified transaction references.',
    },
    {
      title: 'How We Use Your Data',
      icon: UserCheck,
      content:
        'We use your information to process transactions, unlock lifetime access to your purchased handwritten study materials, deliver email access links, and ensure a secure experience on our platform.',
    },
    {
      title: 'Data Security',
      icon: Lock,
      content:
        'We implement strict zero-trust security rules, salted cryptographic protections, and encrypted HTTPS delivery to protect your personal information from unauthorized access or disclosure.',
    },
    {
      title: 'Third-Party Services',
      icon: Globe,
      content:
        'We use trusted payment processors like Razorpay (UPI, QR, Cards, Netbanking) and PayPal, alongside Google Authentication and Cloud Firestore. These providers operate under strict PCI-DSS and security compliance.',
    },
    {
      title: 'Your Choices',
      icon: FileText,
      content:
        'You have the right to access, export, or request deletion of your personal information. You can manage your account from your dashboard or contact our support desk for assistance.',
    },
  ];

  return (
    <div className="pb-24">
      {/* Header */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-slate-900 dark:bg-slate-900/95 -z-10" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <div className="w-16 h-16 bg-primary/20 text-primary rounded-3xl flex items-center justify-center mx-auto mb-4">
              <Shield size={32} />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight leading-tight">
              Privacy Policy
            </h1>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Your privacy is our top priority. Learn how we handle and protect your data at NotesBazaar.
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

export default Privacy;
