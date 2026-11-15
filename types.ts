export enum ExamType {
  SSC = 'SSC',
  BANKING = 'Banking',
  UPSC = 'UPSC',
  RAILWAYS = 'Railways',
  STATE_PSC = 'State PSC',
  ALL = 'General'
}

export enum PaymentMode {
  RAZORPAY = 'razorpay',
  PAYPAL = 'paypal',
  WHATSAPP = 'whatsapp'
}

export interface Note {
  id: string;
  title: string;
  category: string;
  examType: ExamType;
  description: string;
  price: number;
  originalPrice?: number;
  previewImages: string[];
  fileUrl: string; // PDF download URL or empty string if awaiting admin upload
  fileName?: string;
  fileSizeLabel?: string;
  rating: number;
  reviewsCount: number;
  isBestseller: boolean;
  studentsBought?: string;
  pagesCount?: string;
  updatedLabel?: string;
  examSuitability?: string[];
  keyTopics?: string[];
  isEnabled?: boolean;
  isArchived?: boolean;
  downloadLimit?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  purchasedNotes: string[];
  membershipType: 'none' | 'basic' | 'pro' | 'elite';
  membershipExpiry?: number;
  referralCode?: string;
  status?: 'active' | 'suspended';
  emailVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Order {
  id: string;
  uid?: string;
  user_email: string;
  amount: number;
  subtotal?: number;
  discount_amount?: number;
  coupon_code?: string;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  product_id: string;
  product_title?: string;
  payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
  provider?: string;
  payment_method?: string;
  verified_by_server?: boolean;
  download_count?: number;
  refund_id?: string;
  refund_reason?: string;
  created_at: string;
  updated_at?: string;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  applicableProductId?: string; // empty or 'ALL' applies store-wide
  usageLimit?: number;
  usedCount: number;
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Campaign {
  id: string;
  title: string;
  subtitle?: string;
  productId?: string;
  offerPrice?: number;
  couponCode?: string;
  startsAt?: string;
  expiresAt: string;
  isActive: boolean;
  createdAt: string;
}

export interface DownloadRecord {
  id: string;
  uid: string;
  userEmail: string;
  productId: string;
  productTitle: string;
  orderId?: string;
  downloadedAt: string;
}

export interface SupportTicket {
  id: string;
  uid?: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  orderId?: string;
  category?: 'payment' | 'download' | 'account' | 'general';
  status: 'open' | 'in_progress' | 'resolved';
  adminReply?: string;
  created_at: string;
  updated_at?: string;
}

export interface SiteSettings {
  razorpay_key: string;
  razorpay_mode?: 'demo' | 'live';
  paypal_client_id: string;
  enable_razorpay: boolean;
  enable_paypal: boolean;
  appscript_webhook_url?: string;
  appscript_auth_token?: string;
  emailjs_service_id?: string;
  emailjs_template_id?: string;
  emailjs_public_key?: string;
  firebase_api_key?: string;
  firebase_auth_domain?: string;
  firebase_project_id?: string;
  firebase_storage_bucket?: string;
  firebase_messaging_sender_id?: string;
  firebase_app_id?: string;
  hero_title?: string;
  hero_subtitle?: string;
  brand_tagline?: string;
  announcement_enabled?: boolean;
  announcement_text?: string;
  campaign_title?: string;
  campaign_expires_at?: string;
  campaign_product_id?: string;
  promo_code?: string;
  promo_discount_percent?: number;
  contact_email?: string;
  contact_phone?: string;
  whatsapp_number?: string;
  office_address?: string;
}

export interface Review {
  id: string;
  uid: string;
  userName: string;
  userEmail: string;
  productId: string;
  rating: number;
  comment: string;
  verifiedPurchase?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ActivityLog {
  id: string;
  uid?: string;
  userEmail?: string;
  action: string;
  details: string;
  createdAt: string;
}
