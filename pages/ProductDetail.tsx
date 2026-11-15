import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { User, PaymentMode, Note, SiteSettings } from '../types';
import { auth, db } from '../firebase';
import { doc, getDoc, collection, addDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import emailjs from '@emailjs/browser';
import { jsPDF } from 'jspdf';
import confetti from 'canvas-confetti';
import {
  Download,
  ShieldCheck,
  Lock,
  Star,
  CheckCircle2,
  ArrowLeft,
  Share2,
  CreditCard,
  Info,
  ChevronRight,
  ChevronLeft,
  FileDown,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  X,
  Smartphone,
  Landmark,
  Wallet,
  Check,
  Tag,
  CalendarClock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ReviewSystem } from '../components/ReviewSystem';
import { NotesBazaarLogo } from '../components/NotesBazaarLogo';
import { getSafePreviewImages } from '../utils/sampleNotesPages';
import {
  appendPurchasedNoteToSession,
  fetchNotesFromGoogleSheets,
  getBuiltinNoteById,
  recordLocalOrder
} from '../utils/appScriptService';

interface ProductDetailProps {
  user: User | null;
}

declare global {
  interface Window {
    Razorpay: any;
    paypal: any;
  }
}

type RazorpayServiceTab = 'upi' | 'card' | 'netbanking' | 'wallet' | 'emi';

const ProductDetail: React.FC<ProductDetailProps> = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const paypalRef = useRef<HTMLDivElement>(null);
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'details' | 'reviews'>('preview');
  const [shareCopied, setShareCopied] = useState(false);

  // Full-Screen Preview Zoom Modal State
  const [zoomModalOpen, setZoomModalOpen] = useState(false);
  const [activePreviewIdx, setActivePreviewIdx] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; origX: number; origY: number } | null>(null);

  // Promo Coupon State
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; percent: number } | null>(null);
  const [couponFeedback, setCouponFeedback] = useState<string | null>(null);

  // Interactive Razorpay All-Services Checkout State
  const [showDemoPaymentModal, setShowDemoPaymentModal] = useState(false);
  const [demoSimulating, setDemoSimulating] = useState(false);
  const [selectedPayTab, setSelectedPayTab] = useState<RazorpayServiceTab>('upi');
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');
  const [selectedWallet, setSelectedWallet] = useState('PhonePe Wallet');
  const [selectedEmiOption, setSelectedEmiOption] = useState('Simpl / LazyPay PayLater');
  const [upiIdInput, setUpiIdInput] = useState('student@okaxis');
  const [cardNumberInput, setCardNumberInput] = useState('4111 •••• •••• 1111');
  const [cardExpiryInput, setCardExpiryInput] = useState('12/28');
  const [cardCvvInput, setCardCvvInput] = useState('•••');

  useEffect(() => {
    fetchProductAndSettings();
  }, [id]);

  // Keyboard shortcuts inside Full-Screen Zoom Modal
  useEffect(() => {
    if (!zoomModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setZoomModalOpen(false);
      } else if (e.key === '+' || e.key === '=') {
        setZoomLevel((z) => Math.min(3, Number((z + 0.5).toFixed(2))));
      } else if (e.key === '-') {
        setZoomLevel((z) => {
          const next = Math.max(1, Number((z - 0.5).toFixed(2)));
          if (next === 1) setPanOffset({ x: 0, y: 0 });
          return next;
        });
      } else if (e.key === 'ArrowRight') {
        setActivePreviewIdx((idx) => Math.min((previewImagesList.length || 1) - 1, idx + 1));
        setZoomLevel(1);
        setPanOffset({ x: 0, y: 0 });
      } else if (e.key === 'ArrowLeft') {
        setActivePreviewIdx((idx) => Math.max(0, idx - 1));
        setZoomLevel(1);
        setPanOffset({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  useEffect(() => {
    if (paypalLoaded && settings?.enable_paypal && paypalRef.current && window.paypal) {
      paypalRef.current.innerHTML = '';
      try {
        window.paypal
          .Buttons({
            createOrder: (_data: any, actions: any) => {
              return actions.order.create({
                purchase_units: [
                  {
                    description: product?.title,
                    amount: { value: product?.price.toString() }
                  }
                ]
              });
            },
            onApprove: async (_data: any, actions: any) => {
              const order = await actions.order.capture();
              await handlePaymentSuccess(order.id, 'paypal');
            },
            onError: (err: any) => {
              console.error('PayPal Error:', err);
            }
          })
          .render(paypalRef.current);
      } catch (e) {
        console.error('Error rendering PayPal buttons:', e);
      }
    }
  }, [paypalLoaded, settings, product]);

  const fetchProductAndSettings = async () => {
    if (!id) return;
    setLoading(true);

    // Fetch settings safely
    const defaultSettings: SiteSettings = {
      razorpay_key: import.meta.env.VITE_RAZORPAY_KEY_ID || '',
      paypal_client_id: import.meta.env.VITE_PAYPAL_CLIENT_ID || '',
      enable_razorpay: true,
      enable_paypal: false
    };

    try {
      const settingsRef = doc(db, 'settings', 'main');
      const settingsSnap = await getDoc(settingsRef);
      if (settingsSnap.exists()) {
        const settingsData = settingsSnap.data() as SiteSettings;
        setSettings(settingsData);
        if (settingsData.enable_paypal && settingsData.paypal_client_id) {
          loadPaypalScript(settingsData.paypal_client_id);
        }
      } else {
        setSettings(defaultSettings);
      }
    } catch (e) {
      setSettings(defaultSettings);
    }

    // 1. Try Google Sheets catalog first if configured
    try {
      const sheetNotes = await fetchNotesFromGoogleSheets();
      const matchedSheet = sheetNotes?.find((n) => n.id === id);
      if (matchedSheet) {
        setProduct(matchedSheet);
        setLoading(false);
        return;
      }
    } catch (e) {}

    // 2. Try Firestore document
    try {
      const productRef = doc(db, 'products', id);
      const productSnap = await getDoc(productRef);

      if (productSnap.exists()) {
        const productData = productSnap.data();
        setProduct({
          id: productSnap.id,
          title: productData.title,
          category: productData.category,
          examType: productData.exam_type,
          description: productData.description,
          price: productData.price,
          originalPrice: productData.original_price,
          previewImages: productData.preview_images || [],
          fileUrl: productData.file_url,
          rating: productData.rating,
          reviewsCount: productData.reviews_count,
          isBestseller: productData.is_bestseller,
          studentsBought: productData.students_bought
        });
        setLoading(false);
        return;
      }
    } catch (err) {
      console.warn('Firestore product lookup failed, trying builtin catalog:', err);
    }

    // 3. Builtin Catalog Fallback (matches IDs used on Home / Shop / Sheets)
    const builtinMatch = getBuiltinNoteById(id);
    if (builtinMatch) {
      setProduct(builtinMatch);
    } else {
      setProduct({
        id: id || 'prod_ssc_math_01',
        title: 'Premium Handwritten Study Material',
        category: 'General Studies',
        examType: 'SSC' as any,
        description:
          'High-quality, topper-verified handwritten notes designed for comprehensive exam preparation. Includes shortcuts, diagrams, and easy-to-understand explanations.',
        price: 299,
        originalPrice: 999,
        previewImages: [],
        fileUrl: '#',
        rating: 4.8,
        reviewsCount: 120,
        isBestseller: true,
        studentsBought: '850'
      });
    }
    setLoading(false);
  };

  const loadPaypalScript = (clientId: string) => {
    if (document.getElementById('paypal-sdk')) {
      setPaypalLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
    script.id = 'paypal-sdk';
    script.onload = () => setPaypalLoaded(true);
    document.body.appendChild(script);
  };

  const generateInvoice = (paymentId: string) => {
    if (!product || !user) return null;
    const pdf = new jsPDF();
    pdf.setFontSize(22);
    pdf.setTextColor(13, 148, 136);
    pdf.text('NotesBazaar Invoice', 20, 30);

    pdf.setFontSize(12);
    pdf.setTextColor(100);
    pdf.text(`Date: ${new Date().toLocaleDateString()}`, 20, 40);
    pdf.text(`Order ID: ${paymentId}`, 20, 47);

    pdf.setTextColor(0);
    pdf.setFontSize(14);
    pdf.text('Bill To:', 20, 65);
    pdf.setFontSize(12);
    pdf.text(user.displayName, 20, 72);
    pdf.text(user.email, 20, 79);

    pdf.setFillColor(248, 250, 252);
    pdf.rect(20, 95, 170, 10, 'F');
    pdf.setFontSize(10);
    pdf.text('Product Description', 25, 102);
    pdf.text('Amount', 160, 102);

    pdf.text(product.title, 25, 115);
    pdf.text(`INR ${finalPrice}`, 160, 115);

    pdf.setDrawColor(200);
    pdf.line(20, 125, 190, 125);
    pdf.setFontSize(14);
    pdf.text('Total Paid:', 120, 140);
    pdf.text(`INR ${finalPrice}`, 160, 140);

    pdf.setFontSize(10);
    pdf.setTextColor(150);
    pdf.text('Thank you for choosing NotesBazaar — Your Study Partner!', 20, 160);
    pdf.text('This is a computer-generated invoice.', 20, 167);
    return pdf;
  };

  const handlePaymentSuccess = async (
    paymentId: string,
    provider: 'razorpay' | 'paypal' | 'razorpay_demo',
    paymentMethodLabel?: string
  ) => {
    if (!product) return;
    setProcessing(true);
    const userEmail = user?.email || 'guest@example.com';
    const userName = user?.displayName || 'Aspirant';
    const targetFileUrl = product.fileUrl && product.fileUrl !== '#' ? product.fileUrl : `${window.location.origin}/#/dashboard`;

    try {
      // 1. Persist purchase & local order ledger immediately
      appendPurchasedNoteToSession(product.id);
      recordLocalOrder({
        id: paymentId,
        user_email: userEmail,
        product_id: product.id,
        product_title: product.title,
        amount: finalPrice,
        status: 'paid',
        payment_id: paymentId,
        provider,
        payment_method: paymentMethodLabel || 'Razorpay',
        created_at: new Date().toISOString()
      });

      // 2. Record Order & Unlock Note in Firestore when Firebase Auth session is active
      if (auth.currentUser) {
        const fbEmail = auth.currentUser.email || userEmail;
        try {
          await addDoc(collection(db, 'orders'), {
            uid: auth.currentUser.uid,
            user_email: fbEmail,
            amount: Number(finalPrice) || 0,
            status: 'paid',
            product_id: product.id,
            product_title: product.title,
            payment_id: paymentId,
            provider,
            payment_method: paymentMethodLabel || 'Razorpay',
            created_at: new Date().toISOString()
          });
        } catch (dbErr) {
          console.warn('Firestore order record note (recorded locally & via Sheets):', dbErr);
        }

        try {
          const userRef = doc(db, 'users', auth.currentUser.uid);
          await updateDoc(userRef, {
            purchasedNotes: arrayUnion(product.id),
            updatedAt: new Date().toISOString()
          });
        } catch (uErr) {
          console.warn('Could not update user record directly in Firestore:', uErr);
        }

        try {
          await addDoc(collection(db, 'activity_logs'), {
            uid: auth.currentUser.uid,
            userEmail: fbEmail,
            action: 'ORDER_PAID',
            details: `Purchased ${product.title} (₹${finalPrice}) via ${paymentMethodLabel || provider}`,
            createdAt: new Date().toISOString()
          });
        } catch (logErr) {}
      }

      // 4. Generate Invoice PDF
      const invoiceDoc = generateInvoice(paymentId);
      const invoiceBase64 = invoiceDoc?.output('datauristring');

      // 5. Automated Google Apps Script Delivery
      const appScriptUrl = settings?.appscript_webhook_url;
      try {
        const { dispatchAppScriptEmailDelivery } = await import('../utils/deliveryService');
        await dispatchAppScriptEmailDelivery(appScriptUrl, {
          toEmail: userEmail,
          toName: userName,
          productTitle: product.title,
          productId: product.id,
          productCategory: product.category,
          examType: product.examType,
          amount: finalPrice,
          paymentId,
          provider,
          downloadUrl: targetFileUrl,
          purchasedAt: new Date().toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          }),
          invoiceDataUri: invoiceBase64,
          supportEmail: settings?.contact_email || 'support@notesbazaar.co'
        });
      } catch (appScriptErr) {
        console.warn('Apps Script delivery dispatch error:', appScriptErr);
      }

      // 6. Fallback Email via EmailJS
      const serviceId = settings?.emailjs_service_id || import.meta.env.VITE_EMAILJS_SERVICE_ID;
      const templateId = settings?.emailjs_template_id || import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
      const publicKey = settings?.emailjs_public_key || import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

      if (serviceId && templateId && publicKey) {
        try {
          await emailjs.send(
            serviceId,
            templateId,
            {
              to_email: userEmail,
              to_name: userName,
              product_name: product.title,
              download_link: targetFileUrl,
              order_id: paymentId,
              amount: product.price,
              invoice_pdf: invoiceBase64
            },
            publicKey
          );
        } catch (e) {
          console.warn('EmailJS send failed:', e);
        }
      }

      // 7. Celebration Confetti
      confetti({
        particleCount: 160,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#1D4ED8', '#0D9488', '#059669', '#F59E0B']
      });

      navigate('/thank-you', {
        state: {
          product,
          paymentId,
          deliveryChannel: appScriptUrl ? 'Google AppScript Email & Dashboard' : 'Student Dashboard & Email'
        }
      });
    } catch (err) {
      console.error('Payment processing error:', err);
      navigate('/thank-you', { state: { product, paymentId } });
    } finally {
      setProcessing(false);
    }
  };

  const handleSecureDownload = () => {
    if (!product) return;
    setDownloading(true);
    if (product.fileUrl && product.fileUrl !== '#') {
      window.open(product.fileUrl, '_blank');
      setTimeout(() => setDownloading(false), 600);
      return;
    }

    // Generate clean multi-page PDF study capsule when using demo/sample catalog link
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    pdf.setFillColor(29, 78, 216);
    pdf.rect(0, 0, 210, 32, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.text('NOTESBAZAAR • VERIFIED TOPPER NOTES', 15, 16);
    pdf.setFontSize(10);
    pdf.text(`${product.examType} | ${product.category} — Your Study Partner`, 15, 24);

    pdf.setTextColor(15, 23, 42);
    pdf.setFontSize(16);
    pdf.text(product.title, 15, 48);
    pdf.setFont('Helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(71, 85, 105);
    const wrapped = pdf.splitTextToSize(product.description, 180);
    pdf.text(wrapped, 15, 58);

    pdf.setDrawColor(13, 148, 136);
    pdf.setFillColor(240, 253, 250);
    pdf.rect(15, 85, 180, 150, 'FD');
    pdf.setFont('Helvetica', 'bold');
    pdf.setTextColor(13, 148, 136);
    pdf.text('HIGH-YIELD EXAM SUMMARY SHEET', 22, 98);
    pdf.setFont('Helvetica', 'normal');
    pdf.setTextColor(30, 41, 59);
    pdf.setFontSize(10.5);
    pdf.text('• Complete Topic-wise Formula & Timeline Digest included.', 22, 112);
    pdf.text('• Previous Year Questions (PYQ) High-Probability Patterns marked.', 22, 122);
    pdf.text('• Licensed exclusively to: ' + (user?.email || 'Verified Aspirant'), 22, 132);
    pdf.save(`${product.title.replace(/[^a-z0-9]/gi, '_').slice(0, 32)}.pdf`);
    setTimeout(() => setDownloading(false), 600);
  };

  // Live or Demo Razorpay Payment Execution (supports all professional payment methods)
  const handleRazorpayPayment = async () => {
    if (!product) return;

    const activeKey = settings?.razorpay_key?.trim();
    const isLiveKey = activeKey && !activeKey.includes('demo') && activeKey.startsWith('rzp_');

    if (isLiveKey && (window as any).Razorpay) {
      setProcessing(true);
      try {
        const options = {
          key: activeKey,
          amount: Math.round(finalPrice * 100),
          currency: 'INR',
          name: 'NotesBazaar',
          description: `Study Material: ${product.title}`,
          handler: async function (response: any) {
            await handlePaymentSuccess(response.razorpay_payment_id || `pay_${Date.now()}`, 'razorpay', 'Razorpay Live');
          },
          prefill: {
            name: user?.displayName || 'Aspirant',
            email: user?.email || '',
            contact: ''
          },
          notes: {
            product_id: product.id,
            exam_type: product.examType
          },
          method: {
            upi: true,
            card: true,
            netbanking: true,
            wallet: true,
            emi: true,
            paylater: true
          },
          theme: {
            color: '#0D9488'
          },
          modal: {
            ondismiss: () => setProcessing(false)
          }
        };
        const rzp1 = new (window as any).Razorpay(options);
        rzp1.on('payment.failed', function (resp: any) {
          console.warn('Payment failed:', resp.error?.description);
          setProcessing(false);
        });
        rzp1.open();
        return;
      } catch (err) {
        console.warn('Razorpay live modal fallback to interactive checkout:', err);
      }
    }

    setShowDemoPaymentModal(true);
  };

  const executeDemoPayment = async () => {
    setDemoSimulating(true);
    const demoPaymentId = `pay_nb_${selectedPayTab}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const methodLabel =
      selectedPayTab === 'upi'
        ? `UPI (${upiIdInput || 'QR Instant'})`
        : selectedPayTab === 'card'
          ? 'Credit / Debit Card'
          : selectedPayTab === 'netbanking'
            ? `Netbanking (${selectedBank})`
            : selectedPayTab === 'emi'
              ? `PayLater / EMI (${selectedEmiOption})`
              : `Wallet (${selectedWallet})`;

    setTimeout(async () => {
      setShowDemoPaymentModal(false);
      setDemoSimulating(false);
      await handlePaymentSuccess(demoPaymentId, 'razorpay_demo', methodLabel);
    }, 1100);
  };

  const initPayment = async (mode: PaymentMode) => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (mode === PaymentMode.RAZORPAY) await handleRazorpayPayment();
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: product?.title || 'NotesBazaar Handwritten Notes',
          text: `Check out these topper-verified ${product?.examType} notes on NotesBazaar!`,
          url: shareUrl
        });
        return;
      }
    } catch (e) {}

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch (e) {}
  };

  // Zoom Modal helpers
  const openZoomModal = (pageIndex: number) => {
    setActivePreviewIdx(pageIndex);
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    setZoomModalOpen(true);
  };

  const handleZoomStep = (delta: number) => {
    setZoomLevel((prev) => {
      const next = Math.min(3, Math.max(1, Number((prev + delta).toFixed(2))));
      if (next === 1) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const handleWheelZoom = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    handleZoomStep(delta);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (zoomLevel <= 1) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      origX: panOffset.x,
      origY: panOffset.y
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current || zoomLevel <= 1) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPanOffset({
      x: dragStartRef.current.origX + dx,
      y: dragStartRef.current.origY + dy
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const isPurchased = Boolean(user?.purchasedNotes?.includes(id || ''));
  const previewImagesList = product ? getSafePreviewImages(product.examType, product.previewImages) : [];
  const finalPrice = product
    ? Math.max(1, Math.round(product.price * (1 - (appliedCoupon?.percent || 0) / 100)))
    : 0;

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponInput.trim().toUpperCase();
    const configuredCode = (settings?.promo_code || 'TOPPER10').trim().toUpperCase();
    const configuredPct = Number(settings?.promo_discount_percent || 10);

    if (!code) return;
    if (code === configuredCode) {
      setAppliedCoupon({ code, percent: Math.min(80, Math.max(1, configuredPct)) });
      setCouponFeedback(`Applied "${code}" — ${configuredPct}% student discount unlocked!`);
    } else if (code === 'EXAM20') {
      setAppliedCoupon({ code: 'EXAM20', percent: 20 });
      setCouponFeedback('Applied "EXAM20" — 20% topper discount unlocked!');
    } else {
      setAppliedCoupon(null);
      setCouponFeedback(`Invalid code. Try ${configuredCode} for ${configuredPct}% off.`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Loading handwritten notes...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
          <Info size={32} className="text-slate-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Product Not Found</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8">The notes you are looking for might have been moved.</p>
        <Link to="/shop" className="premium-button-primary">
          Back to Library
        </Link>
      </div>
    );
  }

  const isModalPageLocked = !isPurchased && activePreviewIdx > 0;

  return (
    <div className="min-h-screen pb-32">
      {/* Header / Breadcrumb */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors text-xs font-bold cursor-pointer"
          >
            <ArrowLeft size={18} /> Back
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-3.5 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors text-xs font-bold cursor-pointer"
            >
              {shareCopied ? <Check size={16} className="text-emerald-600" /> : <Share2 size={16} />}
              <span>{shareCopied ? 'Link Copied!' : 'Share'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-10">
          {/* Main Content: Preview */}
          <div className="lg:col-span-2 space-y-7">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold">
                <span className="text-blue-700 dark:text-blue-400 font-bold uppercase tracking-wider">
                  {product.examType}
                </span>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span className="text-slate-500 dark:text-slate-400">{product.category}</span>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <div className="flex items-center gap-1 text-amber-500">
                  <Star size={14} fill="currentColor" />
                  <span className="font-bold text-slate-800 dark:text-slate-200">{product.rating || '4.8'}</span>
                  <span className="text-slate-400">({product.reviewsCount || '120'} reviews)</span>
                </div>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white font-heading leading-tight">
                {product.title}
              </h1>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{product.description}</p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-5 py-3 font-bold text-sm transition-all relative cursor-pointer ${
                  activeTab === 'preview' ? 'text-primary' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                Sample Preview ({previewImagesList.length} Pages)
                {activeTab === 'preview' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
              </button>
              <button
                onClick={() => setActiveTab('details')}
                className={`px-5 py-3 font-bold text-sm transition-all relative cursor-pointer ${
                  activeTab === 'details' ? 'text-primary' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                Study Details
                {activeTab === 'details' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
              </button>
              <button
                onClick={() => setActiveTab('reviews')}
                className={`px-5 py-3 font-bold text-sm transition-all relative cursor-pointer ${
                  activeTab === 'reviews' ? 'text-primary' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                Reviews &amp; Ratings
                {activeTab === 'reviews' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
              </button>
            </div>

            <div>
              {activeTab === 'preview' && (
                <div className="space-y-5">
                  {/* Top Bar: Zoom Trigger + Page Switcher */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 sm:px-5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-2.5 text-xs font-bold">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                        {isPurchased ? 'Full Access Unlocked' : 'Page 1 Free Sample'}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        Page {activePreviewIdx + 1} of {previewImagesList.length}
                      </span>
                    </div>

                    <button
                      onClick={() => openZoomModal(activePreviewIdx)}
                      className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-blue-700 dark:hover:bg-primary dark:hover:text-white transition-colors cursor-pointer"
                    >
                      <Maximize2 size={14} /> Full-Screen Zoom (Up to 300%)
                    </button>
                  </div>

                  {/* Interactive Main Preview Canvas */}
                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm relative p-4 sm:p-8">
                    <div
                      onClick={() => openZoomModal(activePreviewIdx)}
                      className="relative group cursor-zoom-in rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-700 shadow-lg bg-white"
                    >
                      <img
                        src={previewImagesList[activePreviewIdx]}
                        className={`w-full h-auto transition-all duration-300 ${
                          !isPurchased && activePreviewIdx > 0 ? 'blur-[6px] select-none scale-[1.01]' : ''
                        }`}
                        alt={`${product.title} — Preview Page ${activePreviewIdx + 1}`}
                      />

                      {/* Floating Zoom Lens Affordance for Unlocked/Sample Page */}
                      {(isPurchased || activePreviewIdx === 0) && (
                        <div className="absolute bottom-4 right-4 bg-slate-900/85 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xl opacity-95 group-hover:bg-blue-700 transition-colors">
                          <ZoomIn size={16} /> Click to Zoom Full Screen
                        </div>
                      )}

                      {/* Locked Overlay ONLY for Page 2+ when unpurchased */}
                      {!isPurchased && activePreviewIdx > 0 && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm z-20 flex items-center justify-center p-6"
                        >
                          <motion.div
                            initial={{ scale: 0.94, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl border border-slate-100 dark:border-slate-800"
                          >
                            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-5">
                              <Lock size={28} strokeWidth={1.75} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                              Unlock Page {activePreviewIdx + 1} &amp; Full PDF
                            </h3>
                            <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm leading-relaxed">
                              You&apos;ve inspected Page 1 free sample. Unlock the complete high-resolution study pack for instant PDF download and email delivery.
                            </p>
                            <button
                              onClick={() => initPayment(PaymentMode.RAZORPAY)}
                              className="w-full premium-button-primary py-4 rounded-2xl"
                            >
                              Unlock Full Notes for ₹{product.price}
                            </button>
                          </motion.div>
                        </div>
                      )}
                    </div>

                    {/* Page Thumbnails Selector */}
                    <div className="mt-5 flex items-center gap-3 overflow-x-auto pb-2">
                      {previewImagesList.map((thumb, idx) => {
                        const locked = !isPurchased && idx > 0;
                        const active = idx === activePreviewIdx;
                        return (
                          <button
                            key={idx}
                            onClick={() => setActivePreviewIdx(idx)}
                            className={`relative w-20 h-24 rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                              active
                                ? 'border-blue-700 ring-2 ring-blue-700/20 scale-105'
                                : 'border-slate-200 dark:border-slate-700 opacity-75 hover:opacity-100'
                            }`}
                          >
                            <img
                              src={thumb}
                              alt={`Thumbnail Page ${idx + 1}`}
                              className={`w-full h-full object-cover object-top ${locked ? 'blur-[2px]' : ''}`}
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-slate-900/75 text-white text-[10px] font-bold py-0.5 text-center flex items-center justify-center gap-1">
                              {locked && <Lock size={9} />}
                              P.{idx + 1}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'details' && (
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-8">
                  <div className="grid sm:grid-cols-2 gap-8">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Exam Target</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{product.examType}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Format</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">High-Res Print-Ready PDF</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Preview Pages</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{previewImagesList.length}+ Sample Sheets</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Delivery</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">Instant Email + Dashboard</p>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                    <h4 className="font-bold text-slate-900 dark:text-white mb-4">What&apos;s included:</h4>
                    <ul className="grid sm:grid-cols-2 gap-4">
                      {[
                        'Complete Syllabus Coverage',
                        'Topper Curated Shortcuts',
                        'Zoom-Clear Vector & Scan Layouts',
                        'Print-Ready A4 PDF Formatting',
                        'Lifetime Free Syllabus Updates',
                        'Instant Automated Email Delivery'
                      ].map((item, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {activeTab === 'reviews' && (
                <ReviewSystem
                  productId={product.id}
                  user={user}
                  isPurchased={isPurchased}
                  onReviewUpdate={(avg, count) => {
                    setProduct((prev) => (prev ? { ...prev, rating: avg, reviewsCount: count } : null));
                  }}
                />
              )}
            </div>
          </div>

          {/* Sidebar: Purchase Card */}
          <aside className="space-y-6">
            <div className="sticky top-24 bg-white dark:bg-slate-900 rounded-3xl p-7 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-3xl font-bold text-slate-900 dark:text-white">₹{finalPrice}</span>
                  {(appliedCoupon || product.originalPrice) && (
                    <span className="text-sm text-slate-400 line-through">
                      ₹{appliedCoupon ? product.price : product.originalPrice}
                    </span>
                  )}
                </div>
                {product.originalPrice && product.originalPrice > finalPrice && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-lg text-xs font-bold">
                    {Math.round(((product.originalPrice - finalPrice) / product.originalPrice) * 100)}% OFF
                  </div>
                )}
              </div>

              {!isPurchased && (
                <form onSubmit={handleApplyCoupon} className="space-y-1.5">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag size={13} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value)}
                        placeholder={`Promo (${settings?.promo_code || 'TOPPER10'})`}
                        className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono uppercase text-slate-900 dark:text-white focus:outline-none focus:border-primary"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold hover:bg-primary transition-colors cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                  {couponFeedback && (
                    <p
                      className={`text-[11px] font-semibold ${
                        appliedCoupon ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {couponFeedback}
                    </p>
                  )}
                </form>
              )}

              <div className="space-y-3">
                {isPurchased ? (
                  <button
                    onClick={handleSecureDownload}
                    disabled={downloading}
                    className="w-full premium-button-primary flex items-center justify-center gap-2"
                  >
                    {downloading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Download size={20} />
                        Download Full Notes PDF
                      </>
                    )}
                  </button>
                ) : (
                  <>
                    {(settings?.enable_razorpay ?? true) && (
                      <div className="space-y-2.5">
                        <button
                          onClick={() => initPayment(PaymentMode.RAZORPAY)}
                          disabled={processing}
                          className="w-full premium-button-primary flex items-center justify-center gap-2 group"
                        >
                          {processing ? (
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Securing Order...</span>
                            </div>
                          ) : (
                            <>
                              <span>Buy Now for ₹{finalPrice}</span>
                              <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </>
                          )}
                        </button>
                        <p className="text-center text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          Razorpay · UPI, QR, Cards, Netbanking, Wallets &amp; EMI
                        </p>
                      </div>
                    )}

                    {settings?.enable_paypal && (
                      <div className="w-full pt-2">
                        {paypalLoaded ? (
                          <div ref={paypalRef} className="z-0 relative"></div>
                        ) : (
                          <div className="text-center py-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs text-slate-400">
                            Loading PayPal...
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Supported Razorpay Payment Methods Overview */}
              <div className="grid grid-cols-5 gap-1.5 pt-2 text-center">
                {[
                  { label: 'UPI', icon: Smartphone },
                  { label: 'Cards', icon: CreditCard },
                  { label: 'Banks', icon: Landmark },
                  { label: 'Wallets', icon: Wallet },
                  { label: 'EMI', icon: CalendarClock }
                ].map((srv) => (
                  <div
                    key={srv.label}
                    className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex flex-col items-center gap-1"
                  >
                    <srv.icon size={14} className="text-blue-700 dark:text-blue-400" />
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{srv.label}</span>
                  </div>
                ))}
              </div>

              {/* Enhanced Value Guarantees */}
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 font-medium">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">256-Bit Razorpay Security</span>
                    <span className="text-[11px] text-slate-400">Zero convenience fee on UPI &amp; Cards</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 font-medium">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <FileDown size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">Instant PDF + Email Link</span>
                    <span className="text-[11px] text-slate-400">Immediate download in your Dashboard</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-1.5">
                  <div className="flex -space-x-2">
                    {['AK', 'PM', 'RS'].map((init, idx) => (
                      <div
                        key={init}
                        className={`w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-[9px] font-bold text-white ${
                          idx % 2 === 0 ? 'bg-blue-700' : 'bg-emerald-600'
                        }`}
                      >
                        {init}
                      </div>
                    ))}
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {product.studentsBought || '850'}+ Aspirants Purchased
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  Verified topper notes with memory charts, formulas, and high-probability questions.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* FULL-SCREEN HANDWRITTEN NOTES PREVIEW ZOOM MODAL                      */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {zoomModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Full-screen handwritten notes zoom viewer"
          >
            {/* Modal Top Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-slate-900/90 border-b border-slate-800 text-white shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <NotesBazaarLogo variant="mark" size={32} className="shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate max-w-[200px] sm:max-w-md">{product.title}</h3>
                  <p className="text-[11px] text-slate-400">
                    Page {activePreviewIdx + 1} of {previewImagesList.length} ·{' '}
                    {isModalPageLocked ? 'Locked Preview' : isPurchased ? 'Unlocked Full Access' : 'Free Sample Page'}
                  </p>
                </div>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={() => handleZoomStep(-0.5)}
                  disabled={zoomLevel <= 1}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white transition-colors cursor-pointer"
                  title="Zoom Out (-)"
                  aria-label="Zoom out"
                >
                  <ZoomOut size={18} />
                </button>

                <div className="hidden sm:flex items-center gap-1 bg-slate-800 p-1 rounded-xl">
                  {[1, 1.5, 2, 3].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => {
                        setZoomLevel(preset);
                        if (preset === 1) setPanOffset({ x: 0, y: 0 });
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        Math.abs(zoomLevel - preset) < 0.1
                          ? 'bg-primary text-white'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {Math.round(preset * 100)}%
                    </button>
                  ))}
                </div>

                <span className="sm:hidden text-xs font-mono font-bold px-2">{Math.round(zoomLevel * 100)}%</span>

                <button
                  onClick={() => handleZoomStep(0.5)}
                  disabled={zoomLevel >= 3}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white transition-colors cursor-pointer"
                  title="Zoom In (+)"
                  aria-label="Zoom in"
                >
                  <ZoomIn size={18} />
                </button>

                <button
                  onClick={() => {
                    setZoomLevel(1);
                    setPanOffset({ x: 0, y: 0 });
                  }}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                  title="Reset Zoom"
                  aria-label="Reset zoom"
                >
                  <RotateCcw size={18} />
                </button>

                <button
                  onClick={() => setZoomModalOpen(false)}
                  className="ml-2 w-11 h-11 rounded-xl bg-white/10 hover:bg-red-500 text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Close Full Screen (Esc)"
                  aria-label="Close zoom modal"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Interactive Zoom & Pan Canvas */}
            <div
              className={`flex-1 relative overflow-hidden flex items-center justify-center p-4 sm:p-8 select-none ${
                zoomLevel > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'
              }`}
              onWheel={handleWheelZoom}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onDoubleClick={() => {
                if (zoomLevel > 1) {
                  setZoomLevel(1);
                  setPanOffset({ x: 0, y: 0 });
                } else {
                  setZoomLevel(2);
                }
              }}
            >
              {/* Prev Page Arrow */}
              {activePreviewIdx > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePreviewIdx((i) => Math.max(0, i - 1));
                    setZoomLevel(1);
                    setPanOffset({ x: 0, y: 0 });
                  }}
                  className="absolute left-3 sm:left-6 z-30 w-11 h-11 rounded-full bg-slate-900/80 hover:bg-primary text-white flex items-center justify-center border border-white/15 shadow-lg cursor-pointer"
                  aria-label="Previous preview page"
                >
                  <ChevronLeft size={22} />
                </button>
              )}

              {/* Zoomable Sheet */}
              <motion.div
                animate={{
                  scale: zoomLevel,
                  x: panOffset.x,
                  y: panOffset.y
                }}
                transition={{ type: 'spring', stiffness: 280, damping: 30 }}
                className="relative max-h-full max-w-3xl w-full flex items-center justify-center"
              >
                <img
                  src={previewImagesList[activePreviewIdx]}
                  draggable={false}
                  alt={`Zoomed Preview Page ${activePreviewIdx + 1}`}
                  className={`max-h-[75vh] w-auto rounded-xl shadow-2xl border border-white/15 bg-white ${
                    isModalPageLocked ? 'blur-[8px]' : ''
                  }`}
                />
              </motion.div>

              {/* Lock card inside Zoom Modal if viewing locked Page 2+ */}
              {isModalPageLocked && (
                <div className="absolute inset-0 z-20 flex items-center justify-center p-6 pointer-events-auto">
                  <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-slate-200 dark:border-slate-700">
                    <div className="w-14 h-14 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Lock size={24} />
                    </div>
                    <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                      Page {activePreviewIdx + 1} is Locked
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                      Purchase this notes pack to inspect all {previewImagesList.length}+ pages in high resolution and download the PDF.
                    </p>
                    <button
                      onClick={() => {
                        setZoomModalOpen(false);
                        initPayment(PaymentMode.RAZORPAY);
                      }}
                      className="w-full premium-button-primary py-3.5"
                    >
                      Unlock Full Notes (₹{product.price})
                    </button>
                  </div>
                </div>
              )}

              {/* Next Page Arrow */}
              {activePreviewIdx < previewImagesList.length - 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePreviewIdx((i) => Math.min(previewImagesList.length - 1, i + 1));
                    setZoomLevel(1);
                    setPanOffset({ x: 0, y: 0 });
                  }}
                  className="absolute right-3 sm:right-6 z-30 w-11 h-11 rounded-full bg-slate-900/80 hover:bg-primary text-white flex items-center justify-center border border-white/15 shadow-lg cursor-pointer"
                  aria-label="Next preview page"
                >
                  <ChevronRight size={22} />
                </button>
              )}
            </div>

            {/* Bottom Page Selector & Action Bar */}
            <div className="px-4 sm:px-6 py-3 bg-slate-900/95 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-white shrink-0">
              <div className="flex items-center gap-2 overflow-x-auto">
                {previewImagesList.map((thumb, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setActivePreviewIdx(idx);
                      setZoomLevel(1);
                      setPanOffset({ x: 0, y: 0 });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      idx === activePreviewIdx
                        ? 'bg-primary text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {!isPurchased && idx > 0 && <Lock size={11} />}
                    Page {idx + 1}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 ml-auto">
                <span className="hidden md:inline text-xs text-slate-400">
                  Tip: Scroll wheel or double-click to zoom, drag to pan
                </span>
                {isPurchased ? (
                  <button
                    onClick={handleSecureDownload}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download size={14} /> Download PDF
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setZoomModalOpen(false);
                      initPayment(PaymentMode.RAZORPAY);
                    }}
                    className="px-5 py-2 bg-gradient-to-r from-blue-600 to-emerald-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Buy &amp; Unlock ₹{product.price}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* RAZORPAY ALL-SERVICES CHECKOUT MODAL (UPI / QR / CARDS / NETBANKING)  */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {showDemoPaymentModal && (
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 dark:border-slate-800 relative overflow-hidden"
            >
              {/* Authentic Blue-Green Header */}
              <div className="bg-gradient-to-r from-blue-800 via-teal-700 to-emerald-700 p-5 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <NotesBazaarLogo variant="mark" size={40} className="rounded-full shadow-md" />
                  <div>
                    <h3 className="font-bold text-white text-base leading-tight">NotesBazaar Checkout</h3>
                    <p className="text-[11px] text-teal-100">Razorpay Trusted Business · 256-bit SSL</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-black">₹{finalPrice}</span>
                  <button
                    onClick={() => setShowDemoPaymentModal(false)}
                    className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center text-sm cursor-pointer"
                    aria-label="Close checkout"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* Item Summary */}
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 px-4 py-3 rounded-2xl border border-slate-200/70 dark:border-slate-800">
                  <div className="min-w-0 pr-3">
                    <span className="text-[10px] uppercase font-bold text-primary tracking-wider block">
                      {appliedCoupon ? `Coupon Applied: ${appliedCoupon.code} (-${appliedCoupon.percent}%)` : 'Instant PDF Unlock'}
                    </span>
                    <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{product.title}</p>
                  </div>
                  <span className="font-black text-slate-900 dark:text-white text-base shrink-0">₹{finalPrice}</span>
                </div>

                {/* All Professional Payment Services Tabs */}
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                    Select Payment Method
                  </p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { id: 'upi' as const, label: 'UPI/QR', icon: Smartphone },
                      { id: 'card' as const, label: 'Card', icon: CreditCard },
                      { id: 'netbanking' as const, label: 'Bank', icon: Landmark },
                      { id: 'wallet' as const, label: 'Wallet', icon: Wallet },
                      { id: 'emi' as const, label: 'PayLater', icon: CalendarClock }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSelectedPayTab(tab.id)}
                        className={`p-2 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          selectedPayTab === tab.id
                            ? 'border-blue-700 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 shadow-sm'
                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <tab.icon size={15} />
                        <span>{tab.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Method Details Panel */}
                <div className="bg-slate-50/70 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 space-y-3">
                  {selectedPayTab === 'upi' && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {['Google Pay', 'PhonePe', 'Paytm', 'BHIM UPI'].map((app) => (
                          <span
                            key={app}
                            className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-bold text-slate-700 dark:text-slate-200"
                          >
                            {app}
                          </span>
                        ))}
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500">UPI ID / VPA</label>
                        <input
                          type="text"
                          value={upiIdInput}
                          onChange={(e) => setUpiIdInput(e.target.value)}
                          placeholder="yourname@okhdfcbank"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-700"
                        />
                      </div>
                    </div>
                  )}

                  {selectedPayTab === 'card' && (
                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-center justify-between text-slate-500 font-semibold">
                        <span>Visa · Mastercard · RuPay</span>
                        <span className="text-emerald-600 font-bold">0% Convenience Fee</span>
                      </div>
                      <input
                        type="text"
                        value={cardNumberInput}
                        onChange={(e) => setCardNumberInput(e.target.value)}
                        aria-label="Card number"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-700"
                      />
                      <div className="grid grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          value={cardExpiryInput}
                          onChange={(e) => setCardExpiryInput(e.target.value)}
                          aria-label="Card expiry"
                          className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-700"
                        />
                        <input
                          type="text"
                          value={cardCvvInput}
                          onChange={(e) => setCardCvvInput(e.target.value)}
                          aria-label="Card CVV"
                          className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-700"
                        />
                      </div>
                    </div>
                  )}

                  {selectedPayTab === 'netbanking' && (
                    <div className="grid grid-cols-2 gap-2">
                      {['HDFC Bank', 'SBI Netbanking', 'ICICI Bank', 'Axis Bank'].map((bank) => (
                        <button
                          key={bank}
                          type="button"
                          onClick={() => setSelectedBank(bank)}
                          className={`p-2.5 rounded-xl border text-xs font-bold text-left cursor-pointer ${
                            selectedBank === bank
                              ? 'border-blue-700 bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400'
                              : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {bank}
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedPayTab === 'wallet' && (
                    <div className="grid grid-cols-2 gap-2">
                      {['PhonePe Wallet', 'Amazon Pay', 'Paytm Wallet', 'Mobikwik Wallet'].map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => setSelectedWallet(w)}
                          className={`p-2.5 rounded-xl border text-xs font-bold text-left cursor-pointer ${
                            selectedWallet === w
                              ? 'border-blue-700 bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400'
                              : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedPayTab === 'emi' && (
                    <div className="grid grid-cols-2 gap-2">
                      {['Simpl / LazyPay PayLater', 'ICICI Cardless EMI', 'HDFC 3-Month EMI', 'Kotak PayLater'].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setSelectedEmiOption(opt)}
                          className={`p-2.5 rounded-xl border text-xs font-bold text-left cursor-pointer ${
                            selectedEmiOption === opt
                              ? 'border-blue-700 bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400'
                              : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={executeDemoPayment}
                  disabled={demoSimulating}
                  className="w-full py-4 bg-gradient-to-r from-blue-700 via-teal-600 to-emerald-600 text-white rounded-xl font-bold text-sm shadow-xl shadow-teal-600/25 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
                >
                  {demoSimulating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Verifying Payment &amp; Delivering Access...</span>
                    </>
                  ) : (
                    <>
                      <span>Pay ₹{finalPrice} &amp; Unlock Now</span>
                      <ChevronRight size={18} />
                    </>
                  )}
                </button>

                <p className="text-center text-[11px] text-slate-400">
                  Secured by Razorpay Checkout · Instant PDF link sent to {user?.email || 'your email'}
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Sticky Buy Bar */}
      {!isPurchased && (
        <div className="md:hidden fixed bottom-16 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 p-4 flex items-center justify-between shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
          <div className="flex flex-col">
            <span className="text-lg font-bold text-slate-900 dark:text-white">₹{finalPrice}</span>
            {product.originalPrice && <span className="text-[10px] text-slate-400 line-through">₹{product.originalPrice}</span>}
          </div>
          <button
            onClick={() => initPayment(PaymentMode.RAZORPAY)}
            disabled={processing}
            className="px-7 py-3 bg-gradient-to-r from-blue-700 to-emerald-600 text-white rounded-xl font-bold text-sm shadow-lg cursor-pointer"
          >
            {processing ? '...' : 'Buy & Unlock'}
          </button>
        </div>
      )}
    </div>
  );
};

export default ProductDetail;
