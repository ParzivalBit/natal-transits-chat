// src/lib/graphics/tokens.ts
/**
 * Design tokens per colori e stili grafici dell'astrologia.
 * Usati da tutti i componenti Pro.
 */

export type ZodiacSign =
  | 'Aries' | 'Taurus' | 'Gemini' | 'Cancer' | 'Leo' | 'Virgo'
  | 'Libra' | 'Scorpio' | 'Sagittarius' | 'Capricorn' | 'Aquarius' | 'Pisces';

export type Aspect =
  | 'conjunction'
  | 'opposition'
  | 'trine'
  | 'square'
  | 'sextile';

export const SIGN_COLORS: Record<ZodiacSign, string> = {
  Aries:       '#E63946', // rosso vivo
  Taurus:      '#8D6E63', // terra/marrone
  Gemini:      '#FFD166', // giallo brillante
  Cancer:      '#118AB2', // blu acqua
  Leo:         '#F4A261', // arancio solare
  Virgo:       '#2A9D8F', // verde teal
  Libra:       '#E76F51', // rosato
  Scorpio:     '#6D597A', // viola scuro
  Sagittarius: '#06D6A0', // verde smeraldo
  Capricorn:   '#264653', // blu/nero sobrio
  Aquarius:    '#457B9D', // azzurro
  Pisces:      '#A8DADC', // acquamarina
};

export const ASPECT_COLORS: Record<Aspect, string> = {
  conjunction: '#333333', // nero scuro
  opposition:  '#E63946', // rosso dinamico
  trine:       '#118AB2', // blu armonico
  square:      '#F4A261', // arancio dinamico
  sextile:     '#06D6A0', // verde armonico
};

// dimensioni e stili base
export const STROKES = {
  ring: 1.2,
  aspect: 1.5,
  cusp: 1,
};

export const FONTS = {
  label: '10px sans-serif',
  glyph: '16px serif',
};
