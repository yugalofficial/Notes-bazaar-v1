import React, { useState, useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getLocalOrders, getSessionUser } from '../utils/appScriptService';

interface ToastOrder {
  title: string;
  method: string;
  timeLabel: string;
}

/**
 * Displays a confirmation notification strictly for the signed-in user's own
 * recent verified purchase within the last 10 minutes—never fabricated social proof.
 */
const PurchaseToast: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<ToastOrder | null>(null);

  useEffect(() => {
    const user = getSessionUser();
    if (!user?.email) return;

    const orders = getLocalOrders(user.email);
    if (!orders || orders.length === 0) return;

    const latest = orders[0];
    const ageMs = Date.now() - new Date(latest.created_at).getTime();
    if (Number.isNaN(ageMs) || ageMs > 10 * 60 * 1000) return;

    setCurrentOrder({
      title: latest.product_title || 'Study Material PDF',
      method: latest.payment_method || 'Razorpay Verified',
      timeLabel: new Date(latest.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
    setVisible(true);
    const hideTimer = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(hideTimer);
  }, []);

  return (
    <AnimatePresence>
      {visible && currentOrder && (
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          className="fixed bottom-24 md:bottom-6 left-4 md:left-6 z-40 bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-3.5 max-w-sm"
        >
          <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center rounded-xl shrink-0">
            <CheckCircle2 size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
              Verified Purchase: <span className="text-primary">{currentOrder.title}</span>
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {currentOrder.method} · {currentOrder.timeLabel}
            </p>
          </div>
          <button
            onClick={() => setVisible(false)}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PurchaseToast;
