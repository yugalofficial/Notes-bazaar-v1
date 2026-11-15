/**
 * NotesBazaar Google Apps Script Client Service
 *
 * Full Serverless Google Sheets Architecture:
 * - Email-Only Authentication (sign in or register with email via deployed AppScript URL)
 * - Auto-setup Google Spreadsheet with sample database tabs:
 *    • Products (notes catalog with title, exam_type, price, download link, preview)
 *    • Users (student emails, roles, purchased notes)
 *    • Orders (purchased transaction ledger)
 *    • Reviews (ratings & feedback)
 * - Live fetching of products and user access directly from Google Sheets
 * - No heavy storage requirement; data flows smoothly through Sheets Webhook.
 */

import { Note, User, ExamType } from '../types';
import { FOUNDER_ADMIN_EMAILS } from './security';

export interface AppScriptResponse<T = any> {
  status: 'success' | 'error';
  message?: string;
  data?: T;
  user?: any;
  notes?: any[];
  sheetsCreated?: string[];
}

// Persistent key for AppScript URL
const STORAGE_APPSCRIPT_KEY = 'notesbazaar_appscript_url';

export const getStoredAppScriptUrl = (): string => {
  try {
    const url = localStorage.getItem(STORAGE_APPSCRIPT_KEY);
    if (url && url.startsWith('http')) return url;
  } catch (e) {}
  return import.meta.env.VITE_APPSCRIPT_DELIVERY_WEBHOOK || '';
};

export const setStoredAppScriptUrl = (url: string) => {
  try {
    localStorage.setItem(STORAGE_APPSCRIPT_KEY, url);
  } catch (e) {}
};

/**
 * Universal caller for Google Apps Script Web App
 * Uses text/plain POST or GET to bypass browser CORS preflight blocks.
 */
export const callAppScript = async <T = any>(
  action: string,
  payload: Record<string, any> = {}
): Promise<AppScriptResponse<T>> => {
  const appScriptUrl = getStoredAppScriptUrl();

  if (!appScriptUrl || !appScriptUrl.startsWith('http')) {
    return {
      status: 'error',
      message: 'Google Apps Script Web App URL is not configured. Please paste your deployed AppScript URL.'
    };
  }

  try {
    // Send as text/plain so browser does not trigger preflight CORS OPTIONS failure on Google servers
    const response = await fetch(appScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        action,
        timestamp: new Date().toISOString(),
        ...payload
      })
    });

    const data = await response.json();
    return data;
  } catch (err: any) {
    console.warn(`AppScript call for action '${action}' encountered response parser note:`, err);
    // In case AppScript returns 302 or text response
    return {
      status: 'error',
      message: err.message || 'Unable to connect to Google Apps Script. Check deployment access.'
    };
  }
};

/**
 * Email-Only Login or Auto-Register via Google Apps Script Web App
 */
