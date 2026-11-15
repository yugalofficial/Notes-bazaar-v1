
export enum ExamType {
  SSC = 'SSC',
  BANKING = 'Banking',
  UPSC = 'UPSC',
  RAILWAYS = 'Railways',
  ALL = 'General'
}

export enum PaymentMode {
  RAZORPAY = 'razorpay',
  PAYPAL = 'paypal',
  WHATSAPP = 'whatsapp' // Fallback
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
  fileUrl: string; // The download link
  rating: number;
  reviewsCount: number;
  isBestseller: boolean;
  studentsBought?: string; 
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
}

export interface Order {
  id: string;
  user_email: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  product_id: string;
  payment_id: string;
  created_at: string;
}

export interface SiteSettings {
  razorpay_key: string;
  razorpay_mode?: 'demo' | 'live';
  paypal_client_id: string;
  enable_razorpay: boolean;
  enable_paypal: boolean;
  // Google Apps Script Webhook for automated email delivery of files & links
  appscript_webhook_url?: string;
  appscript_auth_token?: string;
  // EmailJS backup
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
  promo_code?: string;
  promo_discount_percent?: number;
  contact_email?: string;
  contact_phone?: string;
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
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  uid?: string;
  userEmail?: string;
  action: string;
  details: string;
  createdAt: string;
}

