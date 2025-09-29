// src/components/astro/proLayout.ts
export type ProRadiiOptions = {
  R?: number;            // raggio esterno totale della ruota
  gap?: number;          // gap uniforme tra le fasce (px) - metti 0 per "a filo"
  ringZodiac?: number;   // spessore fascia zodiaco
  ringUserHouses?: number;
  ringPersonHouses?: number;
  ringAspectogram?: number; // raggio del cerchio dell’aspettogramma (non spessore)
};

export function getProRadii(opts: ProRadiiOptions = {}) {
  const R  = opts.R  ?? 300;
  const G  = opts.gap ?? 0; // 0 => bordi a contatto
  const WZ = opts.ringZodiac ?? 36;
  const WHu = opts.ringUserHouses ?? 28;
  const WHp = opts.ringPersonHouses ?? 28;
  const RA = opts.ringAspectogram ?? 140;

  // Parto dall’esterno e scendo
  const zodiacOuter = R;
  const zodiacInner = zodiacOuter - WZ;

  const userHousesOuter = zodiacInner - G;
  const userHousesInner = userHousesOuter - WHu;

  const personHousesOuter = userHousesInner - G;
  const personHousesInner = personHousesOuter - WHp;

  const aspectogramRadius = Math.min(personHousesInner - G, RA);

  return {
    R,
    zodiac: { outer: zodiacOuter, inner: zodiacInner },
    userHouses: { outer: userHousesOuter, inner: userHousesInner },
    personHouses: { outer: personHousesOuter, inner: personHousesInner },
    aspectogramRadius,
  };
}
