'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import BirthForm from '@/components/BirthForm';

type Birth = {
  name: string;
  date: string;
  time: string;
  place_name: string;
  lat: number | null;
  lon: number | null;
};

export default function BirthSection({ birth }: { birth: Birth }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // editMode è vero se ?edit=birth è presente oppure se l'utente ha cliccato Edit.
  const urlWantsEdit = (searchParams.get('edit') ?? '') === 'birth';
  const [localEdit, setLocalEdit] = useState(false);
  const editMode = urlWantsEdit || localEdit || !birth?.date || !birth?.place_name;

  const goEdit = () => {
    // Mantiene hash #birth e forza ?edit=birth (navigazione client → render immediato)
    const sp = new URLSearchParams(searchParams.toString());
    sp.set('edit', 'birth');
    router.replace(`${pathname}?${sp.toString()}#birth`);
    setLocalEdit(true);
  };

  const cancelEdit = () => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete('edit');
    router.replace(`${pathname}?${sp.toString()}#birth`);
    setLocalEdit(false);
  };

  const hasSaved = useMemo(() => {
    return !!birth?.date && !!birth?.place_name;
  }, [birth]);

  if (editMode) {
    return (
      <div className="space-y-3">
        <BirthForm
          initial={{
            name: birth?.name ?? '',
            date: birth?.date ?? '',
            time: birth?.time ?? '',
            place_name: birth?.place_name ?? '',
            lat: birth?.lat ?? null,
            lon: birth?.lon ?? null,
          }}
        />
        <button
          type="button"
          onClick={cancelEdit}
          className="rounded border px-3 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    );
  }

  // Summary view + pulsante Edit SEMPRE visibile
  return (
    <div className="rounded-2xl border p-4 text-sm space-y-2">
      <div className="grid md:grid-cols-2 gap-2">
        <div><span className="text-gray-500">Name:</span> {birth?.name || '—'}</div>
        <div>
          <span className="text-gray-500">Date:</span>{' '}
          {birth?.date ? birth.date : '—'}{' '}
          {birth?.time ? `@ ${birth.time}` : '(solar chart)'}
        </div>
        <div className="md:col-span-2">
          <span className="text-gray-500">Place:</span> {birth?.place_name || '—'}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          onClick={goEdit}
          className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
        >
          Edit birth data
        </button>
        {!hasSaved && (
          <span className="text-xs text-red-600">Complete your birth details to compute houses/ASC.</span>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Whole Sign houses if time is provided. You can edit these details anytime.
      </p>
    </div>
  );
}