export const loginWithAppScriptEmail = async (
  email: string,
  name?: string
): Promise<{ success: boolean; user?: User; message: string }> => {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, message: 'Please enter a valid email address.' };
  }

  const appScriptUrl = getStoredAppScriptUrl();
  const isVerifiedFounder = FOUNDER_ADMIN_EMAILS.includes(cleanEmail);

  // If AppScript is configured, call the live Sheets backend
  if (appScriptUrl && appScriptUrl.startsWith('http')) {
    const result = await callAppScript('email_login', {
      email: cleanEmail,
      name: name || cleanEmail.split('@')[0]
    });

    if (result.status === 'success' && result.user) {
      const u = result.user;
      const appUser: User = {
        uid: u.uid || `nb_sheet_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
        email: cleanEmail,
        displayName: u.name || name || cleanEmail.split('@')[0],
        role: isVerifiedFounder || u.role === 'admin' ? 'admin' : 'user',
        purchasedNotes: Array.isArray(u.purchasedNotes) ? u.purchasedNotes : [],
        membershipType: u.membershipType || 'none',
        referralCode: u.referralCode || `NB-${cleanEmail.substring(0, 4).toUpperCase()}`
      };
      saveSessionUser(appUser);
      return { success: true, user: appUser, message: result.message || 'Login successful via Google Sheets!' };
    }
  }

  // Graceful instantaneous local session fallback with auto-generated student profile
  const fallbackUser: User = {
    uid: `nb_usr_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
    email: cleanEmail,
    displayName: name || cleanEmail.split('@')[0].replace('.', ' '),
    role: isVerifiedFounder ? 'admin' : 'user',
    purchasedNotes: [],
    membershipType: 'none',
    referralCode: `NB-${cleanEmail.substring(0, 4).toUpperCase()}`
  };
  saveSessionUser(fallbackUser);

  return {
    success: true,
    user: fallbackUser,
    message: appScriptUrl 
      ? 'Logged in with student email.' 
      : 'Logged in! (Tip: Link your AppScript URL in Admin for live Google Sheets sync).'
  };
};

/**
 * Trigger Auto-Creation of complete Google Sheets sample database
 */
export const triggerAutoCreateSheets = async (): Promise<AppScriptResponse> => {
  return await callAppScript('auto_create_sheets_sample', {});
};

/**
 * Fetch products directly from Google Sheets
 */
export const fetchNotesFromGoogleSheets = async (): Promise<Note[] | null> => {
  const appScriptUrl = getStoredAppScriptUrl();
  if (!appScriptUrl) return null;

  try {
    const res = await callAppScript('get_products');
    if (res.status === 'success' && Array.isArray(res.notes)) {
      return res.notes.map((item: any) => ({
        id: String(item.id || item.product_id),
        title: item.title,
        category: item.category || 'General',
        examType: (item.exam_type || item.examType || ExamType.ALL) as ExamType,
        description: item.description || '',
        price: Number(item.price) || 299,
        originalPrice: Number(item.original_price || item.originalPrice) || 999,
        previewImages: Array.isArray(item.preview_images) && !String(item.preview_images[0] || '').includes('picsum.photos')
          ? item.preview_images 
          : typeof item.preview_images === 'string' && item.preview_images.startsWith('http') && !item.preview_images.includes('picsum.photos')
            ? [item.preview_images]
            : [],
        fileUrl: item.file_url || item.fileUrl || '#',
        rating: Number(item.rating) || 4.9,
        reviewsCount: Number(item.reviews_count || item.reviewsCount) || 120,
        isBestseller: Boolean(item.is_bestseller || item.isBestseller),
        studentsBought: String(item.students_bought || item.studentsBought || '850')
      }));
    }
  } catch (e) {
    console.warn('Failed to fetch from sheets:', e);
  }
  return null;
};

// Curated Offline / Sample Catalog Fallback (guaranteed accessible by ID across Shop, ProductDetail & Dashboard)
export const BUILTIN_CATALOG_NOTES: Note[] = [
  {
    id: 'prod_ssc_math_01',
    title: 'Complete SSC Mathematics Topper Notes',
    category: 'Quantitative Aptitude',
    examType: ExamType.SSC,
    description: 'Comprehensive handwritten topper notes covering Arithmetic and Advance Maths with proven shortcut methods, geometry diagrams, and formulas.',
    price: 299,
    originalPrice: 999,
    previewImages: [],
    fileUrl: '#',
    rating: 4.9,
    reviewsCount: 180,
    isBestseller: true,
    studentsBought: '1420'
  },
  {
    id: 'prod_upsc_hist_02',
    title: 'UPSC GS Paper 1: Modern Indian History (1757-1947)',
    category: 'History',
    examType: ExamType.UPSC,
    description: 'Topper verified timeline charts, Governor-Generals, freedom struggle chronology, and high-probability mains question answers.',
    price: 499,
    originalPrice: 1499,
    previewImages: [],
    fileUrl: '#',
    rating: 4.95,
    reviewsCount: 240,
    isBestseller: true,
    studentsBought: '2150'
  },
  {
    id: 'prod_bank_reason_03',
    title: 'Banking & Insurance Reasoning & Puzzles Mastery',
    category: 'Reasoning & Economy',
    examType: ExamType.BANKING,
    description: 'High-level seating arrangements, circular puzzles, syllogism rules, RBI monetary policy notes, and blood relations shortcuts.',
    price: 349,
    originalPrice: 899,
    previewImages: [],
    fileUrl: '#',
    rating: 4.85,
    reviewsCount: 160,
    isBestseller: false,
    studentsBought: '890'
  },
  {
    id: 'prod_railway_gs_04',
    title: 'Railways RRB NTPC General Science & Tech Capsule',
    category: 'General Science',
    examType: ExamType.RAILWAYS,
    description: 'Physics, Chemistry, and Biology handwritten summary with 1,500+ repeat questions from previous 10 years RRB papers.',
    price: 199,
    originalPrice: 599,
    previewImages: [],
    fileUrl: '#',
    rating: 4.8,
    reviewsCount: 95,
    isBestseller: false,
    studentsBought: '620'
  }
];

export const getBuiltinNoteById = (id?: string): Note | undefined => {
  if (!id) return undefined;
  return BUILTIN_CATALOG_NOTES.find(n => n.id === id) ||
    (id === 'mock-1' ? BUILTIN_CATALOG_NOTES[0] :
     id === 'mock-2' ? BUILTIN_CATALOG_NOTES[1] :
     id === 'mock-3' ? BUILTIN_CATALOG_NOTES[2] : undefined);
};

// Client Session & Local Orders Storage Helpers
const SESSION_USER_KEY = 'notesbazaar_active_user';
const LOCAL_ORDERS_KEY = 'notesbazaar_local_orders';

export interface LocalOrderRecord {
  id: string;
  user_email: string;
  product_id: string;
  product_title: string;
  amount: number;
  status: 'paid';
  payment_id: string;
  provider: string;
  payment_method?: string;
  created_at: string;
}

export const recordLocalOrder = (order: LocalOrderRecord) => {
  try {
    const raw = localStorage.getItem(LOCAL_ORDERS_KEY);
    const existing: LocalOrderRecord[] = raw ? JSON.parse(raw) : [];
    const updated = [order, ...existing.filter(o => o.payment_id !== order.payment_id)];
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(updated.slice(0, 50)));
  } catch (e) {}
};

