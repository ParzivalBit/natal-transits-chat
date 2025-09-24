// src/lib/graphics/types.ts
/** Punto di un tema natale / transiti / sinastria */
export interface ProPoint {
  name: string;        // es. "Sun", "Moon", ...
  longitude: number;   // gradi 0..360
  sign?: string | null;
  house?: number | null;
  retro?: boolean | null;
}
