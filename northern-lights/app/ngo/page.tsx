'use client'

import { useCallback, useEffect, useState } from 'react'
import { Crosshair, Leaf, MapPin, RefreshCw, Search, Utensils } from 'lucide-react'

type Donation = { id: number; food_name: string; servings: number; created_at: string; expires_at: string; status: string; donor_name: string; distance_km: number; latitude: number; longitude: number }
type Location = { latitude: number; longitude: number }
const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:5000'

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error || 'Request failed')
  return body
}

function formatDate(value: string) { return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) }

export default function NgoDashboard() {
  const [donations, setDonations] = useState<Donation[]>([])
  const [location, setLocation] = useState<Location | null>(null)
  const [loading, setLoading] = useState(true)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadNearby = useCallback(async () => {
    setLoading(true); setError('')
    try { const result = await api<{ donations: Donation[]; location: Location }>('/api/ngo/nearby-food'); setDonations(result.donations); setLocation(result.location) }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load nearby donations.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadNearby() }, [loadNearby])

  const useLocation = () => {
    if (!navigator.geolocation) { setError('Location is not supported by this browser.'); return }
    setLocating(true); setError('')
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try { const result = await api<{ location: Location }>('/api/ngo/location', { method: 'PUT', body: JSON.stringify({ latitude: coords.latitude, longitude: coords.longitude }) }); setLocation(result.location); setNotice('Your NGO location was updated.'); await loadNearby() }
      catch (e) { setError(e instanceof Error ? e.message : 'Unable to update NGO location.') }
      finally { setLocating(false) }
    }, () => { setLocating(false); setError('Location permission was not granted.') })
  }

  return <main className="min-h-screen bg-[#fbf7ed] text-[#254638]"><header className="border-b border-[#e3e8dd] bg-white px-5 py-4"><div className="mx-auto flex max-w-6xl items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-[#183b2f] text-[#c8df9c]"><Leaf className="size-5" /></div><div><p className="font-serif text-xl font-bold text-[#183b2f]">safeplate</p><p className="text-[9px] font-bold uppercase tracking-[.2em] text-[#899985]">ngo workspace</p></div></div></header><div className="mx-auto max-w-6xl px-5 py-8"><div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#7d977c]">NGO dashboard</p><h1 className="font-serif text-4xl font-bold text-[#183b2f]">Food near your community.</h1><p className="mt-2 text-sm text-[#718171]">Live listings from donors within a 10 km radius of your registered location.</p></div><div className="flex gap-2"><button onClick={useLocation} disabled={locating} className="flex items-center gap-2 rounded-xl bg-[#183b2f] px-4 py-3 text-xs font-bold text-white disabled:opacity-60"><Crosshair className="size-4" />{locating ? 'Locating…' : 'Use my location'}</button><button onClick={() => void loadNearby()} className="flex items-center gap-2 rounded-xl border border-[#d6e1d2] bg-white px-4 py-3 text-xs font-bold text-[#315d45]"><RefreshCw className="size-4" />Refresh</button></div></div>{(notice || error) && <div className={`mb-5 rounded-xl px-4 py-3 text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-[#eef5df] text-[#557346]'}`}>{error || notice}</div>}<div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]"><section className="rounded-3xl border border-[#dfe7d8] bg-[#183b2f] p-6 text-white"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#c8df9c]">Your search area</p><h2 className="mt-2 font-serif text-3xl font-bold">10 km radius</h2></div><MapPin className="size-7 text-[#d9825b]" /></div><div className="relative mt-8 flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#214c3b]"><div className="absolute size-[78%] rounded-full border border-[#c8df9c]/30 bg-[#c8df9c]/10" /><div className="absolute size-[48%] rounded-full border border-[#c8df9c]/40 bg-[#c8df9c]/10" /><div className="relative flex size-12 items-center justify-center rounded-full bg-[#d9825b] text-[#183b2f] shadow-xl"><MapPin className="size-5" /></div>{location && <p className="absolute bottom-3 left-3 rounded-lg bg-black/20 px-2 py-1 text-[10px] text-[#dcebd7]">{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</p>}</div><p className="mt-4 text-xs leading-5 text-[#b7cabe]">Location is sent securely to SafePlate to calculate nearby listings. Turn on location to refresh your search area.</p></section><section><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#7d977c]">Available now</p><h2 className="font-serif text-2xl font-bold text-[#183b2f]">Nearby donations</h2></div><span className="rounded-full bg-[#dcebd7] px-3 py-1 text-xs font-bold text-[#4f7654]">{donations.length} listings</span></div>{loading ? <div className="rounded-2xl border border-[#dfe7d8] bg-white p-8 text-sm text-[#718171]">Loading nearby food listings…</div> : donations.length === 0 ? <div className="rounded-2xl border border-dashed border-[#cbdac7] bg-white p-10 text-center"><Search className="mx-auto size-8 text-[#9caf99]" /><p className="mt-3 font-serif text-xl font-bold text-[#183b2f]">No active listings nearby</p><p className="mt-1 text-sm text-[#718171]">Try refreshing after donors add new surplus food.</p></div> : <div className="flex flex-col gap-3">{donations.map((donation) => <article key={donation.id} className="rounded-2xl border border-[#dfe7d8] bg-white p-5"><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-[#eef5df] text-[#557346]"><Utensils className="size-5" /></div><div><h3 className="font-serif text-lg font-bold text-[#183b2f]">{donation.food_name}</h3><p className="text-xs text-[#718171]">{donation.donor_name} · {donation.distance_km} km away</p></div></div><span className="rounded-full bg-[#eef5df] px-2.5 py-1 text-[10px] font-bold text-[#557346]">{donation.status}</span></div><div className="mt-4 flex items-center justify-between border-t border-[#edf0e9] pt-3 text-xs text-[#718171]"><span>{donation.servings} servings</span><span>Listed {formatDate(donation.created_at)}</span></div></article>)}</div>}</section></div></div></main>
}
