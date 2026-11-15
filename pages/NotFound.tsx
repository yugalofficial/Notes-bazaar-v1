import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Home } from 'lucide-react';
import { NotesBazaarLogo } from '../components/NotesBazaarLogo';

const NotFound: React.FC = () => {
  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-12 text-center shadow-lg space-y-6">
        <div className="flex justify-center">
          <NotesBazaarLogo variant="seal" size={64} />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-extrabold uppercase tracking-widest text-primary">Error 404</p>
          <h1 className="text-3xl font-black font-heading text-slate-900 dark:text-white">
            Page Not Found
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            The study guide or route you requested does not exist or may have moved.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:opacity-90 transition-opacity"
          >
            <Home size={16} /> Back to Home
          </Link>
          <Link
            to="/shop"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary/10 text-primary font-bold text-sm hover:bg-primary hover:text-white transition-colors"
          >
            <BookOpen size={16} /> Browse Notes Library
          </Link>
        </div>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
        >
          <ArrowLeft size={14} /> Go back to previous page
        </button>
      </div>
    </div>
  );
};

export default NotFound;
