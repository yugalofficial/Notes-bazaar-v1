import React, { useState, useEffect } from 'react';
import { User, Note, Order, SupportTicket, DownloadRecord } from '../types';
import { auth, db } from '../firebase';
import {
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification
} from 'firebase/auth';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  increment
} from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import {
  LogOut,
  Download,
  FileText,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Mail,
  Receipt,
  LayoutDashboard,
  BookOpen,
  Settings,
  LifeBuoy,
  Send,
  ShieldCheck,
  KeyRound,
  Search,
  ExternalLink,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  getBuiltinNoteById,
  getLocalOrders,
  saveSessionUser
} from '../utils/appScriptService';
import { getSafePreviewImages } from '../utils/sampleNotesPages';
import { sanitizePlainText } from '../utils/security';

interface DashboardProps {
  user: User;
}

type DashboardTab = 'overview' | 'library' | 'orders' | 'settings' | 'support';

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadFeedback, setDownloadFeedback] = useState<{ type: 'error' | 'info' | 'success'; text: string } | null>(null);

  const [purchasedNotesData, setPurchasedNotesData] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [orderFilter, setOrderFilter] = useState('');

  // Entitlements & download logs
  const [entitlementsMap, setEntitlementsMap] = useState<Record<string, { docId?: string; downloadsUsed: number; downloadLimit: number }>>({});
  const [downloadHistory, setDownloadHistory] = useState<DownloadRecord[]>([]);

  // Account Settings state
  const [displayNameInput, setDisplayNameInput] = useState(user.displayName || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [copiedReferral, setCopiedReferral] = useState(false);

  // Support Tickets state
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketCategory, setTicketCategory] = useState<'payment' | 'download' | 'account' | 'general'>('general');
  const [ticketOrderId, setTicketOrderId] = useState('');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [ticketNotice, setTicketNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setDisplayNameInput(user.displayName || '');
  }, [user.displayName]);

  useEffect(() => {
    fetchPurchasedNotes();
    fetchOrderHistory();
    fetchEntitlementsAndDownloads();
    fetchUserTickets();
  }, [user.purchasedNotes, user.email, user.uid]);

  const fetchPurchasedNotes = async () => {
    setLoadingNotes(true);
    const localOrders = getLocalOrders(user.email).filter((o) => o.status === 'paid');
    const localIds = localOrders.map((o) => o.product_id).filter(Boolean);
    const mergedIds = Array.from(new Set([...(user.purchasedNotes || []), ...localIds])).filter(Boolean);

    if (mergedIds.length === 0) {
      setPurchasedNotesData([]);
      setLoadingNotes(false);
      return;
    }

    const notes: Note[] = [];
    for (const noteId of mergedIds) {
      let resolved: Note | undefined;
      try {
        const noteRef = doc(db, 'products', noteId);
        const noteSnap = await getDoc(noteRef);
        if (noteSnap.exists()) {
          const data = noteSnap.data();
          resolved = {
            id: noteSnap.id,
            title: data.title,
            category: data.category,
            examType: data.exam_type,
            description: data.description || '',
            price: Number(data.price) || 0,
            originalPrice: data.original_price ? Number(data.original_price) : undefined,
            previewImages: Array.isArray(data.preview_images) ? data.preview_images : [],
            fileUrl: data.file_url || '',
            fileName: data.file_name,
            fileSizeLabel: data.file_size_label,
            pagesCount: data.pages_count,
            updatedLabel: data.updated_label,
            downloadLimit: data.download_limit ? Number(data.download_limit) : 10,
            rating: Number(data.rating) || 0,
            reviewsCount: Number(data.reviews_count) || 0,
            isBestseller: Boolean(data.is_bestseller),
            studentsBought: data.students_bought
          };
        }
      } catch {
        // Fallback to built-in
      }

      if (!resolved) {
        resolved = getBuiltinNoteById(noteId);
      }

      if (!resolved) {
        const matchedOrder = localOrders.find((o) => o.product_id === noteId);
        if (matchedOrder) {
          resolved = {
            id: noteId,
            title: matchedOrder.product_title || 'Verified Study Pack',
            category: 'Study Pack',
            examType: 'SSC' as any,
            description: 'Verified study material unlocked after payment verification.',
            price: Number(matchedOrder.amount) || 0,
            previewImages: [],
            fileUrl: '',
            rating: 0,
            reviewsCount: 0,
            isBestseller: false,
            downloadLimit: 10
          };
        }
      }
      if (resolved) notes.push(resolved);
    }

    setPurchasedNotesData(notes);
    setLoadingNotes(false);
  };

  const fetchOrderHistory = async () => {
    setLoadingOrders(true);
    const localOrders = getLocalOrders(user.email);
    try {
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, where('user_email', '==', user.email));
      const snap = await getDocs(q);
      const firestoreOrders = snap.docs.map((docItem) => {
        const data = docItem.data();
        return {
          id: docItem.id,
          uid: data.uid,
          product_id: data.product_id,
          product_title: data.product_title,
          amount: Number(data.amount) || 0,
          subtotal: data.subtotal ? Number(data.subtotal) : undefined,
          discount_amount: data.discount_amount ? Number(data.discount_amount) : undefined,
          coupon_code: data.coupon_code,
          status: data.status || 'pending',
          payment_id: data.payment_id || docItem.id,
          razorpay_order_id: data.razorpay_order_id,
          payment_method: data.payment_method,
          provider: data.provider,
          verified_by_server: data.verified_by_server,
          created_at: data.created_at,
          user_email: data.user_email
        } as Order;
      });

      const mergedMap = new Map<string, Order>();
      [...firestoreOrders, ...localOrders].forEach((o: Order) => {
        const key = o.payment_id || o.id;
        if (!mergedMap.has(key)) mergedMap.set(key, o);
      });
      const combined = Array.from(mergedMap.values());
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setOrders(combined);
    } catch {
      setOrders(localOrders);
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchEntitlementsAndDownloads = async () => {
    if (!auth.currentUser) return;
    try {
      const entQ = query(collection(db, 'entitlements'), where('uid', '==', auth.currentUser.uid));
      const entSnap = await getDocs(entQ);
      const map: Record<string, { docId?: string; downloadsUsed: number; downloadLimit: number }> = {};
      entSnap.docs.forEach((d) => {
        const data = d.data();
        map[data.productId] = {
          docId: d.id,
          downloadsUsed: Number(data.downloadsUsed || 0),
          downloadLimit: Number(data.downloadLimit || 10)
        };
      });
      setEntitlementsMap(map);

      const dlQ = query(collection(db, 'downloads'), where('uid', '==', auth.currentUser.uid));
      const dlSnap = await getDocs(dlQ);
      const logs = dlSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as DownloadRecord[];
      logs.sort((a, b) => new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime());
      setDownloadHistory(logs);
    } catch {
      // Non-blocking fallback
    }
  };

  const fetchUserTickets = async () => {
    if (!auth.currentUser) return;
    setLoadingTickets(true);
    try {
      const q = query(collection(db, 'contacts'), where('uid', '==', auth.currentUser.uid));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as SupportTicket[];
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setTickets(list);
    } catch {
      setTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  };

  const handleLogout = async () => {
    saveSessionUser(null);
    try {
      await signOut(auth);
    } catch {
      // Ignore
    }
    navigate('/login');
    window.location.reload();
  };

  const triggerSafeLinkDownload = (url: string, filename?: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    if (filename) link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownload = async (note: Note) => {
    setDownloadFeedback(null);
    setDownloadingId(note.id);

    if (!note.fileUrl || note.fileUrl === '#') {
      setDownloadFeedback({
        type: 'info',
        text: `PDF file for "${note.title}" is pending upload by the administrator. Please submit a quick support ticket below or check back shortly.`
      });
      setDownloadingId(null);
      return;
    }

    const ent = entitlementsMap[note.id] || {
      downloadsUsed: 0,
      downloadLimit: note.downloadLimit || 10
    };

    try {
      const resp = await fetch('/api/downloads/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: note.id,
          userEmail: user.email,
          currentDownloads: ent.downloadsUsed,
          downloadLimit: ent.downloadLimit,
          fileUrl: note.fileUrl
        })
      });
      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await resp.json();
        if (!resp.ok || !data.authorized) {
          setDownloadFeedback({
            type: 'error',
            text: data.error || 'Download could not be authorized.'
          });
          setDownloadingId(null);
          return;
        }
      }
    } catch {
      // Static fallback check when deployed without Express server
      if (ent.downloadsUsed >= ent.downloadLimit) {
        setDownloadFeedback({
          type: 'error',
          text: `Download limit (${ent.downloadLimit}) reached for this note. Contact support to reset.`
        });
        setDownloadingId(null);
        return;
      }
    }

    triggerSafeLinkDownload(
      note.fileUrl,
      `${note.title.replace(/[^a-z0-9]/gi, '_').slice(0, 36)}.pdf`
    );

    if (auth.currentUser) {
      try {
        await addDoc(collection(db, 'downloads'), {
          uid: auth.currentUser.uid,
          userEmail: user.email,
          productId: note.id,
          productTitle: note.title,
          downloadedAt: new Date().toISOString()
        });
        if (ent.docId) {
          await updateDoc(doc(db, 'entitlements', ent.docId), {
            downloadsUsed: increment(1)
          });
        } else {
          const entDocId = `${auth.currentUser.uid}_${note.id}`.slice(0, 120);
          await setDoc(
            doc(db, 'entitlements', entDocId),
            {
              uid: auth.currentUser.uid,
              userEmail: user.email,
              productId: note.id,
              orderId: orders.find((o) => o.product_id === note.id)?.payment_id || 'verified',
              downloadsUsed: 1,
              downloadLimit: ent.downloadLimit,
              grantedAt: new Date().toISOString()
            },
            { merge: true }
          );
        }
        fetchEntitlementsAndDownloads();
      } catch {
        // Non-blocking audit log
      }
    }

    setDownloadFeedback({
      type: 'success',
      text: `Download opened for "${note.title}".`
    });
    setTimeout(() => setDownloadingId(null), 500);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(user.referralCode || `NB-${user.uid.substring(0, 6).toUpperCase()}`);
    setCopiedReferral(true);
    setTimeout(() => setCopiedReferral(false), 2000);
  };

  const downloadInvoice = async (noteTitle: string, orderObj?: Order, noteObj?: Note) => {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const subtotal = orderObj?.subtotal ?? orderObj?.amount ?? noteObj?.price ?? 0;
    const discount = orderObj?.discount_amount ?? 0;
    const netAmount = orderObj?.amount ?? noteObj?.price ?? 0;
    const receiptId = orderObj?.payment_id || `NB-TXN-${(noteObj?.id || 'ORDER').substring(0, 8).toUpperCase()}`;

    pdf.setDrawColor(20, 184, 166);
    pdf.setLineWidth(1);
    pdf.rect(5, 5, 200, 287);

    pdf.setFillColor(248, 250, 252);
    pdf.rect(6, 6, 198, 42, 'F');
    pdf.setDrawColor(234, 242, 240);
    pdf.setLineWidth(0.5);
    pdf.line(6, 48, 204, 48);

    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(26);
    pdf.setTextColor(13, 148, 136);
    pdf.text('NotesBazaar', 15, 22);

    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(120, 120, 120);
    pdf.text('OFFICIAL DIGITAL PURCHASE RECEIPT', 15, 30);

    pdf.setFillColor(209, 250, 229);
    pdf.rect(155, 14, 38, 10, 'F');
    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(5, 150, 105);
    pdf.text('PAYMENT VERIFIED', 157, 20.5);

    pdf.setFontSize(8.5);
    pdf.setTextColor(100);
    pdf.text(`Receipt / Payment ID: ${receiptId}`, 15, 38);
    pdf.text(
      `Issued On: ${new Date(orderObj?.created_at || Date.now()).toLocaleDateString('en-IN', { dateStyle: 'long' })}`,
      15,
      43
    );

    pdf.setDrawColor(220, 225, 230);
    pdf.line(15, 58, 195, 58);

    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(10.5);
    pdf.setTextColor(50);
    pdf.text('ISSUED BY:', 15, 68);
    pdf.text('BILLED TO:', 115, 68);

    pdf.setFont('Helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(90);
    pdf.text('NotesBazaar Digital Learning', 15, 74);
    pdf.text('Your Study Partner', 15, 80);
    pdf.text('support@notesbazaar.co', 15, 86);

    pdf.text(`Name: ${user.displayName}`, 115, 74);
    pdf.text(`Email: ${user.email}`, 115, 80);
    pdf.text(`Method: ${orderObj?.payment_method || 'Razorpay'}`, 115, 86);

    pdf.setFillColor(13, 148, 136);
    pdf.rect(15, 100, 180, 8, 'F');

    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(255);
    pdf.text('Digital Product Description', 18, 105.5);
    pdf.text('Qty', 145, 105.5);
    pdf.text('Amount (INR)', 168, 105.5);

    pdf.setFillColor(248, 250, 252);
    pdf.rect(15, 108, 180, 24, 'F');
    pdf.setDrawColor(226, 232, 240);
    pdf.rect(15, 108, 180, 24, 'D');

    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(10.5);
    pdf.setTextColor(30);
    pdf.text(noteTitle.slice(0, 62), 18, 116);

    pdf.setFont('Helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(110);
    pdf.text(
      `Exam: ${noteObj?.examType || 'Competitive Exams'} | Format: Digital PDF`,
      18,
      122
    );

    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(10.5);
    pdf.setTextColor(30);
    pdf.text('1', 147, 118);
    pdf.text(`INR ${subtotal}.00`, 169, 118);

    pdf.setDrawColor(226, 232, 240);
    pdf.line(115, 142, 195, 142);

    pdf.setFont('Helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(120);
    pdf.text('Subtotal:', 115, 148);
    pdf.text(`Coupon (${orderObj?.coupon_code || 'None'}):`, 115, 154);

    pdf.setTextColor(30);
    pdf.text(`INR ${subtotal}.00`, 170, 148);
    pdf.text(`- INR ${discount}.00`, 170, 154);

    pdf.setFillColor(240, 253, 250);
    pdf.rect(115, 162, 80, 12, 'F');
    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(13, 148, 136);
    pdf.text('Total Paid:', 118, 169.5);
    pdf.text(`INR ${netAmount}.00`, 166, 169.5);

    pdf.setFontSize(8);
    pdf.setTextColor(145);
    pdf.text('System-generated receipt for digital PDF study material purchase on NotesBazaar.', 15, 275);
    pdf.save(`NotesBazaar-Receipt-${receiptId.slice(0, 16)}.pdf`);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileNotice(null);
    const cleanName = sanitizePlainText(displayNameInput, 100);
    if (cleanName.length < 2) {
      setProfileNotice({ type: 'error', text: 'Display name must be at least 2 characters.' });
      return;
    }

    setSavingProfile(true);
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: cleanName });
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          displayName: cleanName,
          updatedAt: new Date().toISOString()
        });
      }
      const updatedUser: User = { ...user, displayName: cleanName };
      saveSessionUser(updatedUser);
      setProfileNotice({ type: 'success', text: 'Account profile saved successfully.' });
    } catch (err: any) {
      setProfileNotice({ type: 'error', text: err?.message || 'Could not update profile.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordReset = async () => {
    setProfileNotice(null);
    try {
      await sendPasswordResetEmail(auth, user.email);
      setProfileNotice({
        type: 'success',
        text: `Password reset email dispatched to ${user.email}. Check your inbox and spam folder.`
      });
    } catch (err: any) {
      setProfileNotice({
        type: 'info',
        text:
          err?.code === 'auth/user-not-found'
            ? 'This account signs in via Google or Quick Email session and does not use a password.'
            : err?.message || 'Unable to send password reset email.'
      });
    }
  };

  const handleSendVerificationEmail = async () => {
    setProfileNotice(null);
    if (!auth.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser);
      setProfileNotice({
        type: 'success',
        text: `Verification link sent to ${user.email}. Refresh after clicking the link.`
      });
    } catch (err: any) {
      setProfileNotice({ type: 'error', text: err?.message || 'Could not send verification email.' });
    }
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setTicketNotice(null);

    const subject = sanitizePlainText(ticketSubject, 200);
    const message = sanitizePlainText(ticketMessage, 2500);
    const orderId = sanitizePlainText(ticketOrderId, 128);

    if (subject.length < 3 || message.length < 5) {
      setTicketNotice({ type: 'error', text: 'Please enter a valid subject and detailed message.' });
      return;
    }

    setSubmittingTicket(true);
    try {
      const payload: Record<string, any> = {
        uid: auth.currentUser?.uid || user.uid,
        name: sanitizePlainText(user.displayName || 'Student', 100),
        email: user.email,
        category: ticketCategory,
        subject,
        message,
        status: 'open',
        created_at: new Date().toISOString()
      };
      if (orderId) payload.orderId = orderId;

      await addDoc(collection(db, 'contacts'), payload);
      setTicketSubject('');
      setTicketOrderId('');
      setTicketMessage('');
      setTicketNotice({ type: 'success', text: 'Support ticket submitted! Our team will reply here and via email.' });
      fetchUserTickets();
    } catch (err: any) {
      setTicketNotice({ type: 'error', text: err?.message || 'Unable to submit support ticket.' });
    } finally {
      setSubmittingTicket(false);
    }
  };

  const paidOrders = orders.filter((o) => o.status === 'paid');
  const filteredOrders = orders.filter(
    (o) =>
      !orderFilter ||
      o.payment_id?.toLowerCase().includes(orderFilter.toLowerCase()) ||
      o.product_title?.toLowerCase().includes(orderFilter.toLowerCase()) ||
      o.status?.toLowerCase().includes(orderFilter.toLowerCase())
  );

  const resolvedProductTitle = (pId: string, fallbackTitle?: string) => {
    return (
      purchasedNotesData.find((p) => p.id === pId)?.title ||
      fallbackTitle ||
      getBuiltinNoteById(pId)?.title ||
      'Study Material PDF'
    );
  };

  const isFirebaseVerified = auth.currentUser ? auth.currentUser.emailVerified : true;

  const tabs: { id: DashboardTab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'library', label: `My Library (${purchasedNotesData.length})`, icon: BookOpen },
    { id: 'orders', label: `Orders & Invoices (${orders.length})`, icon: Receipt },
    { id: 'settings', label: 'Account Settings', icon: Settings },
    { id: 'support', label: `Support${tickets.length > 0 ? ` (${tickets.length})` : ''}`, icon: LifeBuoy }
  ];

  return (
    <div className="min-h-screen bg-[#FAFBFD] dark:bg-slate-950 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
        {/* Top Header */}
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-5 pb-7 border-b border-slate-200/80 dark:border-slate-800">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-3 py-1 rounded-full uppercase tracking-widest inline-flex items-center gap-1">
                <ShieldCheck size={12} /> Aspirant Student Hub
              </span>
              {user.role === 'admin' && (
                <Link
                  to="/admin"
                  className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-3 py-1 rounded-full uppercase tracking-widest hover:bg-amber-500/25 transition-colors"
                >
                  Open Admin Center →
                </Link>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mt-3 font-heading tracking-tight">
              Welcome back, <span className="text-primary">{user.displayName}</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Access your purchased PDF notes, verify order invoices, and manage account preferences.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/shop"
              className="px-4 py-2.5 bg-primary text-white rounded-xl font-bold text-xs hover:bg-primary-dark transition-colors shadow-sm"
            >
              Browse Notes
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:text-red-500 transition-colors flex items-center gap-2 text-xs cursor-pointer"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-1.5 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm mb-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  active
                    ? 'bg-slate-900 dark:bg-primary text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {downloadFeedback && (
          <div
            className={`mb-6 p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-3 ${
              downloadFeedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : downloadFeedback.type === 'error'
                  ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                  : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {downloadFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{downloadFeedback.text}</span>
            </div>
            <button onClick={() => setDownloadFeedback(null)} className="underline text-[11px] cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
          >
            {/* ================= TAB 1: OVERVIEW ================= */}
            {activeTab === 'overview' && (
              <div className="grid lg:grid-cols-3 gap-8">
                <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-primary" />
                    <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-4 uppercase">
                      {user.displayName.charAt(0)}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{user.displayName}</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 mb-3">{user.email}</p>

                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold mb-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {isFirebaseVerified ? (
                        <>
                          <CheckCircle2 size={12} className="text-emerald-500" /> Email Verified
                        </>
                      ) : (
                        <>
                          <Clock size={12} className="text-amber-500" /> Verification Pending
                        </>
                      )}
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/70 dark:border-slate-800 text-left text-xs mb-3">
                      <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px] block">
                        Referral Code
                      </span>
                      <div className="flex items-center justify-between mt-1">
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {user.referralCode || `NB-${user.uid.substring(0, 6).toUpperCase()}`}
                        </span>
                        <button
                          onClick={handleCopyCode}
                          className="text-primary font-bold hover:underline cursor-pointer uppercase text-[10px]"
                        >
                          {copiedReferral ? 'Copied ✓' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    <Link
                      to="/membership"
                      className="block w-full py-2.5 bg-slate-900 dark:bg-slate-800 text-white hover:bg-primary rounded-xl transition-colors text-xs font-bold"
                    >
                      {user.membershipType === 'none'
                        ? 'Explore All-Access Plans'
                        : `Active Plan: ${user.membershipType.toUpperCase()}`}
                    </Link>
                  </div>

                  <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-lg border border-slate-800">
                    <Wallet className="text-primary mb-3" size={24} />
                    <h4 className="font-bold text-base mb-1">Need Help with an Order?</h4>
                    <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                      If a Razorpay payment was debited or you need assistance accessing a PDF, open a support ticket directly.
                    </p>
                    <button
                      onClick={() => setActiveTab('support')}
                      className="w-full py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Open Support Desk
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                  <div className="grid sm:grid-cols-3 gap-5">
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unlocked Notes</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                        {purchasedNotesData.length}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Paid Orders</p>
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                        {paidOrders.length}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PDF Downloads Logged</p>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1 tabular-nums">
                        {downloadHistory.length}
                      </p>
                    </div>
                  </div>

                  {/* Quick Access Library Preview */}
                  <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        Ready for Instant Download
                      </h3>
                      <button
                        onClick={() => setActiveTab('library')}
                        className="text-xs font-bold text-primary hover:underline cursor-pointer"
                      >
                        View Full Library →
                      </button>
                    </div>

                    {loadingNotes ? (
                      <p className="text-xs text-slate-400 py-8 text-center">Loading your unlocked notes...</p>
                    ) : purchasedNotesData.length > 0 ? (
                      <div className="space-y-3">
                        {purchasedNotesData.slice(0, 3).map((note) => {
                          const hasPdf = Boolean(note.fileUrl && note.fileUrl !== '#');
                          return (
                            <div
                              key={note.id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <img
                                  src={getSafePreviewImages(note.examType, note.previewImages, note.title)[0]}
                                  alt={note.title}
                                  className="w-12 h-14 object-cover rounded-xl border border-slate-200 dark:border-slate-800 shrink-0"
                                />
                                <div className="min-w-0">
                                  <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                    {note.title}
                                  </h4>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {note.examType} · {hasPdf ? 'PDF Attached ✓' : 'PDF pending upload'}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDownload(note)}
                                disabled={downloadingId === note.id}
                                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-primary hover:bg-primary-dark text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                              >
                                <Download size={14} />
                                {hasPdf ? 'Download PDF' : 'Check File'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-10 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                        <FileText className="mx-auto text-slate-300 dark:text-slate-700 mb-2" size={32} />
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          You haven&apos;t unlocked any study notes yet.
                        </p>
                        <Link to="/shop" className="text-xs font-bold text-primary hover:underline mt-2 inline-block">
                          Explore Featured Static GK 2026 (₹99) →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ================= TAB 2: MY LIBRARY ================= */}
            {activeTab === 'library' && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      My Purchased Digital Library ({purchasedNotesData.length})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Every verified note unlocked on your account with download tracking.
                    </p>
                  </div>
                  <Link to="/shop" className="text-xs font-bold text-primary hover:underline">
                    + Browse More Notes
                  </Link>
                </div>

                {loadingNotes ? (
                  <div className="py-12 text-center text-xs text-slate-400">Syncing your library...</div>
                ) : purchasedNotesData.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-5">
                    {purchasedNotesData.map((note) => {
                      const ent = entitlementsMap[note.id];
                      const used = ent?.downloadsUsed || 0;
                      const limit = ent?.downloadLimit || note.downloadLimit || 10;
                      const hasPdf = Boolean(note.fileUrl && note.fileUrl !== '#');
                      const matchedOrder = orders.find((o) => o.product_id === note.id && o.status === 'paid');

                      return (
                        <div
                          key={note.id}
                          className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 flex flex-col gap-4"
                        >
                          <div className="flex gap-4">
                            <img
                              src={getSafePreviewImages(note.examType, note.previewImages, note.title)[0]}
                              alt={note.title}
                              className="w-20 h-24 object-cover rounded-xl border border-slate-200 dark:border-slate-800 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-primary/10 text-primary">
                                  {note.examType}
                                </span>
                                <span
                                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                    hasPdf
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                  }`}
                                >
                                  {hasPdf ? 'Ready to Download' : 'PDF Pending Upload'}
                                </span>
                              </div>
                              <Link
                                to={`/product/${note.id}`}
                                className="font-bold text-sm text-slate-900 dark:text-white hover:text-primary line-clamp-2"
                              >
                                {note.title}
                              </Link>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                {matchedOrder
                                  ? `Unlocked ${new Date(matchedOrder.created_at).toLocaleDateString('en-IN')} · Order ${matchedOrder.payment_id.slice(0, 12)}`
                                  : 'Verified Account Entitlement'}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                                Downloads used: <strong>{used}</strong> / {limit}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                            <button
                              onClick={() => handleDownload(note)}
                              disabled={downloadingId === note.id}
                              className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-primary hover:bg-primary-dark text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Download size={14} />
                              {hasPdf ? 'Download PDF' : 'Check PDF Status'}
                            </button>
                            <button
                              onClick={() => downloadInvoice(note.title, matchedOrder, note)}
                              className="py-2.5 px-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 hover:border-primary/40 cursor-pointer"
                            >
                              <Receipt size={14} /> Invoice
                            </button>
                            <Link
                              to={`/product/${note.id}`}
                              className="py-2.5 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold flex items-center gap-1"
                              title="Open product page"
                            >
                              <ExternalLink size={14} />
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-16 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                    <BookOpen className="mx-auto text-slate-300 dark:text-slate-700 mb-3" size={40} />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No Digital Notes Unlocked Yet</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Purchase any study PDF using Razorpay and it will appear here permanently.
                    </p>
                    <Link to="/shop" className="premium-button-primary mt-5 inline-flex text-xs px-5 py-2.5">
                      Explore All Notes
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* ================= TAB 3: ORDERS & INVOICES ================= */}
            {activeTab === 'orders' && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      Orders &amp; Payment Receipts ({filteredOrders.length})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Complete transaction ledger including status, discounts, and downloadable invoices.
                    </p>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={orderFilter}
                      onChange={(e) => setOrderFilter(e.target.value)}
                      placeholder="Filter by ID, title, or status..."
                      className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <Search size={14} className="text-slate-400 absolute left-3 top-2.5" />
                  </div>
                </div>

                {loadingOrders ? (
                  <div className="py-12 text-center text-xs text-slate-400">Syncing payment ledger...</div>
                ) : filteredOrders.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-600 dark:text-slate-400 text-[10px] uppercase tracking-wider">
                          <th className="py-3 px-4">Payment ID</th>
                          <th className="py-3 px-4">Study Material</th>
                          <th className="py-3 px-4">Amount</th>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Receipt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredOrders.map((order) => {
                          const matchedNote = purchasedNotesData.find((p) => p.id === order.product_id);
                          const title = resolvedProductTitle(order.product_id, order.product_title);
                          return (
                            <tr key={order.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/40">
                              <td className="py-3.5 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                                {order.payment_id}
                              </td>
                              <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white max-w-xs truncate">
                                {title}
                                {order.coupon_code && (
                                  <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 font-mono">
                                    {order.coupon_code}
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white tabular-nums">
                                ₹{order.amount}
                              </td>
                              <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                                {new Date(order.created_at).toLocaleDateString('en-IN')}
                              </td>
                              <td className="py-3.5 px-4">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    order.status === 'paid'
                                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                      : order.status === 'refunded'
                                        ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                                        : order.status === 'failed'
                                          ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                  }`}
                                >
                                  {order.status}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                {order.status === 'paid' ? (
                                  <button
                                    onClick={() => downloadInvoice(title, order, matchedNote)}
                                    className="text-primary font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Download size={12} /> Invoice PDF
                                  </button>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-14 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                    <Receipt className="mx-auto text-slate-300 dark:text-slate-700 mb-3" size={38} />
                    <p className="text-xs text-slate-500 dark:text-slate-400">No orders matched your account or filter.</p>
                  </div>
                )}
              </div>
            )}

            {/* ================= TAB 4: ACCOUNT SETTINGS ================= */}
            {activeTab === 'settings' && (
              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-100 dark:border-slate-800 shadow-sm space-y-5">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Profile Details</h3>

                  {profileNotice && (
                    <div
                      className={`p-3.5 rounded-2xl text-xs font-semibold border ${
                        profileNotice.type === 'success'
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                          : profileNotice.type === 'error'
                            ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                            : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                      }`}
                    >
                      {profileNotice.text}
                    </div>
                  )}

                  <form onSubmit={handleSaveProfile} className="space-y-4">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                        Display Name
                      </label>
                      <input
                        type="text"
                        required
                        value={displayNameInput}
                        onChange={(e) => setDisplayNameInput(e.target.value)}
                        className="premium-input text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                        Registered Email
                      </label>
                      <input
                        type="email"
                        disabled
                        value={user.email}
                        className="premium-input text-sm opacity-70 cursor-not-allowed"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="premium-button-primary px-6 py-3 text-xs"
                    >
                      {savingProfile ? 'Saving Profile...' : 'Save Changes'}
                    </button>
                  </form>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-100 dark:border-slate-800 shadow-sm space-y-5">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Security &amp; Verification</h3>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Mail size={14} className="text-primary" /> Email Verification
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                          isFirebaseVerified
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {isFirebaseVerified ? 'Verified' : 'Unverified'}
                      </span>
                    </div>
                    {!isFirebaseVerified && auth.currentUser && (
                      <button
                        type="button"
                        onClick={handleSendVerificationEmail}
                        className="text-xs font-bold text-primary hover:underline cursor-pointer"
                      >
                        Resend Verification Link →
                      </button>
                    )}
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 space-y-3">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <KeyRound size={14} className="text-blue-600" /> Password Management
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Send a secure Firebase password reset link to your registered email address.
                    </p>
                    <button
                      type="button"
                      onClick={handlePasswordReset}
                      className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold hover:bg-primary transition-colors cursor-pointer"
                    >
                      Send Password Reset Email
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ================= TAB 5: SUPPORT DESK ================= */}
            {activeTab === 'support' && (
              <div className="grid lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-100 dark:border-slate-800 shadow-sm space-y-5">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Submit a Support Ticket</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Need help verifying a Razorpay payment or accessing a study PDF? Write directly to our admin desk.
                    </p>
                  </div>

                  {ticketNotice && (
                    <div
                      className={`p-3.5 rounded-2xl text-xs font-semibold border ${
                        ticketNotice.type === 'success'
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                          : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      {ticketNotice.text}
                    </div>
                  )}

                  <form onSubmit={handleSubmitTicket} className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                          Issue Category
                        </label>
                        <select
                          value={ticketCategory}
                          onChange={(e) => setTicketCategory(e.target.value as any)}
                          className="premium-input text-xs"
                        >
                          <option value="general">General Inquiry</option>
                          <option value="payment">Payment / Razorpay Issue</option>
                          <option value="download">PDF Download Access</option>
                          <option value="account">Account / Verification</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                          Order / Payment ID (Optional)
                        </label>
                        <input
                          type="text"
                          value={ticketOrderId}
                          onChange={(e) => setTicketOrderId(e.target.value)}
                          placeholder="pay_..."
                          className="premium-input text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                        Subject *
                      </label>
                      <input
                        type="text"
                        required
                        value={ticketSubject}
                        onChange={(e) => setTicketSubject(e.target.value)}
                        placeholder="Brief summary of your request"
                        className="premium-input text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                        Message *
                      </label>
                      <textarea
                        required
                        value={ticketMessage}
                        onChange={(e) => setTicketMessage(e.target.value)}
                        placeholder="Describe your issue..."
                        className="premium-input text-xs min-h-[120px] resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submittingTicket}
                      className="premium-button-primary px-6 py-3 text-xs"
                    >
                      <Send size={14} /> {submittingTicket ? 'Submitting...' : 'Submit Ticket'}
                    </button>
                  </form>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-100 dark:border-slate-800 shadow-sm space-y-5">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    My Support Tickets ({tickets.length})
                  </h3>

                  {loadingTickets ? (
                    <p className="text-xs text-slate-400 py-8 text-center">Loading ticket history...</p>
                  ) : tickets.length > 0 ? (
                    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                      {tickets.map((t) => (
                        <div
                          key={t.id}
                          className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs text-slate-900 dark:text-white">{t.subject}</span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                t.status === 'resolved'
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  : t.status === 'in_progress'
                                    ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {t.status.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300">{t.message}</p>
                          {t.adminReply && (
                            <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200/70 dark:border-teal-800 text-xs text-teal-900 dark:text-teal-200">
                              <strong className="block text-[10px] uppercase tracking-wider text-teal-700 dark:text-teal-400 mb-0.5">
                                Admin Reply:
                              </strong>
                              {t.adminReply}
                            </div>
                          )}
                          <p className="text-[10px] text-slate-400">
                            {new Date(t.created_at).toLocaleString('en-IN')}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                      <LifeBuoy className="mx-auto text-slate-300 dark:text-slate-700 mb-2" size={32} />
                      <p className="text-xs text-slate-500 dark:text-slate-400">No support tickets submitted yet.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Dashboard;
