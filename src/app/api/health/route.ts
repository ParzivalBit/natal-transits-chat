import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'


export const dynamic = 'force-dynamic'


export async function GET() {
try {
const { count, error } = await supabase
.from('interpretations')
.select('*', { count: 'exact', head: true })


if (error) throw error


return NextResponse.json({ ok: true, interpretationsCount: count ?? 0 })
} catch (err: unknown) {
const message = err instanceof Error ? err.message : 'Unexpected error';
return NextResponse.json({ ok: false, error: message }, { status: 500 });
}
}