export const getLocalOrders = (userEmail?: string): LocalOrderRecord[] => {
  try {
    const raw = localStorage.getItem(LOCAL_ORDERS_KEY);
    const all: LocalOrderRecord[] = raw ? JSON.parse(raw) : [];
    if (!userEmail) return all;
    return all.filter(o => o.user_email?.toLowerCase() === userEmail.toLowerCase());
  } catch (e) {
    return [];
  }
};

export const getSessionUser = (): User | null => {
  try {
    const data = localStorage.getItem(SESSION_USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
};

export const saveSessionUser = (user: User | null) => {
  try {
    if (user) {
      localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_USER_KEY);
    }
  } catch (e) {}
};

export const appendPurchasedNoteToSession = (productId: string) => {
  try {
    const current = getSessionUser();
    if (current) {
      const existing = Array.isArray(current.purchasedNotes) ? current.purchasedNotes : [];
      if (!existing.includes(productId)) {
        current.purchasedNotes = [...existing, productId];
        saveSessionUser(current);
      }
    }
  } catch (e) {}
};

export const updateSessionMembership = (planId: 'basic' | 'pro' | 'elite') => {
  try {
    const current = getSessionUser();
    if (current) {
      current.membershipType = planId;
      current.membershipExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
      saveSessionUser(current);
    }
  } catch (e) {}
};

/**
 * Ready-to-deploy Comprehensive Google Apps Script Web App Template
 * Handles:
 * 1. setup_complete_sheets: Automatically creates the Google Spreadsheet with Products, Users, Orders & Reviews tabs
 * 2. email_login: Authenticates student via email, stores user row in 'Users' sheet
 * 3. get_products: Returns active notes catalog
 * 4. record_order: Stores payment and dispatches download access email with GmailApp
 */
export const COMPLETE_GOOGLE_APPS_SCRIPT_SOURCE = `/**
 * =========================================================================
 * NotesBazaar - Complete Google Apps Script & Google Sheets Backend System
 * =========================================================================
 * 
 * INSTRUCTIONS TO DEPLOY:
 * 1. Go to https://script.google.com and click "New project".
 * 2. Paste this entire code into Code.gs (replacing whatever is inside).
 * 3. Click "Deploy" > "New deployment".
 * 4. Select type: "Web app".
 * 5. Description: "NotesBazaar Production Sheets Backend".
 * 6. Execute as: "Me" (your Google account).
 * 7. Who has access: "Anyone" (crucial for frictionless student login & webhooks).
 * 8. Click "Deploy", approve permissions, copy the Web App URL (ends in /exec).
 * 9. Paste this URL in NotesBazaar Admin or Login screen!
 */

// Helper to get or create the central Spreadsheet
function getOrCreateSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty("NOTESBAZAAR_SHEET_ID");
  var ss;
  
  if (sheetId) {
    try {
      ss = SpreadsheetApp.openById(sheetId);
      if (ss) return ss;
    } catch(e) {}
  }
  
  // Create brand new Google Sheet
  ss = SpreadsheetApp.create("NotesBazaar_Database_Ledger");
  props.setProperty("NOTESBAZAAR_SHEET_ID", ss.getId());
  setupSampleDatabase(ss);
  return ss;
}

// Automatically creates tabs and pre-populates sample data
function setupSampleDatabase(ss) {
  // 1. PRODUCTS TAB
  var prodSheet = ss.getSheetByName("Products") || ss.insertSheet("Products");
  if (prodSheet.getLastRow() === 0) {
    prodSheet.appendRow([
      "id", "title", "category", "exam_type", "price", "original_price", 
      "file_url", "preview_images", "description", "rating", "reviews_count", 
      "is_bestseller", "students_bought"
    ]);
    // Sample Study Material Notes
    prodSheet.appendRow([
      "prod_ssc_math_01",
      "Complete SSC Mathematics Topper Notes",
      "Quantitative Aptitude",
      "SSC",
      299,
      999,
      "https://drive.google.com/file/d/sample-ssc-math/view",
      "",
      "Comprehensive handwritten topper notes covering Arithmetic and Advance Maths with proven shortcut methods and formulas.",
      4.9,
      180,
      true,
      "1420"
    ]);
    prodSheet.appendRow([
      "prod_upsc_hist_02",
      "UPSC GS Paper 1: Modern Indian History (1757-1947)",
      "History",
      "UPSC",
      499,
      1499,
      "https://drive.google.com/file/d/sample-upsc-history/view",
      "",
      "Topper verified timeline charts, Governor-Generals, freedom struggle chronology, and high-probability mains question answers.",
      4.95,
      240,
      true,
      "2150"
    ]);
    prodSheet.appendRow([
      "prod_bank_reason_03",
      "Banking & Insurance Reasoning & Puzzles Mastery",
      "Reasoning",
      "Banking",
      349,
      899,
      "https://drive.google.com/file/d/sample-banking/view",
      "",
      "High level seating arrangements, circular puzzles, syllogism rules, and blood relations with step-by-step decoding shortcuts.",
      4.85,
      160,
      false,
      "890"
    ]);
    prodSheet.appendRow([
      "prod_railway_gs_04",
      "Railways RRB NTPC General Science & Tech Capsule",
      "General Science",
      "Railways",
      199,
      599,
      "https://drive.google.com/file/d/sample-railway/view",
      "",
      "Physics, Chemistry, and Biology handwritten summary with 1,500+ repeat questions from previous 10 years papers.",
      4.8,
      95,
      false,
      "620"
    ]);
  }

  // 2. USERS TAB
  var userSheet = ss.getSheetByName("Users") || ss.insertSheet("Users");
  if (userSheet.getLastRow() === 0) {
    userSheet.appendRow(["uid", "email", "name", "role", "purchasedNotes", "registered_at"]);
    userSheet.appendRow([
      "admin_01",
      "yugalofficial63@gmail.com",
      "Admin Founder",
      "admin",
      "prod_ssc_math_01,prod_upsc_hist_02",
      new Date().toISOString()
    ]);
  }

  // 3. ORDERS TAB
  var orderSheet = ss.getSheetByName("Orders") || ss.insertSheet("Orders");
  if (orderSheet.getLastRow() === 0) {
    orderSheet.appendRow(["order_id", "email", "product_id", "product_title", "amount", "provider", "download_link", "created_at"]);
  }

  // Remove default "Sheet1" if redundant
  var def = ss.getSheetByName("Sheet1");
  if (def && ss.getSheets().length > 1) {
    try { ss.deleteSheet(def); } catch(e) {}
  }
}

// POST Webhook router
function doPost(e) {
  try {
    var raw = e.postData ? e.postData.contents : "{}";
    var payload = JSON.parse(raw);
    var action = payload.action || "";
    var ss = getOrCreateSpreadsheet();

    // ACTION: Setup or Reset Complete Sheets Sample Data
    if (action === "auto_create_sheets_sample" || action === "setup_sheets") {
      setupSampleDatabase(ss);
      return jsonResponse({
        status: "success",
        message: "Google Spreadsheet created & configured with sample products, users, and orders ledger!",
        spreadsheetUrl: ss.getUrl(),
        sheetsCreated: ["Products", "Users", "Orders"]
      });
    }

    // ACTION: Email Login / Register
    if (action === "email_login") {
      var email = (payload.email || "").trim().toLowerCase();
      var name = payload.name || email.split("@")[0];
      if (!email) return jsonResponse({ status: "error", message: "Email is required" });

      var uSheet = ss.getSheetByName("Users") || ss.insertSheet("Users");
      var data = uSheet.getDataRange().getValues();
      var foundUser = null;

      for (var i = 1; i < data.length; i++) {
        if (String(data[i][1]).toLowerCase() === email) {
          foundUser = {
            uid: data[i][0],
            email: data[i][1],
            name: data[i][2],
            role: data[i][3],
            purchasedNotes: String(data[i][4] || "").split(",").filter(Boolean)
          };
          break;
        }
      }

      if (!foundUser) {
        var newUid = "nb_" + Utilities.getUuid().substring(0, 8);
        var role = (email === "yugalofficial63@gmail.com" || email === "yugalna28@gmail.com") ? "admin" : "user";
        uSheet.appendRow([newUid, email, name, role, "", new Date().toISOString()]);
        foundUser = {
          uid: newUid,
          email: email,
          name: name,
          role: role,
          purchasedNotes: []
        };
      }

      return jsonResponse({
        status: "success",
        message: "Student verified successfully via Google Sheets!",
        user: foundUser
      });
    }

    // ACTION: Get Products list from Google Sheet
    if (action === "get_products") {
      var pSheet = ss.getSheetByName("Products");
      if (!pSheet) {
        setupSampleDatabase(ss);
        pSheet = ss.getSheetByName("Products");
      }
      var rows = pSheet.getDataRange().getValues();
      var headers = rows[0];
      var products = [];

      for (var r = 1; r < rows.length; r++) {
        var obj = {};
        for (var c = 0; c < headers.length; c++) {
          obj[headers[c]] = rows[r][c];
        }
        products.push(obj);
      }

      return jsonResponse({
        status: "success",
        notes: products
      });
    }

    // ACTION: Send Notes Delivery Email + Record Order in Sheet
    if (action === "send_notes_delivery_email") {
      var toEmail = payload.toEmail;
      var toName = payload.toName || "Aspirant";
      var productTitle = payload.productTitle || "Notes Study Material";
      var downloadUrl = payload.downloadUrl || ss.getUrl();
      var amount = payload.amount || "0";
      var paymentId = payload.paymentId || ("NB-" + new Date().getTime());

      // 1. Record into Orders sheet
      var oSheet = ss.getSheetByName("Orders") || ss.insertSheet("Orders");
      oSheet.appendRow([
        paymentId,
        toEmail,
        payload.productId || "",
        productTitle,
        amount,
        payload.provider || "razorpay",
        downloadUrl,
        new Date().toISOString()
      ]);

      // 2. Update user purchased notes in Users sheet
      var uSheet2 = ss.getSheetByName("Users");
      if (uSheet2) {
        var uData = uSheet2.getDataRange().getValues();
        for (var k = 1; k < uData.length; k++) {
          if (String(uData[k][1]).toLowerCase() === String(toEmail).toLowerCase()) {
            var currentNotes = String(uData[k][4] || "");
            var arr = currentNotes ? currentNotes.split(",") : [];
            if (arr.indexOf(payload.productId) === -1 && payload.productId) {
              arr.push(payload.productId);
              uSheet2.getRange(k + 1, 5).setValue(arr.join(","));
            }
            break;
          }
        }
      }

      // 3. Dispatch Email with GmailApp
      var subject = "🎉 Your Notes are Ready: " + productTitle + " [Access Link Inside]";
      var html = '<div style="font-family:sans-serif;max-width:600px;margin:auto;background:#fff;padding:30px;border-radius:20px;border:1px solid #e2e8f0;">' +
        '<h1 style="color:#0f766e;margin-top:0;">NotesBazaar Delivery</h1>' +
        '<p>Hello <strong>' + toName + '</strong>,</p>' +
        '<p>Your order <strong>' + paymentId + '</strong> (₹' + amount + ') has been verified!</p>' +
        '<p>Access your notes directly through this high-speed link:</p>' +
        '<p style="margin:25px 0;"><a href="' + downloadUrl + '" style="background:#0d9488;color:#fff;padding:14px 24px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;">📥 Access Notes File</a></p>' +
        '<p style="color:#64748b;font-size:12px;">© NotesBazaar. Powered by Serverless Google Sheets.</p>' +
        '</div>';

      GmailApp.sendEmail(toEmail, subject, "Access your notes: " + downloadUrl, {
        htmlBody: html,
        name: "NotesBazaar Study Material"
      });

      return jsonResponse({
        status: "success",
        message: "Order recorded in Google Sheets and email sent to " + toEmail
      });
    }

    return jsonResponse({ status: "error", message: "Unknown action: " + action });
  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

function doGet(e) {
  var action = (e.parameter && e.parameter.action) || "status";
  var ss = getOrCreateSpreadsheet();

  if (action === "get_products") {
    var pSheet = ss.getSheetByName("Products");
    if (!pSheet) setupSampleDatabase(ss);
    pSheet = ss.getSheetByName("Products");
    var rows = pSheet.getDataRange().getValues();
    var headers = rows[0];
    var products = [];
    for (var r = 1; r < rows.length; r++) {
      var obj = {};
      for (var c = 0; c < headers.length; c++) obj[headers[c]] = rows[r][c];
      products.push(obj);
    }
    return jsonResponse({ status: "success", notes: products });
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    message: "NotesBazaar Google Sheets Backend is active.",
    spreadsheetUrl: ss.getUrl()
  })).setMimeType(ContentService.MimeType.JSON);
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
