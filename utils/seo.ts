/**
 * NotesBazaar SEO & Structured Data Utilities
 * Updates document title, meta description, OpenGraph tags, robots directives,
 * and Schema.org JSON-LD blocks cleanly across SPA routes.
 */

export interface SeoConfig {
  title: string;
  description: string;
  noIndex?: boolean;
  canonicalPath?: string;
}

const DEFAULT_TITLE = 'NotesBazaar – Exam Prep & Study Material';
const DEFAULT_DESCRIPTION =
  'Concise, exam-oriented handwritten PDF notes for SSC, Banking, Railways, State PSC, and UPSC with secure Razorpay checkout and instant PDF access.';

export function applySeoMetadata(config: SeoConfig) {
  if (typeof document === 'undefined') return;

  const fullTitle = config.title.includes('NotesBazaar')
    ? config.title
    : `${config.title} | NotesBazaar`;

  document.title = fullTitle;

  const setMeta = (selector: string, attr: 'name' | 'property', key: string, value: string) => {
    let el = document.querySelector(selector) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', value);
  };

  setMeta('meta[name="description"]', 'name', 'description', config.description || DEFAULT_DESCRIPTION);
  setMeta('meta[property="og:title"]', 'property', 'og:title', fullTitle);
  setMeta('meta[property="og:description"]', 'property', 'og:description', config.description || DEFAULT_DESCRIPTION);
  setMeta(
    'meta[name="robots"]',
    'name',
    'robots',
    config.noIndex ? 'noindex, nofollow' : 'index, follow'
  );
}

export function setStructuredDataJsonLd(id: string, payload: Record<string, any> | null) {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(id);
  if (!payload) {
    if (existing) existing.remove();
    return;
  }
  let script = existing as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(payload);
}

export function getRouteSeo(pathname: string): SeoConfig {
  if (pathname === '/' || pathname === '') {
    return {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      noIndex: false,
    };
  }
  if (pathname.startsWith('/shop')) {
    return {
      title: 'All Digital Notes & Exam Library | NotesBazaar',
      description:
        'Browse Static GK 2026, SSC Mathematics, Banking Reasoning, Railways Science, and UPSC Modern History PDF notes.',
      noIndex: false,
    };
  }
  if (pathname.startsWith('/membership')) {
    return {
      title: 'Aspirant All-Access Membership Plans | NotesBazaar',
      description: 'Unlock priority access to digital study notes and updates across SSC, Banking, Railways, and PSC exams.',
      noIndex: false,
    };
  }
  if (pathname.startsWith('/about')) {
    return {
      title: 'About NotesBazaar – Your Study Partner',
      description: 'Learn how NotesBazaar delivers structured exam-oriented handwritten PDF study material to aspirants.',
      noIndex: false,
    };
  }
  if (pathname.startsWith('/contact')) {
    return {
      title: 'Customer Support & Helpdesk | NotesBazaar',
      description: 'Contact NotesBazaar support for payment verification, download assistance, and study material inquiries.',
      noIndex: false,
    };
  }
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin') || pathname.startsWith('/thank-you')) {
    return {
      title: 'Student & Admin Portal | NotesBazaar',
      description: DEFAULT_DESCRIPTION,
      noIndex: true,
    };
  }
  return {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    noIndex: false,
  };
}
