import React, { useState, useEffect, useRef } from 'react';
import { auth, db, storage } from '../firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  deleteDoc,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { SiteSettings, ExamType, User } from '../types';
import {
  Plus,
  Trash2,
  Edit3,
  Image as ImageIcon,
  Save,
  X,
  FileSpreadsheet,
  ShieldAlert,
  Terminal,
  Search,
  Check,
  Star,
  Settings,
  Database,
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  UploadCloud,
  FileText,
  FolderOpen,
  Users,
  MessageSquare,
  ShoppingBag,
  Copy,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  LogIn
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getSafePreviewImages } from '../utils/sampleNotesPages';
import { NotesBazaarLogo } from '../components/NotesBazaarLogo';
import {
  BUILTIN_CATALOG_NOTES,
  COMPLETE_GOOGLE_APPS_SCRIPT_SOURCE,
  getLocalOrders,
  getStoredAppScriptUrl,
  setStoredAppScriptUrl,
  triggerAutoCreateSheets
} from '../utils/appScriptService';
import {
  StoredVaultCredential,
  checkAdminLockout,
  compressImageFileToDataUrl,
  formatBytes,
  generateSaltHex,
  getLocalVaultCredential,
  hashVaultPasscode,
  isAdminVaultSessionActive,
  isFounderEmail,
  isSafeAssetUrl,
  lockAdminVaultSession,
  recordFailedAdminAttempt,
  resetAdminLockout,
  sanitizePlainText,
  saveLocalVaultCredential,
  unlockAdminVaultSession,
  verifyVaultPasscode
} from '../utils/security';

interface AdminDashboardProps {
  user?: User | null;
}

type AdminTab =
  | 'stats'
  | 'products'
  | 'files'
  | 'orders'
  | 'inquiries'
  | 'reviews'
  | 'logs'
  | 'settings';

interface ManagedFileRecord {
  id: string;
  name: string;
  kind: 'pdf' | 'preview_image';
  url: string;
  mimeType?: string;
  sizeBytes?: number;
  linkedProductId?: string;
  uploadedBy?: string;
  createdAt: string;
}

interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user }) => {
  // Vault Security Gate State
  const [vaultChecking, setVaultChecking] = useState(true);
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [vaultCredential, setVaultCredential] = useState<StoredVaultCredential | null>(null);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [confirmPasscodeInput, setConfirmPasscodeInput] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [vaultBusy, setVaultBusy] = useState(false);
  const [lockoutState, setLockoutState] = useState(() => checkAdminLockout());

  // Navigation & Feedback Banner
  const [activeTab, setActiveTab] = useState<AdminTab>('stats');
  const [banner, setBanner] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  // Core Data States
  const [stats, setStats] = useState({ revenue: 0, orders: 0, products: 0, students: 0 });
  const [salesData, setSalesData] = useState<{ name: string; revenue: number; count: number }[]>([]);
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [managedFiles, setManagedFiles] = useState<ManagedFileRecord[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [allReviews, setAllReviews] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search / Loading Filters
  const [reviewSearchQuery, setReviewSearchQuery] = useState('');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingInquiries, setLoadingInquiries] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Settings & Security Rotation
  const [settings, setSettings] = useState<SiteSettings>({
    razorpay_key: 'rzp_test_demo_sample_key',
    razorpay_mode: 'demo',
    paypal_client_id: '',
    enable_razorpay: true,
    enable_paypal: false,
    appscript_webhook_url: getStoredAppScriptUrl(),
    hero_title: 'Topper Handwritten Notes for Govt Exams',
    hero_subtitle: 'SSC, Banking, UPSC & Railways PDF notes with instant delivery.',
    brand_tagline: 'Your one-stop destination for concise, exam-oriented handwritten notes for SSC, Banking, UPSC, and Government Exams.',
    announcement_enabled: false,
    announcement_text: 'Use code TOPPER10 at checkout for 10% instant savings on all handwritten notes!',
    promo_code: 'TOPPER10',
    promo_discount_percent: 10,
    contact_email: 'support@notesbazaar.co',
    contact_phone: '+91 98765 43210',
    office_address: 'Boring Road, Patna, Bihar 800001'
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingUpSheets, setSettingUpSheets] = useState(false);

  // Vault Passcode Rotation
  const [newVaultPasscode, setNewVaultPasscode] = useState('');
  const [confirmNewVaultPasscode, setConfirmNewVaultPasscode] = useState('');
  const [rotatingPasscode, setRotatingPasscode] = useState(false);

  // Product Modal & File Upload States
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [pdfUploadProgress, setPdfUploadProgress] = useState<number | null>(null);
  const [previewUploadBusy, setPreviewUploadBusy] = useState(false);
  const [vaultUploadProgress, setVaultUploadProgress] = useState<number | null>(null);
  const [newPreviewUrlInput, setNewPreviewUrlInput] = useState('');
  const pdfFileInputRef = useRef<HTMLInputElement>(null);
  const previewFileInputRef = useRef<HTMLInputElement>(null);
  const vaultFileInputRef = useRef<HTMLInputElement>(null);

  const [newProduct, setNewProduct] = useState({
    title: '',
    description: '',
    price: 299,
    original_price: 999,
    category: 'General Studies',
    exam_type: ExamType.SSC,
    preview_images: [] as string[],
    file_url: '',
    file_name: '',
    file_size_label: '',
    is_bestseller: false,
    students_bought: '0'
  });

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setBanner({ type, text });
    setTimeout(() => {
      setBanner((prev) => (prev?.text === text ? null : prev));
    }, 5000);
  };

  const logAdminAction = async (action: string, details: string) => {
    if (!auth.currentUser) return;
    try {
      await addDoc(collection(db, 'activity_logs'), {
        uid: auth.currentUser.uid,
        userEmail: auth.currentUser.email || user?.email || 'admin@notesbazaar.co',
        action: sanitizePlainText(action, 80),
        details: sanitizePlainText(details, 500),
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      // Non-blocking audit trail write
    }
  };

  // 1. Check Vault Lockout countdown timer
  useEffect(() => {
    if (!lockoutState.locked) return;
    const interval = setInterval(() => {
      const next = checkAdminLockout();
      setLockoutState(next);
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutState.locked]);

  // 2. Load Vault Security Credential & Check Active Session
  useEffect(() => {
    const initVault = async () => {
      setVaultChecking(true);
      let cred: StoredVaultCredential | null = getLocalVaultCredential();

      if (auth.currentUser) {
        try {
          const secSnap = await getDoc(doc(db, 'settings', 'admin_security'));
          if (secSnap.exists()) {
            const data = secSnap.data() as StoredVaultCredential;
            if (data?.salt && data?.hash) {
              cred = data;
              saveLocalVaultCredential(data);
            }
          }
        } catch (e) {
          // Local credential fallback
        }
      }

      setVaultCredential(cred);
      if (cred && isAdminVaultSessionActive(user?.email)) {
        setVaultUnlocked(true);
      } else {
        setVaultUnlocked(false);
      }
      setVaultChecking(false);
    };

    initVault();
  }, [user?.email]);

  // 3. Build 7-Day Real Revenue Chart from live Orders
  const recomputeAnalyticsFromOrders = (orders: any[], productCount?: number, studentCount?: number) => {
    const paidOrders = orders.filter((o) => o.status !== 'failed');
    const totalRevenue = paidOrders.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    const days: { key: string; name: string; revenue: number; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const name = d.toLocaleDateString('en-IN', { weekday: 'short' });
      days.push({ key, name, revenue: 0, count: 0 });
    }

    paidOrders.forEach((o) => {
      const iso = typeof o.created_at === 'string' ? o.created_at.slice(0, 10) : '';
      const bucket = days.find((d) => d.key === iso);
      if (bucket) {
        bucket.revenue += Number(o.amount) || 0;
        bucket.count += 1;
      }
    });

    setSalesData(days.map(({ name, revenue, count }) => ({ name, revenue, count })));
    setStats((prev) => ({
      revenue: totalRevenue,
      orders: paidOrders.length,
      products: productCount ?? prev.products,
      students: studentCount ?? prev.students
    }));
  };

  // 4. Live Firestore Subscriptions when Vault is Unlocked
  useEffect(() => {
    if (!vaultUnlocked) return;

    fetchDashboardData();

    let unsubscribeOrders = () => {};
    if (auth.currentUser) {
      try {
        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, orderBy('created_at', 'desc'), limit(100));
        unsubscribeOrders = onSnapshot(
          q,
          (snapshot) => {
            const fsOrders = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            const localOrders = getLocalOrders();
            const mergedMap = new Map<string, any>();
            [...fsOrders, ...localOrders].forEach((o: any) => {
              const key = o.payment_id || o.id;
              if (!mergedMap.has(key)) mergedMap.set(key, o);
            });
            const merged = Array.from(mergedMap.values()).sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            setOrdersList(merged);
            recomputeAnalyticsFromOrders(merged);
          },
          () => {
            const local = getLocalOrders();
            setOrdersList(local);
            recomputeAnalyticsFromOrders(local);
          }
        );
      } catch (e) {
        const local = getLocalOrders();
        setOrdersList(local);
        recomputeAnalyticsFromOrders(local);
      }
    } else {
      const local = getLocalOrders();
      setOrdersList(local);
      recomputeAnalyticsFromOrders(local);
    }

    return () => unsubscribeOrders();
  }, [vaultUnlocked]);

  useEffect(() => {
    if (!vaultUnlocked) return;
    if (activeTab === 'reviews') fetchAllReviews();
    else if (activeTab === 'logs') fetchLogs();
    else if (activeTab === 'files') fetchManagedFiles();
    else if (activeTab === 'inquiries') fetchInquiries();
    else if (activeTab === 'orders') fetchStudents();
  }, [activeTab, vaultUnlocked]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const productSnap = await getDocs(collection(db, 'products'));
      const fetchedProducts = productSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setProducts(fetchedProducts);

      const settingsSnap = await getDoc(doc(db, 'settings', 'main'));
      if (settingsSnap.exists()) {
        const sData = settingsSnap.data() as SiteSettings;
        setSettings((prev) => ({
          ...prev,
          ...sData,
          appscript_webhook_url: sData.appscript_webhook_url || getStoredAppScriptUrl()
        }));
      }

      if (auth.currentUser) {
        try {
          const userSnap = await getDocs(collection(db, 'users'));
          setStats((prev) => ({
            ...prev,
            products: fetchedProducts.length,
            students: userSnap.size
          }));
        } catch (e) {
          setStats((prev) => ({ ...prev, products: fetchedProducts.length }));
        }
      } else {
        setStats((prev) => ({ ...prev, products: fetchedProducts.length }));
      }
    } catch (err) {
      console.warn('Firestore admin fetch warning:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchManagedFiles = async () => {
    setLoadingFiles(true);
    try {
      const snap = await getDocs(collection(db, 'managed_files'));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ManagedFileRecord[];
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setManagedFiles(list);
    } catch (e) {
      setManagedFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      setStudentsList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      setStudentsList([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  const fetchInquiries = async () => {
    setLoadingInquiries(true);
    try {
      const snap = await getDocs(collection(db, 'contacts'));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setInquiries(list);
    } catch (e) {
      setInquiries([]);
    } finally {
      setLoadingInquiries(false);
    }
  };

  const fetchAllReviews = async () => {
    setLoadingReviews(true);
    try {
      const snap = await getDocs(collection(db, 'reviews'));
      setAllReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      setAllReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const snap = await getDocs(collection(db, 'activity_logs'));
      const fetchedLogs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      fetchedLogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setLogs(fetchedLogs);
    } catch (e) {
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Vault Security Handlers
  const handleCreateVaultPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setVaultError(null);

    if (passcodeInput.length < 8) {
      setVaultError('Admin Vault password must be at least 8 characters long.');
      return;
    }
    if (passcodeInput !== confirmPasscodeInput) {
      setVaultError('Passwords do not match. Please re-enter.');
      return;
    }

    setVaultBusy(true);
    try {
      const salt = generateSaltHex(16);
      const hash = await hashVaultPasscode(passcodeInput, salt);
      const cred: StoredVaultCredential = {
        salt,
        hash,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email || auth.currentUser?.email || 'founder'
      };

      saveLocalVaultCredential(cred);
      if (auth.currentUser) {
        try {
          await setDoc(doc(db, 'settings', 'admin_security'), cred);
          await logAdminAction('VAULT_INITIALIZED', 'Founder Security Vault password initialized with salted SHA-256.');
        } catch (fsErr) {
          console.warn('Firestore vault save skipped:', fsErr);
        }
      }

      setVaultCredential(cred);
      resetAdminLockout();
      unlockAdminVaultSession(user?.email);
      setVaultUnlocked(true);
      setPasscodeInput('');
      setConfirmPasscodeInput('');
    } catch (err: any) {
      setVaultError(err?.message || 'Unable to initialize Security Vault.');
    } finally {
      setVaultBusy(false);
    }
  };

  const handleUnlockVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setVaultError(null);

    const lock = checkAdminLockout();
    setLockoutState(lock);
    if (lock.locked) {
      setVaultError(`Too many failed attempts. Vault locked for ${lock.remainingSeconds}s.`);
      return;
    }
    if (!vaultCredential) return;

    setVaultBusy(true);
    try {
      const valid = await verifyVaultPasscode(passcodeInput, vaultCredential);
      if (!valid) {
        const nextLock = recordFailedAdminAttempt();
        setLockoutState(nextLock);
        if (nextLock.locked) {
          setVaultError(`Maximum attempts exceeded. Vault locked for ${nextLock.remainingSeconds}s.`);
        } else {
          setVaultError(`Incorrect Admin Vault password (${nextLock.attempts}/5 failed attempts).`);
        }
        return;
      }

      resetAdminLockout();
      unlockAdminVaultSession(user?.email);
      setVaultUnlocked(true);
      setPasscodeInput('');
      await logAdminAction('VAULT_UNLOCKED', 'Founder unlocked Admin Security Vault.');
    } finally {
      setVaultBusy(false);
    }
  };

  const handleGoogleReauthRecovery = async () => {
    setVaultError(null);
    setVaultBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const res = await signInWithPopup(auth, provider);
      const email = res.user.email;
      if (!isFounderEmail(email)) {
        setVaultError(`Account ${email || 'unknown'} is not an authorized NotesBazaar founder.`);
        return;
      }
      resetAdminLockout();
      unlockAdminVaultSession(email);
      setVaultUnlocked(true);
      await logAdminAction('VAULT_RECOVERED', `Founder ${email} verified via Google OAuth 2FA.`);
    } catch (err: any) {
      setVaultError(err?.message || 'Google re-authentication cancelled or blocked.');
    } finally {
      setVaultBusy(false);
    }
  };

  const handleRotateVaultPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newVaultPasscode.length < 8) {
      showToast('error', 'New Vault passcode must be at least 8 characters.');
      return;
    }
    if (newVaultPasscode !== confirmNewVaultPasscode) {
      showToast('error', 'New passcodes do not match.');
      return;
    }

    setRotatingPasscode(true);
    try {
      const salt = generateSaltHex(16);
      const hash = await hashVaultPasscode(newVaultPasscode, salt);
      const cred: StoredVaultCredential = {
        salt,
        hash,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email || auth.currentUser?.email || 'founder'
      };
      saveLocalVaultCredential(cred);
      if (auth.currentUser) {
        await setDoc(doc(db, 'settings', 'admin_security'), cred);
        await logAdminAction('VAULT_PASSWORD_ROTATED', 'Admin Security Vault password rotated.');
      }
      setVaultCredential(cred);
      setNewVaultPasscode('');
      setConfirmNewVaultPasscode('');
      showToast('success', 'Admin Vault password updated & salted SHA-256 hash stored.');
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to rotate Admin Vault password.');
    } finally {
      setRotatingPasscode(false);
    }
  };

  // Connect live Google Admin Auth if founder used Email-Only fallback
  const handleConnectGoogleAdmin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const res = await signInWithPopup(auth, provider);
      if (!isFounderEmail(res.user.email)) {
        showToast('error', 'Signed-in Google account is not a registered founder email.');
        return;
      }
      await setDoc(
        doc(db, 'admins', res.user.uid),
        {
          uid: res.user.uid,
          email: res.user.email,
          grantedAt: new Date().toISOString()
        },
        { merge: true }
      );
      showToast('success', 'Live Firebase Admin Auth connected! Refreshing live database...');
      fetchDashboardData();
    } catch (e: any) {
      showToast('error', e?.message || 'Could not connect Google Admin Auth.');
    }
  };

  // Seed Builtin Catalog into Live Firestore
  const handleSyncCatalogToFirestore = async () => {
    if (!auth.currentUser) {
      showToast('error', 'Please connect Google Admin Auth (top bar) to write to Firestore.');
      return;
    }
    try {
      for (const item of BUILTIN_CATALOG_NOTES) {
        await setDoc(
          doc(db, 'products', item.id),
          {
            id: item.id,
            title: item.title,
            category: item.category,
            exam_type: item.examType,
            description: item.description,
            price: item.price,
            original_price: item.originalPrice || item.price * 2,
            preview_images: item.previewImages || [],
            file_url: item.fileUrl || '#',
            rating: item.rating || 4.9,
            reviews_count: item.reviewsCount || 120,
            is_bestseller: Boolean(item.isBestseller),
            students_bought: item.studentsBought || '500',
            created_at: new Date().toISOString()
          },
          { merge: true }
        );
      }
      await logAdminAction('CATALOG_SEEDED', `Synced ${BUILTIN_CATALOG_NOTES.length} curated study packs to Firestore.`);
      showToast('success', 'Curated study catalog synced to Live Firestore!');
      fetchDashboardData();
    } catch (e: any) {
      showToast('error', e?.message || 'Error syncing catalog to Firestore.');
    }
  };

  // File & Preview Uploaders
  const uploadPdfToFirebaseStorage = async (file: File, onDone: (url: string) => void) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      showToast('error', 'Only PDF files are accepted for study note delivery.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      showToast('error', 'PDF exceeds 25 MB upload cap. Host large bundles on Google Drive and paste the share link.');
      return;
    }
    if (!auth.currentUser) {
      showToast('error', 'Connect Google Admin Auth first, or paste a secure HTTPS / Google Drive PDF link.');
      return;
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const pathRef = storageRef(storage, `notes_pdfs/${Date.now()}_${safeName}`);
    const uploadTask = uploadBytesResumable(pathRef, file);

    uploadTask.on(
      'state_changed',
      (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        setPdfUploadProgress(pct);
      },
      (err) => {
        setPdfUploadProgress(null);
        showToast(
          'error',
          `Cloud Storage upload blocked (${err.code}). Enable Firebase Storage or paste a Google Drive link.`
        );
      },
      async () => {
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
        setPdfUploadProgress(null);
        try {
          await addDoc(collection(db, 'managed_files'), {
            name: sanitizePlainText(file.name, 200),
            kind: 'pdf',
            url: downloadUrl,
            mimeType: file.type || 'application/pdf',
            sizeBytes: file.size,
            linkedProductId: editingProductId || '',
            uploadedBy: auth.currentUser?.email || 'admin',
            createdAt: new Date().toISOString()
          });
        } catch (e) {}
        await logAdminAction('FILE_UPLOADED', `Uploaded PDF ${file.name} (${formatBytes(file.size)})`);
        onDone(downloadUrl);
        if (activeTab === 'files') fetchManagedFiles();
      }
    );
  };

  const handleProductPdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadPdfToFirebaseStorage(file, (url) => {
      setNewProduct((prev) => ({
        ...prev,
        file_url: url,
        file_name: file.name,
        file_size_label: formatBytes(file.size)
      }));
      showToast('success', `Uploaded ${file.name} (${formatBytes(file.size)})`);
    });
    e.target.value = '';
  };

  const handleProductPreviewUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setPreviewUploadBusy(true);
    try {
      const addedUrls: string[] = [];
      for (const file of files.slice(0, 6)) {
        if (!file.type.startsWith('image/')) continue;
        let finalUrl = '';

        // Try Firebase Storage first if authenticated
        if (auth.currentUser) {
          try {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const imgRef = storageRef(storage, `preview_pages/${Date.now()}_${safeName}`);
            const task = await uploadBytesResumable(imgRef, file);
            finalUrl = await getDownloadURL(task.ref);
          } catch (storageErr) {
            finalUrl = await compressImageFileToDataUrl(file, 1000, 0.78);
          }
        } else {
          finalUrl = await compressImageFileToDataUrl(file, 1000, 0.78);
        }

        if (finalUrl && finalUrl.length <= 440000) {
          addedUrls.push(finalUrl);
          if (auth.currentUser) {
            try {
              await addDoc(collection(db, 'managed_files'), {
                name: sanitizePlainText(file.name, 200),
                kind: 'preview_image',
                url: finalUrl,
                mimeType: file.type || 'image/jpeg',
                sizeBytes: file.size,
                linkedProductId: editingProductId || '',
                uploadedBy: auth.currentUser.email || 'admin',
                createdAt: new Date().toISOString()
              });
            } catch (e) {}
          }
        }
      }

      if (addedUrls.length > 0) {
        setNewProduct((prev) => ({
          ...prev,
          preview_images: [...prev.preview_images.filter(Boolean), ...addedUrls].slice(0, 12)
        }));
        showToast('success', `Added ${addedUrls.length} handwritten preview page(s).`);
      } else {
        showToast('error', 'Could not process selected image(s). Try smaller JPG/PNG files.');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Preview image upload error.');
    } finally {
      setPreviewUploadBusy(false);
      e.target.value = '';
    }
  };

  const handleVaultStandaloneUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!auth.currentUser) {
      showToast('error', 'Connect Google Admin Auth first to upload assets to File Vault.');
      return;
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/');
    if (!isPdf && !isImage) {
      showToast('error', 'Upload PDF documents or PNG/JPG/WebP preview pages only.');
      return;
    }

    if (isPdf) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const pathRef = storageRef(storage, `notes_pdfs/${Date.now()}_${safeName}`);
      const task = uploadBytesResumable(pathRef, file);
      task.on(
        'state_changed',
        (snap) => setVaultUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        (err) => {
          setVaultUploadProgress(null);
          showToast('error', `Storage upload failed (${err.code}). Paste external Drive PDF link instead.`);
        },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          await addDoc(collection(db, 'managed_files'), {
            name: sanitizePlainText(file.name, 200),
            kind: 'pdf',
            url,
            mimeType: 'application/pdf',
            sizeBytes: file.size,
            uploadedBy: auth.currentUser?.email || 'admin',
            createdAt: new Date().toISOString()
          });
          setVaultUploadProgress(null);
          await logAdminAction('VAULT_PDF_UPLOADED', `Added ${file.name} to File Vault`);
          showToast('success', `PDF "${file.name}" saved to File Vault.`);
          fetchManagedFiles();
        }
      );
    } else {
      setVaultUploadProgress(40);
      try {
        let finalUrl = '';
        try {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const imgRef = storageRef(storage, `preview_pages/${Date.now()}_${safeName}`);
          const snap = await uploadBytesResumable(imgRef, file);
          finalUrl = await getDownloadURL(snap.ref);
        } catch {
          finalUrl = await compressImageFileToDataUrl(file, 1000, 0.78);
        }
        await addDoc(collection(db, 'managed_files'), {
          name: sanitizePlainText(file.name, 200),
          kind: 'preview_image',
          url: finalUrl,
          mimeType: file.type || 'image/jpeg',
          sizeBytes: file.size,
          uploadedBy: auth.currentUser?.email || 'admin',
          createdAt: new Date().toISOString()
        });
        await logAdminAction('VAULT_PREVIEW_UPLOADED', `Added preview ${file.name} to File Vault`);
        showToast('success', `Preview image "${file.name}" added to File Vault.`);
        fetchManagedFiles();
      } catch (err: any) {
        showToast('error', err?.message || 'Image upload failed.');
      } finally {
        setVaultUploadProgress(null);
      }
    }
    e.target.value = '';
  };

  const handleDeleteManagedFile = (fileId: string, fileName: string) => {
    setConfirmDialog({
      title: 'Delete Asset from File Vault?',
      message: `Remove "${fileName}" from managed file records? Existing product links will remain unless changed.`,
      confirmLabel: 'Delete Asset',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'managed_files', fileId));
          await logAdminAction('FILE_DELETED', `Removed ${fileName} from File Vault`);
          showToast('success', 'Asset deleted from File Vault.');
          fetchManagedFiles();
        } catch (e: any) {
          showToast('error', e?.message || 'Permission error deleting file.');
        }
      }
    });
  };

  // Product CRUD Handlers
  const handleEditProductInit = (product: any) => {
    setEditingProductId(product.id);
    setNewProduct({
      title: product.title || '',
      description: product.description || '',
      price: Number(product.price) || 0,
      original_price: Number(product.original_price) || 0,
      category: product.category || '',
      exam_type: (product.exam_type || ExamType.SSC) as ExamType,
      preview_images: Array.isArray(product.preview_images) ? product.preview_images.filter(Boolean) : [],
      file_url: product.file_url || '',
      file_name: product.file_name || '',
      file_size_label: product.file_size_label || '',
      is_bestseller: Boolean(product.is_bestseller),
      students_bought: String(product.students_bought || '0')
    });
    setShowAddProduct(true);
  };

  const resetProductForm = () => {
    setEditingProductId(null);
    setNewPreviewUrlInput('');
    setNewProduct({
      title: '',
      description: '',
      price: 299,
      original_price: 999,
      category: 'General Studies',
      exam_type: ExamType.SSC,
      preview_images: [],
      file_url: '',
      file_name: '',
      file_size_label: '',
      is_bestseller: false,
      students_bought: '0'
    });
  };

  const handleAddOrEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      showToast('error', 'Please connect Google Admin Auth to publish products to Live Firestore.');
      return;
    }

    const cleanFileUrl = (newProduct.file_url || '#').trim();
    if (!isSafeAssetUrl(cleanFileUrl, true)) {
      showToast('error', 'Invalid PDF URL protocol. Use HTTPS, Google Drive link, or upload a PDF.');
      return;
    }

    const cleanPreviews = newProduct.preview_images
      .map((u) => u.trim())
      .filter((u) => isSafeAssetUrl(u, false))
      .slice(0, 12);

    const payload: Record<string, any> = {
      title: sanitizePlainText(newProduct.title, 200),
      description: sanitizePlainText(newProduct.description, 2500),
      price: Math.max(0, Number(newProduct.price) || 0),
      original_price: Math.max(0, Number(newProduct.original_price) || 0),
      category: sanitizePlainText(newProduct.category || 'General', 100),
      exam_type: newProduct.exam_type,
      preview_images: cleanPreviews,
      file_url: cleanFileUrl,
      is_bestseller: Boolean(newProduct.is_bestseller),
      students_bought: String(newProduct.students_bought || '0')
    };

    if (newProduct.file_name) payload.file_name = sanitizePlainText(newProduct.file_name, 200);
    if (newProduct.file_size_label) payload.file_size_label = sanitizePlainText(newProduct.file_size_label, 40);

    setSavingProduct(true);
    try {
      if (editingProductId) {
        await setDoc(
          doc(db, 'products', editingProductId),
          {
            id: editingProductId,
            ...payload,
            updated_at: new Date().toISOString()
          },
          { merge: true }
        );
        await logAdminAction('PRODUCT_UPDATED', `Updated "${payload.title}" (₹${payload.price})`);
        showToast('success', `Updated "${payload.title}" successfully.`);
      } else {
        const docRef = await addDoc(collection(db, 'products'), {
          ...payload,
          rating: 4.9,
          reviews_count: 0,
          created_at: new Date().toISOString()
        });
        await setDoc(docRef, { id: docRef.id }, { merge: true });
        await logAdminAction('PRODUCT_CREATED', `Published "${payload.title}" (₹${payload.price})`);
        showToast('success', `Published "${payload.title}" to live catalog!`);
      }
      setShowAddProduct(false);
      resetProductForm();
      fetchDashboardData();
    } catch (err: any) {
      showToast('error', err?.message || 'Error saving product in Firestore.');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = (id: string, title: string) => {
    setConfirmDialog({
      title: 'Delete Study Material?',
      message: `Permanently remove "${title}" from the live storefront inventory?`,
      confirmLabel: 'Delete Note',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'products', id));
          await logAdminAction('PRODUCT_DELETED', `Deleted study pack "${title}" (${id})`);
          showToast('success', `"${title}" deleted from live catalog.`);
          fetchDashboardData();
        } catch (e: any) {
          showToast('error', e?.message || 'Could not delete product due to permissions.');
        }
      }
    });
  };

  // Student Access Grant / Revoke
  const handleToggleStudentProductAccess = async (student: any, productId: string, currentlyHas: boolean) => {
    if (!auth.currentUser) {
      showToast('error', 'Connect Google Admin Auth to modify student note access.');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', student.id), {
        purchasedNotes: currentlyHas ? arrayRemove(productId) : arrayUnion(productId),
        updatedAt: new Date().toISOString()
      });
      await logAdminAction(
        currentlyHas ? 'ACCESS_REVOKED' : 'ACCESS_GRANTED',
        `${currentlyHas ? 'Revoked' : 'Granted'} ${productId} for ${student.email}`
      );
      showToast('success', `${currentlyHas ? 'Revoked' : 'Granted'} access for ${student.email}.`);
      fetchStudents();
    } catch (e: any) {
      showToast('error', e?.message || 'Failed to update student access.');
    }
  };

  // Inquiries Actions
  const handleResolveInquiry = async (inq: any) => {
    try {
      await setDoc(
        doc(db, 'contacts', inq.id),
        {
          name: inq.name,
          email: inq.email,
          subject: inq.subject,
          message: inq.message,
          created_at: inq.created_at,
          status: inq.status === 'resolved' ? 'new' : 'resolved'
        },
        { merge: true }
      );
      showToast('success', 'Inquiry status updated.');
      fetchInquiries();
    } catch (e: any) {
      showToast('error', e?.message || 'Could not update inquiry.');
    }
  };

  const handleDeleteInquiry = (id: string) => {
    setConfirmDialog({
      title: 'Delete Support Inquiry?',
      message: 'This inquiry message will be permanently deleted from Firestore.',
      confirmLabel: 'Delete Message',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'contacts', id));
          showToast('success', 'Inquiry deleted.');
          fetchInquiries();
        } catch (e: any) {
          showToast('error', e?.message || 'Failed to delete inquiry.');
        }
      }
    });
  };

  // Reviews Moderation
  const handleDeleteReviewAdmin = (id: string) => {
    setConfirmDialog({
      title: 'Prune Review?',
      message: 'Remove this review globally from the product rating feed?',
      confirmLabel: 'Prune Review',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'reviews', id));
          await logAdminAction('REVIEW_PRUNED', `Removed review ID ${id}`);
          showToast('success', 'Review successfully pruned.');
          fetchAllReviews();
        } catch (e: any) {
          showToast('error', e?.message || 'Error pruning review.');
        }
      }
    });
  };

  // Save System Settings & AppScript URL
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      if (settings.appscript_webhook_url) {
        setStoredAppScriptUrl(settings.appscript_webhook_url.trim());
      }
      if (auth.currentUser) {
        await setDoc(doc(db, 'settings', 'main'), settings, { merge: true });
        await logAdminAction('SETTINGS_UPDATED', 'Updated Razorpay/AppScript/CMS parameters.');
        showToast('success', 'All payment, delivery & CMS parameters saved to Live Firestore!');
      } else {
        showToast('info', 'Saved AppScript URL locally. Connect Google Admin Auth to sync globally.');
      }
    } catch (e: any) {
      showToast('error', e?.message || 'Error saving settings to Firestore.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSetupGoogleSheets = async () => {
    const cleanUrl = (settings.appscript_webhook_url || '').trim();
    if (!cleanUrl.startsWith('http')) {
      showToast('error', 'Paste your deployed Google Apps Script /exec URL first.');
      return;
    }
    setStoredAppScriptUrl(cleanUrl);
    setSettingUpSheets(true);
    try {
      const res = await triggerAutoCreateSheets();
      if (res.status === 'success') {
        showToast('success', res.message || 'Google Sheets tabs auto-created successfully!');
      } else {
        showToast('error', res.message || 'Could not contact Apps Script URL.');
      }
    } finally {
      setSettingUpSheets(false);
    }
  };

  const handleExportCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      showToast('info', 'Nothing to export yet.');
      return;
    }
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map((row) =>
      Object.values(row)
        .map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`)
        .join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `${filename}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = (text: string, label = 'Copied to clipboard!') => {
    navigator.clipboard.writeText(text);
    showToast('success', label);
  };

  // Filters
  const filteredReviews = allReviews.filter(
    (r) =>
      r.comment?.toLowerCase().includes(reviewSearchQuery.toLowerCase()) ||
      r.userName?.toLowerCase().includes(reviewSearchQuery.toLowerCase())
  );

  const filteredLogs = logs.filter(
    (l) =>
      l.userEmail?.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      l.action?.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      l.details?.toLowerCase().includes(logSearchQuery.toLowerCase())
  );

  const filteredOrders = ordersList.filter(
    (o) =>
      o.user_email?.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
      o.payment_id?.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
      o.product_title?.toLowerCase().includes(orderSearchQuery.toLowerCase())
  );

  const filteredStudents = studentsList.filter(
    (s) =>
      s.email?.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
      s.displayName?.toLowerCase().includes(studentSearchQuery.toLowerCase())
  );

  // =========================================================================
  // RENDER: ADMIN SECURITY VAULT GATE (PASSWORD PROTECTION)
  // =========================================================================
  if (vaultChecking) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-[#FAFBFD] dark:bg-slate-950 px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
            Verifying Founder Security Vault...
          </p>
        </div>
      </div>
    );
  }

  if (!vaultUnlocked) {
    const isFirstTimeSetup = !vaultCredential;
    return (
      <div className="min-h-[85vh] flex items-center justify-center bg-[#FAFBFD] dark:bg-slate-950 px-4 py-12 transition-colors">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[32px] p-8 md:p-10 shadow-2xl border border-slate-100 dark:border-slate-800 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-700 via-teal-600 to-emerald-600" />

          <div className="text-center mb-7">
            <div className="flex justify-center mb-4">
              <NotesBazaarLogo variant="seal" size={64} />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-widest mb-3">
              <Lock size={11} /> Zero-Trust Admin Vault
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-heading">
              {isFirstTimeSetup ? 'Initialize Security Vault' : 'Founder Security Vault'}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-2 leading-relaxed">
              {isFirstTimeSetup
                ? 'Set a master Admin Vault password (stored exclusively as a salted SHA-256 hash) to guard inventory, PDF files, and financial ledgers.'
                : `Enter your Admin Vault passphrase to unlock operational controls for ${user?.email || 'Founder'}.`}
            </p>
          </div>

          {vaultError && (
            <div className="mb-5 p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold flex items-start gap-2.5">
              <ShieldAlert size={16} className="shrink-0 mt-0.5" />
              <span>{vaultError}</span>
            </div>
          )}

          <form onSubmit={isFirstTimeSetup ? handleCreateVaultPasscode : handleUnlockVault} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isFirstTimeSetup ? 'Create Vault Passphrase (Min 8 chars)' : 'Admin Vault Passphrase'}
              </label>
              <div className="relative">
                <input
                  type={showPasscode ? 'text' : 'password'}
                  required
                  minLength={8}
                  disabled={lockoutState.locked}
                  value={passcodeInput}
                  onChange={(e) => setPasscodeInput(e.target.value)}
                  placeholder="••••••••••••"
                  className="premium-input pr-12 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode((s) => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  aria-label="Toggle passcode visibility"
                >
                  {showPasscode ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {isFirstTimeSetup && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Confirm Vault Passphrase
                </label>
                <input
                  type={showPasscode ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={confirmPasscodeInput}
                  onChange={(e) => setConfirmPasscodeInput(e.target.value)}
                  placeholder="••••••••••••"
                  className="premium-input font-mono text-sm"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={vaultBusy || lockoutState.locked}
              className="w-full premium-button-primary py-4 text-sm"
            >
              {vaultBusy ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : lockoutState.locked ? (
                `Vault Locked (${lockoutState.remainingSeconds}s)`
              ) : isFirstTimeSetup ? (
                <>
                  <ShieldCheck size={17} /> Set Vault Password &amp; Enter
                </>
              ) : (
                <>
                  <Unlock size={17} /> Unlock Admin Panel
                </>
              )}
            </button>
          </form>

          {!isFirstTimeSetup && (
            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 space-y-3 text-center">
              <p className="text-[11px] text-slate-400">
                Forgot passphrase? Verify ownership via Google OAuth:
              </p>
              <button
                type="button"
                onClick={handleGoogleReauthRecovery}
                disabled={vaultBusy}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 text-xs font-bold hover:border-primary/40 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <KeyRound size={14} className="text-primary" />
                Unlock via Founder Google Account
              </button>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  if (loading && products.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] bg-[#FAFBFD] dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
            Synchronizing Live Database &amp; File Vault...
          </p>
        </div>
      </div>
    );
  }

  const pendingInquiriesCount = inquiries.filter((i) => i.status !== 'resolved').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10 min-h-screen text-slate-800 dark:text-slate-100 transition-colors duration-300">
      {/* Inline Notification Banner */}
      <AnimatePresence>
        {banner && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className={`fixed top-20 right-4 sm:right-6 z-50 max-w-md px-5 py-3.5 rounded-2xl shadow-2xl border flex items-center gap-3 text-xs font-bold ${
              banner.type === 'success'
                ? 'bg-emerald-950 text-emerald-100 border-emerald-700'
                : banner.type === 'error'
                  ? 'bg-red-950 text-red-100 border-red-700'
                  : 'bg-slate-900 text-slate-100 border-slate-700'
            }`}
          >
            {banner.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle size={16} className="text-amber-400 shrink-0" />
            )}
            <span className="flex-1">{banner.text}</span>
            <button onClick={() => setBanner(null)} className="text-white/60 hover:text-white cursor-pointer">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upper Header */}
      <div className="flex flex-col gap-6 mb-8 pb-7 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full uppercase tracking-widest">
                RBAC Tier: Founder
              </span>
              {auth.currentUser ? (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1">
                  <ShieldCheck size={12} /> Live Firestore Connected
                </span>
              ) : (
                <button
                  onClick={handleConnectGoogleAdmin}
                  className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1 cursor-pointer"
                >
                  <LogIn size={12} /> Connect Google Auth for Live DB Writes
                </button>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mt-3 font-heading tracking-tight">
              Founder Command Center
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Manage study PDFs, preview images, live orders, student access, and security configuration.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            <button
              onClick={fetchDashboardData}
              className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-primary/40 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={14} /> Refresh DB
            </button>
            <button
              onClick={() => {
                lockAdminVaultSession();
                setVaultUnlocked(false);
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold hover:bg-red-600 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Lock size={14} /> Lock Vault
            </button>
          </div>
        </div>

        {/* Navigation Selector Tabs */}
        <div className="flex flex-wrap gap-1.5 bg-white dark:bg-slate-900 p-1.5 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800">
          {(
            [
              { id: 'stats', label: 'Analytics' },
              { id: 'products', label: `Inventory (${products.length})` },
              { id: 'files', label: 'File Vault' },
              { id: 'orders', label: `Orders & Students` },
              { id: 'inquiries', label: `Inquiries${pendingInquiriesCount > 0 ? ` (${pendingInquiriesCount})` : ''}` },
              { id: 'reviews', label: 'Moderation' },
              { id: 'logs', label: 'Compliance' },
              { id: 'settings', label: 'System & Security' }
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-slate-900 dark:bg-primary text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: ANALYTICS (COMPUTED FROM REAL DB ORDERS)                      */}
      {/* =================================================================== */}
      {activeTab === 'stats' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden">
              <span className="w-1.5 h-full bg-primary absolute left-0 top-0" />
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Verified Revenue</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">₹{stats.revenue.toLocaleString()}</p>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full mt-3 inline-block">
                Live Firestore + Local Ledger
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden">
              <span className="w-1.5 h-full bg-blue-600 absolute left-0 top-0" />
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Completed Orders</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.orders}</p>
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-0.5 rounded-full mt-3 inline-block">
                Avg Ticket: ₹{stats.orders > 0 ? Math.round(stats.revenue / stats.orders) : 0}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden">
              <span className="w-1.5 h-full bg-emerald-500 absolute left-0 top-0" />
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Live Study Packs</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{products.length}</p>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full mt-3 inline-block">
                Firestore Collection: products
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden">
              <span className="w-1.5 h-full bg-amber-500 absolute left-0 top-0" />
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Registered Aspirants</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.students}</p>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-full mt-3 inline-block">
                Verified Accounts
              </span>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm min-h-[380px]">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">7-Day Live Revenue Trend</h3>
                  <p className="text-xs text-slate-400">Computed directly from verified orders in database</p>
                </div>
                <button
                  onClick={() => handleExportCSV(salesData, 'sales_7day_live')}
                  className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet size={13} /> Export CSV
                </button>
              </div>
              <div className="h-[290px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0D9488" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#0D9488" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" strokeOpacity={0.18} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', background: '#0f172a', border: '1px solid #1e293b', color: '#fff' }}
                      labelStyle={{ fontWeight: 'bold', fontSize: '12px' }}
                      itemStyle={{ color: '#2dd4bf', fontWeight: 'bold', fontSize: '12px' }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#0D9488" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-900 text-white p-6 rounded-3xl overflow-hidden flex flex-col border border-slate-800">
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-bold text-sm tracking-wide">Live Orders Queue</h3>
                <button
                  onClick={() => handleExportCSV(ordersList, 'live_orders')}
                  className="text-[10px] font-bold text-slate-400 hover:text-white uppercase flex items-center gap-1 cursor-pointer"
                >
                  <FileSpreadsheet size={12} /> CSV
                </button>
              </div>
              <div className="space-y-3 overflow-y-auto flex-1 max-h-[300px] pr-1">
                {ordersList.length > 0 ? (
                  ordersList.slice(0, 15).map((order, i) => (
                    <div key={order.id || i} className="flex justify-between items-center border-b border-slate-800 pb-3 text-xs">
                      <div className="min-w-0 pr-2">
                        <p className="font-mono font-bold text-slate-200 truncate">
                          {order.payment_id?.substring(0, 14).toUpperCase()}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">{order.user_email}</p>
                      </div>
                      <span className="font-bold text-teal-400 shrink-0">+₹{order.amount}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    No completed transactions recorded yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: INVENTORY + PDF/PREVIEW UPLOADER                             */}
      {/* =================================================================== */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Study Catalog Inventory ({products.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Attach real downloadable PDFs and multi-page handwritten previews directly to Firestore products.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {products.length === 0 && (
                <button
                  onClick={handleSyncCatalogToFirestore}
                  className="px-4 py-2.5 bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-xl font-bold flex items-center gap-2 text-xs hover:bg-amber-500/25 transition-all cursor-pointer"
                >
                  <Sparkles size={14} /> Sync 4 Starter Notes to Live DB
                </button>
              )}
              <button
                onClick={() => handleExportCSV(products, 'product_inventory')}
                className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold flex items-center gap-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm cursor-pointer"
              >
                <FileSpreadsheet size={14} /> Export CSV
              </button>
              <button
                onClick={() => {
                  resetProductForm();
                  setShowAddProduct(true);
                }}
                className="premium-button-primary px-5 py-2.5 text-xs"
              >
                <Plus size={15} /> Add New Study Note
              </button>
            </div>
          </div>

          {products.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col h-full group"
                >
                  <div className="aspect-video bg-slate-50 dark:bg-slate-950 rounded-2xl mb-4 overflow-hidden relative border border-slate-100 dark:border-slate-800">
                    <img
                      src={getSafePreviewImages(product.exam_type, product.preview_images)[0]}
                      className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                      alt={product.title}
                    />
                    <div className="absolute top-2.5 left-2.5 flex gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold backdrop-blur-md ${
                          product.file_url && product.file_url !== '#'
                            ? 'bg-emerald-600/90 text-white'
                            : 'bg-slate-900/75 text-slate-200'
                        }`}
                      >
                        {product.file_url && product.file_url !== '#' ? 'PDF Attached ✓' : 'Capsule PDF'}
                      </span>
                    </div>
                    <div className="absolute top-2.5 right-2.5 flex gap-1.5">
                      <button
                        onClick={() => handleEditProductInit(product)}
                        className="p-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur rounded-lg text-slate-700 dark:text-slate-200 hover:text-primary transition-colors shadow-md cursor-pointer"
                        title="Edit Course Item"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        onClick={() => {
                          handleEditProductInit({ ...product, title: `${product.title} (Copy)` });
                          setEditingProductId(null);
                        }}
                        className="p-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur rounded-lg text-slate-700 dark:text-slate-200 hover:text-blue-600 transition-colors shadow-md cursor-pointer"
                        title="Duplicate Note as New Item"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id, product.title)}
                        className="p-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur rounded-lg text-slate-700 dark:text-slate-200 hover:text-red-500 transition-colors shadow-md cursor-pointer"
                        title="Delete Product"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1 leading-tight line-clamp-1">
                    {product.title}
                  </h4>
                  <p className="text-slate-500 dark:text-slate-400 text-xs line-clamp-2 leading-relaxed mb-4 flex-grow font-medium">
                    {product.description}
                  </p>
                  <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800 mt-auto">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full uppercase">
                        {product.exam_type}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        {(product.preview_images?.length || 0)} custom imgs
                      </span>
                    </div>
                    <span className="font-black text-primary text-base">₹{product.price}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
              <Database className="mx-auto text-slate-300 dark:text-slate-700 mb-3" size={38} />
              <h4 className="font-bold text-slate-900 dark:text-white text-base mb-1">
                No Products in Live Firestore Yet
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-5">
                Publish a new study note with your PDF &amp; previews, or sync the 4 starter notes directly into your live Firestore database.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={handleSyncCatalogToFirestore}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                >
                  Sync Starter Catalog
                </button>
                <button
                  onClick={() => {
                    resetProductForm();
                    setShowAddProduct(true);
                  }}
                  className="premium-button-primary px-5 py-2.5 text-xs"
                >
                  <Plus size={14} /> Create Note
                </button>
              </div>
            </div>
          )}

          {/* Add/Edit Product Modal with Real File Uploaders */}
          {showAddProduct && (
            <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-2xl rounded-3xl p-6 md:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 relative max-h-[90vh] overflow-y-auto"
              >
                <button
                  onClick={() => {
                    setShowAddProduct(false);
                    resetProductForm();
                  }}
                  className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
                <h3 className="text-xl font-bold mb-6 font-heading text-slate-900 dark:text-white">
                  {editingProductId ? 'Edit Study Material & Files' : 'Publish New Study Material'}
                </h3>

                <form onSubmit={handleAddOrEditProduct} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        Document Title *
                      </label>
                      <input
                        required
                        type="text"
                        className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/25 outline-none"
                        value={newProduct.title}
                        onChange={(e) => setNewProduct({ ...newProduct, title: e.target.value })}
                        placeholder="e.g. Complete SSC Maths Topper Notes"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        Selling Price (INR) *
                      </label>
                      <input
                        required
                        min={0}
                        type="number"
                        className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/25 outline-none font-mono"
                        value={newProduct.price}
                        onChange={(e) => setNewProduct({ ...newProduct, price: Number(e.target.value) })}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        Original MRP (INR)
                      </label>
                      <input
                        min={0}
                        type="number"
                        className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/25 outline-none font-mono"
                        value={newProduct.original_price}
                        onChange={(e) => setNewProduct({ ...newProduct, original_price: Number(e.target.value) })}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        Exam Target
                      </label>
                      <select
                        className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/25 outline-none"
                        value={newProduct.exam_type}
                        onChange={(e) => setNewProduct({ ...newProduct, exam_type: e.target.value as ExamType })}
                      >
                        {Object.values(ExamType).map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        Category
                      </label>
                      <input
                        required
                        type="text"
                        className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/25 outline-none"
                        value={newProduct.category}
                        onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                        placeholder="e.g. Quantitative Aptitude"
                      />
                    </div>

                    {/* PDF UPLOAD + LINK MANAGER */}
                    <div className="col-span-2 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <FileText size={13} className="text-primary" /> Deliverable Study PDF File
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            ref={pdfFileInputRef}
                            type="file"
                            accept="application/pdf,.pdf"
                            onChange={handleProductPdfFileChange}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => pdfFileInputRef.current?.click()}
                            className="px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-bold flex items-center gap-1.5 hover:bg-primary-dark cursor-pointer"
                          >
                            <UploadCloud size={13} /> Upload PDF File
                          </button>
                        </div>
                      </div>

                      {pdfUploadProgress !== null && (
                        <div className="space-y-1">
                          <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${pdfUploadProgress}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-primary font-bold">Uploading to Firebase Storage... {pdfUploadProgress}%</p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <input
                          required
                          type="text"
                          className="flex-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/25 outline-none font-mono"
                          value={newProduct.file_url}
                          onChange={(e) => setNewProduct({ ...newProduct, file_url: e.target.value })}
                          placeholder="Upload PDF above or paste HTTPS / Google Drive link (use # for built-in PDF)"
                        />
                        {newProduct.file_url && newProduct.file_url !== '#' && (
                          <a
                            href={newProduct.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-primary flex items-center gap-1"
                          >
                            <ExternalLink size={13} /> Test
                          </a>
                        )}
                      </div>
                      {newProduct.file_name && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          Attached: {newProduct.file_name} ({newProduct.file_size_label})
                        </p>
                      )}
                    </div>

                    {/* MULTI-PAGE PREVIEW IMAGES MANAGER */}
                    <div className="col-span-2 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <ImageIcon size={13} className="text-blue-600" /> Handwritten Preview Pages ({newProduct.preview_images.length}/12)
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            ref={previewFileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleProductPreviewUpload}
                            className="hidden"
                          />
                          <button
                            type="button"
                            disabled={previewUploadBusy}
                            onClick={() => previewFileInputRef.current?.click()}
                            className="px-3 py-1.5 rounded-lg bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1.5 hover:bg-blue-800 cursor-pointer"
                          >
                            <UploadCloud size={13} />
                            {previewUploadBusy ? 'Processing...' : 'Upload Preview Pages'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setNewProduct((prev) => ({
                                ...prev,
                                preview_images: getSafePreviewImages(prev.exam_type, [])
                              }))
                            }
                            className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold cursor-pointer"
                          >
                            Use Sample Pages
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newPreviewUrlInput}
                          onChange={(e) => setNewPreviewUrlInput(e.target.value)}
                          placeholder="Or paste an image URL and click Add..."
                          className="flex-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!isSafeAssetUrl(newPreviewUrlInput, false)) {
                              showToast('error', 'Enter a valid https:// or data:image/ URL.');
                              return;
                            }
                            setNewProduct((prev) => ({
                              ...prev,
                              preview_images: [...prev.preview_images, newPreviewUrlInput.trim()].slice(0, 12)
                            }));
                            setNewPreviewUrlInput('');
                          }}
                          className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                        >
                          Add URL
                        </button>
                      </div>

                      {newProduct.preview_images.length > 0 && (
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5 pt-1">
                          {newProduct.preview_images.map((imgUrl, idx) => (
                            <div
                              key={idx}
                              className="relative aspect-[3/4] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white group"
                            >
                              <img src={imgUrl} alt={`Page ${idx + 1}`} className="w-full h-full object-cover object-top" />
                              <button
                                type="button"
                                onClick={() =>
                                  setNewProduct((prev) => ({
                                    ...prev,
                                    preview_images: prev.preview_images.filter((_, i) => i !== idx)
                                  }))
                                }
                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] opacity-90 hover:opacity-100 cursor-pointer"
                              >
                                ✕
                              </button>
                              <span className="absolute bottom-0 inset-x-0 bg-slate-900/75 text-white text-[9px] text-center py-0.5 font-bold">
                                P.{idx + 1}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        Description *
                      </label>
                      <textarea
                        required
                        className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/25 outline-none min-h-[85px]"
                        value={newProduct.description}
                        onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                      />
                    </div>

                    <div className="col-span-2 flex items-center gap-3">
                      <input
                        id="bestsellerCheck"
                        type="checkbox"
                        checked={newProduct.is_bestseller}
                        onChange={(e) => setNewProduct({ ...newProduct, is_bestseller: e.target.checked })}
                        className="w-4 h-4 text-primary rounded cursor-pointer"
                      />
                      <label htmlFor="bestsellerCheck" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                        Mark as Topper Bestseller on Storefront
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddProduct(false);
                        resetProductForm();
                      }}
                      className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingProduct}
                      className="premium-button-primary px-6 py-2.5 text-xs"
                    >
                      <Save size={14} /> {savingProduct ? 'Saving...' : editingProductId ? 'Update Product' : 'Publish Product'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: FILE VAULT (UPLOAD & MANAGE ALL PDFs & PREVIEW IMAGES)       */}
      {/* =================================================================== */}
      {activeTab === 'files' && (
        <div className="space-y-6">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FolderOpen size={18} className="text-primary" /> Admin Secure File Vault
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload PDF study materials and handwritten preview images to cloud storage and copy links into products.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                ref={vaultFileInputRef}
                type="file"
                accept="application/pdf,.pdf,image/*"
                onChange={handleVaultStandaloneUpload}
                className="hidden"
              />
              <button
                onClick={() => vaultFileInputRef.current?.click()}
                className="premium-button-primary px-5 py-2.5 text-xs"
              >
                <UploadCloud size={15} /> Upload PDF or Preview Image
              </button>
            </div>
          </div>

          {vaultUploadProgress !== null && (
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex justify-between text-xs font-bold text-primary">
                <span>Uploading Asset to Firebase Cloud...</span>
                <span>{vaultUploadProgress}%</span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${vaultUploadProgress}%` }} />
              </div>
            </div>
          )}

          {loadingFiles ? (
            <div className="text-center py-12 text-slate-400 text-xs">Scanning File Vault records...</div>
          ) : managedFiles.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {managedFiles.map((file) => (
                <div
                  key={file.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          file.kind === 'pdf'
                            ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400'
                            : 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {file.kind === 'pdf' ? <FileText size={18} /> : <ImageIcon size={18} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{file.name}</p>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase">
                          {file.kind === 'pdf' ? 'PDF Document' : 'Preview Image'} · {formatBytes(file.sizeBytes || 0)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteManagedFile(file.id, file.name)}
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg cursor-pointer"
                      title="Delete Asset"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {file.kind === 'preview_image' && (
                    <div className="aspect-video rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                      <img src={file.url} alt={file.name} className="w-full h-full object-cover object-top" />
                    </div>
                  )}

                  <div className="mt-auto pt-2 flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(file.url, 'Asset URL copied to clipboard!')}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:border-primary/40 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Copy size={12} /> Copy URL
                    </button>
                    {!file.url.startsWith('data:') && (
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="py-2 px-3 rounded-xl bg-primary/10 text-primary text-[11px] font-bold flex items-center gap-1"
                      >
                        <ExternalLink size={12} /> Open
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
              <UploadCloud className="mx-auto text-slate-300 dark:text-slate-700 mb-3" size={38} />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">File Vault is Ready</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Upload study PDFs or handwritten preview sheets here to host and reuse across your notes catalog.
              </p>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: LIVE ORDERS & STUDENT ACCESS MANAGEMENT                      */}
      {/* =================================================================== */}
      {activeTab === 'orders' && (
        <div className="space-y-8">
          {/* Orders Ledger */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShoppingBag size={18} className="text-primary" /> Live Orders Ledger ({filteredOrders.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Real-time Razorpay &amp; PayPal payment transactions
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search email or payment ID..."
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <Search size={14} className="text-slate-400 absolute left-3 top-2.5" />
                </div>
                <button
                  onClick={() => handleExportCSV(filteredOrders, 'orders_ledger')}
                  className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet size={13} /> CSV
                </button>
              </div>
            </div>

            {filteredOrders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase text-slate-500">
                      <th className="py-3 px-4">Payment ID</th>
                      <th className="py-3 px-4">Student Email</th>
                      <th className="py-3 px-4">Product</th>
                      <th className="py-3 px-4">Method</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredOrders.map((o, idx) => (
                      <tr key={o.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-950/50">
                        <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                          {o.payment_id}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{o.user_email}</td>
                        <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-semibold max-w-[200px] truncate">
                          {o.product_title || o.product_id}
                        </td>
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{o.payment_method || o.provider}</td>
                        <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">₹{o.amount}</td>
                        <td className="py-3 px-4 text-slate-400">
                          {o.created_at ? new Date(o.created_at).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-8 text-xs text-slate-400">No matching orders found.</p>
            )}
          </div>

          {/* Registered Students & Access Control */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users size={18} className="text-blue-600" /> Students Directory &amp; Manual Access ({filteredStudents.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Grant or revoke direct PDF study access for registered students
                </p>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search students..."
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20"
                />
                <Search size={14} className="text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            {loadingStudents ? (
              <p className="text-center py-8 text-xs text-slate-400">Loading student directory...</p>
            ) : filteredStudents.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredStudents.map((st) => {
                  const unlockedIds: string[] = Array.isArray(st.purchasedNotes) ? st.purchasedNotes : [];
                  return (
                    <div key={st.id} className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">{st.displayName}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase">
                            {st.role}
                          </span>
                          {st.membershipType && st.membershipType !== 'none' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 uppercase">
                              {st.membershipType}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{st.email}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {(products.length > 0 ? products : BUILTIN_CATALOG_NOTES).slice(0, 4).map((p) => {
                          const has = unlockedIds.includes(p.id);
                          return (
                            <button
                              key={p.id}
                              onClick={() => handleToggleStudentProductAccess(st, p.id, has)}
                              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                                has
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-primary/40'
                              }`}
                              title={has ? 'Click to revoke access' : 'Click to grant access'}
                            >
                              {has ? '✓ ' : '+ '}
                              {String(p.title).slice(0, 20)}...
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center py-8 text-xs text-slate-400">
                {auth.currentUser
                  ? 'No students matched your search.'
                  : 'Connect Google Admin Auth to inspect the live student directory.'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 5: SUPPORT INQUIRIES INBOX (LIVE `contacts` COLLECTION)         */}
      {/* =================================================================== */}
      {activeTab === 'inquiries' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MessageSquare size={18} className="text-primary" /> Student Support Inquiries ({inquiries.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Messages submitted via the Contact Us page stored in Firestore
              </p>
            </div>
            <button
              onClick={() => handleExportCSV(inquiries, 'support_inquiries')}
              className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet size={13} /> Export CSV
            </button>
          </div>

          {loadingInquiries ? (
            <div className="text-center py-12 text-slate-400 text-xs">Loading support inbox...</div>
          ) : inquiries.length > 0 ? (
            <div className="grid gap-4">
              {inquiries.map((inq) => (
                <div
                  key={inq.id}
                  className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">{inq.subject}</span>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                          inq.status === 'resolved'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {inq.status === 'resolved' ? 'Resolved' : 'New Inquiry'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{inq.message}</p>
                    <p className="text-[11px] text-slate-400">
                      From <strong className="text-slate-600 dark:text-slate-300">{inq.name}</strong> ({inq.email}) ·{' '}
                      {inq.created_at ? new Date(inq.created_at).toLocaleString() : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleResolveInquiry(inq)}
                      className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-primary hover:text-white transition-colors cursor-pointer"
                    >
                      {inq.status === 'resolved' ? 'Reopen' : 'Mark Resolved'}
                    </button>
                    <button
                      onClick={() => handleDeleteInquiry(inq.id)}
                      className="p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                      title="Delete message"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-14 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
              <MessageSquare className="mx-auto text-slate-300 dark:text-slate-700 mb-3" size={34} />
              <p className="text-xs text-slate-500 dark:text-slate-400">No support inquiries received yet.</p>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 6: REVIEWS MODERATION                                           */}
      {/* =================================================================== */}
      {activeTab === 'reviews' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                User Reviews Moderation{' '}
                <span className="text-xs bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-bold">
                  {filteredReviews.length}
                </span>
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs">
                Verify study comments and prune illegitimate ratings.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:flex-none">
                <input
                  type="text"
                  placeholder="Filter reviews..."
                  value={reviewSearchQuery}
                  onChange={(e) => setReviewSearchQuery(e.target.value)}
                  className="w-full md:w-60 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>

              <button
                onClick={() => handleExportCSV(filteredReviews, 'reviews_moderation')}
                className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <FileSpreadsheet size={13} /> Export
              </button>
            </div>
          </div>

          {loadingReviews ? (
            <div className="text-center py-10 text-slate-400 text-xs">Loading feedback feed...</div>
          ) : filteredReviews.length > 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredReviews.map((review) => (
                  <div
                    key={review.id}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-950/30"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{review.userName}</span>
                        <span className="text-[10px] text-slate-400">{review.userEmail}</span>
                        <div className="flex text-amber-400">
                          {Array.from({ length: review.rating || 5 }).map((_, i) => (
                            <Star key={i} size={11} fill="currentColor" className="text-amber-400" />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-semibold italic">
                        "{review.comment}"
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Product UID: {review.productId}</p>
                    </div>

                    <button
                      onClick={() => handleDeleteReviewAdmin(review.id)}
                      className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 self-start md:self-center transition-colors border border-red-100 dark:border-red-900/40 cursor-pointer"
                    >
                      <Trash2 size={13} /> Prune Review
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
              <ShieldAlert className="text-slate-300 dark:text-slate-700 mx-auto mb-3" size={32} />
              <p className="text-slate-500 text-xs">No active reviews match filter conditions.</p>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 7: COMPLIANCE AUDIT LOGS                                        */}
      {/* =================================================================== */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Compliance Activity Logs{' '}
                <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-white px-2.5 py-0.5 rounded-full font-bold">
                  {filteredLogs.length}
                </span>
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs">
                Immutable audit trail (update &amp; delete locked in Firestore security rules).
              </p>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:flex-none">
                <input
                  type="text"
                  placeholder="Filter audit stream..."
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  className="w-full md:w-60 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <Terminal className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>

              <button
                onClick={() => handleExportCSV(filteredLogs, 'operational_audit_logs')}
                className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <FileSpreadsheet size={13} /> Export Logs
              </button>
            </div>
          </div>

          {loadingLogs ? (
            <div className="text-center py-10 text-slate-400 text-xs">Interrogating audit trail...</div>
          ) : filteredLogs.length > 0 ? (
            <div className="bg-slate-950 text-slate-300 rounded-2xl border border-slate-800 p-4 font-mono text-[11px] leading-relaxed max-h-[500px] overflow-y-auto space-y-2 shadow-inner">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 bg-slate-900/60 rounded-lg hover:bg-slate-900 border-l-2 border-primary border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-2"
                >
                  <div className="flex-1">
                    <span className="text-teal-400 font-bold">[{log.action}]</span>{' '}
                    <span className="text-slate-400">{log.userEmail || 'system@notesbazaar.co'}</span>{' '}
                    <span>— {log.details}</span>
                  </div>
                  <span className="text-slate-500 text-[10px] whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl font-mono text-xs bg-white dark:bg-slate-900">
              <Database className="text-slate-400 dark:text-slate-700 mx-auto mb-3" size={32} />
              <p className="text-slate-500">System audit buffer is clean. No log entries recorded yet.</p>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 8: SYSTEM, RAZORPAY, APPSCRIPT & ADMIN VAULT SECURITY           */}
      {/* =================================================================== */}
      {activeTab === 'settings' && (
        <div className="space-y-8">
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Razorpay & Payment Gateways */}
            <div className="bg-white dark:bg-slate-900 p-7 md:p-8 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Settings size={18} className="text-primary" /> Razorpay &amp; Gateways
                </h3>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 uppercase tracking-widest">
                  Live &amp; Demo Ready
                </span>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/70 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Active Payment Mode:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSettings({ ...settings, razorpay_key: 'rzp_test_demo_sample_key', razorpay_mode: 'demo' })
                      }
                      className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                        settings.razorpay_key.includes('demo') || !settings.razorpay_key.startsWith('rzp_')
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Demo Mode
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, razorpay_mode: 'live' })}
                      className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                        settings.razorpay_key.startsWith('rzp_live_') ||
                        (settings.razorpay_key.startsWith('rzp_test_') && !settings.razorpay_key.includes('demo'))
                          ? 'bg-teal-600 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Production Live
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Demo mode accepts test UPI, Card, Netbanking &amp; Wallet payments. Switch to Live by entering your real Razorpay Key ID below.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label
                  className={`border-2 rounded-2xl p-4 cursor-pointer transition-all ${
                    settings.enable_razorpay
                      ? 'border-primary bg-teal-50/50 dark:bg-teal-950/20'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-1.5">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-primary rounded cursor-pointer"
                      checked={settings.enable_razorpay}
                      onChange={(e) => setSettings({ ...settings, enable_razorpay: e.target.checked })}
                    />
                    <span className="font-bold text-slate-900 dark:text-white text-xs">Razorpay (India)</span>
                  </div>
                  <p className="text-[10px] text-slate-500 ml-7">UPI, Cards, Netbanking, QR</p>
                </label>

                <label
                  className={`border-2 rounded-2xl p-4 cursor-pointer transition-all ${
                    settings.enable_paypal
                      ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-1.5">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-indigo-500 rounded cursor-pointer"
                      checked={settings.enable_paypal}
                      onChange={(e) => setSettings({ ...settings, enable_paypal: e.target.checked })}
                    />
                    <span className="font-bold text-slate-900 dark:text-white text-xs">PayPal Global</span>
                  </div>
                  <p className="text-[10px] text-slate-500 ml-7">International checkout</p>
                </label>
              </div>

              <div className={!settings.enable_razorpay ? 'opacity-40 pointer-events-none' : ''}>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Razorpay Key ID
                  </label>
                  <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold">
                    {settings.razorpay_key.startsWith('rzp_live') ? '● LIVE ACTIVE' : '○ TEST / DEMO MODE'}
                  </span>
                </div>
                <input
                  type="text"
                  className="premium-input font-mono text-xs"
                  value={settings.razorpay_key}
                  onChange={(e) => setSettings({ ...settings, razorpay_key: e.target.value })}
                  placeholder="rzp_live_... or rzp_test_..."
                />
              </div>

              <div className={!settings.enable_paypal ? 'opacity-40 pointer-events-none' : ''}>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  PayPal Client ID
                </label>
                <input
                  type="text"
                  className="premium-input font-mono text-xs"
                  value={settings.paypal_client_id}
                  onChange={(e) => setSettings({ ...settings, paypal_client_id: e.target.value })}
                  placeholder="AeDX..."
                />
              </div>
            </div>

            {/* Google Apps Script Email Delivery & Sheets Sync */}
            <div className="bg-white dark:bg-slate-900 p-7 md:p-8 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Check size={18} className="text-teal-600" /> AppScript &amp; Sheets Delivery
                </h3>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 uppercase tracking-widest">
                  Email + Sheets
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Deployed Apps Script Web App URL (/exec)
                </label>
                <input
                  type="url"
                  className="premium-input font-mono text-xs"
                  value={settings.appscript_webhook_url || ''}
                  onChange={(e) => setSettings({ ...settings, appscript_webhook_url: e.target.value })}
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSetupGoogleSheets}
                  disabled={settingUpSheets}
                  className="flex-1 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet size={14} />
                  {settingUpSheets ? 'Creating Sheets...' : 'Auto-Setup Complete Sheets'}
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(COMPLETE_GOOGLE_APPS_SCRIPT_SOURCE, 'AppScript Code.gs copied!')}
                  className="py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy size={14} /> Copy Script Code
                </button>
              </div>

              <details className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                <summary className="font-bold text-primary hover:underline cursor-pointer">
                  View Complete Apps Script Code Template
                </summary>
                <pre className="mt-3 p-4 bg-slate-950 text-slate-200 rounded-2xl font-mono text-[10px] overflow-x-auto max-h-44">
                  {COMPLETE_GOOGLE_APPS_SCRIPT_SOURCE.slice(0, 1800)}
                </pre>
              </details>
            </div>

            {/* Admin Vault Passphrase Rotation */}
            <div className="bg-white dark:bg-slate-900 p-7 md:p-8 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <KeyRound size={18} className="text-amber-500" /> Admin Vault Security
                </h3>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                  Salted SHA-256
                </span>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Rotate your Admin Vault passphrase anytime. Only a salted cryptographic hash is stored in Firestore{' '}
                <code className="font-mono text-primary">settings/admin_security</code>.
              </p>

              <form onSubmit={handleRotateVaultPasscode} className="space-y-3">
                <input
                  type="password"
                  minLength={8}
                  required
                  value={newVaultPasscode}
                  onChange={(e) => setNewVaultPasscode(e.target.value)}
                  placeholder="New Vault Passphrase (min 8 chars)"
                  className="premium-input text-xs font-mono"
                />
                <input
                  type="password"
                  minLength={8}
                  required
                  value={confirmNewVaultPasscode}
                  onChange={(e) => setConfirmNewVaultPasscode(e.target.value)}
                  placeholder="Confirm New Passphrase"
                  className="premium-input text-xs font-mono"
                />
                <button
                  type="submit"
                  disabled={rotatingPasscode}
                  className="w-full py-3 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-primary text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  {rotatingPasscode ? 'Rotating Hash...' : 'Update Admin Vault Password'}
                </button>
              </form>
            </div>

            {/* Storefront CMS */}
            <div className="bg-white dark:bg-slate-900 p-7 md:p-8 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Storefront Content &amp; Promotions</h3>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(settings.announcement_enabled)}
                    onChange={(e) => setSettings({ ...settings, announcement_enabled: e.target.checked })}
                    className="w-4 h-4 text-primary rounded cursor-pointer"
                  />
                  Top Promo Bar
                </label>
              </div>
              <div className="grid gap-3.5">
                {settings.announcement_enabled && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Top Announcement Banner Text
                    </label>
                    <input
                      type="text"
                      value={settings.announcement_text || ''}
                      onChange={(e) => setSettings({ ...settings, announcement_text: e.target.value })}
                      placeholder="Limited offer banner text..."
                      className="premium-input text-xs py-3"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Hero Headline
                  </label>
                  <input
                    type="text"
                    value={settings.hero_title || ''}
                    onChange={(e) => setSettings({ ...settings, hero_title: e.target.value })}
                    className="premium-input text-xs py-3"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Hero Subtitle
                  </label>
                  <input
                    type="text"
                    value={settings.hero_subtitle || ''}
                    onChange={(e) => setSettings({ ...settings, hero_subtitle: e.target.value })}
                    className="premium-input text-xs py-3"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Footer Brand Tagline
                  </label>
                  <input
                    type="text"
                    value={settings.brand_tagline || ''}
                    onChange={(e) => setSettings({ ...settings, brand_tagline: e.target.value })}
                    className="premium-input text-xs py-3"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Promo Coupon Code
                    </label>
                    <input
                      type="text"
                      value={settings.promo_code || ''}
                      onChange={(e) => setSettings({ ...settings, promo_code: e.target.value.toUpperCase() })}
                      placeholder="TOPPER10"
                      className="premium-input text-xs py-3 font-mono uppercase"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Discount (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={80}
                      value={settings.promo_discount_percent ?? 10}
                      onChange={(e) => setSettings({ ...settings, promo_discount_percent: Number(e.target.value) })}
                      className="premium-input text-xs py-3"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Support Email
                    </label>
                    <input
                      type="text"
                      value={settings.contact_email || ''}
                      onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
                      className="premium-input text-xs py-3"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Support Phone
                    </label>
                    <input
                      type="text"
                      value={settings.contact_phone || ''}
                      onChange={(e) => setSettings({ ...settings, contact_phone: e.target.value })}
                      className="premium-input text-xs py-3"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Office Address
                  </label>
                  <input
                    type="text"
                    value={settings.office_address || ''}
                    onChange={(e) => setSettings({ ...settings, office_address: e.target.value })}
                    className="premium-input text-xs py-3"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="w-full premium-button-primary py-4 text-xs"
          >
            <Save size={15} /> {savingSettings ? 'Saving Configuration...' : 'Save All Payment, Delivery & CMS Parameters'}
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* IN-APP CONFIRMATION DIALOG (REPLACES window.confirm)                */}
      {/* =================================================================== */}
      <AnimatePresence>
        {confirmDialog && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h4 className="font-bold text-lg text-slate-900 dark:text-white">{confirmDialog.title}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{confirmDialog.message}</p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const fn = confirmDialog.onConfirm;
                    setConfirmDialog(null);
                    await fn();
                  }}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
                >
                  {confirmDialog.confirmLabel}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminDashboard;
