// src/app/api/people/[id]/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerRouteClient } from '@/lib/supabaseServer';


function bad(msg: string, code = 400) { return NextResponse.json({ ok: false, error: msg }, { status: code }); }


export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
const supabase = createSupabaseServerRouteClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return bad('Unauthorized', 401);


const id = params.id;
const { data: person, error } = await supabase
.from('people')
.select('id,label,birth_date,birth_time,birth_place_name')
.eq('user_id', user.id)
.eq('id', id)
.single();
if (error) return bad(error.message, 404);


const { data: points } = await supabase
.from('people_chart_points')
.select('name,longitude,sign,house,retro')
.eq('person_id', id)
.order('name', { ascending: true });


return NextResponse.json({ ok: true, person, points: points ?? [] });
}