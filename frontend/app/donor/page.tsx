'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Crosshair, Leaf, MapPin, Plus, RefreshCw, Utensils } from 'lucide-react'

type Donation = {
  id: number
  food_name: string
  servings: number
  created_at: string
  expires_at: string
  status: string
}

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL 

async function api<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  })

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(body?.error || 'Request failed')
  }

  return body
}

function formatDate(value: string) {
  return new Date(value).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function timeLeft(expiresAt: string, now: number) {
  const ms = Math.max(
    0,
    new Date(expiresAt).getTime() - now
  )

  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(
    Math.floor((ms % 3600000) / 60000)
  ).padStart(2, '0')}:${String(
    Math.floor((ms % 60000) / 1000)
  ).padStart(2, '0')}`
}

export default function DonorDashboard() {
  const [donations, setDonations] = useState<Donation[]>([])

  const [location, setLocation] = useState<{
    latitude: number
    longitude: number
  } | null>(null)

  const [foodName, setFoodName] = useState('')
  const [servings, setServings] = useState('')

  const [createdAt, setCreatedAt] = useState(() =>
    new Date().toISOString().slice(0, 16)
  )

  const [now, setNow] = useState(Date.now())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const loadDonations = async () => {
    try {
      const result = await api<{ donations: Donation[] }>(
        '/api/donor/donations'
      )

      setDonations(result.donations)
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Unable to load donations'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDonations()

    const timer = window.setInterval(
      () => setNow(Date.now()),
      1000
    )

    return () => window.clearInterval(timer)
  }, [])

  /*
   * GET CURRENT LOCATION
   * AND SEND LATITUDE/LONGITUDE TO FLASK
   */
  const locate = () => {
    if (!navigator.geolocation) {
      setError(
        'Location is not supported by this browser.'
      )
      return
    }

    setError('')
    setNotice('Getting your current location...')

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude
        const longitude = position.coords.longitude

        // Display latitude and longitude immediately
        setLocation({
          latitude,
          longitude,
        })

        try {
          // Send location to Flask backend
          const result = await api<{
            location: {
              latitude: number
              longitude: number
            }
          }>('/api/donor/location', {
            method: 'PUT',
            body: JSON.stringify({
              latitude: latitude,
              longitude: longitude,
            }),
          })

          // Use location returned by backend
          setLocation(result.location)

          setNotice(
            `Location saved successfully: ${latitude.toFixed(
              6
            )}, ${longitude.toFixed(6)}`
          )
        } catch (e) {
          setError(
            e instanceof Error
              ? e.message
              : 'Unable to save location.'
          )
        }
      },
      (error) => {
        if (
          error.code ===
          error.PERMISSION_DENIED
        ) {
          setError(
            'Location permission was not granted.'
          )
        } else if (
          error.code ===
          error.POSITION_UNAVAILABLE
        ) {
          setError(
            'Your current location could not be determined.'
          )
        } else if (
          error.code === error.TIMEOUT
        ) {
          setError(
            'Location request timed out. Please try again.'
          )
        } else {
          setError(
            'Unable to get your location.'
          )
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }

  /*
   * CREATE DONATION
   */
  const createDonation = async (
    event: FormEvent
  ) => {
    event.preventDefault()

    if (
      !foodName.trim() ||
      Number(servings) <= 0
    ) {
      return
    }

    setSaving(true)
    setError('')

    try {
      const result = await api<{
        donation: Donation
      }>('/api/donor/donations', {
        method: 'POST',
        body: JSON.stringify({
          food_name: foodName.trim(),
          servings: Number(servings),
          created_at: new Date(
            createdAt
          ).toISOString(),
        }),
      })

      setDonations((current) => [
        result.donation,
        ...current,
      ])

      setFoodName('')
      setServings('')

      setNotice(
        'Donation listed for the next 2 hours.'
      )
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Unable to create donation'
      )
    } finally {
      setSaving(false)
    }
  }

  const history = useMemo(
    () =>
      donations.filter(
        (item) =>
          item.status === 'picked_up' ||
          item.status === 'expired'
      ),
    [donations]
  )

  const active = donations.filter(
    (item) =>
      item.status !== 'picked_up' &&
      item.status !== 'expired'
  )

  return (
    <main className="min-h-screen bg-[#fbf7ed] text-[#254638]">

      {/* HEADER */}
      <header className="border-b border-[#e3e8dd] bg-white px-5 py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-3">

          <div className="flex size-10 items-center justify-center rounded-xl bg-[#183b2f] text-[#c8df9c]">
            <Leaf className="size-5" />
          </div>

          <div>
            <p className="font-serif text-xl font-bold text-[#183b2f]">
              safeplate
            </p>

            <p className="text-[9px] font-bold uppercase tracking-[.2em] text-[#899985]">
              donor workspace
            </p>
          </div>

        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8">

        {/* PAGE HEADING */}
        <div className="mb-8">
          <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#7d977c]">
            Donor dashboard
          </p>

          <h1 className="font-serif text-4xl font-bold text-[#183b2f]">
            Make surplus matter.
          </h1>

          <p className="mt-2 text-sm text-[#718171]">
            Create a donation and keep its real status in sync
            with your backend.
          </p>
        </div>

        {/* NOTICE / ERROR */}
        {(notice || error) && (
          <div
            className={`mb-5 rounded-xl px-4 py-3 text-sm ${
              error
                ? 'bg-red-50 text-red-700'
                : 'bg-[#eef5df] text-[#557346]'
            }`}
          >
            {error || notice}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">

          {/* CREATE DONATION */}
          <form
            onSubmit={createDonation}
            className="rounded-3xl border border-[#dfe7d8] bg-white p-6"
          >
            <div className="mb-5 flex items-center gap-3">
              <Plus className="text-[#d9825b]" />

              <h2 className="font-serif text-2xl font-bold text-[#183b2f]">
                Create donation
              </h2>
            </div>

            <div className="flex flex-col gap-4">

              <label className="text-xs font-bold">
                Food name

                <input
                  required
                  value={foodName}
                  onChange={(e) =>
                    setFoodName(e.target.value)
                  }
                  className="mt-2 w-full rounded-xl border p-3 font-normal"
                  placeholder="Vegetable rice bowls"
                />
              </label>

              <label className="text-xs font-bold">
                Servings

                <input
                  required
                  min="1"
                  type="number"
                  value={servings}
                  onChange={(e) =>
                    setServings(e.target.value)
                  }
                  className="mt-2 w-full rounded-xl border p-3 font-normal"
                />
              </label>

              <label className="text-xs font-bold">
                Time of creation

                <input
                  required
                  type="datetime-local"
                  value={createdAt}
                  onChange={(e) =>
                    setCreatedAt(e.target.value)
                  }
                  className="mt-2 w-full rounded-xl border p-3 font-normal"
                />
              </label>

              <button
                disabled={saving}
                className="rounded-xl bg-[#183b2f] px-4 py-3 font-bold text-white disabled:opacity-50"
              >
                {saving
                  ? 'Saving donation...'
                  : 'List donation'}
              </button>

            </div>
          </form>

          {/* LOCATION */}
          <section className="rounded-3xl border border-[#dfe7d8] bg-white p-6">

            <div className="mb-5 flex items-center justify-between">

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#7d977c]">
                  Live donor location
                </p>

                <h2 className="font-serif text-2xl font-bold text-[#183b2f]">
                  Your pickup point
                </h2>
              </div>

              <button
                onClick={locate}
                className="rounded-xl border p-3"
                aria-label="Update location"
                type="button"
              >
                <Crosshair className="size-4" />
              </button>

            </div>

            {/* LOCATION DISPLAY */}
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl bg-[#e8eee0]">

              <MapPin className="size-12 text-[#d9825b]" />

              {location && (
                <div className="mt-4 text-center">

                  <p className="text-xs font-bold text-[#557346]">
                    Current location
                  </p>

                  <p className="mt-1 text-sm font-semibold text-[#183b2f]">
                    Latitude: {location.latitude.toFixed(6)}
                  </p>

                  <p className="text-sm font-semibold text-[#183b2f]">
                    Longitude: {location.longitude.toFixed(6)}
                  </p>

                </div>
              )}

            </div>

            {/* TURN ON LOCATION */}
            <button
              onClick={locate}
              type="button"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold"
            >
              <RefreshCw className="size-4" />

              {location
                ? 'Update location'
                : 'Turn on location'}
            </button>

            {/* COORDINATES */}
            <p className="mt-3 text-center text-xs text-[#899985]">
              {location
                ? `${location.latitude.toFixed(
                    6
                  )}, ${location.longitude.toFixed(6)}`
                : 'Location is currently off.'}
            </p>

          </section>

        </div>

        {/* ACTIVE DONATIONS */}
        <section className="mt-10">

          <h2 className="mb-4 font-serif text-2xl font-bold text-[#183b2f]">
            Active donations
          </h2>

          {loading ? (
            <p>Loading donations...</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">

              {active.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border bg-white p-5"
                >

                  <div className="flex items-center justify-between">

                    <Utensils className="text-[#557346]" />

                    <span className="rounded-full bg-[#eef5df] px-3 py-1 text-xs font-bold">
                      {item.status}
                    </span>

                  </div>

                  <h3 className="mt-4 font-bold">
                    {item.food_name}
                  </h3>

                  <p className="text-sm text-[#899985]">
                    {item.servings} servings ·{' '}
                    {formatDate(item.created_at)}
                  </p>

                  <p className="mt-4 font-mono text-xl font-bold text-[#d9825b]">
                    {timeLeft(
                      item.expires_at,
                      now
                    )}
                  </p>

                </article>
              ))}

            </div>
          )}

        </section>

        {/* DONATION HISTORY */}
        <section className="mt-10">

          <h2 className="mb-4 font-serif text-2xl font-bold text-[#183b2f]">
            Donation history
          </h2>

          <div className="rounded-2xl border bg-white">

            {history.length ? (
              history.map((item) => (
                <div
                  key={item.id}
                  className="border-b p-4 last:border-0"
                >

                  <p className="font-bold">
                    {item.food_name}
                  </p>

                  <p className="text-sm text-[#899985]">
                    {item.servings} servings ·{' '}
                    {formatDate(item.created_at)} ·{' '}
                    {item.status}
                  </p>

                </div>
              ))
            ) : (
              <p className="p-5 text-sm text-[#899985]">
                No completed donations yet.
              </p>
            )}

          </div>

        </section>

      </div>
    </main>
  )
}