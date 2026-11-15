import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import type { Request, Response, NextFunction } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

// Load Firebase Project config to query/verify catalog & coupons cleanly via Firestore REST if needed
let firebaseProjectId = '';
let firebaseDatabaseId = '(default)';
try {
  const cfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(cfgPath)) {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
    firebaseProjectId = cfg.projectId || '';
    firebaseDatabaseId = cfg.firestoreDatabaseId || '(default)';
  }
} catch {
  // Non-fatal
}

// Built-in catalog price floor map (server-authoritative baseline when Firestore REST lookup isn't used)
const BUILTIN_PRICES_INR: Record<string, { title: string; price: number }> = {
  prod_static_gk_2026: { title: 'NotesBazaar – Static GK 2026', price: 99 },
  prod_ssc_math_01: { title: 'Complete SSC Mathematics Topper Notes', price: 299 },
  prod_upsc_hist_02: { title: 'UPSC GS Paper 1: Modern Indian History (1757-1947)', price: 499 },
  prod_bank_reason_03: { title: 'Banking & Insurance Reasoning & Puzzles Mastery', price: 349 },
  prod_railway_gs_04: { title: 'Railways RRB NTPC General Science & Tech Capsule', price: 199 },
};

// In-memory replay & idempotency guard + lightweight IP rate limiter
const processedPaymentIds = new Map<string, { orderId: string; amountInr: number; verifiedAt: string; status: string }>();
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'local';
    const key = `${req.path}:${ip}`;
    const now = Date.now();
    const bucket = rateLimitBuckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (bucket.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please wait a moment and try again.',
      });
    }
    bucket.count += 1;
    return next();
  };
}

function getRazorpayConfig() {
  const keyId = (process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  const webhookSecret = (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();
  const explicitMode = (process.env.RAZORPAY_MODE || '').trim().toLowerCase();
  const liveReady = Boolean(keyId && keySecret && explicitMode !== 'demo');
  return {
    keyId,
    keySecret,
    webhookSecret,
    mode: liveReady ? 'live' : 'demo',
    liveReady,
  };
}

function timingSafeHexCompare(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Parse Firestore REST value helper
function extractFirestoreScalar(field: any): any {
  if (!field || typeof field !== 'object') return undefined;
  if ('stringValue' in field) return field.stringValue;
  if ('integerValue' in field) return Number(field.integerValue);
  if ('doubleValue' in field) return Number(field.doubleValue);
  if ('booleanValue' in field) return Boolean(field.booleanValue);
  return undefined;
}

async function fetchProductFromFirestore(productId: string): Promise<{ title: string; price: number; isEnabled: boolean } | null> {
  if (!firebaseProjectId || !productId || !/^[a-zA-Z0-9_-]{1,128}$/.test(productId)) {
    return null;
  }
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebaseProjectId)}/databases/${encodeURIComponent(firebaseDatabaseId)}/documents/products/${encodeURIComponent(productId)}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const doc = await resp.json();
    const fields = doc.fields || {};
    const price = extractFirestoreScalar(fields.price);
    const title = extractFirestoreScalar(fields.title);
    const isEnabled = extractFirestoreScalar(fields.is_enabled);
    if (typeof price === 'number' && !Number.isNaN(price)) {
      return {
        title: typeof title === 'string' ? title : productId,
        price,
        isEnabled: isEnabled !== false,
      };
    }
  } catch {
    // Fallback to builtin
  }
  return null;
}

