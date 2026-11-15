import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ExamType, Note } from '../types';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import {
  Search,
  Filter,
  Star,
  ChevronRight,
  MessageCircle,
  BookOpen,
  TrendingUp,
  LayoutGrid,
  List,
  ZoomIn,
  Bookmark
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BUILTIN_CATALOG_NOTES, fetchNotesFromGoogleSheets } from '../utils/appScriptService';
import { getSafePreviewImages } from '../utils/sampleNotesPages';

const ProductCard: React.FC<{
  note: Note;
  viewMode: 'grid' | 'list';
  isSaved: boolean;
  onToggleSave: (id: string) => void;
}> = ({ note, viewMode, isSaved, onToggleSave }) => {
  const [isHovered, setIsHovered] = useState(false);
  const safeImages = getSafePreviewImages(note.examType, note.previewImages, `${note.title} ${note.id}`);
  const displayImage = isHovered && safeImages[1] ? safeImages[1] : safeImages[0];
  const discountPct =
    note.originalPrice && note.originalPrice > note.price
      ? Math.round(((note.originalPrice - note.price) / note.originalPrice) * 100)
      : 0;

  if (viewMode === 'list') {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="group bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-4 sm:p-5 hover:shadow-premium-hover transition-all duration-300 flex flex-col sm:flex-row gap-5 items-center"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Link
          to={`/product/${note.id}`}
          className="w-full sm:w-44 h-52 sm:h-48 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-950 shrink-0 relative border border-slate-100 dark:border-slate-800"
        >
          <img
            src={displayImage}
            loading="lazy"
            className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
            alt={note.title}
          />
          {note.isBestseller && (
            <span className="absolute top-2.5 left-2.5 bg-blue-700 text-white px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm">
              Bestseller
            </span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleSave(note.id);
            }}
            aria-label={isSaved ? 'Remove from saved notes' : 'Save note for later'}
            className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-lg flex items-center justify-center shadow-md transition-colors cursor-pointer ${
              isSaved ? 'bg-amber-500 text-white' : 'bg-white/90 dark:bg-slate-900/90 text-slate-600 dark:text-slate-300 hover:text-amber-500'
            }`}
          >
            <Bookmark size={14} fill={isSaved ? 'currentColor' : 'none'} />
          </button>
        </Link>

        <div className="flex-1 flex flex-col w-full">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-blue-700 dark:text-blue-400 font-bold uppercase tracking-wider">{note.examType}</span>
            <span>·</span>
            <span>{note.category}</span>
            {note.pagesCount && (
              <>
                <span>·</span>
                <span>{note.pagesCount}</span>
              </>
            )}
            {note.rating > 0 && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1 text-amber-500 font-bold">
                  <Star size={12} fill="currentColor" /> {note.rating}
                </span>
              </>
            )}
          </div>

          <Link to={`/product/${note.id}`}>
            <h3 className="font-bold text-slate-900 dark:text-white text-xl mb-2 group-hover:text-primary transition-colors">
              {note.title}
            </h3>
          </Link>

          <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">
            {note.description}
          </p>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-baseline gap-2 tabular-nums">
              <span className="text-2xl font-black text-slate-900 dark:text-white">₹{note.price}</span>
              {note.originalPrice && (
                <span className="text-xs text-slate-400 line-through font-semibold">₹{note.originalPrice}</span>
              )}
              {discountPct > 0 && (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                  {discountPct}% OFF
                </span>
              )}
            </div>

            <Link
              to={`/product/${note.id}`}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-700 to-emerald-600 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all"
            >
              <ZoomIn size={14} /> Preview &amp; Buy
            </Link>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94 }}
      className="group bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 overflow-hidden hover:shadow-premium-hover transition-all duration-300 flex flex-col h-full relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {discountPct > 0 ? (
        <div className="absolute top-4 left-4 z-20">
          <span className="bg-emerald-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-md">
            {discountPct}% OFF
          </span>
        </div>
      ) : note.isBestseller ? (
        <div className="absolute top-4 left-4 z-20">
          <span className="bg-blue-700 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-md">
            Bestseller
          </span>
        </div>
      ) : null}

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleSave(note.id);
        }}
        aria-label={isSaved ? 'Remove from saved notes' : 'Save note for later'}
        className={`absolute top-4 right-4 z-20 w-9 h-9 rounded-xl flex items-center justify-center shadow-md transition-all cursor-pointer ${
          isSaved ? 'bg-amber-500 text-white' : 'bg-white/95 dark:bg-slate-900/90 text-slate-600 dark:text-slate-300 hover:text-amber-500'
        }`}
      >
        <Bookmark size={15} fill={isSaved ? 'currentColor' : 'none'} />
      </button>

      {/* Image Container */}
      <Link
        to={`/product/${note.id}`}
        className="relative aspect-[4/5] overflow-hidden bg-slate-50 dark:bg-slate-950 m-2.5 rounded-[20px] border border-slate-100/80 dark:border-slate-800 block"
      >
        <img
          src={displayImage}
          loading="lazy"
          className={`w-full h-full object-cover object-top transition-transform duration-700 ${
            isHovered ? 'scale-105' : 'scale-100'
          }`}
          alt={note.title}
        />

        <div
          className={`absolute inset-0 bg-slate-950/35 backdrop-blur-[2px] flex items-center justify-center transition-opacity duration-300 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <span className="bg-white text-slate-900 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-xl flex items-center gap-2">
            <ZoomIn size={14} className="text-blue-700" />
            Zoom Sample Page
          </span>
        </div>
      </Link>

      {/* Content */}
      <div className="p-5 pt-2 flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
          <span className="truncate">
            <strong className="text-blue-700 dark:text-blue-400 uppercase">{note.examType}</strong> · {note.category}
          </span>
          {note.rating > 0 ? (
            <span className="inline-flex items-center gap-1 text-amber-500 font-bold shrink-0">
              <Star size={12} fill="currentColor" />
              {note.rating}
            </span>
          ) : (
            <span className="text-[10px] font-bold text-slate-400 shrink-0">{note.pagesCount || 'PDF'}</span>
          )}
        </div>

        <Link to={`/product/${note.id}`}>
          <h3 className="font-bold text-slate-900 dark:text-white mb-2 leading-snug group-hover:text-primary transition-colors line-clamp-2 text-lg">
            {note.title}
          </h3>
        </Link>

        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 line-clamp-2 leading-relaxed font-medium">
          {note.description}
        </p>

        <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex flex-col tabular-nums">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-slate-900 dark:text-white">₹{note.price}</span>
              {note.originalPrice && (
                <span className="text-[11px] text-slate-400 line-through font-semibold">₹{note.originalPrice}</span>
              )}
            </div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
              Instant PDF Unlock
            </span>
          </div>

          <Link
            to={`/product/${note.id}`}
            className="px-4 py-2.5 bg-gradient-to-r from-blue-700 to-emerald-600 text-white rounded-xl font-bold text-xs flex items-center gap-1 shadow-md hover:shadow-lg active:scale-95 transition-all"
          >
            <span>Buy Now</span>
            <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    </motion.div>
  );
};

