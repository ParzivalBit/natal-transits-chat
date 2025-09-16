export default function Page() {
return (
<div className="grid gap-8">
<section className="text-center space-y-4">
<h1 className="text-4xl font-bold tracking-tight">Your AI astrologer, chart‑aware</h1>
<p className="text-gray-700 max-w-2xl mx-auto">
Calculate your natal chart (Whole Sign for MVP), get daily/weekly transits, and chat with an AI that knows your chart.
</p>
<div className="flex items-center justify-center gap-3">
<a
href="#"
className="rounded-xl bg-brand-600 text-white px-5 py-3 font-medium shadow hover:bg-brand-700"
>
Get started
</a>
<a
href="#"
className="rounded-xl border px-5 py-3 font-medium hover:bg-gray-50"
>
Pricing $7.99/m
</a>
</div>
</section>


<section className="grid md:grid-cols-3 gap-6">
<div className="rounded-2xl border p-5">
<h3 className="font-semibold mb-2">Chart‑aware Chat</h3>
<p className="text-sm text-gray-600">Ask about your transits. Get gentle, practical suggestions (2–3 micro‑actions).</p>
</div>
<div className="rounded-2xl border p-5">
<h3 className="font-semibold mb-2">Calendar Sync</h3>
<p className="text-sm text-gray-600">Optional iCal/Google Calendar events for key transits.</p>
</div>
<div className="rounded-2xl border p-5">
<h3 className="font-semibold mb-2">Transparent Settings</h3>
<p className="text-sm text-gray-600">Toggle orbs, house system, and educational notes.</p>
</div>
</section>
</div>
)
}