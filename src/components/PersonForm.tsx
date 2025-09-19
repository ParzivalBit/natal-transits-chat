'use client';
import React, { useState } from 'react';

type GeoApiItem = { name?: string; display_name?: string; lat: number; lon: number };
type GeoItem = { name: string; lat: number; lon: number };

function toGeoItem(r: GeoApiItem): GeoItem {
  return {
    name: r.name || r.display_name || 'loc',
    lat: Number(r.lat),
    lon: Number(r.lon),
  };
}

export default function PersonForm({ onCreated }: { onCreated?: (id: string) => void }) {
  const [label, setLabel] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [place, setPlace] = useState('');
  const [lat, setLat] = useState<string>('');
  const [lon, setLon] = useState<string>('');
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<GeoItem[]>([]);

  async function searchPlace() {
    if (!place.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/geo/resolve?q=${encodeURIComponent(place)}&lang=it&limit=5`);
      const j: { items?: GeoApiItem[] } = await res.json();
      const items = Array.isArray(j?.items) ? j.items.map(toGeoItem) : [];
      setResults(items);
    } finally { setSearching(false); }
  }

  async function submit() {
    if (!label.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      alert('Inserisci etichetta e data (YYYY-MM-DD)');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/people', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          label, date,
          time: time.trim() || null,
          place_name: place.trim() || null,
          lat: lat ? Number(lat) : null,
          lon: lon ? Number(lon) : null,
        }),
      });
      const j: { ok?: boolean; id?: string; error?: string } = await res.json();
      if (!res.ok || !j?.ok || !j.id) throw new Error(j?.error || 'Errore');
      // reset
      setLabel(''); setDate(''); setTime(''); setPlace(''); setLat(''); setLon(''); setResults([]);
      onCreated?.(j.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Errore';
      alert(message);
    } finally { setSubmitting(false); }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-gray-500">Etichetta</label>
        <input className="w-full rounded border p-2" value={label}
               onChange={e=>setLabel(e.target.value)} placeholder="es. papà / collega 1 / amica 2" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500">Data di nascita</label>
          <input type="date" className="w-full rounded border p-2" value={date}
                 onChange={e=>setDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Ora (opzionale)</label>
          <input type="time" className="w-full rounded border p-2" value={time}
                 onChange={e=>setTime(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500">Luogo di nascita (facoltativo)</label>
        <div className="flex gap-2">
          <input className="flex-1 rounded border p-2" value={place}
                 onChange={e=>setPlace(e.target.value)} placeholder="città, paese" />
          <button type="button" className="rounded border px-3" onClick={searchPlace} disabled={searching}>
            {searching? '...' : 'Cerca'}
          </button>
        </div>
        {results.length>0 && (
          <div className="mt-2 space-y-1 text-sm">
            {results.map((r,i)=> (
              <button key={i}
                      className="block w-full text-left rounded border p-2 hover:bg-gray-50"
                      onClick={()=>{
                        setPlace(r.name);
                        setLat(String(r.lat));
                        setLon(String(r.lon));
                        setResults([]);
                      }}>
                {r.name} <span className="text-gray-500">({r.lat.toFixed(3)}, {r.lon.toFixed(3)})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500">Lat (facoltativa)</label>
          <input className="w-full rounded border p-2" value={lat} onChange={e=>setLat(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Lon (facoltativa)</label>
          <input className="w-full rounded border p-2" value={lon} onChange={e=>setLon(e.target.value)} />
        </div>
      </div>

      <button type="button" className="rounded-lg border px-4 py-2" onClick={submit} disabled={submitting}>
        {submitting? 'Salvo…' : 'Aggiungi persona'}
      </button>
      <p className="text-xs text-gray-500">Se non inserisci il luogo, useremo la posizione attuale dell’utente per i calcoli “oggi”.</p>
    </div>
  );
}