const PAGE_SIZE = 9;

const Shop: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialExam = (searchParams.get('exam') as ExamType) || ExamType.ALL;

  const [activeExam, setActiveExam] = useState<ExamType>(initialExam);
  const [searchQuery, setSearchQuery] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'featured' | 'newest' | 'price_asc' | 'price_desc' | 'rating'>('featured');
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('notesbazaar_saved_ids');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const toggleSaveId = (noteId: string) => {
    setSavedIds((prev) => {
      const next = prev.includes(noteId) ? prev.filter((id) => id !== noteId) : [...prev, noteId];
      try {
        localStorage.setItem('notesbazaar_saved_ids', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  useEffect(() => {
    const exam = searchParams.get('exam') as ExamType;
    if (exam) setActiveExam(exam);
  }, [searchParams]);

  const fetchNotes = async () => {
    try {
      try {
        const sheetNotes = await fetchNotesFromGoogleSheets();
        if (sheetNotes && sheetNotes.length > 0) {
          setNotes(sheetNotes.filter((n) => n.isEnabled !== false && !n.isArchived));
          setLoading(false);
          return;
        }
      } catch {}

      const productsRef = collection(db, 'products');
      const snapshot = await getDocs(productsRef);

      if (!snapshot.empty) {
        const mappedNotes: Note[] = snapshot.docs.map((docSnap) => {
          const item = docSnap.data();
          return {
            id: docSnap.id,
            title: item.title,
            category: item.category || 'Study Material',
            examType: (item.exam_type || ExamType.SSC) as ExamType,
            description: item.description,
            price: Number(item.price || 0),
            originalPrice: item.original_price ? Number(item.original_price) : undefined,
            previewImages: item.preview_images || [],
            fileUrl: item.file_url || '',
            rating: Number(item.rating || 0),
            reviewsCount: Number(item.reviews_count || 0),
            isBestseller: Boolean(item.is_bestseller),
            studentsBought: item.students_bought,
            pagesCount: item.pages_count,
            updatedLabel: item.updated_label,
            examSuitability: item.exam_suitability,
            keyTopics: item.key_topics,
            isEnabled: item.is_enabled !== false,
            isArchived: Boolean(item.is_archived),
            createdAt: item.created_at,
          };
        });
        setNotes(mappedNotes.filter((n) => n.isEnabled !== false && !n.isArchived));
      } else {
        setNotes(BUILTIN_CATALOG_NOTES);
      }
    } catch (err) {
      console.warn('Catalog fetch fallback to curated builtin catalog:', err);
      setNotes(BUILTIN_CATALOG_NOTES);
    } finally {
      setLoading(false);
    }
  };

  const handleExamChange = (exam: ExamType) => {
    setActiveExam(exam);
    setVisibleLimit(PAGE_SIZE);
    if (exam === ExamType.ALL) {
      searchParams.delete('exam');
    } else {
      searchParams.set('exam', exam);
    }
    setSearchParams(searchParams);
  };

  const filteredNotes = notes
    .filter((n) => {
      const matchesSaved = !showSavedOnly || savedIds.includes(n.id);
      const suitMatch = (n.examSuitability || []).some((s) =>
        s.toLowerCase().includes(String(activeExam).toLowerCase())
      );
      const matchesExam =
        activeExam === ExamType.ALL ||
        String(n.examType).toLowerCase() === String(activeExam).toLowerCase() ||
        suitMatch;
      const q = searchQuery.toLowerCase();
      const matchesQuery =
        n.title.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q) ||
        n.category.toLowerCase().includes(q) ||
        (n.keyTopics || []).some((t) => t.toLowerCase().includes(q));
      return matchesSaved && matchesExam && matchesQuery;
    })
    .sort((a, b) => {
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      if (sortBy === 'newest') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      return Number(b.isBestseller) - Number(a.isBestseller);
    });

  const pagedNotes = filteredNotes.slice(0, visibleLimit);

  return (
    <div className="min-h-screen">
      {/* Header Section */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 pt-10 pb-12 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs uppercase tracking-widest">
                <BookOpen size={15} strokeWidth={2} />
                Handwritten Study Library
              </div>
              <h1 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white font-heading tracking-tight">
                {activeExam === ExamType.ALL ? 'All Digital Study Notes' : `${activeExam} Study Material`}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-base max-w-xl font-medium leading-relaxed">
                Preview crisp sample pages with full-screen zoom before unlocking digital PDF access.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl flex">
                <button
                  onClick={() => setViewMode('grid')}
                  aria-label="Grid view"
                  className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-slate-900 shadow-sm text-primary'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                >
                  <LayoutGrid size={18} strokeWidth={1.8} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  aria-label="List view"
                  className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-slate-900 shadow-sm text-primary'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                >
                  <List size={18} strokeWidth={1.8} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Sidebar Filters */}
          <aside className="w-full lg:w-72 space-y-8 shrink-0">
            <div className="space-y-3">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Search Notes</h3>
              <div className="relative group">
                <input
                  type="text"
                  placeholder="Static GK, Maths, Polity..."
                  className="premium-input pl-12"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setVisibleLimit(PAGE_SIZE);
                  }}
                />
                <Search
                  className="w-5 h-5 text-slate-400 absolute left-4 top-4 group-focus-within:text-primary transition-colors"
                  strokeWidth={1.5}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Exam Category</h3>
                <Filter size={14} className="text-slate-400" strokeWidth={1.5} />
              </div>
              <div className="flex flex-wrap lg:flex-col gap-2.5">
                {[ExamType.ALL, ExamType.SSC, ExamType.BANKING, ExamType.RAILWAYS, ExamType.STATE_PSC, ExamType.UPSC].map((exam) => (
                  <button
                    key={exam}
                    onClick={() => handleExamChange(exam)}
                    className={`px-4 py-3 rounded-2xl transition-all flex justify-between items-center text-sm font-bold border cursor-pointer ${
                      activeExam === exam
                        ? 'bg-gradient-to-r from-blue-700 to-emerald-600 border-transparent text-white shadow-lg shadow-teal-600/20'
                        : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-primary/30'
                    }`}
                  >
                    <span>{exam === ExamType.ALL ? 'All Exams' : exam}</span>
                    {activeExam === exam && <ChevronRight size={16} strokeWidth={2.5} />}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowSavedOnly((s) => !s)}
                className={`w-full mt-2 px-4 py-3 rounded-2xl transition-all flex justify-between items-center text-sm font-bold border cursor-pointer ${
                  showSavedOnly
                    ? 'bg-amber-500 border-transparent text-white shadow-md'
                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-amber-500/40'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Bookmark size={15} fill={showSavedOnly ? 'currentColor' : 'none'} />
                  Saved Shortlist ({savedIds.length})
                </span>
              </button>
            </div>

            <div className="bg-slate-900 dark:bg-slate-900/95 border border-slate-800 p-7 rounded-3xl text-white shadow-xl relative overflow-hidden">
              <h4 className="font-bold text-base mb-2 flex items-center gap-2.5">
                <div className="w-8 h-8 bg-primary/20 text-teal-400 rounded-lg flex items-center justify-center">
                  <MessageCircle size={18} strokeWidth={1.5} />
                </div>
                Need Study Guidance?
              </h4>
              <p className="text-xs text-slate-400 mb-5 leading-relaxed font-medium">
                Unsure which study pack suits your exam target? Reach our customer support desk.
              </p>
              <Link
                to="/contact"
                className="block w-full bg-gradient-to-r from-blue-600 to-emerald-600 text-white py-3 rounded-xl text-center text-xs font-bold hover:opacity-95 transition-opacity"
              >
                Contact Support Team
              </Link>
            </div>
          </aside>

          {/* Product Grid */}
          <div className="flex-1">
            {loading ? (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-7">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 h-[430px] rounded-[28px] animate-pulse flex flex-col p-5"
                  >
                    <div className="aspect-[4/5] bg-slate-100 dark:bg-slate-800 rounded-2xl mb-4" />
                    <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-1/2 mb-2" />
                    <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded w-3/4 mb-4" />
                    <div className="mt-auto flex justify-between">
                      <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded w-20" />
                      <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8 px-1">
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                    Showing <span className="text-slate-900 dark:text-white font-bold">{pagedNotes.length}</span> of{' '}
                    <span className="font-bold">{filteredNotes.length}</span> study notes
                  </p>
                  <div className="flex items-center gap-3">
                    <select
                      aria-label="Sort study notes"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                    >
                      <option value="featured">Sort: Featured &amp; Popular</option>
                      <option value="newest">Sort: Newest Added</option>
                      <option value="price_asc">Price: Low to High</option>
                      <option value="price_desc">Price: High to Low</option>
                      <option value="rating">Highest Rated</option>
                    </select>
                    <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                      <TrendingUp size={14} />
                      Exam Oriented
                    </div>
                  </div>
                </div>

                <AnimatePresence mode="popLayout">
                  <motion.div
                    layout
                    className={viewMode === 'grid' ? 'grid sm:grid-cols-2 xl:grid-cols-3 gap-7' : 'flex flex-col gap-5'}
                  >
                    {pagedNotes.length > 0 ? (
                      pagedNotes.map((note) => (
                        <ProductCard
                          key={note.id}
                          note={note}
                          viewMode={viewMode}
                          isSaved={savedIds.includes(note.id)}
                          onToggleSave={toggleSaveId}
                        />
                      ))
                    ) : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="col-span-full py-24 text-center bg-white dark:bg-slate-900 rounded-[32px] border border-dashed border-slate-200 dark:border-slate-800"
                      >
                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Search size={28} className="text-slate-400" strokeWidth={1.5} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No matching notes found</h3>
                        <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto text-sm">
                          Try clearing your search or selecting another exam category.
                        </p>
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setShowSavedOnly(false);
                            handleExamChange(ExamType.ALL);
                          }}
                          className="mt-5 text-primary font-bold hover:underline text-sm uppercase tracking-wider cursor-pointer"
                        >
                          Clear all filters
                        </button>
                      </motion.div>
                    )}
                  </motion.div>
                </AnimatePresence>

                {filteredNotes.length > pagedNotes.length && (
                  <div className="mt-10 text-center">
                    <button
                      type="button"
                      onClick={() => setVisibleLimit((prev) => prev + PAGE_SIZE)}
                      className="px-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-200 hover:border-primary transition-colors cursor-pointer"
                    >
                      Load More Study Notes ({filteredNotes.length - pagedNotes.length} remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Shop;
