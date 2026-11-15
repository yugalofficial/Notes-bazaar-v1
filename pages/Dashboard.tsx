import React, { useState, useEffect } from 'react';
import { User, Note } from '../types';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc, addDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { 
  LogOut, 
  Download, 
  FileText, 
  Star, 
  Users, 
  CreditCard, 
  ChevronRight,
  ExternalLink,
  Award,
  Wallet,
  Clock,
  CheckCircle2,
  Calendar,
  AlertCircle,
  TrendingUp,
  Mail,
  Receipt
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import {
  getBuiltinNoteById,
  getLocalOrders,
  saveSessionUser
} from '../utils/appScriptService';

interface DashboardProps {
  user: User;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const navigate = useNavigate();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [purchasedNotesData, setPurchasedNotesData] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'notes' | 'orders' | 'referrals'>('notes');

  // New states for referral copying feedback
  const [copiedReferral, setCopiedReferral] = useState(false);

  useEffect(() => {
    fetchPurchasedNotes();
    fetchOrderHistory();
  }, [user.purchasedNotes, user.email]);

  const fetchPurchasedNotes = async () => {
    const localOrders = getLocalOrders(user.email);
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
            description: data.description,
            price: data.price,
            originalPrice: data.original_price,
            previewImages: data.preview_images || [],
            fileUrl: data.file_url,
            rating: data.rating,
            reviewsCount: data.reviews_count,
            isBestseller: data.is_bestseller,
            studentsBought: data.students_bought
          };
        }
      } catch (e) {}

      if (!resolved) {
        resolved = getBuiltinNoteById(noteId);
      }
      if (!resolved) {
        const matchedOrder = localOrders.find((o) => o.product_id === noteId);
        if (matchedOrder) {
          resolved = {
            id: noteId,
            title: matchedOrder.product_title,
            category: 'Study Pack',
            examType: 'SSC' as any,
            description: 'Verified study material unlocked via Razorpay.',
            price: matchedOrder.amount,
            previewImages: [],
            fileUrl: '#',
            rating: 4.9,
            reviewsCount: 100,
            isBestseller: true
          };
        }
      }
      if (resolved) notes.push(resolved);
    }

    setPurchasedNotesData(notes);
    setLoadingNotes(false);
  };

  const fetchOrderHistory = async () => {
    const localOrders = getLocalOrders(user.email);
    try {
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, where('user_email', '==', user.email));
      const snap = await getDocs(q);
      const firestoreOrders = snap.docs.map((docItem) => {
        const data = docItem.data();
        return {
          id: docItem.id,
          product_id: data.product_id,
          product_title: data.product_title,
          amount: data.amount,
          status: data.status,
          payment_id: data.payment_id,
          created_at: data.created_at,
          user_email: data.user_email
        };
      });

      const mergedMap = new Map<string, any>();
      [...localOrders, ...firestoreOrders].forEach((o) => {
        const key = o.payment_id || o.id;
        if (!mergedMap.has(key)) mergedMap.set(key, o);
      });
      const combined = Array.from(mergedMap.values());
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setOrders(combined);
    } catch (err) {
      setOrders(localOrders);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleLogout = async () => {
    saveSessionUser(null);
    try {
      await signOut(auth);
    } catch (e) {}
    navigate('/login');
    window.location.reload();
  };

  const handleDownload = (note: Note) => {
    setDownloadingId(note.id);
    if (note.fileUrl && note.fileUrl !== '#') {
      window.open(note.fileUrl, '_blank');
      setTimeout(() => setDownloadingId(null), 500);
      return;
    }

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    pdf.setFillColor(29, 78, 216);
    pdf.rect(0, 0, 210, 32, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.text('NOTESBAZAAR • VERIFIED TOPPER NOTES', 15, 16);
    pdf.setFontSize(10);
    pdf.text(`${note.examType} | ${note.category} — Your Study Partner`, 15, 24);

    pdf.setTextColor(15, 23, 42);
    pdf.setFontSize(16);
    pdf.text(note.title, 15, 48);
    pdf.setFont('Helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(71, 85, 105);
    const wrapped = pdf.splitTextToSize(note.description, 180);
    pdf.text(wrapped, 15, 58);

    pdf.setDrawColor(13, 148, 136);
    pdf.setFillColor(240, 253, 250);
    pdf.rect(15, 85, 180, 140, 'FD');
    pdf.setFont('Helvetica', 'bold');
    pdf.setTextColor(13, 148, 136);
    pdf.text('STUDENT STUDY VAULT EDITION', 22, 98);
    pdf.setFont('Helvetica', 'normal');
    pdf.setTextColor(30, 41, 59);
    pdf.setFontSize(10.5);
    pdf.text(`• Licensed to: ${user.displayName} (${user.email})`, 22, 112);
    pdf.text('• Topic-wise topper formulas, diagrams & PYQ shortcuts included.', 22, 122);
    pdf.save(`${note.title.replace(/[^a-z0-9]/gi, '_').slice(0, 32)}.pdf`);
    setTimeout(() => setDownloadingId(null), 500);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(user.referralCode || `NB-${user.uid.substring(0, 6).toUpperCase()}`);
    setCopiedReferral(true);
    setTimeout(() => setCopiedReferral(false), 2000);
  };

  // Spectacular Premium PDF Generator
  const downloadInvoice = async (note: Note) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Outer framing border
    doc.setDrawColor(20, 184, 166); // Teal primary border
    doc.setLineWidth(1);
    doc.rect(5, 5, 200, 287);

    // Header graphics block
    doc.setFillColor(248, 250, 252); // Slate light grey background header block
    doc.rect(6, 6, 198, 42, 'F');
    
    doc.setDrawColor(234, 242, 240);
    doc.setLineWidth(0.5);
    doc.line(6, 48, 204, 48);

    // Primary Branding Header Titles
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(13, 148, 136); // Teal
    doc.text('NotesBazaar', 15, 22);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(140, 140, 140);
    doc.text('OFFICIAL PURCHASE RECEIPT & CERTIFICATE', 15, 30);

    // Invoice Status Badge
    doc.setFillColor(209, 250, 229); // Light green fill
    doc.rect(155, 14, 38, 10, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(5, 150, 105); // Deep emerald
    doc.text('PAYMENT SECURED', 157.5, 20.5);

    // Metadata lines
    doc.setFontSize(8.5);
    doc.setTextColor(110);
    doc.text(`Receipt ID: NB-TXN-${note.id.substring(0, 8).toUpperCase()}`, 15, 38);
    doc.text(`Issued On: ${new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}`, 15, 43);

    // Divider line
    doc.setDrawColor(220, 225, 230);
    doc.line(15, 58, 195, 58);

    // Buyer & Provider Information Columns
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(50);
    doc.text('PROVIDER DETAILS:', 15, 68);
    doc.text('BUYER PROFILE:', 115, 68);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(90);
    doc.text('NotesBazaar Education Services Ltd.', 15, 74);
    doc.text('Indirapuram, UP, India', 15, 80);
    doc.text('support@notesbazaar.co', 15, 86);

    doc.text(`Name: ${user.displayName}`, 115, 74);
    doc.text(`Email: ${user.email}`, 115, 80);
    doc.text(`Tier Status: ${user.membershipType.toUpperCase()}`, 115, 86);

    // Product Order items table
    doc.setDrawColor(20, 184, 166);
    doc.setFillColor(13, 148, 136);
    doc.rect(15, 100, 180, 8, 'F'); // Dark table header bar

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255);
    doc.text('Item Description / Exam category', 18, 105.5);
    doc.text('Qty', 145, 105.5);
    doc.text('Price (INR)', 170, 105.5);

    // Table Row White Block
    doc.setFillColor(248, 250, 252);
    doc.rect(15, 108, 180, 24, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, 108, 180, 24, 'D');

    // Row Data text
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(30);
    doc.text(note.title, 18, 116);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(120);
    doc.text(`Category: ${note.category} | Exam Target: ${note.examType}`, 18, 122);
    doc.text('Guaranteed lifelong free study syllabus updates', 18, 127);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(30);
    doc.text('1', 147, 118);
    doc.text(`INR ${note.price}.00`, 171, 118);

    // Price summaries
    doc.setDrawColor(226, 232, 240);
    doc.line(115, 142, 195, 142);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(125);
    doc.text('Subtotal amount:', 115, 148);
    doc.text('Taxes & Gateway fees:', 115, 154);
    doc.text('Discount Code Applied:', 115, 160);

    doc.setTextColor(30);
    doc.text(`INR ${note.price}.00`, 175, 148);
    doc.text('INR 0.00', 175, 154);
    doc.text('None (0%)', 175, 160);

    // Final Total Secured Box
    doc.setFillColor(240, 253, 250);
    doc.rect(115, 165, 80, 12, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(13, 148, 136);
    doc.text('Secured NET Total:', 118, 172.5);
    doc.text(`INR ${note.price}.00`, 166, 172.5);

    // Draw stylized validation badge stamp vector
    doc.setDrawColor(20, 184, 166);
    doc.setFillColor(248, 250, 252);
    doc.setLineWidth(0.6);
    doc.circle(42, 215, 18, 'F');
    doc.circle(42, 215, 18, 'D');
    doc.circle(42, 215, 16, 'D');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(13, 148, 136);
    doc.text('VERIFIED', 32, 213);
    doc.text('STUDY GUIDE', 30.5, 216);
    doc.text('OFFICIAL', 32, 219);

    // Compliance signatures & dynamic QR mock pattern
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(80);
    doc.text('AUTHORIZED REGISTRAR', 125, 210);

    // Sign Line
    doc.setDrawColor(180);
    doc.line(125, 222, 185, 222);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text('NotesBazaar Compliance Representative', 125, 227);
    doc.text('Yugal N., Director of Academics', 125, 232);

    // Footer copyright message
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('This is a secure system generated financial document verifying instant digital file delivery.', 15, 275);
    doc.text('For purchase reconciliation please contact our legal desk at Indirapuram, UP, India.', 15, 280);

    // Save PDF
    doc.save(`NotesBazaar-Invoice-${note.id.substring(0, 8).toUpperCase()}.pdf`);

    // Log this action to activity trail when Firebase session is active
    if (auth.currentUser) {
      try {
        await addDoc(collection(db, 'activity_logs'), {
          uid: auth.currentUser.uid,
          userEmail: auth.currentUser.email || user.email,
          action: 'DOWNLOAD_INVOICE',
          details: `Downloaded PDF receipt invoice for ${note.title}`,
          createdAt: new Date().toISOString()
        });
      } catch (e) {
        console.warn('Could not log activity down', e);
      }
    }
  };

  const hasPurchased = user.purchasedNotes && user.purchasedNotes.length > 0;
  const resolvedProductTitle = (pId: string) => {
    return purchasedNotesData.find(p => p.id === pId)?.title || "Premium Study Notebook Guide";
  };

  return (
    <div className="min-h-screen bg-slate-50/20 dark:bg-slate-950 transition-colors duration-300">
      
      {/* Dynamic Header Block */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-8 border-b border-slate-100 dark:border-slate-900">
          <div>
            <span className="text-[10px] font-bold text-primary dark:text-primary bg-primary/10 px-3 py-1 rounded-full uppercase tracking-widest">
              Verified Aspirant Account
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mt-3 font-heading tracking-tight">
              Dashboard Hub
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Accelerate your prep, <span className="text-primary font-bold dark:text-primary">{user.displayName}</span>
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="bg-teal-50 dark:bg-slate-900 border border-teal-100/50 dark:border-slate-800 px-5 py-2.5 rounded-2xl flex items-center gap-3.5 shadow-sm">
              <Award className="text-primary dark:text-amber-400" size={20} />
              <div>
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Aspirant Plan</p>
                <p className="text-xs font-bold text-primary dark:text-amber-400">{user.membershipType === 'none' ? 'Standard Access' : user.membershipType.toUpperCase()}</p>
              </div>
            </div>

            <button 
              onClick={handleLogout}
              className="px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-red-500 dark:hover:text-red-400 transition-colors flex items-center gap-2 text-xs cursor-pointer"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </div>

        {/* Bento Grid Stats Panel */}
        <div className="grid lg:grid-cols-3 gap-8 mb-10">
          
          {/* User Side Info Card */}
          <div className="flex flex-col gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-900 shadow-sm text-center relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-primary"></div>
              <div className="w-20 h-20 bg-primary/10 text-primary dark:text-teal-400 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-4 shadow-inner uppercase">
                {user.displayName.charAt(0)}
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">{user.displayName}</h3>
              <p className="text-slate-400 dark:text-slate-500 text-xs mb-4">{user.email}</p>
              
              <div className="p-3 bg-slate-50 dark:bg-slate-950/45 rounded-xl border border-slate-100/60 dark:border-slate-800 text-left text-xs mb-2">
                <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[9px] block">Referral Code</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{user.referralCode || `NB-${user.uid.substring(0,6).toUpperCase()}`}</span>
                  <button 
                    onClick={handleCopyCode}
                    className="text-xs text-primary font-bold hover:underline cursor-pointer uppercase tracking-wider text-[9px]"
                  >
                    {copiedReferral ? 'Copied ✓' : 'Copy'}
                  </button>
                </div>
              </div>
              
              <Link 
                to="/membership" 
                className="block w-full text-center py-2.5 bg-slate-50 hover:bg-primary dark:bg-slate-950 hover:text-white dark:hover:bg-primary dark:text-slate-300 rounded-xl transition-all border border-slate-200 dark:border-slate-800 text-xs font-bold mt-2"
              >
                Upgrade Plan
              </Link>
            </div>

            {/* Refer & Earn monetization card */}
            <div className="bg-gradient-to-br from-indigo-900 to-slate-950 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden group">
              <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-primary/20 rounded-full blur-3xl group-hover:scale-150 transition-all duration-1000"></div>
              <Wallet className="text-primary mb-3" size={28} />
              <h4 className="font-bold text-base mb-1 relative z-10">Refer & Earn Real Rewards</h4>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed relative z-10 font-medium">
                Refer other college aspirants or students to study on NotesBazaar and instantly earn <span className="font-sans font-bold text-primary">₹50 Credit</span> when they place any notes purchase.
              </p>
              <button 
                onClick={handleCopyCode}
                className="w-full bg-primary text-white py-3 rounded-xl text-center text-xs font-bold hover:bg-teal-500 transition-all shadow-lg shadow-teal-500/10 cursor-pointer"
              >
                {copiedReferral ? 'Copied Referral Code ✓' : 'Share Referral Code'}
              </button>
            </div>
          </div>

          {/* Interactive tabs and data visualization sections */}
          <div className="lg:col-span-2 space-y-8">
            <div className="grid sm:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                  <FileText size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Unlocked Notes</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">{purchasedNotesData.length}</p>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-500 dark:text-indigo-400 rounded-xl flex items-center justify-center">
                  <Receipt size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Verified Orders</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">{orders.length}</p>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 dark:text-emerald-400 rounded-xl flex items-center justify-center">
                  <Award size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Membership</p>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {user.membershipType === 'none' ? 'Standard' : user.membershipType.toUpperCase()}
                  </p>
                </div>
              </div>
            </div>

            {/* Sub-panels navigation bar */}
            <div className="flex border-b border-slate-200 dark:border-slate-800">
              <button 
                onClick={() => setActiveSubTab('notes')}
                className={`px-5 py-3 font-bold text-sm transition-all relative ${
                  activeSubTab === 'notes' ? 'text-primary' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                Access Library
                {activeSubTab === 'notes' && <motion.div layoutId="subtab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
              </button>
              <button 
                onClick={() => setActiveSubTab('orders')}
                className={`px-5 py-3 font-bold text-sm transition-all relative ${
                  activeSubTab === 'orders' ? 'text-primary' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                Order History & Invoices
                {activeSubTab === 'orders' && <motion.div layoutId="subtab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
              </button>
              <button 
                onClick={() => setActiveSubTab('referrals')}
                className={`px-5 py-3 font-bold text-sm transition-all relative ${
                  activeSubTab === 'referrals' ? 'text-primary' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                Partner Program
                {activeSubTab === 'referrals' && <motion.div layoutId="subtab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
              </button>
            </div>

            {/* Dashboard Subtab Render Panels */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSubTab}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="bg-white dark:bg-slate-900 rounded-[32px] p-6 border border-slate-100 dark:border-slate-800 shadow-sm"
              >
                {activeSubTab === 'notes' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
                      My Study Notes Guide <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">{purchasedNotesData.length}</span>
                    </h3>
                    
                    {loadingNotes ? (
                      <div className="text-center py-12 text-slate-400 font-medium">Retrieving verified study vault files...</div>
                    ) : purchasedNotesData.length > 0 ? (
                      <div className="grid gap-4">
                        {purchasedNotesData.map((note) => (
                          <div key={note.id} className="flex flex-col sm:flex-row items-center justify-between p-5 border border-slate-100 dark:border-slate-800 rounded-2xl hover:border-primary/20 hover:bg-slate-50/60 dark:hover:bg-slate-950/60 transition-all group bg-slate-50/40 dark:bg-slate-950/40">
                            <div className="flex items-center gap-4 mb-3 sm:mb-0 w-full sm:w-auto">
                              <div className="w-12 h-12 bg-white dark:bg-slate-950 text-primary flex items-center justify-center rounded-xl font-bold text-sm shadow-inner group-hover:bg-primary group-hover:text-white transition-all border border-slate-100 dark:border-slate-800">
                                PDF
                              </div>
                              <div className="flex-1">
                                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm md:text-base leading-snug mb-0.5 line-clamp-1 group-hover:text-primary transition-colors">{note.title}</h4>
                                <div className="flex items-center flex-wrap gap-2 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wide">
                                  <span>{note.examType}</span>
                                  <span>•</span>
                                  <span className="text-emerald-500 flex items-center gap-0.5">✓ Secured Instant Access</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex gap-2 w-full sm:w-auto">
                              <button 
                                onClick={() => downloadInvoice(note)}
                                className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl transition-all font-bold text-xs border border-slate-100 dark:border-slate-800 flex items-center justify-center gap-1.5 cursor-pointer"
                                title="Download Certified Invoice Receipt"
                              >
                                <Receipt size={14} /> Certificate
                              </button>
                              <button 
                                onClick={() => handleDownload(note)}
                                className="flex-1 sm:flex-none text-white bg-slate-900 hover:bg-primary rounded-xl px-5 py-2.5 transition-all text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-slate-900/10 cursor-pointer"
                              >
                                <Download size={14} /> Download
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-16 flex flex-col items-center gap-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                        <FileText className="text-slate-300 dark:text-slate-700" size={40} />
                        <div>
                          <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">You do not have any purchased premium notes guides on this profile.</p>
                          <Link to="/shop" className="text-primary font-bold hover:underline text-xs mt-3 inline-block uppercase tracking-wider">Explore Study Materials</Link>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeSubTab === 'orders' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
                      My Purchase History & Ledger
                    </h3>

                    {loadingOrders ? (
                      <div className="text-center py-12 text-slate-400 font-medium">Syncing historic billing logs...</div>
                    ) : orders.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-500 dark:text-slate-400 border-collapse">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300 text-[10px] uppercase tracking-wider">
                              <th className="py-3 px-4">Transaction ID</th>
                              <th className="py-3 px-4">Study Material</th>
                              <th className="py-3 px-4">Price</th>
                              <th className="py-3 px-4">Date</th>
                              <th className="py-3 px-4">Status</th>
                              <th className="py-3 px-4 text-right">Invoices</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                            {orders.map((order) => {
                              const note = purchasedNotesData.find(p => p.id === order.product_id);
                              return (
                                <tr key={order.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-950/15">
                                  <td className="py-3.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                                    {order.payment_id.substring(0, 10).toUpperCase()}
                                  </td>
                                  <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 truncate max-w-xs">
                                    {resolvedProductTitle(order.product_id)}
                                  </td>
                                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                                    ₹{order.amount}
                                  </td>
                                  <td className="py-3.5 px-4 text-slate-400 text-xs">
                                    {new Date(order.created_at).toLocaleDateString()}
                                  </td>
                                  <td className="py-3.5 px-4">
                                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                      order.status === 'paid' 
                                        ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400' 
                                        : 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400'
                                    }`}>
                                      {order.status}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 text-right">
                                    {order.status === 'paid' && note ? (
                                      <button
                                        onClick={() => downloadInvoice(note)}
                                        className="text-primary font-bold hover:underline cursor-pointer flex items-center gap-1 ml-auto text-xs"
                                        title="Generate official receipt"
                                      >
                                        <Download size={12} /> Invoice PDF
                                      </button>
                                    ) : (
                                      <span className="text-slate-300">-</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-16 flex flex-col items-center gap-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                        <Receipt className="text-slate-300 dark:text-slate-700" size={40} />
                        <div>
                          <p className="text-slate-400 dark:text-slate-500 text-xs">No transactions have been recorded under your email.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeSubTab === 'referrals' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        Affiliate Partner Program
                      </h3>
                      <p className="text-xs text-slate-400">Share knowledge, build student circles, and earn direct credits.</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6 bg-slate-50/50 dark:bg-slate-950/30 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div className="space-y-3">
                        <span className="text-[10px] font-bold text-primary dark:text-primary bg-primary/10 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          Passive Cashbacks
                        </span>
                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">How does affiliate partner program work?</h4>
                        <ol className="space-y-2 text-xs text-slate-500 dark:text-slate-400 list-decimal pl-4 font-medium">
                          <li>Secure your unique affiliate coupon code: <span className="font-bold text-primary">{user.referralCode || `NB-${user.uid.substring(0,6).toUpperCase()}`}</span></li>
                          <li>Share the invitation code with exam aspirants or groups on Telegram, WhatsApp, and Facebook.</li>
                          <li>When a candidate registers and purchases a premium study guide, they get a custom welcome bonus, and you earn <span className="font-bold text-slate-900 dark:text-white">₹50 Credit</span> inside your wallet.</li>
                        </ol>
                      </div>

                      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-xl flex flex-col justify-center items-center gap-4 shadow-sm text-center">
                        <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 rounded-2xl flex items-center justify-center">
                          <Wallet size={24} />
                        </div>
                        <div>
                          <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">Aspirant Wallet Balance</h5>
                          <p className="text-2xl font-black text-emerald-500 mt-1">₹0.00</p>
                        </div>
                        <button 
                          onClick={handleCopyCode}
                          className="premium-button-primary w-full py-2 font-bold text-xs"
                        >
                          {copiedReferral ? 'Copied Code ✓' : 'Copy Affiliation Code'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
