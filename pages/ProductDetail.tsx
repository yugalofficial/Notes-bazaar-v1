import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { User, PaymentMode, Note, SiteSettings } from '../types';
import { auth, db } from '../firebase';
import {
  doc,
  getDoc,
  collection,
  addDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  getDocs
} from 'firebase/firestore';
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
  CalendarClock,
  AlertTriangle,
  RefreshCw,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ReviewSystem } from '../components/ReviewSystem';
import { NotesBazaarLogo } from '../components/NotesBazaarLogo';
import { getSafePreviewImages } from '../utils/sampleNotesPages';
import { BUILTIN_CATALOG_NOTES } from '../utils/appScriptService';
import {
  appendPurchasedNoteToSession,
  fetchNotesFromGoogleSheets,
  getBuiltinNoteById,
  recordLocalOrder
} from '../utils/appScriptService';
import { applySeoMetadata, setStructuredDataJsonLd } from '../utils/seo';

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
  const [relatedNotes, setRelatedNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentPendingNotice, setPaymentPendingNotice] = useState<string | null>(null);
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

  // Coupon State
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number } | null>(null);
  const [couponFeedback, setCouponFeedback] = useState<string | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  // Demo Checkout Modal State (used ONLY when Live Razorpay Server Keys are not configured)
  const [showDemoPaymentModal, setShowDemoPaymentModal] = useState(false);
  const [demoSimulating, setDemoSimulating] = useState(false);
  const [pendingOrderData, setPendingOrderData] = useState<{
    orderId: string;
    amountInr: number;
    mode: 'demo' | 'live';
  } | null>(null);
  const [selectedPayTab, setSelectedPayTab] = useState<RazorpayServiceTab>('upi');
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');
  const [selectedWallet, setSelectedWallet] = useState('PhonePe Wallet');
  const [selectedEmiOption, setSelectedEmiOption] = useState('Simpl / LazyPay PayLater');
  const [upiIdInput, setUpiIdInput] = useState('student@okaxis');
  const [cardNumberInput, setCardNumberInput] = useState('4111 •••• •••• 1111');
  const [cardExpiryInput, setCardExpiryInput] = useState('12/28');
  const [cardCvvInput, setCardCvvInput] = useState('•••');

  useEffect(() => {
    setAppliedCoupon(null);
    setCouponFeedback(null);
    setCouponInput('');
    setPaymentError(null);
    setPaymentPendingNotice(null);
    setDownloadNotice(null);
    fetchProductAndSettings();
  }, [id]);

  // Apply Dynamic SEO & Product JSON-LD
  useEffect(() => {
    if (!product) return;
    applySeoMetadata({
      title: `${product.title} – NotesBazaar`,
      description: product.description.slice(0, 155),
      noIndex: false,
    });
    setStructuredDataJsonLd('nb-product-schema', {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.title,
      description: product.description,
      category: product.category,
      brand: { '@type': 'Brand', name: 'NotesBazaar' },
      offers: {
        '@type': 'Offer',
        priceCurrency: 'INR',
        price: product.price,
        availability: product.isEnabled === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      },
      ...(product.reviewsCount > 0 && product.rating > 0
        ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: product.rating,
              reviewCount: product.reviewsCount,
            },
          }
        : {}),
    });
    return () => setStructuredDataJsonLd('nb-product-schema', null);
  }, [product]);

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
                    amount: { value: String(finalPrice) }
                  }
                ]
              });
            },
            onApprove: async (_data: any, actions: any) => {
              const order = await actions.order.capture();
              await handlePaymentSuccess(order.id, order.id, 'paypal', 'PayPal', false);
            },
            onError: (err: any) => {
              console.error('PayPal Error:', err);
              setPaymentError('PayPal payment could not complete. Please try again.');
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

    const defaultSettings: SiteSettings = {
      razorpay_key: import.meta.env.VITE_RAZORPAY_KEY_ID || '',
      paypal_client_id: import.meta.env.VITE_PAYPAL_CLIENT_ID || '',
      enable_razorpay: true,
      enable_paypal: false
    };

    try {
      const settingsSnap = await getDoc(doc(db, 'settings', 'main'));
      if (settingsSnap.exists()) {
        const settingsData = settingsSnap.data() as SiteSettings;
        setSettings(settingsData);
        if (settingsData.enable_paypal && settingsData.paypal_client_id) {
          loadPaypalScript(settingsData.paypal_client_id);
        }
      } else {
        setSettings(defaultSettings);
      }
    } catch {
      setSettings(defaultSettings);
    }

    let resolvedProduct: Note | null = null;

    // 1. Google Sheets catalog check
    try {
      const sheetNotes = await fetchNotesFromGoogleSheets();
      const matchedSheet = sheetNotes?.find((n) => n.id === id);
      if (matchedSheet) resolvedProduct = matchedSheet;
    } catch {}

    // 2. Firestore document lookup
    if (!resolvedProduct) {
      try {
        const productSnap = await getDoc(doc(db, 'products', id));
        if (productSnap.exists()) {
          const d = productSnap.data();
          const builtinTemplate = getBuiltinNoteById(productSnap.id);
          resolvedProduct = {
            id: productSnap.id,
            title: d.title,
            category: d.category,
            examType: d.exam_type,
            description: d.description,
            price: Number(d.price || 0),
            originalPrice: d.original_price ? Number(d.original_price) : undefined,
            previewImages: d.preview_images || [],
            fileUrl: d.file_url || '',
            fileName: d.file_name || builtinTemplate?.fileName,
            fileSizeLabel: d.file_size_label,
            pagesCount: d.pages_count || builtinTemplate?.pagesCount,
            updatedLabel: d.updated_label || builtinTemplate?.updatedLabel,
            examSuitability: d.exam_suitability || builtinTemplate?.examSuitability,
            keyTopics: d.key_topics || builtinTemplate?.keyTopics,
            isEnabled: d.is_enabled !== false,
            isArchived: Boolean(d.is_archived),
            downloadLimit: d.download_limit || 5,
            rating: Number(d.rating || 0),
            reviewsCount: Number(d.reviews_count || 0),
            isBestseller: Boolean(d.is_bestseller),
            studentsBought: d.students_bought
          };
        }
      } catch (err) {
        console.warn('Firestore product lookup failed, trying builtin catalog:', err);
      }
    }

    // 3. Builtin Catalog Fallback
    if (!resolvedProduct) {
      resolvedProduct = getBuiltinNoteById(id) || null;
    }

    setProduct(resolvedProduct);

    // Load Related Notes
    try {
      const prodSnap = await getDocs(collection(db, 'products'));
      const pool: Note[] = !prodSnap.empty
        ? prodSnap.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              id: docSnap.id,
              title: d.title,
              category: d.category || 'Study Material',
              examType: d.exam_type,
              description: d.description || '',
              price: Number(d.price || 0),
              originalPrice: d.original_price ? Number(d.original_price) : undefined,
              previewImages: d.preview_images || [],
              fileUrl: d.file_url || '',
              rating: Number(d.rating || 0),
              reviewsCount: Number(d.reviews_count || 0),
              isBestseller: Boolean(d.is_bestseller),
              isEnabled: d.is_enabled !== false,
              isArchived: Boolean(d.is_archived)
            };
          })
        : BUILTIN_CATALOG_NOTES;
      setRelatedNotes(
        pool
          .filter((item) => item.id !== id && item.isEnabled !== false && !item.isArchived)
          .slice(0, 3)
      );
    } catch {
      setRelatedNotes(BUILTIN_CATALOG_NOTES.filter((item) => item.id !== id).slice(0, 3));
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
    return pdf;
  };

  const logFailedOrCancelledOrder = async (
    orderId: string,
    paymentId: string,
    reason: string,
    status: 'failed' | 'pending'
  ) => {
    if (!product || !auth.currentUser) return;
    try {
      await addDoc(collection(db, 'orders'), {
        uid: auth.currentUser.uid,
        user_email: auth.currentUser.email || user?.email || '',
        amount: Number(finalPrice) || 0,
        status,
        product_id: product.id,
        product_title: product.title,
        payment_id: paymentId || orderId,
        razorpay_order_id: orderId,
        provider: 'razorpay',
        payment_method: reason.slice(0, 75),
        verified_by_server: false,
        created_at: new Date().toISOString()
      });
    } catch {}
  };

  const handlePaymentSuccess = async (
    paymentId: string,
    razorpayOrderId: string,
    provider: 'razorpay' | 'paypal' | 'razorpay_demo',
    paymentMethodLabel: string,
    verifiedByServer: boolean
  ) => {
    if (!product) return;
    setProcessing(true);
    const userEmail = user?.email || 'guest@example.com';
    const userName = user?.displayName || 'Aspirant';
    const targetFileUrl =
      product.fileUrl && product.fileUrl !== '#' ? product.fileUrl : `${window.location.origin}/#/dashboard`;

    try {
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
        payment_method: paymentMethodLabel,
        created_at: new Date().toISOString()
      });

      if (auth.currentUser) {
        const fbEmail = auth.currentUser.email || userEmail;
        let firestoreOrderId = paymentId;
        try {
          const ordDoc = await addDoc(collection(db, 'orders'), {
            uid: auth.currentUser.uid,
            user_email: fbEmail,
            amount: Number(finalPrice) || 0,
            subtotal: Number(product.price) || 0,
            discount_amount: appliedCoupon ? appliedCoupon.discountAmount : 0,
            coupon_code: appliedCoupon?.code || '',
            status: 'paid',
            product_id: product.id,
            product_title: product.title,
            payment_id: paymentId,
            razorpay_order_id: razorpayOrderId,
            provider,
            payment_method: paymentMethodLabel,
            verified_by_server: verifiedByServer,
            download_count: 0,
            created_at: new Date().toISOString()
          });
          firestoreOrderId = ordDoc.id;
        } catch (dbErr) {
          console.warn('Firestore order record note:', dbErr);
        }

        try {
          await setDoc(
            doc(db, 'entitlements', `${auth.currentUser.uid}_${product.id}`),
            {
              uid: auth.currentUser.uid,
              userEmail: fbEmail,
              productId: product.id,
              orderId: firestoreOrderId,
              downloadsUsed: 0,
              downloadLimit: product.downloadLimit || 5,
              grantedAt: new Date().toISOString()
            },
            { merge: true }
          );
        } catch {}

        try {
          await updateDoc(doc(db, 'users', auth.currentUser.uid), {
            purchasedNotes: arrayUnion(product.id),
            updatedAt: new Date().toISOString()
          });
        } catch {}

        try {
          await addDoc(collection(db, 'activity_logs'), {
            uid: auth.currentUser.uid,
            userEmail: fbEmail,
            action: 'ORDER_PAID',
            details: `Verified order for ${product.title} (₹${finalPrice}) via ${paymentMethodLabel}`,
            createdAt: new Date().toISOString()
          });
        } catch {}
      }

      const invoiceDoc = generateInvoice(paymentId);
      const invoiceBase64 = invoiceDoc?.output('datauristring');

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
      } catch {}

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
              amount: finalPrice,
              invoice_pdf: invoiceBase64
            },
            publicKey
          );
        } catch {}
      }

      confetti({
        particleCount: 150,
        spread: 75,
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

  const handleSecureDownload = async () => {
    if (!product || !user) return;
    setDownloading(true);
    setDownloadNotice(null);

    try {
      const hasRealPdf = Boolean(product.fileUrl && product.fileUrl.trim() && product.fileUrl !== '#');
      if (!hasRealPdf) {
        setDownloadNotice(
          'Your purchase is verified, and the full PDF file is pending attachment in the Admin File Vault. Please check your Dashboard Library shortly or contact support.'
        );
        setDownloading(false);
        return;
      }

      // Check download allowance with backend if available
      let currentDownloads = 0;
      const entId = `${user.uid}_${product.id}`;
      try {
        const entSnap = await getDoc(doc(db, 'entitlements', entId));
        if (entSnap.exists()) {
          currentDownloads = Number(entSnap.data().downloadsUsed || 0);
        }
      } catch {}

      try {
        const authResp = await fetch('/api/downloads/authorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: product.id,
            userEmail: user.email,
            currentDownloads,
            downloadLimit: product.downloadLimit || 5,
            fileUrl: product.fileUrl
          })
        });
        const contentType = authResp.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const authData = await authResp.json();
          if (!authResp.ok || !authData.authorized) {
            setDownloadNotice(authData.error || 'Download authorization declined.');
            setDownloading(false);
            return;
          }
        }
      } catch {
        // Static-host fallback: check client allowance directly
        if (currentDownloads >= (product.downloadLimit || 5)) {
          setDownloadNotice('Download limit reached for this study pack. Please open a support ticket in your Dashboard.');
          setDownloading(false);
          return;
        }
      }

      // Log download in Firestore
      if (auth.currentUser) {
        try {
          await addDoc(collection(db, 'downloads'), {
            uid: auth.currentUser.uid,
            userEmail: auth.currentUser.email || user.email,
            productId: product.id,
            productTitle: product.title,
            downloadedAt: new Date().toISOString()
          });
          await updateDoc(doc(db, 'entitlements', entId), {
            downloadsUsed: currentDownloads + 1
          });
        } catch {}
      }

      // Trigger real download / open PDF safely (anchor download works inside iframes without popup blockers)
      if (product.fileUrl.startsWith('data:application/pdf')) {
        const a = document.createElement('a');
        a.href = product.fileUrl;
        a.download = product.fileName || `${product.title.replace(/[^a-z0-9]/gi, '_').slice(0, 32)}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        const a = document.createElement('a');
        a.href = product.fileUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } finally {
      setTimeout(() => setDownloading(false), 600);
    }
  };

  // Server-Authoritative Razorpay Order Creation + Signature Verification
  const handleRazorpayPayment = async () => {
    if (!product || !user) return;
    if (product.isEnabled === false) {
      setPaymentError('This study material is currently unavailable for purchase.');
      return;
    }

    setPaymentError(null);
    setPaymentPendingNotice(null);
    setProcessing(true);

    try {
      const clientMode = settings?.razorpay_mode === 'live' ? 'live' : 'demo';

      // 1. Request server-created order
      let orderPayload: any = null;
      try {
        const orderRes = await fetch('/api/razorpay/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: product.id,
            userEmail: user.email,
            couponCode: appliedCoupon?.code || undefined,
            fallbackPrice: product.price,
            fallbackTitle: product.title,
            clientMode
          })
        });
        const ct = orderRes.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          orderPayload = await orderRes.json();
          if (!orderRes.ok || !orderPayload.success) {
            throw new Error(orderPayload.error || 'Could not initialize Razorpay order.');
          }
        }
      } catch (apiErr: any) {
        // Only fall back cleanly if API route is unavailable (e.g. GitHub Pages static deploy)
        if (apiErr?.message && !apiErr.message.includes('Unexpected token')) {
          throw apiErr;
        }
      }

      if (!orderPayload) {
        orderPayload = {
          success: true,
          mode: 'demo',
          orderId: `order_demo_${Date.now()}`,
          keyId: settings?.razorpay_key || 'rzp_test_demo_mode',
          amountInr: finalPrice,
          amountPaise: finalPrice * 100
        };
      }

      // Free 100% coupon completion
      if (orderPayload.isFreeWithCoupon || orderPayload.amountInr === 0) {
        await handlePaymentSuccess(
          `pay_coupon_${Date.now()}`,
          orderPayload.orderId,
          'razorpay_demo',
          `Coupon (${appliedCoupon?.code})`,
          true
        );
        return;
      }

      // 2. Live Razorpay Checkout when backend reports Live Mode ready
      const activeKey = orderPayload.keyId || settings?.razorpay_key?.trim() || '';
      const shouldUseLiveSdk = orderPayload.mode === 'live' && activeKey.startsWith('rzp_') && window.Razorpay;

      if (shouldUseLiveSdk) {
        const options = {
          key: activeKey,
          order_id: orderPayload.orderId,
          amount: orderPayload.amountPaise,
          currency: 'INR',
          name: 'NotesBazaar',
          description: `Digital PDF: ${product.title}`,
          handler: async function (response: any) {
            try {
              const verifyRes = await fetch('/api/razorpay/verify-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id || orderPayload.orderId,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  productId: product.id,
                  expectedAmountInr: orderPayload.amountInr,
                  couponCode: appliedCoupon?.code,
                  mode: 'live'
                })
              });
              const verifyJson = await verifyRes.json();
              if (!verifyRes.ok || !verifyJson.verified) {
                setPaymentError(verifyJson.error || 'Payment signature verification failed. No access granted.');
                await logFailedOrCancelledOrder(orderPayload.orderId, response.razorpay_payment_id || 'unknown', 'Signature failed', 'failed');
                setProcessing(false);
                return;
              }
              await handlePaymentSuccess(
                verifyJson.paymentId,
                verifyJson.orderId,
                'razorpay',
                verifyJson.paymentMethod || 'Razorpay Verified',
                true
              );
            } catch {
              setPaymentError('Unable to verify payment signature with server. If debited, open a Support Ticket with your Payment ID.');
              setProcessing(false);
            }
          },
          prefill: {
            name: user.displayName || 'Aspirant',
            email: user.email || ''
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
          theme: { color: '#0D9488' },
          modal: {
            ondismiss: async () => {
              setPaymentPendingNotice('Checkout window closed before payment completion. Your card/UPI was not charged by NotesBazaar.');
              await logFailedOrCancelledOrder(orderPayload.orderId, `cancel_${Date.now()}`, 'Checkout dismissed', 'pending');
              setProcessing(false);
            }
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', async (resp: any) => {
          const reason = resp?.error?.description || 'Transaction failed at bank/UPI.';
          setPaymentError(`Payment failed: ${reason} You can retry below.`);
          await logFailedOrCancelledOrder(
            orderPayload.orderId,
            resp?.error?.metadata?.payment_id || `fail_${Date.now()}`,
            reason,
            'failed'
          );
          setProcessing(false);
        });
        rzp.open();
        return;
      }

      // 3. Controlled Demo Checkout Modal (explicitly labeled Demo Mode)
      setPendingOrderData({
        orderId: orderPayload.orderId,
        amountInr: orderPayload.amountInr,
        mode: 'demo'
      });
      setProcessing(false);
      setShowDemoPaymentModal(true);
    } catch (err: any) {
      setPaymentError(err?.message || 'Could not start Razorpay checkout. Please try again.');
      setProcessing(false);
    }
  };

  const executeDemoPayment = async () => {
    if (!product) return;
    setDemoSimulating(true);
    const demoPaymentId = `pay_demo_${selectedPayTab}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const orderId = pendingOrderData?.orderId || `order_demo_${Date.now()}`;
    const methodLabel =
      selectedPayTab === 'upi'
        ? `Demo UPI (${upiIdInput || 'QR'})`
        : selectedPayTab === 'card'
          ? 'Demo Card'
          : selectedPayTab === 'netbanking'
            ? `Demo Netbanking (${selectedBank})`
            : selectedPayTab === 'emi'
              ? `Demo PayLater (${selectedEmiOption})`
              : `Demo Wallet (${selectedWallet})`;

    try {
      const verifyRes = await fetch('/api/razorpay/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_order_id: orderId,
          razorpay_payment_id: demoPaymentId,
          productId: product.id,
          expectedAmountInr: finalPrice,
          mode: 'demo'
        })
      });
      const ct = verifyRes.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const vj = await verifyRes.json();
        if (!verifyRes.ok || !vj.verified) {
          throw new Error(vj.error || 'Demo verification failed.');
        }
      }
      setShowDemoPaymentModal(false);
      setDemoSimulating(false);
      await handlePaymentSuccess(demoPaymentId, orderId, 'razorpay_demo', methodLabel, true);
    } catch {
      // Static deploy fallback
      setShowDemoPaymentModal(false);
      setDemoSimulating(false);
      await handlePaymentSuccess(demoPaymentId, orderId, 'razorpay_demo', methodLabel, false);
    }
  };

  const initPayment = async (mode: PaymentMode) => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (mode === PaymentMode.RAZORPAY) await handleRazorpayPayment();
  };

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    const code = couponInput.trim().toUpperCase();
    if (!code) return;

    setValidatingCoupon(true);
    setCouponFeedback(null);

    try {
      const resp = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          couponCode: code,
          fallbackPrice: product.price
        })
      });
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const data = await resp.json();
        if (resp.ok && data.valid) {
          setAppliedCoupon({ code: data.code, discountAmount: Number(data.discountAmount || 0) });
          setCouponFeedback(`Applied "${data.code}" — Saved ₹${data.discountAmount}!`);
          setValidatingCoupon(false);
          return;
        }
        setAppliedCoupon(null);
        setCouponFeedback(data.error || 'Invalid or expired coupon code.');
        setValidatingCoupon(false);
        return;
      }
    } catch {
      // Fallback to Firestore direct lookup when hosted statically
    }

    try {
      const couponSnap = await getDoc(doc(db, 'coupons', code));
      if (couponSnap.exists()) {
        const c = couponSnap.data();
        if (c.isActive && (!c.expiresAt || new Date(c.expiresAt).getTime() > Date.now())) {
          const disc =
            c.discountType === 'percent'
              ? Math.round((product.price * Number(c.discountValue)) / 100)
              : Math.round(Number(c.discountValue));
          setAppliedCoupon({ code, discountAmount: Math.min(product.price, disc) });
          setCouponFeedback(`Applied "${code}" — Saved ₹${Math.min(product.price, disc)}!`);
          setValidatingCoupon(false);
          return;
        }
      }
      const adminPromo = (settings?.promo_code || '').trim().toUpperCase();
      const adminPct = Number(settings?.promo_discount_percent || 0);
      if (adminPromo && code === adminPromo && adminPct > 0) {
        const disc = Math.round((product.price * adminPct) / 100);
        setAppliedCoupon({ code, discountAmount: disc });
        setCouponFeedback(`Applied "${code}" (${adminPct}% OFF) — Saved ₹${disc}!`);
      } else {
        setAppliedCoupon(null);
        setCouponFeedback('Invalid or expired coupon code.');
      }
    } catch {
      setAppliedCoupon(null);
      setCouponFeedback('Unable to validate coupon right now.');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: product?.title || 'NotesBazaar Digital Notes',
          text: `Inspect ${product?.title} on NotesBazaar`,
          url: shareUrl
        });
        return;
      }
    } catch {}
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch {}
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
  const previewImagesList = product
    ? getSafePreviewImages(product.examType, product.previewImages, `${product.title} ${product.id}`)
    : [];
  const finalPrice = product
    ? Math.max(0, product.price - (appliedCoupon?.discountAmount || 0))
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Loading digital study guide...</p>
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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Study Pack Not Found</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8">The notes you requested could not be found.</p>
        <Link to="/shop" className="premium-button-primary">
          Back to Notes Library
        </Link>
      </div>
    );
  }

  const isModalPageLocked = !isPurchased && activePreviewIdx > 0;
  const hasRealPdfAttached = Boolean(product.fileUrl && product.fileUrl.trim() && product.fileUrl !== '#');

  return (
    <div className="min-h-screen pb-36 md:pb-20">
      {/* Header / Breadcrumb */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors text-xs font-bold cursor-pointer"
          >
            <ArrowLeft size={18} /> Back
          </button>

          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-3.5 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors text-xs font-bold cursor-pointer"
          >
            {shareCopied ? <Check size={16} className="text-emerald-600" /> : <Share2 size={16} />}
            <span>{shareCopied ? 'Link Copied!' : 'Share'}</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-10">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-7">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold">
                <span className="text-blue-700 dark:text-blue-400 font-bold uppercase tracking-wider">
                  {product.examType}
                </span>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span className="text-slate-500 dark:text-slate-400">{product.category}</span>
                {product.pagesCount && (
                  <>
                    <span className="text-slate-300 dark:text-slate-700">·</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">{product.pagesCount}</span>
                  </>
                )}
                {product.updatedLabel && (
                  <>
                    <span className="text-slate-300 dark:text-slate-700">·</span>
                    <span className="text-slate-500 dark:text-slate-400">{product.updatedLabel}</span>
                  </>
                )}
                {product.reviewsCount > 0 && product.rating > 0 && (
                  <>
                    <span className="text-slate-300 dark:text-slate-700">·</span>
                    <div className="flex items-center gap-1 text-amber-500">
                      <Star size={14} fill="currentColor" />
                      <span className="font-bold text-slate-800 dark:text-slate-200">{product.rating}</span>
                      <span className="text-slate-400">({product.reviewsCount} reviews)</span>
                    </div>
                  </>
                )}
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white font-heading leading-tight">
                {product.title}
              </h1>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{product.description}</p>

              {product.examSuitability && product.examSuitability.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {product.examSuitability.map((ex) => (
                    <span
                      key={ex}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold"
                    >
                      {ex}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-5 py-3 font-bold text-sm transition-all relative whitespace-nowrap cursor-pointer ${
                  activeTab === 'preview' ? 'text-primary' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                Sample Preview ({previewImagesList.length} Pages)
                {activeTab === 'preview' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
              </button>
              <button
                onClick={() => setActiveTab('details')}
                className={`px-5 py-3 font-bold text-sm transition-all relative whitespace-nowrap cursor-pointer ${
                  activeTab === 'details' ? 'text-primary' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                Syllabus &amp; Topics
                {activeTab === 'details' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
              </button>
              <button
                onClick={() => setActiveTab('reviews')}
                className={`px-5 py-3 font-bold text-sm transition-all relative whitespace-nowrap cursor-pointer ${
                  activeTab === 'reviews' ? 'text-primary' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                Verified Reviews ({product.reviewsCount || 0})
                {activeTab === 'reviews' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
              </button>
            </div>

            <div>
              {activeTab === 'preview' && (
                <div className="space-y-5">
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

                  {/* Preview Canvas */}
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

                      {(isPurchased || activePreviewIdx === 0) && (
                        <div className="absolute bottom-4 right-4 bg-slate-900/85 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xl opacity-95 group-hover:bg-blue-700 transition-colors">
                          <ZoomIn size={16} /> Click to Zoom Full Screen
                        </div>
                      )}

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
                              You&apos;ve inspected Page 1 sample. Complete secure payment to unlock full access in your Student Library.
                            </p>
                            <button
                              onClick={() => initPayment(PaymentMode.RAZORPAY)}
                              className="w-full premium-button-primary py-4 rounded-2xl"
                            >
                              Unlock Full Notes for ₹{finalPrice}
                            </button>
                          </motion.div>
                        </div>
                      )}
                    </div>

                    {/* Thumbnails */}
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
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Exam Target</p>
                      <p className="text-base font-bold text-slate-900 dark:text-white">
                        {product.examSuitability?.join(', ') || product.examType}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Format &amp; Length</p>
                      <p className="text-base font-bold text-slate-900 dark:text-white">
                        Digital PDF Notes {product.pagesCount ? `(${product.pagesCount})` : ''}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Content Currency</p>
                      <p className="text-base font-bold text-slate-900 dark:text-white">
                        {product.updatedLabel || 'Current Exam Syllabus'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Delivery Policy</p>
                      <p className="text-base font-bold text-slate-900 dark:text-white">
                        PDF Unlock After Payment Verification
                      </p>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                    <h4 className="font-bold text-slate-900 dark:text-white mb-4">Key Topics &amp; Coverage Included:</h4>
                    <ul className="grid sm:grid-cols-2 gap-3.5">
                      {(product.keyTopics && product.keyTopics.length > 0
                        ? product.keyTopics
                        : [
                            'Complete Syllabus Coverage',
                            'Exam-Oriented Tables & Formulas',
                            'Zoom-Clear Layouts for Phone & Tablet',
                            'Print-Ready A4 PDF Formatting'
                          ]
                      ).map((item, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                          <CheckCircle2 size={17} className="text-emerald-600 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    <p className="font-bold text-slate-900 dark:text-white">Delivery Instructions:</p>
                    <p>
                      1. Click Buy Now and complete checkout via Razorpay (UPI, Cards, Netbanking, Wallets).
                      2. Once signature verification finishes, access opens immediately in your Student Dashboard Library and right on this page.
                    </p>
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

            {/* Related Products */}
            {relatedNotes.length > 0 && (
              <div className="pt-8 border-t border-slate-200 dark:border-slate-800 space-y-5">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BookOpen size={18} className="text-primary" /> Related Study Packs
                </h2>
                <div className="grid sm:grid-cols-3 gap-4">
                  {relatedNotes.map((rel) => (
                    <Link
                      key={rel.id}
                      to={`/product/${rel.id}`}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 hover:border-primary/40 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                          {rel.examType}
                        </p>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-2 mt-1">
                          {rel.title}
                        </h3>
                      </div>
                      <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 dark:border-slate-800">
                        <span className="font-black text-slate-900 dark:text-white tabular-nums">₹{rel.price}</span>
                        <span className="text-[11px] font-bold text-primary">View →</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar: Purchase Card */}
          <aside className="space-y-6">
            <div className="sticky top-24 bg-white dark:bg-slate-900 rounded-3xl p-7 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex flex-col tabular-nums">
                  <span className="text-3xl font-bold text-slate-900 dark:text-white">₹{finalPrice}</span>
                  {(appliedCoupon || (product.originalPrice && product.originalPrice > finalPrice)) && (
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

              {paymentError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 space-y-2">
                  <div className="flex items-start gap-2 font-semibold">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                    <span>{paymentError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => initPayment(PaymentMode.RAZORPAY)}
                    className="inline-flex items-center gap-1 font-bold underline cursor-pointer"
                  >
                    <RefreshCw size={12} /> Retry Razorpay Checkout
                  </button>
                </div>
              )}

              {paymentPendingNotice && (
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 font-medium">
                  {paymentPendingNotice}
                </div>
              )}

              {!isPurchased && (
                <form onSubmit={handleApplyCoupon} className="space-y-1.5">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag size={13} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value)}
                        placeholder={settings?.promo_code ? `Promo (${settings.promo_code})` : 'Enter coupon code'}
                        className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono uppercase text-slate-900 dark:text-white focus:outline-none focus:border-primary"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={validatingCoupon}
                      className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold hover:bg-primary transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {validatingCoupon ? '...' : 'Apply'}
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
                  <div className="space-y-2.5">
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
                          {hasRealPdfAttached ? 'Download Full Notes PDF' : 'Check PDF Download Status'}
                        </>
                      )}
                    </button>
                    {downloadNotice && (
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
                        {downloadNotice}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {(settings?.enable_razorpay ?? true) && (
                      <div className="space-y-2.5">
                        <button
                          onClick={() => initPayment(PaymentMode.RAZORPAY)}
                          disabled={processing || product.isEnabled === false}
                          className="w-full premium-button-primary flex items-center justify-center gap-2 group disabled:opacity-60"
                        >
                          {processing ? (
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Initiating Razorpay...</span>
                            </div>
                          ) : product.isEnabled === false ? (
                            <span>Currently Unavailable</span>
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
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 pt-2 text-center">
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

              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 font-medium">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">HMAC Signature Verified</span>
                    <span className="text-[11px] text-slate-400">Server-validated Razorpay order creation</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 font-medium">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <FileDown size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">Instant Library Access</span>
                    <span className="text-[11px] text-slate-400">
                      Up to {product.downloadLimit || 5} secure downloads + invoice PDF
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* FULL-SCREEN HANDWRITTEN NOTES PREVIEW ZOOM MODAL */}
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

              <motion.div
                animate={{ scale: zoomLevel, x: panOffset.x, y: panOffset.y }}
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
                      Purchase this study pack to inspect all pages and download the PDF.
                    </p>
                    <button
                      onClick={() => {
                        setZoomModalOpen(false);
                        initPayment(PaymentMode.RAZORPAY);
                      }}
                      className="w-full premium-button-primary py-3.5"
                    >
                      Unlock Full Notes (₹{finalPrice})
                    </button>
                  </div>
                </div>
              )}

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

            <div className="px-4 sm:px-6 py-3 pb-safe bg-slate-900/95 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 sm:gap-4 text-white shrink-0">
              <div className="flex items-center gap-2 overflow-x-auto">
                {previewImagesList.map((_, idx) => (
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
                    Buy &amp; Unlock ₹{finalPrice}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CONTROLLED TEST / DEMO RAZORPAY CHECKOUT MODAL */}
      <AnimatePresence>
        {showDemoPaymentModal && (
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[92dvh] overflow-y-auto shadow-2xl border border-slate-100 dark:border-slate-800 relative"
            >
              <div className="bg-gradient-to-r from-blue-800 via-teal-700 to-emerald-700 p-5 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <NotesBazaarLogo variant="mark" size={40} className="rounded-full shadow-md" />
                  <div>
                    <h3 className="font-bold text-white text-base leading-tight">NotesBazaar Test Checkout</h3>
                    <p className="text-[11px] text-amber-200 font-semibold">
                      Demo Simulation Mode (Configure RAZORPAY_KEY_SECRET for Live Pay)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-black tabular-nums">₹{finalPrice}</span>
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
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 px-4 py-3 rounded-2xl border border-slate-200/70 dark:border-slate-800">
                  <div className="min-w-0 pr-3">
                    <span className="text-[10px] uppercase font-bold text-primary tracking-wider block">
                      {appliedCoupon ? `Coupon Applied: ${appliedCoupon.code} (-₹${appliedCoupon.discountAmount})` : 'Test Order Simulation'}
                    </span>
                    <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{product.title}</p>
                  </div>
                  <span className="font-black text-slate-900 dark:text-white text-base shrink-0 tabular-nums">₹{finalPrice}</span>
                </div>

                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                    Simulated Payment Rail
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
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

                <div className="bg-slate-50/70 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 space-y-3">
                  {selectedPayTab === 'upi' && (
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-500">Test UPI ID</label>
                      <input
                        type="text"
                        value={upiIdInput}
                        onChange={(e) => setUpiIdInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white"
                      />
                    </div>
                  )}
                  {selectedPayTab === 'card' && (
                    <div className="space-y-2 text-xs">
                      <input
                        type="text"
                        value={cardNumberInput}
                        onChange={(e) => setCardNumberInput(e.target.value)}
                        aria-label="Test card number"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
                      />
                      <div className="grid grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          value={cardExpiryInput}
                          onChange={(e) => setCardExpiryInput(e.target.value)}
                          aria-label="Expiry"
                          className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
                        />
                        <input
                          type="text"
                          value={cardCvvInput}
                          onChange={(e) => setCardCvvInput(e.target.value)}
                          aria-label="CVV"
                          className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-white"
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

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDemoPaymentModal(false);
                      setPaymentError('Simulated bank decline triggered. Click Retry to test recovery flow.');
                    }}
                    className="py-3.5 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 font-bold text-xs hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                  >
                    Simulate Decline
                  </button>
                  <button
                    type="button"
                    onClick={executeDemoPayment}
                    disabled={demoSimulating}
                    className="py-3.5 bg-gradient-to-r from-blue-700 via-teal-600 to-emerald-600 text-white rounded-xl font-bold text-xs shadow-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-75"
                  >
                    {demoSimulating ? 'Verifying...' : `Simulate Pay ₹${finalPrice}`}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Sticky Buy Bar */}
      {!isPurchased && (
        <div className="md:hidden fixed bottom-[58px] left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800 px-4 py-3 flex items-center justify-between gap-3 shadow-[0_-8px_20px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col tabular-nums">
            <span className="text-lg font-bold text-slate-900 dark:text-white leading-tight">₹{finalPrice}</span>
            {product.originalPrice && <span className="text-[10px] text-slate-400 line-through">₹{product.originalPrice}</span>}
          </div>
          <button
            onClick={() => initPayment(PaymentMode.RAZORPAY)}
            disabled={processing || product.isEnabled === false}
            className="min-h-[44px] px-6 py-2.5 bg-gradient-to-r from-blue-700 to-emerald-600 text-white rounded-xl font-bold text-sm shadow-lg cursor-pointer"
          >
            {processing ? '...' : 'Buy & Unlock'}
          </button>
        </div>
      )}
    </div>
  );
};

export default ProductDetail;
