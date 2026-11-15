import React, { useState } from 'react';
import { useLocation, Link, Navigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import {
  CheckCircle,
  Download,
  Mail,
  Copy,
  Check,
  ArrowRight
} from 'lucide-react';
import { NotesBazaarLogo } from '../components/NotesBazaarLogo';

const ThankYou: React.FC = () => {
  const location = useLocation();
  const product = location.state?.product;
  const paymentId = location.state?.paymentId || 'NB-SEC-TXN';
  const deliveryChannel = location.state?.deliveryChannel || 'Automated Email & Student Dashboard';

  const [downloading, setDownloading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!product) {
    return <Navigate to="/" />;
  }

  const effectiveFileUrl =
    product.fileUrl && product.fileUrl !== '#' ? product.fileUrl : `${window.location.origin}/#/dashboard`;

  const handleDownload = async () => {
    setDownloading(true);
    if (product.fileUrl && product.fileUrl !== '#') {
      window.open(effectiveFileUrl, '_blank');
      setTimeout(() => setDownloading(false), 600);
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
    pdf.text(`${product.examType || 'Competitive'} | Order: ${paymentId}`, 15, 24);
    pdf.setTextColor(15, 23, 42);
    pdf.setFontSize(16);
    pdf.text(product.title, 15, 48);
    pdf.setFont('Helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(71, 85, 105);
    pdf.text(pdf.splitTextToSize(product.description || '', 180), 15, 58);
    pdf.save(`${product.title.replace(/[^a-z0-9]/gi, '_').slice(0, 32)}.pdf`);
    setTimeout(() => setDownloading(false), 600);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(effectiveFileUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-xl w-full bg-white dark:bg-slate-900 rounded-[36px] p-8 md:p-11 shadow-2xl text-center border border-slate-100 dark:border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-700 via-teal-600 to-emerald-600"></div>

        <div className="flex justify-center mb-5">
          <NotesBazaarLogo variant="seal" size={76} className="drop-shadow-md" />
        </div>

        <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-3.5 py-1.5 rounded-full">
          <CheckCircle size={14} />
          Payment Confirmed · Instant Delivery
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mt-3 mb-2 font-heading">
          You&apos;re All Set!
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 max-w-md mx-auto">
          Thank you for choosing NotesBazaar. Your study material PDF is unlocked and dispatched to your inbox.
        </p>

        {/* Delivery Details Card */}
        <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 mb-6 text-left space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-slate-400 uppercase tracking-widest">Selected Study Pack</span>
              <span className="font-mono font-bold text-primary text-[11px]">ID: {paymentId.substring(0, 16)}</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{product.title}</h3>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex-1 premium-button-primary py-3.5 px-5 rounded-2xl text-sm"
            >
              {downloading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Preparing PDF...</span>
                </>
              ) : (
                <>
                  <Download size={18} />
                  <span>Download Notes PDF</span>
                </>
              )}
            </button>

            <button
              onClick={handleCopyLink}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 py-3.5 px-4 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copiedLink ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
              <span>{copiedLink ? 'Link Copied!' : 'Copy Direct Link'}</span>
            </button>
          </div>

          <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1">
            <div className="flex items-center gap-2 text-primary font-bold">
              <Mail size={14} />
              <span>Automated Email Dispatch Active</span>
            </div>
            <p className="text-[11px] text-slate-400">
              A copy of this file access link and official receipt has been delivered via {deliveryChannel}.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-xs font-bold pt-1">
          <Link
            to="/dashboard"
            className="w-full sm:w-auto px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-blue-700 dark:hover:bg-primary dark:hover:text-white rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            Go to Student Library <ArrowRight size={14} />
          </Link>
          <Link
            to="/shop"
            className="w-full sm:w-auto px-6 py-3 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl flex items-center justify-center transition-all"
          >
            Browse More Notes
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ThankYou;
