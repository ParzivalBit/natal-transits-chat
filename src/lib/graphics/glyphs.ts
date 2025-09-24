// src/lib/graphics/glyphs.ts
// Glyph helpers: segni e pianeti
// - via Unicode char (consigliato) -> planetChar, signChar, signCharSafe
// - placeholder path (fallback)    -> planetGlyph, signGlyph
// - colori (wrapper)               -> signColor, aspectColor

import { SIGN_COLORS, ASPECT_COLORS, type ZodiacSign, type Aspect } from './tokens';

export type PlanetName =
  | 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars'
  | 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune' | 'Pluto'
  | 'Asc' | 'Mc';

// ---------------------------
// Unicode characters
// ---------------------------
const PLANET_CHARS: Record<PlanetName, string> = {
  Sun: '☉', Moon: '☾', Mercury: '☿', Venus: '♀', Mars: '♂',
  Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇',
  Asc: '↑', Mc: 'T',
};

const SIGN_CHARS: Record<ZodiacSign, string> = {
  Aries: '♈', Taurus: '♉', Gemini: '♊', Cancer: '♋', Leo: '♌', Virgo: '♍',
  Libra: '♎', Scorpio: '♏', Sagittarius: '♐', Capricorn: '♑', Aquarius: '♒', Pisces: '♓',
};

export function planetChar(name: PlanetName): string {
  return PLANET_CHARS[name] ?? '?';
}
export function signChar(sign: ZodiacSign): string {
  return SIGN_CHARS[sign] ?? '?';
}

// --- Normalizzazione nomi segno (IT/EN) ---
const IT_TO_EN: Record<string, ZodiacSign> = {
  ariete: 'Aries',
  toro: 'Taurus',
  gemelli: 'Gemini',
  cancro: 'Cancer',
  leone: 'Leo',
  vergine: 'Virgo',
  bilancia: 'Libra',
  scorpione: 'Scorpio',
  sagittario: 'Sagittarius',
  capricorno: 'Capricorn',
  acquario: 'Aquarius',
  pesci: 'Pisces',
};
const EN_ALL: Record<string, ZodiacSign> = {
  aries: 'Aries', taurus: 'Taurus', gemini: 'Gemini', cancer: 'Cancer',
  leo: 'Leo', virgo: 'Virgo', libra: 'Libra', scorpio: 'Scorpio',
  sagittarius: 'Sagittarius', capricorn: 'Capricorn', aquarius: 'Aquarius', pisces: 'Pisces',
};

export function normalizeZodiacSign(input: string): ZodiacSign | null {
  if (!input) return null;
  const k = input.trim().toLowerCase();
  return EN_ALL[k] ?? IT_TO_EN[k] ?? null;
}

/** Accetta sia EN che IT; se non riconosciuto -> '?' */
export function signCharSafe(input: string): string {
  const z = normalizeZodiacSign(input);
  return z ? SIGN_CHARS[z] : '?';
}

// ---------------------------
// Placeholder SVG paths (fallback)
// ---------------------------
export function planetGlyph(name: PlanetName): string {
  switch (name) {
    case 'Sun': return 'M0,-10 A10,10 0 1,0 0,10 A10,10 0 1,0 0,-10 Z';
    case 'Moon': return 'M6,0 A6,6 0 1,1 -6,0 A10,10 0 1,0 6,0 Z';
    case 'Mercury': return 'M0,-8 L6,8 L-6,8 Z';
    case 'Venus': return 'M0,-8 L8,0 L0,8 L-8,0 Z';
    case 'Mars': return 'M-6,-6 L6,6 M6,-6 L-6,6';
    case 'Jupiter': return 'M0,-8 L0,8 M-8,0 L8,0';
    case 'Saturn': return 'M-8,0 L8,0';
    case 'Uranus': return 'M0,-8 L0,8';
    case 'Neptune': return 'M-6,-6 L6,6';
    case 'Pluto': return 'M-6,6 L6,-6';
    case 'Asc': return 'M0,-10 L0,10';
    case 'Mc': return 'M-8,0 L8,0';
    default: return '';
  }
}
export function signGlyph(sign: ZodiacSign): string {
  switch (sign) {
    case 'Aries': return 'M-6,-8 L0,8 L6,-8';
    case 'Taurus': return 'M-6,0 A6,6 0 1,0 6,0 A6,6 0 1,0 -6,0 Z';
    default: return 'M-6,-6 L6,6';
  }
}

// ---------------------------
// Colori (wrapper)
// ---------------------------
export function signColor(sign: ZodiacSign): string {
  return SIGN_COLORS[sign];
}
export function aspectColor(aspect: Aspect): string {
  return ASPECT_COLORS[aspect];
}

// Tipi utili
export type { ZodiacSign, Aspect } from './tokens';
