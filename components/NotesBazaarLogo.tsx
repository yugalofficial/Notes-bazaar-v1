import React from 'react';

interface NotesBazaarLogoProps {
  variant?: 'mark' | 'seal';
  size?: number;
  className?: string;
}

/**
 * Official NotesBazaar Circular Crest Emblem
 * Faithfully matches the Royal Blue + Emerald Green + Gold Nib crest:
 * - Outer Blue-to-Green circular frame
 * - Open Book silhouette + Fountain Pen Nib + Bold Stylized "NB" monogram
 * - Seal variant includes circular text "NOTESBAZAAR" & "Your Study Partner"
 */
export const NotesBazaarLogo: React.FC<NotesBazaarLogoProps> = ({
  variant = 'mark',
  size = 44,
  className = ''
}) => {
  const uid = React.useId().replace(/:/g, '');
  const gradRing = `nb-ring-${uid}`;
  const gradBook = `nb-book-${uid}`;
  const gradGold = `nb-gold-${uid}`;
  const topArcId = `nb-top-arc-${uid}`;
  const bottomArcId = `nb-bottom-arc-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="NotesBazaar Emblem"
    >
      <defs>
        <linearGradient id={gradRing} x1="12" y1="12" x2="108" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1D4ED8" />
          <stop offset="52%" stopColor="#0F766E" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        <linearGradient id={gradBook} x1="28" y1="30" x2="92" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E3A8A" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        <linearGradient id={gradGold} x1="40" y1="20" x2="80" y2="95" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
        <path id={topArcId} d="M 21,60 A 39,39 0 1,1 99,60" />
        <path id={bottomArcId} d="M 19,65 A 41,41 0 0,0 101,65" />
      </defs>

      {/* Outer crisp white backing */}
      <circle cx="60" cy="60" r="58" fill="#FFFFFF" />

      {variant === 'seal' ? (
        <>
          {/* Outer Blue-Green Band */}
          <circle cx="60" cy="60" r="55" fill={`url(#${gradRing})`} />
          <circle cx="60" cy="60" r="52" stroke="#FFFFFF" strokeWidth="1.2" strokeOpacity="0.85" />
          {/* Inner Gold Accent Ring */}
          <circle cx="60" cy="60" r="35" fill="#FFFFFF" stroke={`url(#${gradGold})`} strokeWidth="2.2" />

          {/* Curved Brand Text */}
          <text
            fill="#FFFFFF"
            fontSize="10.2"
            fontWeight="800"
            letterSpacing="1.6"
            fontFamily="Outfit, Plus Jakarta Sans, sans-serif"
          >
            <textPath href={`#${topArcId}`} startOffset="50%" textAnchor="middle">
              NOTESBAZAAR
            </textPath>
          </text>
          <text
            fill="#FEF3C7"
            fontSize="8.2"
            fontWeight="700"
            letterSpacing="0.5"
            fontFamily="Plus Jakarta Sans, sans-serif"
          >
            <textPath href={`#${bottomArcId}`} startOffset="50%" textAnchor="middle">
              Your Study Partner
            </textPath>
          </text>
        </>
      ) : (
        <>
          {/* Compact Mark Ring */}
          <circle cx="60" cy="60" r="54" fill="#FFFFFF" stroke={`url(#${gradRing})`} strokeWidth="6" />
          <circle cx="60" cy="60" r="46" stroke={`url(#${gradGold})`} strokeWidth="1.8" strokeDasharray="3 3" strokeOpacity="0.65" />
        </>
      )}

      {/* Centered Emblem: Open Book + Fountain Pen Nib + "NB" Monogram */}
      <g transform={variant === 'seal' ? 'translate(0, 2) scale(0.84) translate(11.5, 11.5)' : 'translate(0, 1)'}>
        {/* Fountain Pen Nib at Top Center */}
        <path
          d="M60 22 L66.5 34 L63.5 39 H56.5 L53.5 34 Z"
          fill={`url(#${gradBook})`}
        />
        <line x1="60" y1="24" x2="60" y2="33" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="60" cy="33.5" r="1.5" fill="#F59E0B" />

        {/* Open Book Base Silhouette */}
        <path
          d="M27 44 C38 41 51 44 60 51 C69 44 82 41 93 44 V82 C82 79 69 81 60 88 C51 81 38 79 27 82 Z"
          fill="#FFFFFF"
          stroke={`url(#${gradBook})`}
          strokeWidth="3.2"
          strokeLinejoin="round"
        />
        {/* Inner Spine Accent */}
        <path
          d="M23 48 V85 C36 82 50 84 60 91 C70 84 84 82 97 85 V48"
          stroke={`url(#${gradGold})`}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <line x1="60" y1="51" x2="60" y2="87" stroke="#CBD5E1" strokeWidth="1.6" />

        {/* Stylized Bold N (Royal Blue) & B (Emerald Green) */}
        <path
          d="M36 74 V53 H41 L51 67 V53 H56 V74 H51 L41 60 V74 Z"
          fill="#1D4ED8"
        />
        <path
          d="M64 53 H74.5 C78.5 53 81 55.2 81 58.3 C81 60.5 79.6 62 77.6 62.7 C80.2 63.4 81.8 65.3 81.8 68 C81.8 71.7 79 74 74.6 74 H64 V53 Z M69.2 61.3 H73.5 C75.2 61.3 76.2 60.4 76.2 59.1 C76.2 57.8 75.2 56.9 73.5 56.9 H69.2 V61.3 Z M69.2 70 H74 C75.9 70 77 69 77 67.5 C77 66 75.9 65 74 65 H69.2 V70 Z"
          fill="#059669"
        />
      </g>
    </svg>
  );
};

export default NotesBazaarLogo;