async function fetchCouponFromFirestore(code: string): Promise<any | null> {
  if (!firebaseProjectId || !code) return null;
  const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (!cleanCode) return null;
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebaseProjectId)}/databases/${encodeURIComponent(firebaseDatabaseId)}/documents/coupons/${encodeURIComponent(cleanCode)}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const doc = await resp.json();
    const fields = doc.fields || {};
    return {
      code: cleanCode,
      discountType: extractFirestoreScalar(fields.discountType) || 'percent',
      discountValue: Number(extractFirestoreScalar(fields.discountValue) || 0),
      minOrderAmount: Number(extractFirestoreScalar(fields.minOrderAmount) || 0),
      maxDiscount: Number(extractFirestoreScalar(fields.maxDiscount) || 0),
      applicableProductId: extractFirestoreScalar(fields.applicableProductId) || '',
      usageLimit: Number(extractFirestoreScalar(fields.usageLimit) || 0),
      usedCount: Number(extractFirestoreScalar(fields.usedCount) || 0),
      expiresAt: extractFirestoreScalar(fields.expiresAt) || '',
      isActive: extractFirestoreScalar(fields.isActive) !== false,
    };
  } catch {
    return null;
  }
}

async function fetchPublicSettingsFromFirestore(): Promise<{ promoCode?: string; promoPercent?: number }> {
  if (!firebaseProjectId) return {};
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebaseProjectId)}/databases/${encodeURIComponent(firebaseDatabaseId)}/documents/settings/main`;
    const resp = await fetch(url);
    if (!resp.ok) return {};
    const doc = await resp.json();
    const fields = doc.fields || {};
    return {
      promoCode: extractFirestoreScalar(fields.promo_code),
      promoPercent: extractFirestoreScalar(fields.promo_discount_percent),
    };
  } catch {
    return {};
  }
}

async function computeAuthoritativePrice(productId: string, clientFallbackPrice?: number, clientFallbackTitle?: string, couponCode?: string) {
  const firestoreProduct = await fetchProductFromFirestore(productId);
  const builtin = BUILTIN_PRICES_INR[productId];

  const resolvedProduct = firestoreProduct || (builtin ? { ...builtin, isEnabled: true } : null);

  if (!resolvedProduct && (typeof clientFallbackPrice !== 'number' || clientFallbackPrice < 0)) {
    throw new Error('Product could not be verified.');
  }

  if (resolvedProduct && !resolvedProduct.isEnabled) {
    throw new Error('This product is currently unavailable for purchase.');
  }

  const basePrice = resolvedProduct ? resolvedProduct.price : Number(clientFallbackPrice);
  const title = resolvedProduct ? resolvedProduct.title : String(clientFallbackTitle || productId);

  let discountAmount = 0;
  let appliedCoupon: string | undefined;

  if (couponCode && couponCode.trim().length > 0) {
    const cleanCode = couponCode.trim().toUpperCase();
    const coupon = await fetchCouponFromFirestore(cleanCode);
    if (coupon) {
      if (!coupon.isActive) throw new Error('This coupon code is inactive.');
      if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
        throw new Error('This coupon code has expired.');
      }
      if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
        throw new Error('Coupon usage limit reached.');
      }
      if (coupon.minOrderAmount > 0 && basePrice < coupon.minOrderAmount) {
        throw new Error(`Minimum order of ₹${coupon.minOrderAmount} required for this coupon.`);
      }
      if (
        coupon.applicableProductId &&
        coupon.applicableProductId !== 'ALL' &&
        coupon.applicableProductId !== productId
      ) {
        throw new Error('Coupon is not valid for this product.');
      }
      if (coupon.discountType === 'percent') {
        discountAmount = Math.round((basePrice * coupon.discountValue) / 100);
        if (coupon.maxDiscount > 0) {
          discountAmount = Math.min(discountAmount, coupon.maxDiscount);
        }
      } else {
        discountAmount = Math.round(coupon.discountValue);
      }
      appliedCoupon = cleanCode;
    } else {
      // Check global settings promo_code fallback configured by Admin
      const pubSettings = await fetchPublicSettingsFromFirestore();
      if (pubSettings.promoCode && pubSettings.promoCode.trim().toUpperCase() === cleanCode && Number(pubSettings.promoPercent) > 0) {
        discountAmount = Math.round((basePrice * Number(pubSettings.promoPercent)) / 100);
        appliedCoupon = cleanCode;
      } else {
        throw new Error('Invalid or expired coupon code.');
      }
    }
  }

  discountAmount = Math.max(0, Math.min(discountAmount, basePrice));
  const finalAmount = Math.max(0, Math.round(basePrice - discountAmount));

  return {
    title,
    basePrice,
    discountAmount,
    finalAmount,
    appliedCoupon,
  };
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  // Baseline Security Headers
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  app.use(cors());

  // 1. Razorpay Webhook Endpoint MUST receive raw body for HMAC verification before express.json()
  app.post(
    '/api/razorpay/webhook',
    express.raw({ type: 'application/json', limit: '256kb' }),
    (req: Request, res: Response) => {
      const cfg = getRazorpayConfig();
      const signature = String(req.headers['x-razorpay-signature'] || '');
      const secret = cfg.webhookSecret || cfg.keySecret;

      if (!secret) {
        return res.status(503).json({ success: false, error: 'Webhook secret not configured on server.' });
      }

      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body || {});
      const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

      if (!timingSafeHexCompare(expectedSignature, signature)) {
        return res.status(400).json({ success: false, error: 'Invalid webhook signature.' });
      }

      try {
        const event = JSON.parse(rawBody);
        const eventType = String(event.event || '');
        const paymentEntity = event?.payload?.payment?.entity;

        if (paymentEntity?.id) {
          const paymentId = String(paymentEntity.id);
          const orderId = String(paymentEntity.order_id || '');
          const amountInr = Math.round(Number(paymentEntity.amount || 0) / 100);
          const status = eventType === 'payment.failed' ? 'failed' : 'paid';
          processedPaymentIds.set(paymentId, {
            orderId,
            amountInr,
            verifiedAt: new Date().toISOString(),
            status,
          });
        }

        return res.status(200).json({ received: true, event: eventType });
      } catch {
        return res.status(400).json({ success: false, error: 'Malformed webhook payload.' });
      }
    }
  );

  // Standard JSON parser for all remaining routes
  app.use(express.json({ limit: '512kb' }));

  // 2. Health & Gateway Capability Check (never leaks secrets)
  app.get('/api/health', (_req: Request, res: Response) => {
    const cfg = getRazorpayConfig();
    res.json({
      status: 'ok',
      service: 'NotesBazaar Commerce API',
      timestamp: new Date().toISOString(),
      razorpay: {
        mode: cfg.mode,
        liveReady: cfg.liveReady,
        keyIdConfigured: Boolean(cfg.keyId),
      },
    });
  });

  // 3. Server-Side Coupon Validation
  app.post('/api/coupons/validate', rateLimit(30, 60_000), async (req: Request, res: Response) => {
    try {
      const { productId, couponCode, fallbackPrice } = req.body || {};
      if (!productId || !couponCode) {
        return res.status(400).json({ valid: false, error: 'Product ID and coupon code are required.' });
      }

      const priced = await computeAuthoritativePrice(
        String(productId),
        typeof fallbackPrice === 'number' ? fallbackPrice : undefined,
        undefined,
        String(couponCode)
      );

      return res.json({
        valid: true,
        code: priced.appliedCoupon,
        basePrice: priced.basePrice,
        discountAmount: priced.discountAmount,
        finalAmount: priced.finalAmount,
      });
    } catch (err: any) {
      return res.status(400).json({
        valid: false,
        error: err?.message || 'Coupon validation failed.',
      });
    }
  });

  // 4. Create Razorpay Order (Server-Side Authoritative Amount)
  app.post('/api/razorpay/create-order', rateLimit(20, 60_000), async (req: Request, res: Response) => {
    try {
      const { productId, userEmail, couponCode, fallbackPrice, fallbackTitle, clientMode } = req.body || {};
      if (!productId || !userEmail || !String(userEmail).includes('@')) {
        return res.status(400).json({ success: false, error: 'Valid productId and userEmail are required.' });
      }

      const priced = await computeAuthoritativePrice(
        String(productId),
        typeof fallbackPrice === 'number' ? fallbackPrice : undefined,
        typeof fallbackTitle === 'string' ? fallbackTitle : undefined,
        typeof couponCode === 'string' ? couponCode : undefined
      );

      const cfg = getRazorpayConfig();
      const useLive = cfg.liveReady && clientMode !== 'demo';

      if (priced.finalAmount === 0) {
        const freeOrderId = `order_free_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        return res.json({
          success: true,
          mode: useLive ? 'live' : 'demo',
          isFreeWithCoupon: true,
          orderId: freeOrderId,
          amountInr: 0,
          amountPaise: 0,
          subtotalInr: priced.basePrice,
          discountInr: priced.discountAmount,
          couponCode: priced.appliedCoupon || null,
          productTitle: priced.title,
          currency: 'INR',
        });
      }

      if (useLive) {
        const authToken = Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString('base64');
        const receipt = `nb_${String(productId).slice(0, 16)}_${Date.now()}`;
        const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: priced.finalAmount * 100,
            currency: 'INR',
            receipt,
            notes: {
              productId: String(productId),
              productTitle: priced.title.slice(0, 120),
              userEmail: String(userEmail).trim().toLowerCase(),
              couponCode: priced.appliedCoupon || '',
            },
          }),
        });

        const rzpData = await rzpResponse.json();
        if (!rzpResponse.ok || !rzpData?.id) {
          return res.status(502).json({
            success: false,
            error: rzpData?.error?.description || 'Failed to create Razorpay order.',
          });
        }

        return res.json({
          success: true,
          mode: 'live',
          orderId: rzpData.id,
          keyId: cfg.keyId,
          amountInr: priced.finalAmount,
          amountPaise: rzpData.amount,
          subtotalInr: priced.basePrice,
          discountInr: priced.discountAmount,
          couponCode: priced.appliedCoupon || null,
          productTitle: priced.title,
          currency: 'INR',
        });
      }

      // Controlled Demo / Test Simulation Order
      const demoOrderId = `order_demo_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      return res.json({
        success: true,
        mode: 'demo',
        orderId: demoOrderId,
        keyId: cfg.keyId || 'rzp_test_demo_mode',
        amountInr: priced.finalAmount,
        amountPaise: priced.finalAmount * 100,
        subtotalInr: priced.basePrice,
        discountInr: priced.discountAmount,
        couponCode: priced.appliedCoupon || null,
        productTitle: priced.title,
        currency: 'INR',
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err?.message || 'Unable to initiate payment order.',
      });
    }
  });

  // 5. Verify Razorpay Payment Signature (HMAC-SHA256 + Payment Entity Cross-Check)
  app.post('/api/razorpay/verify-payment', rateLimit(25, 60_000), async (req: Request, res: Response) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        productId,
        expectedAmountInr,
        mode,
      } = req.body || {};

      if (!razorpay_order_id || !razorpay_payment_id) {
        return res.status(400).json({ verified: false, error: 'Missing order or payment identifier.' });
      }

      const paymentId = String(razorpay_payment_id);
      const orderId = String(razorpay_order_id);

      // Idempotency return if already verified
      const existing = processedPaymentIds.get(paymentId);
      if (existing && existing.status === 'paid') {
        return res.json({
          verified: true,
          idempotent: true,
          paymentId,
          orderId: existing.orderId,
          amountInr: existing.amountInr,
          verifiedAt: existing.verifiedAt,
        });
      }

      const cfg = getRazorpayConfig();

      // Free 100% coupon completion
      if (orderId.startsWith('order_free_') && Number(expectedAmountInr) === 0) {
        const record = {
          orderId,
          amountInr: 0,
          verifiedAt: new Date().toISOString(),
          status: 'paid',
        };
        processedPaymentIds.set(paymentId, record);
        return res.json({ verified: true, mode: 'free_coupon', paymentId, ...record });
      }

      // Demo simulation verification (distinct from live Razorpay verification)
      if (mode === 'demo' || orderId.startsWith('order_demo_')) {
        if (cfg.liveReady && mode === 'live') {
          return res.status(400).json({ verified: false, error: 'Live signature cannot use demo order ID.' });
        }
        const verifiedAt = new Date().toISOString();
        const amount = Number(expectedAmountInr || 0);
        processedPaymentIds.set(paymentId, {
          orderId,
          amountInr: amount,
          verifiedAt,
          status: 'paid',
        });
        return res.json({
          verified: true,
          mode: 'demo',
          paymentId,
          orderId,
          amountInr: amount,
          paymentMethod: 'Demo Checkout Simulation',
          verifiedAt,
        });
      }

      // Strict Live Razorpay HMAC-SHA256 Signature Check
      if (!cfg.keySecret || !cfg.keyId) {
        return res.status(503).json({
          verified: false,
          error: 'Razorpay live verification secret is not configured on the server.',
        });
      }

      if (!razorpay_signature) {
        return res.status(400).json({ verified: false, error: 'Missing razorpay_signature.' });
      }

      const expectedSignature = crypto
        .createHmac('sha256', cfg.keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      if (!timingSafeHexCompare(expectedSignature, String(razorpay_signature))) {
        return res.status(400).json({
          verified: false,
          error: 'Payment signature mismatch. Possible tampering detected.',
        });
      }

      // Cross-check payment status & amount directly with Razorpay REST API
      const authToken = Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString('base64');
      const paymentCheckResp = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
        headers: { Authorization: `Basic ${authToken}` },
      });

      if (!paymentCheckResp.ok) {
        return res.status(502).json({ verified: false, error: 'Could not confirm payment status with Razorpay API.' });
      }

      const paymentEntity = await paymentCheckResp.json();
      const paidStatus = String(paymentEntity.status || '');
      const amountPaidInr = Math.round(Number(paymentEntity.amount || 0) / 100);

      if (paidStatus !== 'captured' && paidStatus !== 'authorized') {
        return res.status(402).json({
          verified: false,
          status: paidStatus,
          error: `Payment is in '${paidStatus}' state and has not settled.`,
        });
      }

      if (productId) {
        const authPrice = await computeAuthoritativePrice(String(productId), Number(expectedAmountInr));
        if (typeof expectedAmountInr === 'number' && amountPaidInr < expectedAmountInr) {
          return res.status(400).json({
            verified: false,
            error: `Paid amount (₹${amountPaidInr}) is lower than required (₹${expectedAmountInr}).`,
          });
        }
        if (amountPaidInr < authPrice.finalAmount && !req.body?.couponCode) {
          return res.status(400).json({
            verified: false,
            error: 'Paid amount does not match catalog pricing.',
          });
        }
      }

      const verifiedAt = new Date().toISOString();
      processedPaymentIds.set(paymentId, {
        orderId,
        amountInr: amountPaidInr,
        verifiedAt,
        status: 'paid',
      });

      return res.json({
        verified: true,
        mode: 'live',
        paymentId,
        orderId,
        amountInr: amountPaidInr,
        paymentMethod: paymentEntity.method ? `Razorpay (${String(paymentEntity.method).toUpperCase()})` : 'Razorpay',
        verifiedAt,
      });
    } catch (err: any) {
      return res.status(500).json({
        verified: false,
        error: err?.message || 'Payment verification failed.',
      });
    }
  });

  // 6. Download Authorization & Policy Audit Endpoint
  app.post('/api/downloads/authorize', rateLimit(40, 60_000), (req: Request, res: Response) => {
    const { productId, userEmail, currentDownloads, downloadLimit, fileUrl } = req.body || {};
    if (!productId || !userEmail) {
      return res.status(400).json({ authorized: false, error: 'Product ID and user email are required.' });
    }
    const maxDownloads = typeof downloadLimit === 'number' && downloadLimit > 0 ? downloadLimit : 10;
    const used = Number(currentDownloads || 0);
    if (used >= maxDownloads) {
      return res.status(403).json({
        authorized: false,
        error: `Download limit (${maxDownloads}) reached for this study pack. Contact support from your dashboard if you need a reset.`,
      });
    }
    if (!fileUrl || fileUrl === '#') {
      return res.status(404).json({
        authorized: false,
        error: 'The PDF study pack file is not yet attached by the administrator.',
      });
    }
    return res.json({
      authorized: true,
      remainingDownloads: maxDownloads - used - 1,
      authorizedAt: new Date().toISOString(),
    });
  });

  // 7. Admin Refund Endpoint (Live Razorpay Refund API or Auditable Ledger Refund)
  app.post('/api/razorpay/refund', rateLimit(15, 60_000), async (req: Request, res: Response) => {
    try {
      const { paymentId, amountInr, reason } = req.body || {};
      if (!paymentId) {
        return res.status(400).json({ success: false, error: 'Payment ID is required.' });
      }
      const cfg = getRazorpayConfig();
      const pid = String(paymentId);

      if (cfg.liveReady && pid.startsWith('pay_') && !pid.includes('demo')) {
        const authToken = Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString('base64');
        const body: Record<string, any> = {
          notes: { reason: String(reason || 'Admin initiated refund').slice(0, 150) },
        };
        if (typeof amountInr === 'number' && amountInr > 0) {
          body.amount = Math.round(amountInr * 100);
        }
        const refundResp = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(pid)}/refund`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
        const refundData = await refundResp.json();
        if (!refundResp.ok) {
          return res.status(502).json({
            success: false,
            error: refundData?.error?.description || 'Razorpay refund API declined request.',
          });
        }
        return res.json({
          success: true,
          mode: 'live',
          refundId: refundData.id,
          status: refundData.status || 'processed',
        });
      }

      return res.json({
        success: true,
        mode: 'demo',
        refundId: `rfnd_demo_${Date.now()}`,
        status: 'refunded',
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Refund failed.' });
    }
  });

  // Mount Vite Dev Middleware or Static Production Build
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    app.get('/@vite/client', async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await vite.transformRequest('/@vite/client');
        if (result?.code) {
          const safeCode = result.code
            .replace(/await wsTransport\.connect\(handlers\);/g, 'return;')
            .replace(/transport\.connect\(createHMRHandler\(handleMessage\)\);/g, '/* HMR WebSocket disabled */')
            .replace(/throw new Error\("send was called before connect"\);/g, 'return;')
            .replace(/throw new Error\("invoke was called before connect"\);/g, 'return;');
          res.setHeader('Content-Type', 'application/javascript');
          return res.send(safeCode);
        }
      } catch {
        // Fall back cleanly if transform fails
      }
      return next();
    });
    app.get('/@vite-plugin-pwa/pwa-entry-point-loaded', (_req: Request, res: Response) => {
      res.setHeader('Content-Type', 'application/javascript');
      return res.send(`
export default function registerDevSW() {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/dev-sw.js?dev-sw', { scope: '/', type: 'module' }).catch(function() {});
  }
}
`);
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir, { maxAge: '1d', index: false }));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        return res.sendFile(indexFile);
      }
      return res.status(404).send('Build output not found. Run npm run build first.');
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    const cfg = getRazorpayConfig();
    console.log(`[NotesBazaar Server] Listening on http://0.0.0.0:${PORT} (mode=${isProduction ? 'prod' : 'dev'}, razorpay=${cfg.mode})`);
  });
}

startServer().catch((err) => {
  console.error('[NotesBazaar Server] Startup failure:', err);
  process.exit(1);
});
