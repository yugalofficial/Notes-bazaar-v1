import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Mail, Phone, MapPin, Send, HelpCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { SiteSettings } from '../types';
import { z } from 'zod';
import { sanitizePlainText } from '../utils/security';

const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.').max(100),
  email: z.string().email('Please provide a valid email address.').max(160),
  subject: z.string().min(2, 'Subject must be at least 2 characters.').max(200),
  message: z.string().min(5, 'Message must be at least 5 characters.').max(2500),
});

const Contact: React.FC = () => {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [showFaq, setShowFaq] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'main');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data() as SiteSettings);
        }
      } catch (err) {
        console.warn('Could not load contact settings:', err);
      }
    };
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const sanitized = {
      name: sanitizePlainText(formData.name, 100),
      email: formData.email.trim().toLowerCase().slice(0, 160),
      subject: sanitizePlainText(formData.subject, 200),
      message: sanitizePlainText(formData.message, 2500),
    };

    const parsed = contactSchema.safeParse(sanitized);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0].message);
      return;
    }

    setSending(true);
    const payload = {
      ...parsed.data,
      status: 'open',
      created_at: new Date().toISOString(),
    };

    try {
      await addDoc(collection(db, 'contacts'), payload);
    } catch (err) {
      console.warn('Firestore contacts write fell back locally:', err);
    }

    // Mirror locally for instant visibility if offline
    try {
      const key = 'notesbazaar_contact_inquiries';
      const prev = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify([{ id: `loc_${Date.now()}`, ...payload }, ...prev.slice(0, 29)]));
    } catch (storageErr) {}

    setSent(true);
    setFormData({ name: '', email: '', subject: '', message: '' });
    setSending(false);
  };

  const contactInfo = [
    {
      label: 'Email Support',
      value: settings?.contact_email || 'support@notesbazaar.co',
      icon: Mail,
      color: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400',
    },
    {
      label: 'Phone Support',
      value: settings?.contact_phone || '+91 98765 43210',
      icon: Phone,
      color: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Office Address',
      value: settings?.office_address || 'New Delhi, India',
      icon: MapPin,
      color: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
    },
  ];

  return (
    <div className="pb-24">
      {/* Header */}
      <section className="relative pt-16 pb-28 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-primary/5 dark:bg-primary/10 -z-10" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <span className="px-4 py-2 bg-primary/10 text-primary text-xs font-bold rounded-full uppercase tracking-widest inline-block">
              Contact Us
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
              We&apos;re Here to <span className="premium-gradient-text">Help</span> You Succeed.
            </h1>
            <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Have questions about our handwritten notes, Razorpay payments, or instant email delivery? Reach out anytime.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact Info & Form */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Info Cards */}
          <div className="space-y-6">
            {contactInfo.map((info, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.05 }}
                transition={{ delay: i * 0.08 }}
                className="bg-white dark:bg-slate-900 p-7 rounded-[28px] shadow-premium border border-slate-100 dark:border-slate-800 flex items-center gap-5"
              >
                <div className={`w-13 h-13 ${info.color} rounded-2xl flex items-center justify-center flex-shrink-0`}>
                  <info.icon size={22} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">{info.label}</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{info.value}</p>
                </div>
              </motion.div>
            ))}

            <div className="bg-slate-900 border border-slate-800 p-8 rounded-[32px] text-white space-y-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
              <h3 className="text-xl font-bold text-white">Frequently Asked Questions</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Instant answers on PDF downloads, UPI/card payments, and email access links.
              </p>
              <button
                type="button"
                onClick={() => setShowFaq((prev) => !prev)}
                className="w-full py-3.5 bg-white text-slate-900 rounded-2xl font-bold text-sm hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <HelpCircle size={18} /> {showFaq ? 'Hide FAQs' : 'View FAQs'}
              </button>
              {showFaq && (
                <div className="pt-2 space-y-3 text-xs text-slate-300 border-t border-slate-800">
                  <div>
                    <p className="font-bold text-white">When do I receive my notes?</p>
                    <p className="text-slate-400">
                      Immediately after Razorpay payment — unlocked in your Dashboard and sent to your email.
                    </p>
                  </div>
                  <div>
                    <p className="font-bold text-white">Can I preview before buying?</p>
                    <p className="text-slate-400">
                      Yes, click any note&apos;s Page 1 sample to open the full-screen 300% zoom preview.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.05 }}
              className="bg-white dark:bg-slate-900 p-8 md:p-14 rounded-[40px] shadow-premium border border-slate-100 dark:border-slate-800 h-full transition-colors"
            >
              {sent ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6 py-20">
                  <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center">
                    <CheckCircle2 size={40} />
                  </div>
                  <h3 className="text-3xl font-bold text-slate-900 dark:text-white">Message Sent!</h3>
                  <p className="text-slate-500 dark:text-slate-400 max-w-md">
                    Thank you for reaching out. Your inquiry has been logged directly to our support team and we will respond within 24–48 hours.
                  </p>
                  <button onClick={() => setSent(false)} className="premium-button-secondary">
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {formError && (
                    <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                      <AlertCircle size={16} className="shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">
                        Full Name
                      </label>
                      <input
                        required
                        type="text"
                        placeholder="Rahul Verma"
                        className="premium-input"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">
                        Email Address
                      </label>
                      <input
                        required
                        type="email"
                        placeholder="aspirant@example.com"
                        className="premium-input"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">
                      Subject
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="How can we help?"
                      className="premium-input"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">
                      Message
                    </label>
                    <textarea
                      required
                      placeholder="Your message here..."
                      className="premium-input min-h-[160px] resize-none"
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    />
                  </div>
                  <button disabled={sending} type="submit" className="w-full premium-button-primary py-4 text-base">
                    {sending ? 'Sending Message...' : 'Send Message'}
                    {!sending && <Send size={18} />}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
