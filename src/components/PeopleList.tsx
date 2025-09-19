'use client';
import useSWR from 'swr';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(r => r.json());

type Item = { id: string; label: string; birth_date: string; birth_place_name?: string | null };

export default function PeopleList() {
  const { data } = useSWR('/api/people', fetcher);
  const items: Item[] = data?.items || [];

  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <div className="text-sm text-gray-600">Nessuna persona salvata.</div>
      ) : (
        <ul className="space-y-1">
          {items.map(p => (
            <li key={p.id}>
              <Link
                href={`/dashboard/people/${p.id}`}
                className="flex items-center justify-between rounded border p-2 hover:bg-gray-50"
              >
                <div>
                  <div className="font-medium">{p.label}</div>
                  <div className="text-xs text-gray-500">
                    {p.birth_date}{p.birth_place_name ? ` • ${p.birth_place_name}` : ''}
                  </div>
                </div>
                <span className="text-gray-400">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
