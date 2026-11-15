import { ExamType } from '../types';

/**
 * Generates ultra-crisp, zoom-ready SVG handwritten study note page Data URIs.
 * Because they are vector SVGs, zooming up to 300% inside the full-screen preview
 * modal keeps every formula, timeline, diagram, and handwritten line razor sharp.
 */

const encodeSvg = (svg: string): string => {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
};

const createRuledPaperBase = (pageNum: number, examLabel: string, topicTitle: string, bodyContent: string, accentColor = '#1D4ED8') => {
  const horizontalLines = Array.from({ length: 24 })
    .map((_, idx) => {
      const y = 128 + idx * 34;
      return `<line x1="24" y1="${y}" x2="776" y2="${y}" stroke="#E2E8F0" stroke-width="1"/>`;
    })
    .join('');

  return encodeSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
      <defs>
        <pattern id="paperGrain" width="20" height="20" patternUnits="userSpaceOnUse">
          <rect width="20" height="20" fill="#FFFDF8"/>
          <circle cx="4" cy="6" r="0.6" fill="#E2E8F0" opacity="0.5"/>
          <circle cx="14" cy="16" r="0.5" fill="#CBD5E1" opacity="0.4"/>
        </pattern>
      </defs>

      <!-- Cream Notebook Page Canvas -->
      <rect width="800" height="1000" rx="12" fill="url(#paperGrain)" />
      
      <!-- Ruled Notebook Lines & Double Margin -->
      ${horizontalLines}
      <line x1="92" y1="0" x2="92" y2="1000" stroke="#FDA4AF" stroke-width="1.8" />
      <line x1="98" y1="0" x2="98" y2="1000" stroke="#FECDD3" stroke-width="1" />

      <!-- Binder Punch Holes -->
      <circle cx="44" cy="160" r="11" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
      <circle cx="44" cy="500" r="11" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>
      <circle cx="44" cy="840" r="11" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1.5"/>

      <!-- Header Strip -->
      <rect x="114" y="34" width="648" height="72" rx="10" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.2"/>
      <rect x="114" y="34" width="8" height="72" rx="3" fill="${accentColor}"/>
      <text x="136" y="64" font-family="Plus Jakarta Sans, Segoe UI, sans-serif" font-size="14" font-weight="800" fill="${accentColor}" letter-spacing="1.4">
        NOTESBAZAAR TOPPER SERIES • ${examLabel.toUpperCase()}
      </text>
      <text x="136" y="92" font-family="Outfit, Segoe UI, sans-serif" font-size="22" font-weight="800" fill="#0F172A">
        ${topicTitle}
      </text>
      <rect x="664" y="50" width="82" height="36" rx="8" fill="#ECFDF5" stroke="#A7F3D0"/>
      <text x="705" y="73" font-family="JetBrains Mono, monospace" font-size="13" font-weight="700" fill="#047857" text-anchor="middle">
        PAGE 0${pageNum}
      </text>

      <!-- Handwritten Content Body -->
      ${bodyContent}

      <!-- Subtle Watermark Footer -->
      <text x="400" y="968" font-family="Outfit, sans-serif" font-size="13" font-weight="700" fill="#94A3B8" text-anchor="middle" letter-spacing="2">
        NOTESBAZAAR • YOUR STUDY PARTNER • EXAM ORIENTED HANDWRITTEN NOTES
      </text>
    </svg>
  `);
};

const SSC_PAGES = [
  createRuledPaperBase(
    1,
    'SSC CGL / CHSL',
    'Algebra & Trigonometry — Topper Golden Shortcuts',
    `
      <text x="118" y="154" font-family="Georgia, cursive, serif" font-size="20" font-weight="700" fill="#1E3A8A" font-style="italic">
        1. Reciprocal Identities (Direct 2-Sec SSC Tier-2 Tricks)
      </text>
      <rect x="118" y="170" width="634" height="118" rx="10" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1.5"/>
      <text x="138" y="204" font-family="JetBrains Mono, monospace" font-size="18" font-weight="700" fill="#1E293B">
        If  x + 1/x = k   ==&gt;   x² + 1/x² = k² - 2
      </text>
      <text x="138" y="238" font-family="JetBrains Mono, monospace" font-size="18" font-weight="700" fill="#0F766E">
        If  x + 1/x = k   ==&gt;   x³ + 1/x³ = k³ - 3k
      </text>
      <text x="138" y="272" font-family="JetBrains Mono, monospace" font-size="16" font-weight="600" fill="#B45309">
        ★ Special Case: If x + 1/x = √3  ==&gt;  x⁶ = -1  (Repeated 18 times!)
      </text>

      <text x="118" y="330" font-family="Georgia, cursive, serif" font-size="20" font-weight="700" fill="#1E3A8A" font-style="italic">
        2. Geometry: Alternate Segment &amp; Chord Theorems
      </text>
      <!-- Circle Geometry Diagram -->
      <rect x="118" y="350" width="290" height="230" rx="12" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5"/>
      <circle cx="263" cy="450" r="68" fill="none" stroke="#1D4ED8" stroke-width="2.5"/>
      <line x1="155" y1="518" x2="371" y2="518" stroke="#DC2626" stroke-width="2.5"/>
      <polygon points="263,518 208,408 318,412" fill="rgba(13,148,136,0.12)" stroke="#0D9488" stroke-width="2.2"/>
      <text x="263" y="544" font-family="Plus Jakarta Sans, sans-serif" font-size="13" font-weight="700" fill="#DC2626" text-anchor="middle">Tangent PT • ∠TPQ = ∠PRQ</text>

      <!-- Side Note Formulas -->
      <rect x="428" y="350" width="324" height="230" rx="12" fill="#FEFCE8" stroke="#FDE047" stroke-width="1.5"/>
      <text x="446" y="384" font-family="Plus Jakarta Sans, sans-serif" font-size="15" font-weight="800" fill="#854D0E">
        HIGH-YIELD EXAM NOTES
      </text>
      <text x="446" y="420" font-family="Georgia, serif" font-size="16" fill="#1E293B" font-style="italic">
        • PA × PB = PT² (Secant-Tangent)
      </text>
      <text x="446" y="454" font-family="Georgia, serif" font-size="16" fill="#1E293B" font-style="italic">
        • Inradius r = Δ / s   |   R = abc / 4Δ
      </text>
      <text x="446" y="488" font-family="Georgia, serif" font-size="16" fill="#1E293B" font-style="italic">
        • Right Triangle: r = (P + B - H) / 2
      </text>
      <text x="446" y="522" font-family="Georgia, serif" font-size="16" fill="#047857" font-weight="700" font-style="italic">
        ✓ Solved PYQ (CGL 2024): r = (6+8-10)/2 = 2 cm
      </text>

      <text x="118" y="628" font-family="Georgia, cursive, serif" font-size="20" font-weight="700" fill="#1E3A8A" font-style="italic">
        3. Trigonometry Maxima / Minima Value Table
      </text>
      <rect x="118" y="646" width="634" height="220" rx="10" fill="#FFFFFF" stroke="#CBD5E1"/>
      <line x1="118" y1="692" x2="752" y2="692" stroke="#CBD5E1" fill="#F1F5F9"/>
      <text x="140" y="676" font-family="Plus Jakarta Sans, sans-serif" font-size="14" font-weight="800" fill="#0F172A">Expression Type</text>
      <text x="450" y="676" font-family="Plus Jakarta Sans, sans-serif" font-size="14" font-weight="800" fill="#059669">Minimum Value</text>
      <text x="610" y="676" font-family="Plus Jakarta Sans, sans-serif" font-size="14" font-weight="800" fill="#1D4ED8">Maximum Value</text>

      <text x="140" y="730" font-family="JetBrains Mono, monospace" font-size="15" fill="#1E293B">a sinθ + b cosθ</text>
      <text x="450" y="730" font-family="JetBrains Mono, monospace" font-size="15" font-weight="700" fill="#059669">-√(a² + b²)</text>
      <text x="610" y="730" font-family="JetBrains Mono, monospace" font-size="15" font-weight="700" fill="#1D4ED8">+√(a² + b²)</text>

      <text x="140" y="772" font-family="JetBrains Mono, monospace" font-size="15" fill="#1E293B">a sin²θ + b cosec²θ (a≥b)</text>
      <text x="450" y="772" font-family="JetBrains Mono, monospace" font-size="15" font-weight="700" fill="#059669">2√(ab)</text>
      <text x="610" y="772" font-family="JetBrains Mono, monospace" font-size="15" font-weight="700" fill="#1D4ED8">∞ (Infinity)</text>

      <text x="140" y="814" font-family="JetBrains Mono, monospace" font-size="15" fill="#1E293B">a sec²θ + b cosec²θ</text>
      <text x="450" y="814" font-family="JetBrains Mono, monospace" font-size="15" font-weight="700" fill="#059669">(√a + √b)²</text>
      <text x="610" y="814" font-family="JetBrains Mono, monospace" font-size="15" font-weight="700" fill="#1D4ED8">∞ (Infinity)</text>
    `,
    '#1D4ED8'
  ),
  createRuledPaperBase(
    2,
    'SSC CGL / CHSL',
    'Percentage, Profit & Loss — Ratio Multiplier Method',
    `
      <text x="118" y="154" font-family="Georgia, serif" font-size="20" font-weight="700" fill="#0F766E" font-style="italic">
        Fraction-to-Percent Standard Conversion Chart (Must Memorize)
      </text>
      <rect x="118" y="176" width="634" height="190" rx="12" fill="#ECFDF5" stroke="#A7F3D0"/>
      <text x="145" y="216" font-family="JetBrains Mono, monospace" font-size="17" font-weight="700" fill="#065F46">
        1/6 = 16.66%     |    1/7 = 14.28%     |    1/8 = 12.50%
      </text>
      <text x="145" y="256" font-family="JetBrains Mono, monospace" font-size="17" font-weight="700" fill="#065F46">
        1/9 = 11.11%     |    1/11 = 9.09%     |    1/12 = 8.33%
      </text>
      <text x="145" y="296" font-family="JetBrains Mono, monospace" font-size="17" font-weight="700" fill="#065F46">
        3/8 = 37.50%     |    5/8 = 62.50%     |    4/7 = 57.14%
      </text>
      <text x="145" y="340" font-family="Plus Jakarta Sans, sans-serif" font-size="15" font-weight="700" fill="#B45309">
        Tip: Use Successive Net Effect = x + y + (xy)/100 for double discounts!
      </text>
      <text x="118" y="425" font-family="Georgia, serif" font-size="19" font-weight="700" fill="#1E293B" font-style="italic">
        Dishonest Shopkeeper Formula:
      </text>
      <text x="135" y="465" font-family="JetBrains Mono, monospace" font-size="17" fill="#1D4ED8">
        CP : SP = (Weight Actually Given) : (Weight Claimed)
      </text>
      <text x="135" y="505" font-family="Georgia, serif" font-size="16" fill="#475569" font-style="italic">
        Example: Uses 800g instead of 1000g ==&gt; CP:SP = 800:1000 = 4:5 (+25% Profit)
      </text>
    `,
    '#059669'
  ),
  createRuledPaperBase(
    3,
    'SSC CGL / CHSL',
    'Compound Interest Tree & Installment Shortcuts',
    `
      <text x="118" y="158" font-family="Georgia, serif" font-size="20" font-weight="700" fill="#1D4ED8" font-style="italic">
        3-Year CI vs SI Difference Direct Formula
      </text>
      <rect x="118" y="182" width="634" height="140" rx="12" fill="#EFF6FF" stroke="#93C5FD"/>
      <text x="144" y="228" font-family="JetBrains Mono, monospace" font-size="18" font-weight="700" fill="#1E3A8A">
        2 Years:  CI - SI = P × (R / 100)²
      </text>
      <text x="144" y="274" font-family="JetBrains Mono, monospace" font-size="18" font-weight="700" fill="#0F766E">
        3 Years:  CI - SI = P × (R / 100)² × (300 + R) / 100
      </text>
    `,
    '#1D4ED8'
  )
];

const UPSC_PAGES = [
  createRuledPaperBase(
    1,
    'UPSC CSE GS-1',
    'Modern Indian History — Chronology & Acts (1757–1947)',
    `
      <text x="118" y="154" font-family="Georgia, serif" font-size="20" font-weight="700" fill="#1E3A8A" font-style="italic">
        Phase I: Expansion &amp; Constitutional Framework (1773 – 1858)
      </text>
      <rect x="118" y="176" width="634" height="210" rx="12" fill="#FFFFFF" stroke="#CBD5E1"/>
      <text x="140" y="212" font-family="Plus Jakarta Sans, sans-serif" font-size="15" font-weight="800" fill="#1D4ED8">
        • Regulating Act 1773: Governor of Bengal → Governor-General (Warren Hastings)
      </text>
      <text x="140" y="246" font-family="Plus Jakarta Sans, sans-serif" font-size="15" font-weight="600" fill="#334155">
          Created Supreme Court at Calcutta (1774) — Sir Elijah Impey (1st Chief Justice)
      </text>
      <text x="140" y="286" font-family="Plus Jakarta Sans, sans-serif" font-size="15" font-weight="800" fill="#059669">
        • Charter Act 1833: Governor-General of India (Lord William Bentinck)
      </text>
      <text x="140" y="320" font-family="Plus Jakarta Sans, sans-serif" font-size="15" font-weight="600" fill="#334155">
          Ended commercial monopoly of EIC completely; Law Commission (Macaulay).
      </text>
      <text x="140" y="360" font-family="Plus Jakarta Sans, sans-serif" font-size="15" font-weight="800" fill="#B45309">
        • GoI Act 1858: Crown Rule begins, Viceroy Lord Canning, Secretary of State created.
      </text>

      <text x="118" y="428" font-family="Georgia, serif" font-size="20" font-weight="700" fill="#0F766E" font-style="italic">
        Gandhian Era Mass Movements Mind-Map
      </text>
      <!-- Timeline Flow -->
      <rect x="118" y="448" width="196" height="120" rx="12" fill="#ECFDF5" stroke="#6EE7B7"/>
      <text x="216" y="480" font-family="Outfit, sans-serif" font-size="16" font-weight="800" fill="#065F46" text-anchor="middle">1920–22 NCM</text>
      <text x="216" y="508" font-family="Plus Jakarta Sans, sans-serif" font-size="13" fill="#047857" text-anchor="middle">Nagpur Session</text>
      <text x="216" y="532" font-family="Plus Jakarta Sans, sans-serif" font-size="13" fill="#047857" text-anchor="middle">Chauri Chaura Call-off</text>

      <rect x="336" y="448" width="196" height="120" rx="12" fill="#EFF6FF" stroke="#93C5FD"/>
      <text x="434" y="480" font-family="Outfit, sans-serif" font-size="16" font-weight="800" fill="#1E3A8A" text-anchor="middle">1930–34 CDM</text>
      <text x="434" y="508" font-family="Plus Jakarta Sans, sans-serif" font-size="13" fill="#1D4ED8" text-anchor="middle">Dandi Salt March</text>
      <text x="434" y="532" font-family="Plus Jakarta Sans, sans-serif" font-size="13" fill="#1D4ED8" text-anchor="middle">Gandhi-Irwin Pact</text>

      <rect x="554" y="448" width="198" height="120" rx="12" fill="#FEF3C7" stroke="#FCD34D"/>
      <text x="653" y="480" font-family="Outfit, sans-serif" font-size="16" font-weight="800" fill="#92400E" text-anchor="middle">1942 Quit India</text>
      <text x="653" y="508" font-family="Plus Jakarta Sans, sans-serif" font-size="13" fill="#B45309" text-anchor="middle">Gowalia Tank, Bombay</text>
      <text x="653" y="532" font-family="Plus Jakarta Sans, sans-serif" font-size="13" fill="#B45309" text-anchor="middle">"Do or Die" Parallel Govts</text>

      <rect x="118" y="606" width="634" height="190" rx="12" fill="#F8FAFC" stroke="#CBD5E1"/>
      <text x="140" y="642" font-family="Plus Jakarta Sans, sans-serif" font-size="15" font-weight="800" fill="#0F172A">
        UPSC Mains Answer Writing Value-Add (Parallel Govts during 1942):
      </text>
      <text x="140" y="678" font-family="Georgia, serif" font-size="16" fill="#334155" font-style="italic">
        1. Ballia (UP) — Chittu Pandey (August 1942)
      </text>
      <text x="140" y="712" font-family="Georgia, serif" font-size="16" fill="#334155" font-style="italic">
        2. Tamluk (Midnapore, Bengal) — Jatiya Sarkar (Vidyut Vahinis, Cyclone Relief)
      </text>
      <text x="140" y="746" font-family="Georgia, serif" font-size="16" fill="#334155" font-style="italic">
        3. Satara (Maharashtra) — "Prati Sarkar" (Y.B. Chavan &amp; Nana Patil, longest running)
      </text>
    `,
    '#1D4ED8'
  ),
  createRuledPaperBase(
    2,
    'UPSC CSE GS-1',
    'Socio-Religious Reform Movements — Quick Comparison',
    `
      <text x="118" y="156" font-family="Georgia, serif" font-size="20" font-weight="700" fill="#059669" font-style="italic">
        Key Organizations, Founders &amp; Core Journals
      </text>
      <rect x="118" y="182" width="634" height="240" rx="12" fill="#FFFFFF" stroke="#CBD5E1"/>
      <text x="140" y="220" font-family="Plus Jakarta Sans, sans-serif" font-size="15" font-weight="800" fill="#1D4ED8">
        • Brahmo Samaj (1828) — Raja Ram Mohan Roy | Sambad Kaumudi, Mirat-ul-Akbar
      </text>
      <text x="140" y="264" font-family="Plus Jakarta Sans, sans-serif" font-size="15" font-weight="800" fill="#059669">
        • Satyashodhak Samaj (1873) — Jyotirao Phule | Gulamgiri, Anti-caste equality
      </text>
      <text x="140" y="308" font-family="Plus Jakarta Sans, sans-serif" font-size="15" font-weight="800" fill="#B45309">
        • Arya Samaj (1875) — Swami Dayananda Saraswati | Satyarth Prakash, Shuddhi
      </text>
      <text x="140" y="352" font-family="Plus Jakarta Sans, sans-serif" font-size="15" font-weight="800" fill="#334155">
        • Ramakrishna Mission (1897) — Swami Vivekananda | Belur Math, Practical Vedanta
      </text>
    `,
    '#059669'
  )
];

const BANKING_PAGES = [
  createRuledPaperBase(
    1,
    'BANKING IBPS / SBI PO',
    'Monetary Policy Tools &amp; Syllogism Logic Framework',
    `
      <text x="118" y="156" font-family="Georgia, serif" font-size="20" font-weight="700" fill="#059669" font-style="italic">
        1. RBI Liquidity &amp; Inflation Control Matrix
      </text>
      <rect x="118" y="178" width="634" height="220" rx="12" fill="#ECFDF5" stroke="#A7F3D0"/>
      <text x="140" y="216" font-family="JetBrains Mono, monospace" font-size="16" font-weight="700" fill="#065F46">
        Repo Rate ↑     ==&gt; Borrowing Cost ↑ ==&gt; Inflation ↓ (Hawkish)
      </text>
      <text x="140" y="254" font-family="JetBrains Mono, monospace" font-size="16" font-weight="700" fill="#1E3A8A">
        CRR / SLR ↑     ==&gt; Bank Lendable Funds ↓ ==&gt; Liquidity Absorbed
      </text>
      <text x="140" y="292" font-family="JetBrains Mono, monospace" font-size="16" font-weight="700" fill="#B45309">
        SDF (Standing Deposit Facility): Collateral-free liquidity absorption floor
      </text>
      <text x="140" y="330" font-family="Plus Jakarta Sans, sans-serif" font-size="14" font-weight="700" fill="#334155">
        MPC Composition: 6 Members (3 RBI + 3 Govt), RBI Governor holds casting vote.
      </text>

      <text x="118" y="440" font-family="Georgia, serif" font-size="20" font-weight="700" fill="#1D4ED8" font-style="italic">
        2. Syllogism "Only A Few" Golden Rule (SBI Mains Favorite)
      </text>
      <rect x="118" y="464" width="634" height="160" rx="12" fill="#EFF6FF" stroke="#BFDBFE"/>
      <text x="142" y="502" font-family="Plus Jakarta Sans, sans-serif" font-size="16" font-weight="800" fill="#1E3A8A">
        Statement: "Only a few A are B"
      </text>
      <text x="142" y="538" font-family="Plus Jakarta Sans, sans-serif" font-size="15" font-weight="600" fill="#047857">
        ✓ Means BOTH:  [Some A are B]  +  [Some A are NOT B]
      </text>
      <text x="142" y="574" font-family="Plus Jakarta Sans, sans-serif" font-size="15" font-weight="600" fill="#DC2626">
        ✗ "All A can be B" is ALWAYS FALSE, while "All B can be A" is TRUE!
      </text>
    `,
    '#059669'
  ),
  createRuledPaperBase(
    2,
    'BANKING IBPS / SBI PO',
    'Basel III Capital Adequacy &amp; Priority Sector Lending (PSL)',
    `
      <text x="118" y="156" font-family="Georgia, serif" font-size="20" font-weight="700" fill="#1D4ED8" font-style="italic">
        Priority Sector Lending (PSL) Targets for Domestic Commercial Banks
      </text>
      <rect x="118" y="182" width="634" height="180" rx="12" fill="#FFFFFF" stroke="#CBD5E1"/>
      <text x="142" y="220" font-family="JetBrains Mono, monospace" font-size="16" font-weight="700" fill="#0F172A">
        Total PSL Target: 40% of ANBC  |  RRBs &amp; SFBs: 75% of ANBC
      </text>
      <text x="142" y="260" font-family="JetBrains Mono, monospace" font-size="16" fill="#059669">
        Agriculture: 18% (Small/Marginal Farmers: 10%)
      </text>
      <text x="142" y="300" font-family="JetBrains Mono, monospace" font-size="16" fill="#1D4ED8">
        Micro Enterprises: 7.5%  |  Weaker Sections: 12%
      </text>
    `,
    '#1D4ED8'
  )
];

const RAILWAYS_PAGES = [
  createRuledPaperBase(
    1,
    'RAILWAYS RRB NTPC',
    'General Science Capsule — Physics SI Units &amp; Vitamins Chart',
    `
      <text x="118" y="156" font-family="Georgia, serif" font-size="20" font-weight="700" fill="#1D4ED8" font-style="italic">
        1. Essential Physics Formula &amp; Lens Sign Convention
      </text>
      <rect x="118" y="180" width="634" height="160" rx="12" fill="#EFF6FF" stroke="#BFDBFE"/>
      <text x="142" y="218" font-family="JetBrains Mono, monospace" font-size="17" font-weight="700" fill="#1E3A8A">
        Mirror Formula: 1/f = 1/v + 1/u   |   Lens Formula: 1/f = 1/v - 1/u
      </text>
      <text x="142" y="258" font-family="JetBrains Mono, monospace" font-size="17" font-weight="700" fill="#059669">
        Power of Lens P = 1 / f (in metres)   Unit: Dioptre (D)
      </text>
      <text x="142" y="298" font-family="Plus Jakarta Sans, sans-serif" font-size="15" font-weight="700" fill="#B45309">
        Convex Lens (+f) corrects Hypermetropia | Concave Lens (-f) corrects Myopia
      </text>

      <text x="118" y="390" font-family="Georgia, serif" font-size="20" font-weight="700" fill="#059669" font-style="italic">
        2. Vitamins Chemical Names &amp; Deficiency Diseases
      </text>
      <rect x="118" y="414" width="634" height="220" rx="12" fill="#ECFDF5" stroke="#A7F3D0"/>
      <text x="142" y="452" font-family="JetBrains Mono, monospace" font-size="15" font-weight="700" fill="#065F46">
        • Vit A (Retinol)       → Night Blindness (Fat Soluble)
      </text>
      <text x="142" y="490" font-family="JetBrains Mono, monospace" font-size="15" font-weight="700" fill="#065F46">
        • Vit B1 (Thiamine)     → Beri-Beri | B12 (Cyanocobalamin) → Cobalt
      </text>
      <text x="142" y="528" font-family="JetBrains Mono, monospace" font-size="15" font-weight="700" fill="#065F46">
        • Vit C (Ascorbic Acid) → Scurvy (Water Soluble: B &amp; C)
      </text>
      <text x="142" y="566" font-family="JetBrains Mono, monospace" font-size="15" font-weight="700" fill="#065F46">
        • Vit D (Calciferol)    → Rickets | Vit K (Phylloquinone) → Blood Clot
      </text>
    `,
    '#1D4ED8'
  ),
  createRuledPaperBase(
    2,
    'RAILWAYS RRB NTPC',
    'Chemistry — Common Alloys, Ores &amp; pH Values',
    `
      <text x="118" y="156" font-family="Georgia, serif" font-size="20" font-weight="700" fill="#059669" font-style="italic">
        Most Repeated Railway Alloy Compositions
      </text>
      <rect x="118" y="184" width="634" height="170" rx="12" fill="#FFFFFF" stroke="#CBD5E1"/>
      <text x="142" y="222" font-family="JetBrains Mono, monospace" font-size="16" font-weight="700" fill="#1E293B">
        Brass  = Copper (Cu) + Zinc (Zn)
      </text>
      <text x="142" y="260" font-family="JetBrains Mono, monospace" font-size="16" font-weight="700" fill="#1D4ED8">
        Bronze = Copper (Cu) + Tin (Sn)
      </text>
      <text x="142" y="298" font-family="JetBrains Mono, monospace" font-size="16" font-weight="700" fill="#059669">
        Solder = Lead (Pb) + Tin (Sn)   |   Stainless Steel = Fe + Cr + Ni + C
      </text>
    `,
    '#059669'
  )
];

export const getSamplePagesByExam = (examType?: ExamType | string): string[] => {
  const key = String(examType || '').toUpperCase();
  if (key.includes('UPSC')) return UPSC_PAGES;
  if (key.includes('BANK')) return BANKING_PAGES;
  if (key.includes('RAIL')) return RAILWAYS_PAGES;
  return SSC_PAGES;
};

/**
 * Ensures any product has crisp, reliable handwritten note sample pages
 * and strips broken external picsum.photos URLs.
 */
export const getSafePreviewImages = (
  examType?: ExamType | string,
  existingImages?: string[]
): string[] => {
  const validCustom = (existingImages || []).filter(
    (img) => typeof img === 'string' && img.trim().length > 0 && !img.includes('picsum.photos')
  );
  if (validCustom.length > 0) {
    return validCustom;
  }
  return getSamplePagesByExam(examType);
};
