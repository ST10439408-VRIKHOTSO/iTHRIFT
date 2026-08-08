'use strict';

const fs = require('node:fs');
const path = require('node:path');

const OUT_DIR = path.join(__dirname, '..', '..', 'public', 'images', 'products');

// Simple, original brand-colour swatches used only to tint a generated
// placeholder. No logos, photography or other brand assets are used or
// reproduced anywhere in this prototype. Used only as a fallback for
// products added via the admin console without an uploaded photo.
const BRAND_COLOURS = {
  Nike: '#111111',
  Adidas: '#1a1a1a',
  Puma: '#7a1f17',
  'Calvin Klein': '#15151c',
  Guess: '#1f1f1f',
  'Tommy Hilfiger': '#1d3b6b',
  Zara: '#2a2a2a',
  'H&M': '#5a1d1d',
  Wrangler: '#2e4a6b',
  'L.L.Bean': '#274a37',
  Dickies: '#3c4a2e',
  Woolrich: '#4a4036',
  Next: '#33333d',
  Mocome: '#3a3a3a',
};

function textColourFor(hex) {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.55 ? '#14131a' : '#f5f3fa';
}

const CONDITION_BADGES = {
  Excellent: { bg: '#e3f6ea', fg: '#2f7d4f' },
  'Very Good': { bg: '#e6eefb', fg: '#2f5fa8' },
  Good: { bg: '#fbedce', fg: '#92660f' },
  Fair: { bg: '#fbe7e7', fg: '#a93f3f' },
};

/**
 * Generates a single, original SVG placeholder image for a product: a flat
 * silhouette tinted with the brand colour, the product name, and a coloured
 * condition badge. Saved to public/images/products/<id>.svg and referenced
 * from the Product table's ImageFile column.
 */
function generateProductImage({ id, name, brand, condition, category }) {
  const bg = BRAND_COLOURS[brand] || '#3a3a3a';
  const fg = textColourFor(bg);
  const badge = CONDITION_BADGES[condition] || { bg: '#f6f5f9', fg: '#75727f' };
  const silhouette = silhouetteFor(category);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <rect width="600" height="600" fill="${bg}"/>
  <g transform="translate(300,255)" fill="${fg}" opacity="0.92">${silhouette}</g>
  <rect x="24" y="24" width="${Math.min(560, 28 + condition.length * 13)}" height="34" rx="17" fill="${badge.bg}"/>
  <text x="38" y="47" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="${badge.fg}">${escapeXml(condition)}</text>
  <text x="300" y="540" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="${fg}">${escapeXml(brand)}</text>
  <text x="300" y="568" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" fill="${fg}" opacity="0.85">${escapeXml(name)}</text>
</svg>`;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const fileName = `${id}.svg`;
  fs.writeFileSync(path.join(OUT_DIR, fileName), svg, 'utf8');
  return `/images/products/${fileName}`;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function silhouetteFor(category) {
  switch (category) {
    case 'Footwear':
      return '<path d="M-150,40 q0,-30 40,-34 l130,-12 q30,-2 46,18 l34,40 q40,8 70,4 l8,22 q-2,18 -24,18 l-280,0 q-26,0 -24,-26 z"/>';
    case 'Jeans':
    case 'Trousers':
      return '<path d="M-80,-140 h160 l10,90 q4,40 -6,170 q-2,18 -22,18 h-30 q-16,0 -18,-18 l-14,-150 l-14,150 q-2,18 -18,18 h-30 q-20,0 -22,-18 q-10,-130 -6,-170 z"/>';
    case 'Knitwear':
    case 'Outerwear':
    case 'Tees':
      return '<path d="M-90,-150 l50,-20 q40,18 80,0 l50,20 l36,46 l-30,30 l-16,-12 v210 q0,16 -16,16 h-128 q-16,0 -16,-16 v-210 l-16,12 l-30,-30 z"/>';
    case 'Dresses':
      return '<path d="M-60,-150 l30,-16 q30,14 60,0 l30,16 l-6,60 l40,200 q4,18 -16,18 h-176 q-20,0 -16,-18 l40,-200 z"/>';
    case 'Accessories':
      return '<circle r="110" fill="none" stroke="currentColor" stroke-width="14"/><circle r="14" cy="-110"/>';
    default:
      return '<path d="M-90,-150 l50,-20 q40,18 80,0 l50,20 l36,46 l-30,30 l-16,-12 v210 q0,16 -16,16 h-128 q-16,0 -16,-16 v-210 l-16,12 l-30,-30 z"/>';
  }
}

module.exports = { generateProductImage };
