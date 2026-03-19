import React, { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import './index.css'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

if (L && L.Icon && L.Icon.Default) {
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
  })
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

const T = {
  bg: '#f4f1e9',
  bgGrad: 'linear-gradient(160deg, #edf1ee 0%, #f3efe7 48%, #eee7dc 100%)',
  card: '#ffffff',
  cardBorder: 'rgba(0,0,0,0.07)',
  ink: '#111111',
  inkMid: '#5e5e5e',
  inkMuted: '#929292',
  blue: '#2a6dd9',
  blueLight: '#4a8ff0',
  bluePale: '#eaf2ff',
  sand: '#eee8de',
  sand2: '#e4ddd1',
  sand3: '#d8d0c3',
  sage: '#dcead0',
  sagePale: '#eef6e9',
  sageDeep: '#416432',
  warm: '#e68448',
  warmPale: '#fff1e7',
  danger: '#c63b22',
  dangerPale: '#fff2ee',
  success: '#1f7e49',
  border: 'rgba(0,0,0,0.08)',
  borderMid: 'rgba(0,0,0,0.12)',
  shadow: '0 8px 30px rgba(0,0,0,0.06)',
  shadowMd: '0 14px 38px rgba(0,0,0,0.10)',
  shadowLg: '0 22px 70px rgba(0,0,0,0.14)',
  radius: '16px',
  radiusLg: '26px',
  radiusXl: '34px',
  pill: '999px',
  ffBlack: "'Sora', 'Unbounded', sans-serif",
  ff: "'DM Sans', sans-serif",
}

const TRIP_COLORS = ['#2a6dd9', '#c8d44a', '#e87a3e', '#3a5c28', '#7a3ab5', '#cc2200']
const MAP_COLORS = ['#2a6dd9', '#e87a3e', '#3a8aaa', '#c8d44a', '#7a3ab5', '#cc4422']
const VIBES = ['all', 'beach + nightlife', 'culture + food', 'culture + slow travel', 'city break', 'adventure']
const REACTION_OPTIONS = ['🔥', '😍', '✈️', '🤍', '👏', '😭']

function pickMapColor() {
  return MAP_COLORS[Math.floor(Math.random() * MAP_COLORS.length)]
}

function cleanMoney(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = parseFloat(String(value).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function safeNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function normalizeDuration(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 1
}

function formatShortDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function avatarInitials(name) {
  return String(name || '').trim().slice(0, 2).toUpperCase() || 'RV'
}

function avatarBg(name) {
  const bgs = [T.bluePale, T.sagePale, T.warmPale, '#f0eafc']
  const txts = [T.blue, T.sageDeep, T.warm, '#6a2ab5']
  let h = 0
  for (let i = 0; i < String(name || '').length; i += 1) {
    h = String(name).charCodeAt(i) + ((h << 5) - h)
  }
  return { bg: bgs[Math.abs(h) % bgs.length], txt: txts[Math.abs(h) % txts.length] }
}

let mapsPromise = null
function loadGoogleMaps() {
  if (typeof window !== 'undefined' && window.google?.maps?.places) return Promise.resolve(window.google)
  if (!GOOGLE_MAPS_API_KEY) return Promise.reject(new Error('Missing VITE_GOOGLE_MAPS_API_KEY'))
  if (mapsPromise) return mapsPromise

  mapsPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('google-maps-script')
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google))
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps')))
      return
    }

    const script = document.createElement('script')
    script.id = 'google-maps-script'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&loading=async&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => resolve(window.google)
    script.onerror = () => reject(new Error('Failed to load Google Maps'))
    document.head.appendChild(script)
  })

  return mapsPromise
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: '3px solid rgba(0,0,0,0.08)',
          borderTopColor: T.ink,
          animation: 'spin .7s linear infinite',
        }}
      />
    </div>
  )
}

function ErrBanner({ msg, onClose }) {
  if (!msg) return null
  return (
    <div
      style={{
        background: T.dangerPale,
        border: '1px solid rgba(198,59,34,0.16)',
        borderRadius: T.radius,
        padding: '12px 16px',
        fontSize: 13,
        color: T.danger,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        gap: 12,
      }}
    >
      <span>{msg}</span>
      {onClose ? (
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: T.danger,
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
            padding: 0,
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  )
}

function Avatar({ name, size = 36 }) {
  const c = avatarBg(name)
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: c.bg,
        color: c.txt,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.3,
        fontWeight: 800,
        fontFamily: T.ffBlack,
        flexShrink: 0,
        letterSpacing: '-0.01em',
      }}
    >
      {avatarInitials(name)}
    </div>
  )
}

function IconBadge({ emoji, bg, size = 56 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: bg || T.bluePale,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.44,
        flexShrink: 0,
      }}
    >
      {emoji}
    </div>
  )
}

function DisplayHeading({ black, blue, size = 'xl', center = false }) {
  const fontSizes = {
    xl: 'clamp(32px, 5vw, 58px)',
    lg: 'clamp(24px, 3.5vw, 42px)',
    md: 'clamp(20px, 2.5vw, 32px)',
    sm: '20px',
  }
  const fs = fontSizes[size] || fontSizes.xl
  const lineH = size === 'xl' ? 1.0 : 1.05

  return (
    <div style={{ textAlign: center ? 'center' : 'left', lineHeight: lineH }}>
      {black ? (
        <span
          style={{
            fontFamily: T.ffBlack,
            color: T.ink,
            fontSize: fs,
            fontWeight: 900,
            letterSpacing: '-0.04em',
            lineHeight: lineH,
          }}
        >
          {black}{' '}
        </span>
      ) : null}
      {blue ? (
        <span
          style={{
            fontFamily: T.ffBlack,
            color: T.blue,
            fontSize: fs,
            fontWeight: 300,
            fontStyle: 'italic',
            letterSpacing: '-0.03em',
            lineHeight: lineH,
          }}
        >
          {blue}
        </span>
      ) : null}
    </div>
  )
}

function Btn({ children, variant = 'primary', size = 'md', onClick, disabled, style: extra = {}, type = 'button' }) {
  const base = {
    borderRadius: T.pill,
    fontFamily: T.ff,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all .15s',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    whiteSpace: 'nowrap',
    outline: 'none',
  }

  const sizes = {
    sm: { padding: '9px 16px', fontSize: 13 },
    md: { padding: '13px 22px', fontSize: 14 },
    lg: { padding: '16px 30px', fontSize: 15 },
  }

  const variants = {
    primary: { background: T.ink, color: '#fff', border: 'none' },
    secondary: { background: T.card, color: T.ink, border: `1.5px solid ${T.borderMid}` },
    ghost: { background: 'transparent', color: T.inkMid, border: `1.5px solid ${T.border}` },
    blue: { background: T.blue, color: '#fff', border: 'none' },
    danger: { background: T.dangerPale, color: T.danger, border: '1px solid rgba(198,59,34,0.14)' },
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{ ...base, ...(sizes[size] || sizes.md), ...(variants[variant] || variants.primary), ...extra }}
    >
      {children}
    </button>
  )
}

function Card({ children, style: extra = {}, onClick, className }) {
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        background: T.card,
        border: `1px solid ${T.cardBorder}`,
        borderRadius: T.radiusLg,
        boxShadow: T.shadow,
        overflow: 'hidden',
        ...extra,
        cursor: onClick ? 'pointer' : undefined,
      }}
    >
      {children}
    </div>
  )
}

function Chip({ children, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? T.ink : T.card,
        color: active ? '#fff' : T.inkMid,
        border: active ? `1px solid ${T.ink}` : `1.5px solid ${T.borderMid}`,
        borderRadius: T.pill,
        padding: '8px 16px',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: T.ff,
        transition: 'all .15s',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

function Badge({ children, variant = 'default' }) {
  const variants = {
    default: { bg: T.sand2, c: T.inkMid },
    blue: { bg: T.bluePale, c: T.blue },
    sage: { bg: T.sagePale, c: T.sageDeep },
    warm: { bg: T.warmPale, c: T.warm },
  }
  const s = variants[variant] || variants.default

  return (
    <span
      style={{
        background: s.bg,
        color: s.c,
        borderRadius: T.pill,
        padding: '4px 10px',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.04em',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

function RoveLogo({ size = 'md' }) {
  const sz = { sm: 18, md: 26, lg: 38 }[size] || 26
  return (
    <span
      style={{
        fontFamily: T.ffBlack,
        fontWeight: 900,
        fontSize: sz,
        letterSpacing: '-0.04em',
        lineHeight: 1,
        userSelect: 'none',
      }}
    >
      <span style={{ color: T.ink }}>R</span>
      <span style={{ color: T.blue, fontStyle: 'italic', fontWeight: 300 }}>o</span>
      <span style={{ color: T.ink }}>ve</span>
    </span>
  )
}

function ScreenHeader({ title, subtitle, onBack, right }) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        background: 'rgba(244,241,233,0.94)',
        backdropFilter: 'blur(18px)',
        borderBottom: `1px solid ${T.cardBorder}`,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      {onBack ? (
        <button
          onClick={onBack}
          style={{
            border: `1px solid ${T.border}`,
            background: T.card,
            borderRadius: 14,
            padding: '10px 12px',
            fontSize: 16,
            cursor: 'pointer',
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          ←
        </button>
      ) : null}

      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontFamily: T.ffBlack,
            fontSize: 18,
            fontWeight: 900,
            color: T.ink,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 3, fontWeight: 300 }}>
            {subtitle}
          </div>
        ) : null}
      </div>

      {right ? <div style={{ flexShrink: 0 }}>{right}</div> : null}
    </div>
  )
}

function PlaceInput({ value, onChange, onPlaceSelected, placeholder, style: extra = {} }) {
  const ref = useRef(null)

  useEffect(() => {
    let mounted = true

    loadGoogleMaps()
      .then(() => {
        if (!mounted || !ref.current || !window.google?.maps?.places) return
        const ac = new window.google.maps.places.Autocomplete(ref.current, {
          fields: ['name', 'formatted_address', 'geometry', 'place_id'],
          types: ['establishment'],
        })

        ac.addListener('place_changed', () => {
          const p = ac.getPlace()
          const lat = p?.geometry?.location ? p.geometry.location.lat() : null
          const lng = p?.geometry?.location ? p.geometry.location.lng() : null
          onPlaceSelected({
            name: p?.name || ref.current.value || '',
            address: p?.formatted_address || '',
            lat,
            lng,
            placeId: p?.place_id || '',
          })
        })
      })
      .catch(() => {})

    return () => {
      mounted = false
    }
  }, [onPlaceSelected])

  return (
    <input
      ref={ref}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoComplete="off"
      style={{ ...css.input, ...extra }}
    />
  )
}

function ReactionPicker({ selectedEmoji, counts = {}, onChoose }) {
  const [open, setOpen] = useState(false)
  const total = Object.values(counts || {}).reduce((sum, n) => sum + n, 0)

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: selectedEmoji ? T.bluePale : T.sand2,
          border: `1px solid ${selectedEmoji ? 'rgba(42,109,217,0.2)' : T.border}`,
          borderRadius: T.pill,
          padding: '6px 12px',
          fontSize: 12,
          fontWeight: 700,
          color: selectedEmoji ? T.blue : T.inkMid,
          cursor: 'pointer',
        }}
      >
        <span>{selectedEmoji || '🙂'}</span>
        <span>+</span>
        <span>{total}</span>
      </button>

      {open ? (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            zIndex: 30,
            background: T.card,
            border: `1px solid ${T.cardBorder}`,
            boxShadow: T.shadowMd,
            borderRadius: 16,
            padding: 8,
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            minWidth: 180,
          }}
        >
          {REACTION_OPTIONS.map(emoji => (
            <button
              key={emoji}
              onClick={() => {
                onChoose(emoji)
                setOpen(false)
              }}
              style={{
                border: 'none',
                background: selectedEmoji === emoji ? T.bluePale : T.sand,
                borderRadius: 12,
                padding: '8px 10px',
                fontSize: 18,
                cursor: 'pointer',
              }}
            >
              {emoji}
            </button>
          ))}

          {selectedEmoji ? (
            <button
              onClick={() => {
                onChoose(selectedEmoji)
                setOpen(false)
              }}
              style={{
                width: '100%',
                border: 'none',
                background: T.dangerPale,
                color: T.danger,
                borderRadius: 12,
                padding: '8px 10px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Remove reaction
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function RoveMap({ trips, savedPlaces, mapVisibleKey, mapFocusId }) {
  const mapRef = useRef(null)
  const mapInst = useRef(null)
  const markers = useRef([])
  const lastFit = useRef('')

  useEffect(() => {
    if (mapInst.current || !mapRef.current) return
    const map = L.map(mapRef.current, { center: [20, 10], zoom: 2, zoomControl: false })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: 'CARTO',
      maxZoom: 19,
    }).addTo(map)
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    mapInst.current = map
  }, [])

  useEffect(() => {
    const m = mapInst.current
    if (!m) return
    const t = setTimeout(() => m.invalidateSize(), 150)
    return () => clearTimeout(t)
  }, [mapVisibleKey])

  useEffect(() => {
    const map = mapInst.current
    if (!map) return

    markers.current.forEach(m => m.remove())
    markers.current = []

    const visible = mapFocusId ? trips.filter(t => t.id === mapFocusId) : trips
    const pts = []

    visible.forEach((trip, ti) => {
      const col = trip.map_color || TRIP_COLORS[ti % TRIP_COLORS.length]
      ;(trip.days || []).forEach(day => {
        ;(day.activities || []).forEach(act => {
          const lat = Number(act.lat)
          const lng = Number(act.lng)
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

          const isSaved = savedPlaces.some(f => f.activity_id === act.id)
          const sz = isSaved ? 18 : 14

          const icon = L.divIcon({
            html: `<div style="width:${sz}px;height:${sz}px;background:${isSaved ? T.blue : col};border:2.5px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,0.18)"></div>`,
            className: '',
            iconAnchor: [sz / 2, sz],
            popupAnchor: [0, -sz],
          })

          const popup = `<div style="min-width:200px;font-family:${T.ff};padding:4px"><div style="font-size:11px;color:${T.inkMuted};margin-bottom:5px">${trip.title || 'Trip'} · Day ${day.day}</div><div style="font-size:18px;font-weight:800;color:${T.ink};margin-bottom:5px">${act.name || 'Place'}</div><div style="font-size:12px;color:${T.inkMid}">${act.note || ''}</div></div>`

          const mk = L.marker([lat, lng], { icon }).addTo(map)
          mk.bindPopup(popup, { closeButton: true, autoPan: true, maxWidth: 260 })
          mk.on('click', () => {
            map.setView([lat, lng], Math.max(map.getZoom(), 14))
            mk.openPopup()
          })

          pts.push([lat, lng])
          markers.current.push(mk)
        })
      })
    })

    const sig = JSON.stringify({ pts, mapFocusId })
    const t = setTimeout(() => {
      map.invalidateSize()
      if (sig !== lastFit.current) {
        lastFit.current = sig
        if (pts.length === 1) map.setView(pts[0], 13)
        else if (pts.length > 1) map.fitBounds(pts, { padding: [60, 60], maxZoom: 13 })
        else map.setView([20, 10], 2)
      }
    }, 150)

    return () => clearTimeout(t)
  }, [trips, savedPlaces, mapFocusId, mapVisibleKey])

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
}

function AuthScreen() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const submit = async () => {
    setError('')
    setInfo('')

    if (!email || !pass) {
      setError('Please fill in all fields.')
      return
    }
    if (mode === 'signup' && !username.trim()) {
      setError('Please choose a username.')
      return
    }
    if (pass.length < 6) {
      setError('Password needs at least 6 characters.')
      return
    }

    setLoading(true)

    if (mode === 'signup') {
      const { error: err } = await supabase.auth.signUp({
        email,
        password: pass,
        options: { data: { full_name: name, username } },
      })
      if (err) setError(err.message)
      else setInfo('Account created! Check your inbox if email confirmation is on.')
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password: pass })
      if (err) setError(err.message)
    }

    setLoading(false)
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: T.bgGrad,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: T.ff,
      }}
    >
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <RoveLogo size="lg" />
        <p style={{ margin: '12px 0 0', fontSize: 15, color: T.inkMuted, fontStyle: 'italic', fontFamily: T.ff, fontWeight: 300 }}>
          take the trip out of the group chat
        </p>
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: T.card,
          borderRadius: T.radiusXl,
          padding: '28px 20px 24px',
          boxShadow: T.shadowLg,
        }}
      >
        <div style={{ display: 'flex', background: T.sand, borderRadius: T.pill, padding: 4, marginBottom: 24, gap: 4 }}>
          {['login', 'signup'].map(m => (
            <button
              key={m}
              onClick={() => {
                setMode(m)
                setError('')
                setInfo('')
              }}
              style={{
                flex: 1,
                padding: '13px 0',
                border: 'none',
                borderRadius: T.pill,
                background: mode === m ? T.ink : 'transparent',
                color: mode === m ? '#fff' : T.inkMid,
                fontFamily: T.ffBlack,
                fontSize: 13,
                fontWeight: 900,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all .2s',
              }}
            >
              {m === 'login' ? 'Log in' : 'Sign up'}
            </button>
          ))}
        </div>

        <ErrBanner msg={error} onClose={() => setError('')} />

        {info ? (
          <div
            style={{
              background: T.bluePale,
              border: '1px solid rgba(42,109,217,0.2)',
              borderRadius: T.radius,
              padding: '12px 16px',
              fontSize: 13,
              color: T.blue,
              marginBottom: 16,
            }}
          >
            {info}
          </div>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {mode === 'signup' ? (
            <>
              <div>
                <label style={css.label}>FULL NAME</label>
                <input style={css.inputBlue} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
              </div>

              <div>
                <label style={css.label}>USERNAME</label>
                <input
                  style={css.inputBlue}
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="choose_a_username"
                />
              </div>
            </>
          ) : null}

          <div>
            <label style={css.label}>EMAIL</label>
            <input
              style={css.inputBlue}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              onKeyDown={e => e.key === 'Enter' && submit()}
            />
          </div>

          <div>
            <label style={css.label}>PASSWORD</label>
            <input
              style={css.inputBlue}
              type="password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              placeholder="at least 6 characters"
              onKeyDown={e => e.key === 'Enter' && submit()}
            />
          </div>

          <button
            onClick={submit}
            disabled={loading}
            style={{
              width: '100%',
              padding: '17px',
              marginTop: 4,
              background: T.ink,
              color: '#fff',
              border: 'none',
              borderRadius: T.pill,
              fontFamily: T.ff,
              fontSize: 16,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'all .15s',
            }}
          >
            {loading ? '…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return <div style={{ minHeight: '100dvh', background: T.bgGrad }} />
  if (!session) return <AuthScreen />
  return <RoveApp session={session} />
}

function RoveApp({ session }) {
  const userId = session.user.id

  const [tab, setTab] = useState('feed')
  const [feedTab, setFeedTab] = useState('explore')
  const [activeVibe, setActiveVibe] = useState('all')
  const [feedSearch, setFeedSearch] = useState('')
  const [myTripSearch, setMyTripSearch] = useState('')

  const [posts, setPosts] = useState([])
  const [postAuthors, setPostAuthors] = useState({})
  const [postLikeCounts, setPostLikeCounts] = useState({})
  const [likedPostIds, setLikedPostIds] = useState({})
  const [savedPostIds, setSavedPostIds] = useState({})
  const [postReactionCounts, setPostReactionCounts] = useState({})
  const [myReactionsByPost, setMyReactionsByPost] = useState({})
  const [commentsByPost, setCommentsByPost] = useState({})
  const [openCommentsByPost, setOpenCommentsByPost] = useState({})
  const [commentDraftByPost, setCommentDraftByPost] = useState({})
  const [adoptLoadingByPost, setAdoptLoadingByPost] = useState({})
  const [previewTrip, setPreviewTrip] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const [profile, setProfile] = useState(null)
  const [friendCount, setFriendCount] = useState(0)
  const [myTrips, setMyTrips] = useState([])
  const [tripPlans, setTripPlans] = useState({})
  const [tripImportItemsByTrip, setTripImportItemsByTrip] = useState({})
  const [savedPlaces, setSavedPlaces] = useState([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [loadingTrips, setLoadingTrips] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [mapFocusId, setMapFocusId] = useState(null)

  const [tripMembers, setTripMembers] = useState({})
  const [showInviteBoxByTrip, setShowInviteBoxByTrip] = useState({})
  const [friendSearchByTrip, setFriendSearchByTrip] = useState({})
  const [inviteLoadingByTrip, setInviteLoadingByTrip] = useState({})
  const [friendSuggestionsByTrip, setFriendSuggestionsByTrip] = useState({})
  const [friendsByTrip, setFriendsByTrip] = useState({})

  const [shareModalTripId, setShareModalTripId] = useState(null)
  const [shareVisibilityDraft, setShareVisibilityDraft] = useState('friends')
  const [shareCaptionDraft, setShareCaptionDraft] = useState('')
  const [shareSubmitting, setShareSubmitting] = useState(false)

  const [importUrl, setImportUrl] = useState('')
  const [importNotes, setImportNotes] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [importStatusMsg, setImportStatusMsg] = useState('')

  const [openMyTripId, setOpenMyTripId] = useState(null)
  const [myTripsScreen, setMyTripsScreen] = useState('list')

  const saveTimeoutRef = useRef({})
  const mapVisibleKey = tab === 'map' ? `map-${mapFocusId || 'all'}` : 'hidden'

  const plannerTripsForMap = useMemo(() => {
    return myTrips.map(trip => {
      const plan = tripPlans[trip.id]
      if (!plan) return { ...trip, days: [] }

      return {
        ...trip,
        days: plan.days.map(day => ({
          day: day.day,
          title: day.title || '',
          activities: (day.items || [])
            .filter(i => Number.isFinite(Number(i.lat)) && Number.isFinite(Number(i.lng)))
            .map(i => ({
              id: i.id,
              name: i.name || 'Place',
              note: i.note || '',
              lat: Number(i.lat),
              lng: Number(i.lng),
              spend: i.spend || '',
            })),
        })),
      }
    })
  }, [myTrips, tripPlans])

  const filteredPosts = useMemo(() => {
    let n = posts

    if (feedTab === 'explore') n = n.filter(p => (p.visibility || 'private') === 'public')
    else n = n.filter(p => (p.visibility || 'private') === 'friends')

    if (activeVibe !== 'all') {
      n = n.filter(p => (p.vibe || '').toLowerCase() === activeVibe.toLowerCase())
    }

    const q = feedSearch.trim().toLowerCase()
    if (q) {
      n = n.filter(p =>
        [
          p.title,
          p.city,
          p.country,
          p.caption,
          p.vibe,
          p.budget,
          p.tips,
          p.source_url,
          p.source_title,
          p.source_platform,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      )
    }

    return n
  }, [posts, feedTab, activeVibe, feedSearch])

  const filteredMyTrips = useMemo(() => {
    const q = myTripSearch.trim().toLowerCase()
    if (!q) return myTrips

    return myTrips.filter(trip => {
      const plan = tripPlans[trip.id]
      const imported = tripImportItemsByTrip[trip.id] || []

      const dayText = (plan?.days || [])
        .flatMap(day => [
          day.title,
          ...(day.items || []).flatMap(item => [item.name, item.note, item.category]),
        ])
        .filter(Boolean)
        .join(' ')

      const importText = imported
        .flatMap(item => [item.title, item.description, item.location_name, item.address, item.item_type])
        .filter(Boolean)
        .join(' ')

      const haystack = [
        trip.title,
        trip.city,
        trip.country,
        trip.caption,
        trip.vibe,
        trip.budget,
        trip.source_url,
        trip.source_title,
        trip.source_platform,
        dayText,
        importText,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(q)
    })
  }, [myTrips, tripPlans, tripImportItemsByTrip, myTripSearch])

  const adoptedCount = useMemo(() => myTrips.filter(t => !!t.adopted_from_post_id).length, [myTrips])
  const importedCount = useMemo(() => myTrips.filter(t => !!t.source_url).length, [myTrips])
  const savedCount = useMemo(() => Object.values(savedPostIds).filter(Boolean).length, [savedPostIds])

  const openTrip = myTrips.find(t => t.id === openMyTripId) || null
  const openPlan = openTrip ? tripPlans[openTrip.id] : null
  const openImportedItems = openTrip ? tripImportItemsByTrip[openTrip.id] || [] : []
  const openTripMembers = openTrip ? tripMembers[openTrip.id] || [] : []
  const openFriendSuggestions = openTrip ? friendSuggestionsByTrip[openTrip.id] || [] : []
  const isOwner = openTrip ? openTrip.author_id === userId : false

  useEffect(() => {
    loadPosts()
    loadMyTrips()
    loadSavedPlaces()
    loadProfile()
    loadFriendCount()
  }, [])

  useEffect(() => {
    if (tab !== 'mytrips') return
    if (!openMyTripId && myTrips.length) setOpenMyTripId(myTrips[0].id)
  }, [tab, myTrips, openMyTripId])

  function goToMyTripsList() {
    setMyTripsScreen('list')
  }

  function openTripHome(tripId) {
    setOpenMyTripId(tripId)
    setMyTripsScreen('tripHome')
    setTab('mytrips')
  }

  function queueTripSave(tripId) {
    if (saveTimeoutRef.current[tripId]) clearTimeout(saveTimeoutRef.current[tripId])
    saveTimeoutRef.current[tripId] = setTimeout(async () => {
      await saveEntireTripPlan(tripId)
    }, 700)
  }

  function makeEmptyPlan() {
    const ts = Date.now()
    const dk = `day-${ts}`
    const ik = `item-${ts}`

    return {
      id: null,
      groupBudget: '',
      days: [
        {
          id: dk,
          clientKey: dk,
          day: 1,
          title: '',
          items: [
            {
              id: ik,
              clientKey: ik,
              category: 'Restaurant',
              name: '',
              note: '',
              url: '',
              timeText: '',
              spend: '',
              lat: null,
              lng: null,
            },
          ],
        },
      ],
    }
  }

  function normalizeImportItem(row, index = 0) {
    return {
      id: row.id || `import-${Date.now()}-${index}`,
      item_type: row.item_type || 'place',
      title: row.title || '',
      description: row.description || '',
      location_name: row.location_name || '',
      address: row.address || '',
      lat: row.lat ?? null,
      lng: row.lng ?? null,
      day_number: row.day_number ?? null,
      sort_order: row.sort_order ?? index,
      source_confidence: row.source_confidence ?? null,
    }
  }

  async function loadProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile(data || null)
  }

  async function loadFriendCount() {
    const { data } = await supabase.from('friendships').select('friend_id').eq('user_id', userId).eq('status', 'accepted')
    setFriendCount((data || []).length)
  }

  async function loadPosts() {
    setLoadingPosts(true)

    const [{ data: all, error: e1 }, { data: fr }] = await Promise.all([
      supabase.from('posts').select('*').order('created_at', { ascending: false }),
      supabase.from('friendships').select('friend_id').eq('user_id', userId).eq('status', 'accepted'),
    ])

    if (e1) {
      setErrorMsg(e1.message)
      setLoadingPosts(false)
      return
    }

    const fids = new Set((fr || []).map(r => r.friend_id))
    const visible = (all || []).filter(p => {
      const v = p.visibility || 'private'
      if (v === 'private') return false
      if (v === 'public') return true
      if (v === 'friends') return p.author_id === userId || fids.has(p.author_id)
      return false
    })

    setPosts(visible)
    await loadSocialData(visible)
    setLoadingPosts(false)
  }

  async function loadSocialData(visible) {
    const pids = visible.map(p => p.id)
    const aids = [...new Set([...visible.map(p => p.author_id).filter(Boolean), userId])]
    if (!pids.length) return

    const [{ data: profiles }, { data: likes }, { data: saves }, { data: reactions }, { data: comments }] = await Promise.all([
      supabase.from('profiles').select('id,username,full_name,avatar_url').in('id', aids),
      supabase.from('post_likes').select('post_id,user_id').in('post_id', pids),
      supabase.from('post_saves').select('post_id,user_id').in('post_id', pids),
      supabase.from('post_reactions').select('post_id,user_id,emoji').in('post_id', pids),
      supabase.from('post_comments').select('id,post_id,user_id,body,created_at').in('post_id', pids).order('created_at', { ascending: true }),
    ])

    const authorMap = {}
    ;(profiles || []).forEach(r => {
      authorMap[r.id] = r
    })
    setPostAuthors(authorMap)

    const likeCounts = {}
    const likeMine = {}
    ;(likes || []).forEach(r => {
      likeCounts[r.post_id] = (likeCounts[r.post_id] || 0) + 1
      if (r.user_id === userId) likeMine[r.post_id] = true
    })
    setPostLikeCounts(likeCounts)
    setLikedPostIds(likeMine)

    const saveMine = {}
    ;(saves || []).forEach(r => {
      if (r.user_id === userId) saveMine[r.post_id] = true
    })
    setSavedPostIds(saveMine)

    const reactionCounts = {}
    const reactionMine = {}
    ;(reactions || []).forEach(r => {
      if (!reactionCounts[r.post_id]) reactionCounts[r.post_id] = {}
      reactionCounts[r.post_id][r.emoji] = (reactionCounts[r.post_id][r.emoji] || 0) + 1
      if (r.user_id === userId) reactionMine[r.post_id] = r.emoji
    })
    setPostReactionCounts(reactionCounts)
    setMyReactionsByPost(reactionMine)

    const cuids = [...new Set((comments || []).map(c => c.user_id).filter(Boolean))]
    let cprof = []
    if (cuids.length) {
      const { data: cp } = await supabase.from('profiles').select('id,username,full_name').in('id', cuids)
      cprof = cp || []
    }

    const cpm = new Map(cprof.map(r => [r.id, r]))
    const cm = {}
    ;(comments || []).forEach(r => {
      if (!cm[r.post_id]) cm[r.post_id] = []
      const pr = cpm.get(r.user_id)
      cm[r.post_id].push({
        ...r,
        username: pr?.username || '',
        fullName: pr?.full_name || '',
      })
    })
    setCommentsByPost(cm)
  }

  async function loadTripImportItems(tripId) {
    const { data, error } = await supabase
      .from('trip_import_items')
      .select('*')
      .eq('trip_id', tripId)
      .order('sort_order', { ascending: true })

    if (error) {
      setErrorMsg(error.message)
      return
    }

    setTripImportItemsByTrip(prev => ({
      ...prev,
      [tripId]: (data || []).map((row, index) => normalizeImportItem(row, index)),
    }))
  }

  async function loadMyTrips() {
    setLoadingTrips(true)

    const { data: own, error: e1 } = await supabase.from('posts').select('*').eq('author_id', userId).order('created_at', { ascending: false })
    if (e1) {
      setErrorMsg(e1.message)
      setLoadingTrips(false)
      return
    }

    const { data: mrows } = await supabase.from('trip_members').select('trip_id').eq('user_id', userId)
    const mids = (mrows || []).map(r => r.trip_id)

    let invited = []
    if (mids.length) {
      const { data } = await supabase.from('posts').select('*').in('id', mids).order('created_at', { ascending: false })
      invited = data || []
    }

    const map = new Map()
    ;[...(own || []), ...invited].forEach(t => map.set(t.id, t))

    const trips = Array.from(map.values()).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    setMyTrips(trips)

    if (trips.length > 0) {
      setOpenMyTripId(prev => prev || trips[0].id)
      await Promise.all(
        trips.map(async t => {
          await Promise.all([
            loadTripPlan(t.id),
            loadTripMembers(t.id),
            loadAcceptedFriends(t.id),
            loadTripImportItems(t.id),
          ])
        })
      )
    }

    setLoadingTrips(false)
  }

  async function loadSavedPlaces() {
    const a = await supabase.from('saved_places').select('*').eq('user_id', userId)
    if (!a.error) {
      setSavedPlaces(a.data || [])
      return
    }

    const b = await supabase.from('fav_places').select('*').eq('user_id', userId)
    if (!b.error) setSavedPlaces(b.data || [])
  }

  async function loadTripPlan(tripId) {
    const { data: plan } = await supabase.from('trip_plans').select('*').eq('post_id', tripId).eq('user_id', userId).maybeSingle()

    if (!plan) {
      setTripPlans(p => ({ ...p, [tripId]: p[tripId] || makeEmptyPlan() }))
      return
    }

    const { data: dayRows } = await supabase.from('trip_plan_days').select('*').eq('plan_id', plan.id).order('position', { ascending: true })

    const days = []
    for (const day of dayRows || []) {
      const { data: items } = await supabase.from('trip_plan_items').select('*').eq('plan_day_id', day.id).order('position', { ascending: true })
      days.push({
        id: day.id,
        clientKey: day.client_key,
        day: day.day_number,
        title: day.caption || '',
        items: (items || []).map(i => ({
          id: i.id,
          clientKey: i.client_key,
          category: i.category || 'Restaurant',
          name: i.name || '',
          note: i.location || '',
          url: i.url || '',
          timeText: i.time_text || '',
          spend: i.spend != null ? String(i.spend) : '',
          lat: i.lat,
          lng: i.lng,
        })),
      })
    }

    setTripPlans(p => ({
      ...p,
      [tripId]: {
        id: plan.id,
        groupBudget: plan.group_budget != null ? String(plan.group_budget) : '',
        days: days.length ? days : makeEmptyPlan().days,
      },
    }))
  }

  async function loadTripMembers(tripId) {
    const { data: rows } = await supabase.from('trip_members').select('id,role,user_id').eq('trip_id', tripId).order('created_at', { ascending: true })
    const uids = (rows || []).map(r => r.user_id)

    let profs = []
    if (uids.length) {
      const { data } = await supabase.from('profiles').select('id,username,full_name').in('id', uids)
      profs = data || []
    }

    const pm = new Map(profs.map(r => [r.id, r]))
    setTripMembers(p => ({
      ...p,
      [tripId]: (rows || []).map(r => ({
        id: r.id,
        role: r.role,
        userId: r.user_id,
        username: pm.get(r.user_id)?.username || '',
        fullName: pm.get(r.user_id)?.full_name || '',
      })),
    }))
  }

  async function loadAcceptedFriends(tripId) {
    const { data: fr } = await supabase.from('friendships').select('friend_id').eq('user_id', userId).eq('status', 'accepted')
    const fids = (fr || []).map(r => r.friend_id)

    if (!fids.length) {
      setFriendsByTrip(p => ({ ...p, [tripId]: [] }))
      return
    }

    const { data: profs } = await supabase.from('profiles').select('id,username,full_name').in('id', fids).order('username', { ascending: true })
    setFriendsByTrip(p => ({ ...p, [tripId]: profs || [] }))
  }

  async function toggleLike(postId) {
    const liked = !!likedPostIds[postId]
    if (liked) {
      const { error } = await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId)
      if (error) {
        setErrorMsg(error.message)
        return
      }

      setLikedPostIds(p => ({ ...p, [postId]: false }))
      setPostLikeCounts(p => ({ ...p, [postId]: Math.max((p[postId] || 1) - 1, 0) }))
    } else {
      const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: userId })
      if (error) {
        setErrorMsg(error.message)
        return
      }

      setLikedPostIds(p => ({ ...p, [postId]: true }))
      setPostLikeCounts(p => ({ ...p, [postId]: (p[postId] || 0) + 1 }))
    }
  }

  async function toggleSavePost(postId) {
    const saved = !!savedPostIds[postId]
    if (saved) {
      const { error } = await supabase.from('post_saves').delete().eq('post_id', postId).eq('user_id', userId)
      if (error) {
        setErrorMsg(error.message)
        return
      }
      setSavedPostIds(p => ({ ...p, [postId]: false }))
    } else {
      const { error } = await supabase.from('post_saves').insert({ post_id: postId, user_id: userId })
      if (error) {
        setErrorMsg(error.message)
        return
      }
      setSavedPostIds(p => ({ ...p, [postId]: true }))
    }
  }

  async function setReaction(postId, emoji) {
    const ex = myReactionsByPost[postId] || null

    if (ex === emoji) {
      const { error } = await supabase.from('post_reactions').delete().eq('post_id', postId).eq('user_id', userId)
      if (error) {
        setErrorMsg(error.message)
        return
      }

      setMyReactionsByPost(p => ({ ...p, [postId]: null }))
      setPostReactionCounts(p => {
        const n = { ...p }
        const pc = { ...(n[postId] || {}) }
        pc[emoji] = Math.max((pc[emoji] || 1) - 1, 0)
        n[postId] = pc
        return n
      })
      return
    }

    if (ex) {
      const { error: deleteError } = await supabase.from('post_reactions').delete().eq('post_id', postId).eq('user_id', userId)
      if (deleteError) {
        setErrorMsg(deleteError.message)
        return
      }
    }

    const { error: insertError } = await supabase.from('post_reactions').insert({ post_id: postId, user_id: userId, emoji })
    if (insertError) {
      setErrorMsg(insertError.message)
      return
    }

    setMyReactionsByPost(p => ({ ...p, [postId]: emoji }))
    setPostReactionCounts(p => {
      const n = { ...p }
      const pc = { ...(n[postId] || {}) }
      if (ex) pc[ex] = Math.max((pc[ex] || 1) - 1, 0)
      pc[emoji] = (pc[emoji] || 0) + 1
      n[postId] = pc
      return n
    })
  }

  async function addComment(postId) {
    const draft = String(commentDraftByPost[postId] || '').trim()
    if (!draft) return

    const { data, error } = await supabase.from('post_comments').insert({ post_id: postId, user_id: userId, body: draft }).select().single()
    if (error) {
      setErrorMsg(error.message)
      return
    }

    const me = postAuthors[userId] || {}
    setCommentsByPost(p => ({
      ...p,
      [postId]: [...(p[postId] || []), { ...data, username: me.username || 'you', fullName: me.full_name || '' }],
    }))
    setCommentDraftByPost(p => ({ ...p, [postId]: '' }))
  }

  async function deleteComment(cId, postId) {
    const { error } = await supabase.from('post_comments').delete().eq('id', cId).eq('user_id', userId)
    if (error) {
      setErrorMsg(error.message)
      return
    }
    setCommentsByPost(p => ({ ...p, [postId]: (p[postId] || []).filter(c => c.id !== cId) }))
  }

  async function openPreview(post) {
    setPreviewLoading(true)
    setPreviewTrip(null)

    const { data: plan } = await supabase.from('trip_plans').select('*').eq('post_id', post.id).order('created_at', { ascending: true }).limit(1).maybeSingle()

    let days = []
    if (plan) {
      const { data: dr } = await supabase.from('trip_plan_days').select('*').eq('plan_id', plan.id).order('position', { ascending: true })
      days = await Promise.all(
        (dr || []).map(async day => {
          const { data: items } = await supabase.from('trip_plan_items').select('*').eq('plan_day_id', day.id).order('position', { ascending: true })
          return {
            id: day.id,
            day: day.day_number,
            title: day.caption || '',
            items: (items || []).map(i => ({
              id: i.id,
              category: i.category || '',
              name: i.name || '',
              note: i.location || '',
              url: i.url || '',
              timeText: i.time_text || '',
              spend: i.spend != null ? String(i.spend) : '',
              lat: i.lat,
              lng: i.lng,
            })),
          }
        })
      )
    }

    const imported = tripImportItemsByTrip[post.id] || []

    setPreviewTrip({
      ...post,
      groupBudget: plan?.group_budget != null ? String(plan.group_budget) : '',
      days,
      importedItems: imported,
    })
    setPreviewLoading(false)
  }

  function updatePlan(id, patch) {
    setTripPlans(p => {
      const pl = p[id]
      if (!pl) return p
      return { ...p, [id]: { ...pl, ...patch } }
    })
    queueTripSave(id)
  }

  function updateDay(id, di, patch) {
    setTripPlans(p => {
      const pl = p[id]
      if (!pl) return p
      const ds = [...pl.days]
      ds[di] = { ...ds[di], ...patch }
      return { ...p, [id]: { ...pl, days: ds } }
    })
    queueTripSave(id)
  }

  function updateItem(id, di, ii, patch) {
    setTripPlans(p => {
      const pl = p[id]
      if (!pl) return p
      const ds = [...pl.days]
      const d = { ...ds[di] }
      const its = [...d.items]
      its[ii] = { ...its[ii], ...patch }
      d.items = its
      ds[di] = d
      return { ...p, [id]: { ...pl, days: ds } }
    })
    queueTripSave(id)
  }

  function addItem(id, di, seed = null) {
    setTripPlans(p => {
      const pl = p[id]
      if (!pl) return p
      const ds = [...pl.days]
      const d = { ...ds[di] }
      const k = `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      d.items = [
        ...d.items,
        {
          id: k,
          clientKey: k,
          category: seed?.category || seed?.item_type || 'Restaurant',
          name: seed?.name || seed?.title || seed?.location_name || '',
          note: seed?.note || seed?.description || seed?.address || '',
          url: seed?.url || '',
          timeText: seed?.timeText || '',
          spend: seed?.spend || '',
          lat: seed?.lat ?? null,
          lng: seed?.lng ?? null,
        },
      ]
      ds[di] = d
      return { ...p, [id]: { ...pl, days: ds } }
    })
    queueTripSave(id)
  }

  function removeItem(id, di, ii) {
    setTripPlans(p => {
      const pl = p[id]
      if (!pl) return p
      const ds = [...pl.days]
      const d = { ...ds[di] }
      if (d.items.length === 1) return p
      d.items = d.items.filter((_, i) => i !== ii)
      ds[di] = d
      return { ...p, [id]: { ...pl, days: ds } }
    })
    queueTripSave(id)
  }

  function addDay(id, seedDay = null) {
    setTripPlans(p => {
      const pl = p[id]
      if (!pl) return p
      const n = pl.days.length + 1
      const dk = `day-${Date.now()}-${n}`
      const ik = `item-${Date.now()}-${n}`

      const seedItems = (seedDay?.items || []).length
        ? seedDay.items.map((seed, index) => ({
            id: `${ik}-${index}`,
            clientKey: `${ik}-${index}`,
            category: seed.category || seed.item_type || 'Restaurant',
            name: seed.name || seed.title || seed.location_name || '',
            note: seed.note || seed.description || seed.address || '',
            url: seed.url || '',
            timeText: seed.timeText || '',
            spend: seed.spend || '',
            lat: seed.lat ?? null,
            lng: seed.lng ?? null,
          }))
        : [
            {
              id: ik,
              clientKey: ik,
              category: 'Restaurant',
              name: '',
              note: '',
              url: '',
              timeText: '',
              spend: '',
              lat: null,
              lng: null,
            },
          ]

      return {
        ...p,
        [id]: {
          ...pl,
          days: [
            ...pl.days,
            {
              id: dk,
              clientKey: dk,
              day: n,
              title: seedDay?.title || '',
              items: seedItems,
            },
          ],
        },
      }
    })
    queueTripSave(id)
  }

  function removeDay(id, dayIndex) {
    setTripPlans(prev => {
      const plan = prev[id]
      if (!plan) return prev
      if ((plan.days || []).length <= 1) return prev

      const nextDays = plan.days
        .filter((_, i) => i !== dayIndex)
        .map((day, idx) => ({
          ...day,
          day: idx + 1,
        }))

      return {
        ...prev,
        [id]: {
          ...plan,
          days: nextDays,
        },
      }
    })

    queueTripSave(id)
  }
    async function geocodeIfNeeded(id, di, ii) {
    const item = tripPlans[id]?.days?.[di]?.items?.[ii]
    if (!item || (Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)))) return

    const q = [item.name, item.note].filter(Boolean).join(', ')
    if (!q.trim()) return

    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`)
    if (!r.ok) return

    const d = await r.json()
    if (d?.length) {
      updateItem(id, di, ii, { lat: Number(d[0].lat), lng: Number(d[0].lon) })
    }
  }

  async function ensurePlanRow(id) {
    const cur = tripPlans[id]
    if (cur?.id && !String(cur.id).startsWith('day-')) return cur.id

    const { data, error } = await supabase
      .from('trip_plans')
      .insert({
        user_id: userId,
        post_id: id,
        group_budget: cur?.groupBudget === '' ? null : Number(cur?.groupBudget || 0),
      })
      .select()
      .single()

    if (error) {
      setErrorMsg(error.message)
      return null
    }

    setTripPlans(p => ({ ...p, [id]: { ...p[id], id: data.id } }))
    return data.id
  }

  async function saveEntireTripPlan(id) {
    const plan = tripPlans[id]
    if (!plan) return

    const planId = await ensurePlanRow(id)
    if (!planId) return

    await supabase
      .from('trip_plans')
      .update({
        group_budget: plan.groupBudget === '' ? null : Number(plan.groupBudget),
      })
      .eq('id', planId)

    const { data: ed } = await supabase.from('trip_plan_days').select('id,client_key').eq('plan_id', planId)
    const edm = new Map((ed || []).map(d => [d.client_key, d]))
    const savedDayIds = []

    for (let di = 0; di < plan.days.length; di += 1) {
      const day = plan.days[di]
      const dp = {
        plan_id: planId,
        client_key: day.clientKey || day.id,
        day_number: day.day,
        caption: day.title || '',
        position: di,
      }

      const ex = edm.get(dp.client_key)
      let savedDay = null

      if (ex) {
        const { data } = await supabase.from('trip_plan_days').update(dp).eq('id', ex.id).select().single()
        savedDay = data
      } else {
        const { data } = await supabase.from('trip_plan_days').insert(dp).select().single()
        savedDay = data
      }

      if (!savedDay) continue
      savedDayIds.push(savedDay.id)

      const { data: ei } = await supabase.from('trip_plan_items').select('id,client_key').eq('plan_day_id', savedDay.id)
      const eim = new Map((ei || []).map(i => [i.client_key, i]))
      const savedItemIds = []

      for (let ii = 0; ii < day.items.length; ii += 1) {
        const item = day.items[ii]
        const ip = {
          plan_day_id: savedDay.id,
          client_key: item.clientKey || item.id,
          category: item.category || 'Restaurant',
          name: item.name || '',
          location: item.note || '',
          url: item.url || '',
          time_text: item.timeText || '',
          spend: item.spend === '' ? null : Number(item.spend),
          lat: item.lat,
          lng: item.lng,
          position: ii,
        }

        const eii = eim.get(ip.client_key)
        let savedItem = null

        if (eii) {
          const { data } = await supabase.from('trip_plan_items').update(ip).eq('id', eii.id).select().single()
          savedItem = data
        } else {
          const { data } = await supabase.from('trip_plan_items').insert(ip).select().single()
          savedItem = data
        }

        if (savedItem) savedItemIds.push(savedItem.id)
      }

      const deleteItems = (ei || []).map(r => r.id).filter(i => !savedItemIds.includes(i))
      if (deleteItems.length) {
        await supabase.from('trip_plan_items').delete().in('id', deleteItems)
      }
    }

    const deleteDays = (ed || []).map(r => r.id).filter(i => !savedDayIds.includes(i))
    if (deleteDays.length) {
      await supabase.from('trip_plan_days').delete().in('id', deleteDays)
    }
  }

  async function createTrip() {
    const { data, error } = await supabase
      .from('posts')
      .insert({
        author_id: userId,
        title: 'New Trip',
        city: '',
        country: '',
        duration: 1,
        vibe: 'city break',
        caption: '',
        tips: '',
        budget: '$$',
        visibility: 'private',
        map_color: pickMapColor(),
        cover_img: null,
        source_platform: null,
        source_url: null,
        source_title: null,
        source_thumbnail_url: null,
        import_status: null,
        import_raw: null,
        imported_by: null,
      })
      .select()
      .single()

    if (error) {
      setErrorMsg(error.message)
      return
    }

    setMyTrips(p => [data, ...p])
    setTripPlans(p => ({ ...p, [data.id]: makeEmptyPlan() }))
    setTripMembers(p => ({ ...p, [data.id]: [] }))
    setTripImportItemsByTrip(p => ({ ...p, [data.id]: [] }))
    setOpenMyTripId(data.id)
    setTab('mytrips')
    setMyTripsScreen('tripHome')
    await loadAcceptedFriends(data.id)
    await loadPosts()
  }

  async function importTripFromUrl() {
    const trimmedUrl = String(importUrl || '').trim()
    if (!trimmedUrl) {
      setErrorMsg('Paste a TikTok, Instagram, blog, or travel URL first.')
      return
    }

    setImportLoading(true)
    setImportStatusMsg('Reading the link and building your trip...')
    setErrorMsg('')

    try {
      const { data, error } = await supabase.functions.invoke('import-social-trip', {
        body: {
          url: trimmedUrl,
          notes: String(importNotes || '').trim(),
        },
      })

      console.log('FUNCTION RESPONSE:', data)
      console.log('FUNCTION ERROR:', error)

      if (error) throw error
      if (!data?.trip?.id) throw new Error('Import did not return a trip.')

      const tripId = data.trip.id

      setImportStatusMsg('Trip imported. Opening your draft...')
      setImportUrl('')
      setImportNotes('')

      await loadMyTrips()
      await loadPosts()

      setOpenMyTripId(tripId)
      setTab('mytrips')
      setMyTripsScreen('tripHome')

      if (data.items?.length) {
        setTripImportItemsByTrip(prev => ({
          ...prev,
          [tripId]: data.items.map((row, index) => normalizeImportItem(row, index)),
        }))
      } else {
        await loadTripImportItems(tripId)
      }

      if (data.plan_seed?.days?.length) {
        const seedBase = Date.now()
        const seededPlan = {
          id: null,
          groupBudget: data.plan_seed.groupBudget ? String(data.plan_seed.groupBudget) : '',
          days: data.plan_seed.days.map((day, di) => ({
            id: `seed-day-${seedBase}-${di}`,
            clientKey: `seed-day-${seedBase}-${di}`,
            day: di + 1,
            title: day.title || '',
            items: (day.items || []).length
              ? day.items.map((item, ii) => ({
                  id: `seed-item-${seedBase}-${di}-${ii}`,
                  clientKey: `seed-item-${seedBase}-${di}-${ii}`,
                  category: item.category || item.item_type || 'Restaurant',
                  name: item.name || item.title || item.location_name || '',
                  note: item.note || item.description || item.address || '',
                  url: item.url || '',
                  timeText: item.timeText || '',
                  spend: item.spend ? String(item.spend) : '',
                  lat: item.lat ?? null,
                  lng: item.lng ?? null,
                }))
              : [
                  {
                    id: `seed-item-${seedBase}-${di}-0`,
                    clientKey: `seed-item-${seedBase}-${di}-0`,
                    category: 'Restaurant',
                    name: '',
                    note: '',
                    url: '',
                    timeText: '',
                    spend: '',
                    lat: null,
                    lng: null,
                  },
                ],
          })),
        }

        setTripPlans(prev => ({
          ...prev,
          [tripId]: seededPlan,
        }))

        setTimeout(async () => {
          await saveEntireTripPlan(tripId)
        }, 150)
      }

      setImportStatusMsg('Done.')
      setTimeout(() => setImportStatusMsg(''), 3000)
    } catch (err) {
      console.error('Import error:', err)

      const message =
        err?.message ||
        err?.context?.json?.error ||
        err?.context?.error ||
        'Import failed.'

      setErrorMsg(message)
      setImportStatusMsg('')
    } finally {
      setImportLoading(false)
    }
  }

  async function deleteTrip(tripId) {
    const trip = myTrips.find(t => t.id === tripId)
    const own = trip?.author_id === userId

    if (!window.confirm(own ? 'Delete this trip?' : 'Leave this trip?')) return

    if (!own) {
      await supabase.from('trip_members').delete().eq('trip_id', tripId).eq('user_id', userId)

      const remainingTrips = myTrips.filter(t => t.id !== tripId)

      setMyTrips(remainingTrips)
      setTripPlans(p => {
        const n = { ...p }
        delete n[tripId]
        return n
      })
      setTripMembers(p => {
        const n = { ...p }
        delete n[tripId]
        return n
      })
      setTripImportItemsByTrip(p => {
        const n = { ...p }
        delete n[tripId]
        return n
      })

      if (openMyTripId === tripId) {
        const next = remainingTrips[0]?.id || null
        setOpenMyTripId(next)
        setMyTripsScreen(next ? 'tripHome' : 'list')
      }

      await loadPosts()
      return
    }

    const plan = tripPlans[tripId]
    if (plan?.id && !String(plan.id).startsWith('day-')) {
      const { data: dr } = await supabase.from('trip_plan_days').select('id').eq('plan_id', plan.id)
      const dids = (dr || []).map(d => d.id)

      if (dids.length) {
        await supabase.from('trip_plan_items').delete().in('plan_day_id', dids)
        await supabase.from('trip_plan_days').delete().in('id', dids)
      }

      await supabase.from('trip_plans').delete().eq('id', plan.id)
    }

    await supabase.from('trip_import_items').delete().eq('trip_id', tripId)
    await supabase.from('trip_members').delete().eq('trip_id', tripId)
    await supabase.from('posts').delete().eq('id', tripId)

    const remainingTrips = myTrips.filter(t => t.id !== tripId)

    setMyTrips(remainingTrips)
    setTripPlans(p => {
      const n = { ...p }
      delete n[tripId]
      return n
    })
    setTripMembers(p => {
      const n = { ...p }
      delete n[tripId]
      return n
    })
    setTripImportItemsByTrip(p => {
      const n = { ...p }
      delete n[tripId]
      return n
    })

    if (mapFocusId === tripId) setMapFocusId(null)
    if (openMyTripId === tripId) {
      const next = remainingTrips[0]?.id || null
      setOpenMyTripId(next)
      setMyTripsScreen(next ? 'tripHome' : 'list')
    }

    await loadPosts()
  }

  async function uploadPhoto(file, tripId) {
    if (!file || !tripId) return

    const ext = file.name?.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${userId}/${tripId}/${Date.now()}.${ext}`

    const { error: ue } = await supabase.storage.from('trip-photos').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

    if (ue) {
      setErrorMsg(ue.message)
      return
    }

    const { data } = supabase.storage.from('trip-photos').getPublicUrl(path)
    if (!data?.publicUrl) return

    await supabase.from('posts').update({ cover_img: data.publicUrl }).eq('id', tripId)
    setMyTrips(p => p.map(t => (t.id === tripId ? { ...t, cover_img: data.publicUrl } : t)))
    await loadPosts()
  }

  function openShareComposer(tripId, vis) {
    if (vis === 'private') {
      updateVisibility(tripId, 'private')
      return
    }

    const trip = myTrips.find(t => t.id === tripId)
    if (!trip) return

    setShareModalTripId(tripId)
    setShareVisibilityDraft(vis)
    setShareCaptionDraft(trip.caption || '')
  }

  async function submitShare() {
    if (!shareModalTripId) return

    const caption = String(shareCaptionDraft || '').trim()
    if (!caption) {
      setErrorMsg('Please add a caption.')
      return
    }

    setShareSubmitting(true)

    setMyTrips(p =>
      p.map(t =>
        t.id === shareModalTripId
          ? { ...t, visibility: shareVisibilityDraft, caption }
          : t
      )
    )

    await supabase
      .from('posts')
      .update({ visibility: shareVisibilityDraft, caption })
      .eq('id', shareModalTripId)

    setShareSubmitting(false)
    await loadPosts()
    setShareModalTripId(null)
    setShareCaptionDraft('')
  }

  async function updateVisibility(tripId, vis) {
    const trip = myTrips.find(t => t.id === tripId)
    if (!trip || trip.author_id !== userId) return

    setMyTrips(p => p.map(t => (t.id === tripId ? { ...t, visibility: vis } : t)))
    await supabase.from('posts').update({ visibility: vis }).eq('id', tripId)
    await loadPosts()
  }

  async function adoptTrip(srcId) {
    setAdoptLoadingByPost(p => ({ ...p, [srcId]: true }))

    const src = posts.find(p => p.id === srcId)
    if (!src) {
      setAdoptLoadingByPost(p => ({ ...p, [srcId]: false }))
      return
    }

    const { data: np, error: ie } = await supabase
      .from('posts')
      .insert({
        author_id: userId,
        title: src.title || src.city || 'Untitled',
        city: src.city || '',
        country: src.country || '',
        duration: src.duration || 1,
        vibe: src.vibe || 'city break',
        caption: src.caption || '',
        tips: src.tips || '',
        budget: src.budget || '$$',
        cover_img: src.cover_img || null,
        visibility: 'private',
        adopted_from_post_id: srcId,
        map_color: pickMapColor(),
        source_platform: src.source_platform || null,
        source_url: src.source_url || null,
        source_title: src.source_title || null,
        source_thumbnail_url: src.source_thumbnail_url || null,
        import_status: src.import_status || null,
        import_raw: src.import_raw || null,
        imported_by: src.imported_by || null,
      })
      .select()
      .single()

    if (ie) {
      setErrorMsg(ie.message)
      setAdoptLoadingByPost(p => ({ ...p, [srcId]: false }))
      return
    }

    const imported = tripImportItemsByTrip[srcId] || []
    if (imported.length) {
      const payload = imported.map((item, index) => ({
        trip_id: np.id,
        item_type: item.item_type || 'place',
        title: item.title || '',
        description: item.description || '',
        location_name: item.location_name || '',
        address: item.address || '',
        lat: item.lat,
        lng: item.lng,
        day_number: item.day_number,
        sort_order: index,
        source_confidence: item.source_confidence,
      }))

      await supabase.from('trip_import_items').insert(payload)
    }

    const { data: plan } = await supabase
      .from('trip_plans')
      .select('*')
      .eq('post_id', srcId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (plan) {
      const { data: newPlan } = await supabase
        .from('trip_plans')
        .insert({
          user_id: userId,
          post_id: np.id,
          group_budget: plan.group_budget,
        })
        .select()
        .single()

      const { data: srcDays } = await supabase
        .from('trip_plan_days')
        .select('*')
        .eq('plan_id', plan.id)
        .order('position', { ascending: true })

      for (const sd of srcDays || []) {
        const { data: nd } = await supabase
          .from('trip_plan_days')
          .insert({
            plan_id: newPlan.id,
            client_key: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            day_number: sd.day_number,
            caption: sd.caption || '',
            position: sd.position || 0,
          })
          .select()
          .single()

        const { data: si } = await supabase
          .from('trip_plan_items')
          .select('*')
          .eq('plan_day_id', sd.id)
          .order('position', { ascending: true })

        if ((si || []).length) {
          await supabase.from('trip_plan_items').insert(
            (si || []).map(i => ({
              plan_day_id: nd.id,
              client_key: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              category: i.category || 'Restaurant',
              name: i.name || '',
              location: i.location || '',
              url: i.url || '',
              time_text: i.time_text || '',
              spend: i.spend,
              lat: i.lat,
              lng: i.lng,
              position: i.position || 0,
            }))
          )
        }
      }
    }

    await loadMyTrips()
    await loadPosts()
    setOpenMyTripId(np.id)
    setMyTripsScreen('tripHome')
    setMapFocusId(np.id)
    setTab('mytrips')
    setAdoptLoadingByPost(p => ({ ...p, [srcId]: false }))
  }

  function openInviteBox(id) {
    const next = !showInviteBoxByTrip[id]
    setShowInviteBoxByTrip(p => ({ ...p, [id]: next }))
    if (next) {
      setFriendSuggestionsByTrip(p => ({ ...p, [id]: friendsByTrip[id] || [] }))
    }
  }

  function updateFriendSearch(id, val) {
    setFriendSearchByTrip(p => ({ ...p, [id]: val }))

    const q = String(val || '').trim().replace(/^@+/, '').toLowerCase()
    const all = friendsByTrip[id] || []
    const currentMembers = new Set((tripMembers[id] || []).map(m => m.userId))

    const filtered = all.filter(
      f =>
        !currentMembers.has(f.id) &&
        (
          String(f.username || '').toLowerCase().includes(q) ||
          String(f.full_name || '').toLowerCase().includes(q)
        )
    )

    setFriendSuggestionsByTrip(p => ({ ...p, [id]: q ? filtered.slice(0, 6) : [] }))
  }

  async function inviteMember(id, raw) {
    const cleaned = String(raw || '').trim().replace(/^@+/, '').toLowerCase()
    if (!cleaned) return

    setInviteLoadingByTrip(p => ({ ...p, [id]: true }))

    const friend = (friendsByTrip[id] || []).find(
      f => String(f.username || '').toLowerCase() === cleaned
    )

    if (!friend) {
      setErrorMsg('Only accepted friends can be invited.')
      setInviteLoadingByTrip(p => ({ ...p, [id]: false }))
      return
    }

    const { error } = await supabase.from('trip_members').insert({
      trip_id: id,
      user_id: friend.id,
      role: 'editor',
      invited_by: userId,
    })

    if (error) {
      setErrorMsg(error.code === '23505' ? 'Already on this trip.' : error.message)
      setInviteLoadingByTrip(p => ({ ...p, [id]: false }))
      return
    }

    setFriendSearchByTrip(p => ({ ...p, [id]: '' }))
    setFriendSuggestionsByTrip(p => ({ ...p, [id]: [] }))

    await loadTripMembers(id)
    await loadAcceptedFriends(id)
    setInviteLoadingByTrip(p => ({ ...p, [id]: false }))
  }

  async function removeMember(id, rowId) {
    const { error } = await supabase.from('trip_members').delete().eq('id', rowId)
    if (error) {
      setErrorMsg(error.message)
      return
    }
    await loadTripMembers(id)
  }

  function getTripSpent(plan) {
    if (!plan?.days) return 0
    let total = 0
    plan.days.forEach(d => {
      ;(d.items || []).forEach(i => {
        const v = parseFloat(String(i.spend || '').replace(/[^0-9.-]/g, ''))
        if (!Number.isNaN(v)) total += v
      })
    })
    return total
  }

  function getTripRemaining(plan) {
    const b = parseFloat(String(plan?.groupBudget || '').replace(/[^0-9.-]/g, ''))
    const s = getTripSpent(plan)
    if (Number.isNaN(b)) return 0
    return b - s
  }

  function updateTripField(tripId, key, value) {
    setMyTrips(p => p.map(t => (t.id === tripId ? { ...t, [key]: value } : t)))
  }

  async function persistTripField(tripId, key, value) {
    const { error } = await supabase.from('posts').update({ [key]: value }).eq('id', tripId)
    if (error) {
      setErrorMsg(error.message)
      return
    }
    if (
      key === 'title' ||
      key === 'caption' ||
      key === 'visibility' ||
      key === 'city' ||
      key === 'country' ||
      key === 'duration' ||
      key === 'vibe' ||
      key === 'budget'
    ) {
      await loadPosts()
    }
  }

  function addImportedItemToPlanner(tripId, importItem) {
    const currentPlan = tripPlans[tripId] || makeEmptyPlan()
    const dayNumber = Number(importItem.day_number)

    setTripPlans(prev => {
      const plan = prev[tripId] || currentPlan
      const nextDays = [...(plan.days || [])]

      let targetIndex = Number.isFinite(dayNumber) && dayNumber > 0 ? dayNumber - 1 : 0

      while (nextDays.length <= targetIndex) {
        const n = nextDays.length + 1
        const base = `${Date.now()}-${n}`
        nextDays.push({
          id: `day-${base}`,
          clientKey: `day-${base}`,
          day: n,
          title: '',
          items: [
            {
              id: `item-${base}`,
              clientKey: `item-${base}`,
              category: 'Restaurant',
              name: '',
              note: '',
              url: '',
              timeText: '',
              spend: '',
              lat: null,
              lng: null,
            },
          ],
        })
      }

      const day = { ...nextDays[targetIndex] }
      const cleanItems = (day.items || []).filter(item => item.name || item.note || item.url || item.timeText || item.spend)
      const k = `import-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      cleanItems.push({
        id: k,
        clientKey: k,
        category: importItem.item_type || 'Restaurant',
        name: importItem.title || importItem.location_name || '',
        note: importItem.description || importItem.address || '',
        url: '',
        timeText: '',
        spend: '',
        lat: importItem.lat ?? null,
        lng: importItem.lng ?? null,
      })
      day.items = cleanItems
      nextDays[targetIndex] = day

      return {
        ...prev,
        [tripId]: {
          ...plan,
          days: nextDays.map((d, index) => ({ ...d, day: index + 1 })),
        },
      }
    })

    queueTripSave(tripId)
  }

  const NAV = [
    ['feed', 'Explore'],
    ['map', 'Map'],
    ['mytrips', 'My Trips'],
    ['profile', 'Profile'],
  ]
    return (
    <div
      style={{
        minHeight: '100dvh',
        background: T.bgGrad,
        fontFamily: T.ff,
        color: T.ink,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800;900&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300;1,9..40,400&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
        html, body, #root { margin: 0; padding: 0; width: 100%; min-height: 100%; }
        body { overflow-x: hidden; }
        input, select, textarea, button { font-family: inherit; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.sand3}; border-radius: 999px; }
        input:focus, select:focus, textarea:focus {
          outline: none;
          border-color: ${T.blue} !important;
          box-shadow: 0 0 0 3px rgba(42,109,217,0.10);
        }
        .nav-item:hover { background: ${T.card} !important; color: ${T.ink} !important; }
        .card-lift:hover { transform: translateY(-4px); box-shadow: ${T.shadowMd} !important; }
        .trip-hero-card:hover { transform: translateY(-3px); box-shadow: ${T.shadowMd} !important; }
        .invite-row:hover { background: ${T.sand} !important; }

        @media (max-width: 768px) {
          .desktop-top-stats { display: none !important; }
        }
      `}</style>

      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            background: 'rgba(244,241,233,0.92)',
            backdropFilter: 'blur(20px)',
            borderBottom: `1px solid ${T.cardBorder}`,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <RoveLogo size="md" />

          <div className="desktop-top-stats" style={{ display: 'flex', gap: 8, marginLeft: 'auto', marginRight: 8, flexWrap: 'wrap' }}>
            {[
              { l: 'Trips', v: myTrips.length },
              { l: 'Imported', v: importedCount },
              { l: 'Adopted', v: adoptedCount },
              { l: 'Saved', v: savedCount },
            ].map(({ l, v }) => (
              <div
                key={l}
                style={{
                  background: T.card,
                  border: `1px solid ${T.cardBorder}`,
                  borderRadius: T.pill,
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 11, color: T.inkMuted, fontWeight: 500 }}>{l}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: T.ink, fontFamily: T.ffBlack }}>{v}</span>
              </div>
            ))}
          </div>

          <Btn variant="primary" size="sm" onClick={createTrip}>
            + New trip
          </Btn>
        </header>

        <main
          style={{
            flex: 1,
            width: '100%',
            maxWidth: 900,
            margin: '0 auto',
            padding: '16px 14px 90px',
            animation: 'fadeIn .4s ease both',
          }}
        >
          {tab === 'feed' && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: T.sage,
                    color: T.sageDeep,
                    padding: '7px 16px',
                    borderRadius: T.pill,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    marginBottom: 16,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.sageDeep, display: 'inline-block' }} />
                  {feedTab === 'explore' ? 'Community itineraries' : "Buddies' trips"}
                </div>

                <DisplayHeading
                  black={feedTab === 'explore' ? 'Take the trip out of' : 'See where your'}
                  blue={feedTab === 'explore' ? 'the group chat.' : 'buddies are going.'}
                  size="lg"
                />

                <p style={{ fontSize: 14, color: T.inkMid, maxWidth: 520, lineHeight: 1.7, margin: '12px 0 0', fontWeight: 300 }}>
                  {feedTab === 'explore'
                    ? 'Browse public itineraries, save ideas, react, comment, and adopt trips into your planner.'
                    : 'Trips shared by your friends — still social, just a little more personal.'}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: T.pill, padding: 4, gap: 4 }}>
                    {['explore', 'buddies'].map(ft => (
                      <button
                        key={ft}
                        onClick={() => setFeedTab(ft)}
                        style={{
                          padding: '9px 16px',
                          border: 'none',
                          borderRadius: T.pill,
                          background: feedTab === ft ? T.ink : 'transparent',
                          color: feedTab === ft ? '#fff' : T.inkMid,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all .15s',
                        }}
                      >
                        {ft === 'explore' ? 'Explore' : 'Buddies'}
                      </button>
                    ))}
                  </div>

                  <input
                    value={feedSearch}
                    onChange={e => setFeedSearch(e.target.value)}
                    placeholder="Search city, vibe, title, source…"
                    style={{ ...css.input, borderRadius: T.pill, padding: '10px 16px', flex: 1, minWidth: 0 }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', overflowX: 'auto', paddingBottom: 4 }}>
                  {VIBES.map(v => (
                    <Chip key={v} active={activeVibe === v} onClick={() => setActiveVibe(v)}>
                      {v}
                    </Chip>
                  ))}
                </div>
              </div>

              <ErrBanner msg={errorMsg} onClose={() => setErrorMsg('')} />

              {loadingPosts ? (
                <Spinner />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                  {filteredPosts.map(post => {
                    const author = postAuthors[post.author_id]
                    const comments = commentsByPost[post.id] || []
                    const rc = postReactionCounts[post.id] || {}
                    const myReaction = myReactionsByPost[post.id] || null

                    return (
                      <Card key={post.id} style={{ transition: 'all .2s' }} className="card-lift">
                        <button
                          onClick={() => openPreview(post)}
                          style={{
                            display: 'block',
                            width: '100%',
                            border: 'none',
                            background: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <div style={{ position: 'relative', height: 220, overflow: 'hidden' }}>
                            {post.cover_img ? (
                              <img src={post.cover_img} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            ) : (
                              <div
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  background: 'linear-gradient(135deg,#0f5cc7,#67c4ea)',
                                  display: 'flex',
                                  alignItems: 'flex-end',
                                  justifyContent: 'flex-start',
                                  padding: 20,
                                }}
                              >
                                <span style={{ color: 'rgba(255,255,255,0.78)', fontSize: 13 }}>No photo yet</span>
                              </div>
                            )}

                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.10) 48%, transparent 70%)' }} />

                            <div
                              style={{
                                position: 'absolute',
                                top: 14,
                                left: 14,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 7,
                                background: 'rgba(255,255,255,0.92)',
                                backdropFilter: 'blur(8px)',
                                borderRadius: T.pill,
                                padding: '4px 10px 4px 5px',
                              }}
                            >
                              <Avatar name={author?.username || 'R'} size={22} />
                              <span style={{ fontSize: 11, color: T.ink, fontWeight: 600 }}>@{author?.username || 'traveler'}</span>
                            </div>

                            <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              {post.source_platform ? (
                                <div
                                  style={{
                                    background: 'rgba(255,255,255,0.92)',
                                    backdropFilter: 'blur(8px)',
                                    borderRadius: T.pill,
                                    padding: '5px 11px',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: T.blue,
                                  }}
                                >
                                  {post.source_platform}
                                </div>
                              ) : null}
                              <div
                                style={{
                                  background: 'rgba(255,255,255,0.92)',
                                  backdropFilter: 'blur(8px)',
                                  borderRadius: T.pill,
                                  padding: '5px 11px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: T.ink,
                                }}
                              >
                                {post.duration || 0} days
                              </div>
                            </div>

                            <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.80)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>
                                {[post.country, post.city].filter(Boolean).join(' · ')}
                              </div>
                              <h3
                                style={{
                                  fontFamily: T.ffBlack,
                                  fontSize: 26,
                                  fontWeight: 900,
                                  color: '#fff',
                                  margin: '0 0 4px',
                                  letterSpacing: '-0.03em',
                                  lineHeight: 1.02,
                                }}
                              >
                                {post.title || post.city || 'Untitled'}
                              </h3>
                              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.78)' }}>{post.vibe || 'trip'}</span>
                            </div>
                          </div>
                        </button>

                        <div style={{ padding: '16px 16px 18px' }}>
                          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                            <button
                              onClick={() => toggleLike(post.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                background: likedPostIds[post.id] ? T.bluePale : T.sand2,
                                border: `1px solid ${likedPostIds[post.id] ? 'rgba(42,109,217,0.2)' : T.border}`,
                                borderRadius: T.pill,
                                padding: '6px 12px',
                                fontSize: 12,
                                fontWeight: 600,
                                color: likedPostIds[post.id] ? T.blue : T.inkMid,
                                cursor: 'pointer',
                              }}
                            >
                              ❤️ {postLikeCounts[post.id] || 0}
                            </button>

                            <button
                              onClick={() => toggleSavePost(post.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                background: savedPostIds[post.id] ? T.bluePale : T.sand2,
                                border: `1px solid ${savedPostIds[post.id] ? 'rgba(42,109,217,0.2)' : T.border}`,
                                borderRadius: T.pill,
                                padding: '6px 12px',
                                fontSize: 12,
                                fontWeight: 600,
                                color: savedPostIds[post.id] ? T.blue : T.inkMid,
                                cursor: 'pointer',
                              }}
                            >
                              🔖 {savedPostIds[post.id] ? 'Saved' : 'Save'}
                            </button>

                            <button
                              onClick={() => setOpenCommentsByPost(p => ({ ...p, [post.id]: !p[post.id] }))}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                background: openCommentsByPost[post.id] ? T.bluePale : T.sand2,
                                border: `1px solid ${openCommentsByPost[post.id] ? 'rgba(42,109,217,0.2)' : T.border}`,
                                borderRadius: T.pill,
                                padding: '6px 12px',
                                fontSize: 12,
                                fontWeight: 600,
                                color: openCommentsByPost[post.id] ? T.blue : T.inkMid,
                                cursor: 'pointer',
                              }}
                            >
                              💬 {comments.length}
                            </button>

                            <ReactionPicker selectedEmoji={myReaction} counts={rc} onChoose={emoji => setReaction(post.id, emoji)} />
                          </div>

                          <p style={{ fontSize: 13, color: T.inkMid, lineHeight: 1.65, margin: '0 0 12px', fontWeight: 300 }}>
                            {post.caption || 'No caption yet.'}
                          </p>

                          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                            <Badge variant="blue">{post.vibe || 'trip'}</Badge>
                            <Badge>{post.budget || '$$'}</Badge>
                            <Badge variant={(post.visibility || 'private') === 'public' ? 'sage' : 'warm'}>
                              {(post.visibility || 'private') === 'public' ? 'Public' : 'Buddies'}
                            </Badge>
                            {post.import_status ? <Badge variant="blue">{post.import_status}</Badge> : null}
                          </div>

                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <Btn variant="primary" size="sm" onClick={() => adoptTrip(post.id)} disabled={!!adoptLoadingByPost[post.id]}>
                              {adoptLoadingByPost[post.id] ? 'Adopting…' : 'Adopt this trip'}
                            </Btn>
                            <Btn variant="secondary" size="sm" onClick={() => openPreview(post)}>
                              View trip
                            </Btn>
                          </div>

                          {openCommentsByPost[post.id] ? (
                            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14, marginTop: 14 }}>
                              <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                                {comments.length ? comments.map(c => (
                                  <div key={c.id} style={{ background: T.sand, borderRadius: T.radius, padding: '10px 12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: T.ink }}>@{c.username || 'user'}</span>
                                        <span style={{ fontSize: 11, color: T.inkMuted }}>{new Date(c.created_at).toLocaleDateString()}</span>
                                      </div>
                                      {c.user_id === userId ? (
                                        <button
                                          onClick={() => deleteComment(c.id, post.id)}
                                          style={{ background: 'none', border: 'none', color: T.danger, cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: 0 }}
                                        >
                                          delete
                                        </button>
                                      ) : null}
                                    </div>
                                    <p style={{ fontSize: 13, color: T.inkMid, margin: 0, lineHeight: 1.5, fontWeight: 300 }}>{c.body}</p>
                                  </div>
                                )) : (
                                  <p style={{ fontSize: 12, color: T.inkMuted, margin: 0 }}>No comments yet.</p>
                                )}
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                                <input
                                  value={commentDraftByPost[post.id] || ''}
                                  onChange={e => setCommentDraftByPost(p => ({ ...p, [post.id]: e.target.value }))}
                                  onKeyDown={e => e.key === 'Enter' && addComment(post.id)}
                                  placeholder="Add a comment…"
                                  style={css.input}
                                />
                                <Btn variant="primary" size="sm" onClick={() => addComment(post.id)}>
                                  Post
                                </Btn>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </Card>
                    )
                  })}

                  {!filteredPosts.length ? (
                    <div style={{ textAlign: 'center', padding: '72px 0' }}>
                      <div style={{ fontSize: 56, marginBottom: 14 }}>✈️</div>
                      <DisplayHeading black={feedTab === 'explore' ? 'No public trips' : 'No buddy trips'} blue="yet." size="md" center />
                      <p style={{ color: T.inkMuted, fontSize: 14, margin: '10px 0 0', fontWeight: 300 }}>
                        {feedTab === 'explore' ? 'Be the first to share a public trip!' : 'Add friends and share trips to see them here.'}
                      </p>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {tab === 'map' && (
            <div>
              <ScreenHeader
                title="My Map"
                subtitle="Tap a trip to focus its pins"
                right={
                  mapFocusId ? (
                    <Btn variant="secondary" size="sm" onClick={() => setMapFocusId(null)}>
                      Show all
                    </Btn>
                  ) : null
                }
              />

              <ErrBanner msg={errorMsg} onClose={() => setErrorMsg('')} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
                <Card style={{ padding: 14 }}>
                  {myTrips.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 10px' }}>
                      <IconBadge emoji="🗺️" bg={T.bluePale} size={56} />
                      <p style={{ fontSize: 13, color: T.inkMuted, lineHeight: 1.6, marginTop: 12, fontWeight: 300 }}>
                        Add places in My Trips to see them here.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                      {myTrips.map((trip, i) => (
                        <button
                          key={trip.id}
                          onClick={() => setMapFocusId(prev => (prev === trip.id ? null : trip.id))}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            minWidth: 180,
                            padding: '10px 12px',
                            background: mapFocusId === trip.id ? T.sand : T.card,
                            border: `1px solid ${mapFocusId === trip.id ? T.sand3 : T.cardBorder}`,
                            borderRadius: T.radius,
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all .15s',
                            fontFamily: T.ff,
                          }}
                        >
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              background: trip.map_color || TRIP_COLORS[i % TRIP_COLORS.length],
                              flexShrink: 0,
                            }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: T.ink,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {trip.title || trip.city || 'Untitled'}
                            </div>
                            <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 1 }}>
                              {[trip.city, trip.country].filter(Boolean).join(', ')}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </Card>

                <Card style={{ overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: 'calc(100dvh - 290px)', minHeight: 420 }}>
                    <RoveMap
                      trips={plannerTripsForMap}
                      savedPlaces={savedPlaces}
                      mapVisibleKey={mapVisibleKey}
                      mapFocusId={mapFocusId}
                    />
                  </div>
                </Card>
              </div>
            </div>
          )}

          {tab === 'mytrips' && (
            <div>
              {myTripsScreen === 'list' && (
                <div>
                  <ScreenHeader
                    title="My Trips"
                    subtitle="Search, import, or open a trip"
                    right={<Btn variant="primary" size="sm" onClick={createTrip}>+ New</Btn>}
                  />

                  <div style={{ marginTop: 14 }}>
                    <ErrBanner msg={errorMsg} onClose={() => setErrorMsg('')} />

                    <Card style={{ padding: 16, marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <IconBadge emoji="✨" bg={T.bluePale} size={44} />
                        <div>
                          <div style={{ fontFamily: T.ffBlack, fontSize: 17, fontWeight: 900, color: T.ink, letterSpacing: '-0.02em' }}>
                            AI import
                          </div>
                          <div style={{ fontSize: 12, color: T.inkMuted, fontWeight: 300 }}>
                            TikTok, Instagram, blogs, or any public travel link
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gap: 10 }}>
                        <div>
                          <label style={css.label}>PASTE URL</label>
                          <input
                            value={importUrl}
                            onChange={e => setImportUrl(e.target.value)}
                            placeholder="https://..."
                            style={css.input}
                          />
                        </div>

                        <div>
                          <label style={css.label}>OPTIONAL NOTES</label>
                          <textarea
                            value={importNotes}
                            onChange={e => setImportNotes(e.target.value)}
                            placeholder="Paste caption text or any extra context to help the AI."
                            style={{ ...css.input, minHeight: 90, resize: 'vertical' }}
                          />
                        </div>

                        {importStatusMsg ? (
                          <div
                            style={{
                              background: T.bluePale,
                              border: '1px solid rgba(42,109,217,0.18)',
                              borderRadius: T.radius,
                              padding: '10px 12px',
                              fontSize: 12,
                              color: T.blue,
                              fontWeight: 600,
                            }}
                          >
                            {importStatusMsg}
                          </div>
                        ) : null}

                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          <Btn variant="blue" onClick={importTripFromUrl} disabled={importLoading}>
                            {importLoading ? 'Importing…' : 'Import with AI'}
                          </Btn>
                          <Btn
                            variant="secondary"
                            onClick={() => {
                              setImportUrl('')
                              setImportNotes('')
                              setImportStatusMsg('')
                            }}
                            disabled={importLoading}
                          >
                            Clear
                          </Btn>
                        </div>
                      </div>
                    </Card>

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
                      <input
                        value={myTripSearch}
                        onChange={e => setMyTripSearch(e.target.value)}
                        placeholder="Search trips, places, cities, notes…"
                        style={{ ...css.input, borderRadius: T.pill, padding: '12px 18px' }}
                      />
                    </div>

                    {loadingTrips ? (
                      <Spinner />
                    ) : !filteredMyTrips.length ? (
                      <div style={{ textAlign: 'center', padding: '60px 0' }}>
                        <IconBadge emoji="🌍" bg={T.bluePale} size={72} />
                        <div style={{ marginTop: 20 }}>
                          <DisplayHeading black={myTrips.length ? 'No matching trips' : 'No trips'} blue="yet." size="md" center />
                        </div>
                        <p style={{ color: T.inkMuted, fontSize: 14, margin: '10px 0 24px', fontWeight: 300 }}>
                          {myTrips.length ? 'Try a different search.' : 'Create your first trip or import one from a link.'}
                        </p>
                        {!myTrips.length ? <Btn variant="primary" onClick={createTrip}>+ Create trip</Btn> : null}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {filteredMyTrips.map((trip, idx) => {
                          const plan = tripPlans[trip.id]
                          const spent = getTripSpent(plan)
                          const memberCount = (tripMembers[trip.id] || []).length + 1
                          const placeCount = (plan?.days || []).reduce((sum, d) => sum + (d.items || []).length, 0)
                          const importedItemsCount = (tripImportItemsByTrip[trip.id] || []).length

                          return (
                            <Card
                              key={trip.id}
                              onClick={() => openTripHome(trip.id)}
                              style={{ transition: 'all .2s' }}
                              className="trip-hero-card"
                            >
                              <div style={{ position: 'relative', minHeight: 210, overflow: 'hidden' }}>
                                {trip.cover_img ? (
                                  <img
                                    src={trip.cover_img}
                                    alt={trip.title}
                                    style={{ width: '100%', height: 210, objectFit: 'cover', display: 'block' }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      width: '100%',
                                      height: 210,
                                      background: trip.id
                                        ? `linear-gradient(135deg, ${trip.map_color || TRIP_COLORS[idx % TRIP_COLORS.length]}, #7fd0ee)`
                                        : 'linear-gradient(135deg, #2a6dd9, #7fd0ee)',
                                      position: 'relative',
                                    }}
                                  >
                                    <div
                                      style={{
                                        position: 'absolute',
                                        inset: 0,
                                        background:
                                          'radial-gradient(circle at 70% 20%, rgba(255,255,255,0.22), transparent 28%), radial-gradient(circle at 30% 120%, rgba(255,255,255,0.18), transparent 34%)',
                                      }}
                                    />
                                  </div>
                                )}

                                <div
                                  style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'linear-gradient(to top, rgba(0,0,0,0.56) 0%, rgba(0,0,0,0.16) 45%, transparent 70%)',
                                  }}
                                />

                                <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                  {trip.source_url ? <Badge variant="blue">Imported</Badge> : null}
                                  {trip.adopted_from_post_id ? <Badge variant="warm">Adopted</Badge> : null}
                                  {trip.author_id !== userId ? <Badge variant="blue">Collaborator</Badge> : null}
                                  <Badge variant={trip.visibility === 'public' ? 'sage' : trip.visibility === 'friends' ? 'blue' : 'default'}>
                                    {trip.visibility === 'public' ? 'Public' : trip.visibility === 'friends' ? 'Friends' : 'Private'}
                                  </Badge>
                                </div>

                                <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
                                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.80)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>
                                    {[trip.country, trip.city].filter(Boolean).join(' · ') || 'My trip'}
                                  </div>
                                  <h3
                                    style={{
                                      fontFamily: T.ffBlack,
                                      fontSize: 28,
                                      fontWeight: 900,
                                      color: '#fff',
                                      margin: '0 0 6px',
                                      letterSpacing: '-0.04em',
                                      lineHeight: 1.02,
                                    }}
                                  >
                                    {trip.title || trip.city || 'Untitled'}
                                  </h3>
                                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', color: 'rgba(255,255,255,0.82)', fontSize: 12 }}>
                                    <span>{trip.duration || 0} days</span>
                                    <span>{placeCount} places</span>
                                    <span>{memberCount} people</span>
                                    <span>{importedItemsCount} imported</span>
                                  </div>
                                </div>
                              </div>

                              <div style={{ padding: '16px 16px 18px' }}>
                                <p style={{ fontSize: 13, lineHeight: 1.6, color: T.inkMid, margin: '0 0 12px', fontWeight: 300 }}>
                                  {trip.caption || 'Open this trip to edit details, review imported places, and invite friends.'}
                                </p>

                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                                  <Badge variant="blue">{trip.vibe || 'trip'}</Badge>
                                  <Badge>{trip.budget || '$$'}</Badge>
                                  {plan?.groupBudget ? <Badge variant="warm">Budget ${plan.groupBudget}</Badge> : null}
                                  {spent ? <Badge variant="sage">Spent ${spent.toFixed(0)}</Badge> : null}
                                  {trip.source_platform ? <Badge variant="blue">{trip.source_platform}</Badge> : null}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                                  <Btn variant="primary" size="sm">Open trip</Btn>

                                  <button
                                    onClick={e => {
                                      e.stopPropagation()
                                      deleteTrip(trip.id)
                                    }}
                                    style={{
                                      border: 'none',
                                      background: 'none',
                                      color: T.danger,
                                      fontSize: 12,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {trip.author_id === userId ? 'Delete' : 'Leave'}
                                  </button>
                                </div>
                              </div>
                            </Card>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {myTripsScreen === 'tripHome' && openTrip && openPlan && (
                <div>
                  <ScreenHeader
                    title={openTrip.title || openTrip.city || 'Trip'}
                    subtitle={[openTrip.city, openTrip.country].filter(Boolean).join(', ') || 'Trip home'}
                    onBack={goToMyTripsList}
                    right={
                      <button
                        onClick={() => deleteTrip(openTrip.id)}
                        style={{
                          border: 'none',
                          background: 'none',
                          color: T.danger,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {isOwner ? 'Delete' : 'Leave'}
                      </button>
                    }
                  />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
                    <Card style={{ overflow: 'hidden' }}>
                      <div style={{ position: 'relative', minHeight: 240 }}>
                        {openTrip.cover_img ? (
                          <img
                            src={openTrip.cover_img}
                            alt={openTrip.title}
                            style={{ width: '100%', height: 240, objectFit: 'cover', display: 'block' }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '100%',
                              height: 240,
                              background: `linear-gradient(135deg, ${openTrip.map_color || T.blue}, #7fd0ee)`,
                            }}
                          />
                        )}

                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'linear-gradient(to top, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.10) 45%, transparent 75%)',
                          }}
                        />

                        <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {openTrip.source_url ? <Badge variant="blue">Imported</Badge> : null}
                          {openTrip.adopted_from_post_id ? <Badge variant="warm">Adopted</Badge> : null}
                          {openTrip.author_id !== userId ? <Badge variant="blue">Collaborator</Badge> : null}
                          <Badge variant={openTrip.visibility === 'public' ? 'sage' : openTrip.visibility === 'friends' ? 'blue' : 'default'}>
                            {openTrip.visibility === 'public' ? 'Public' : openTrip.visibility === 'friends' ? 'Friends' : 'Private'}
                          </Badge>
                        </div>

                        <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.80)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>
                            {[openTrip.country, openTrip.city].filter(Boolean).join(' · ') || 'My trip'}
                          </div>
                          <h2
                            style={{
                              fontFamily: T.ffBlack,
                              fontSize: 30,
                              fontWeight: 900,
                              color: '#fff',
                              margin: '0 0 6px',
                              letterSpacing: '-0.04em',
                              lineHeight: 1.02,
                            }}
                          >
                            {openTrip.title || openTrip.city || 'Untitled'}
                          </h2>
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: 'rgba(255,255,255,0.84)', fontSize: 12 }}>
                            <span>{openTrip.duration || 0} days</span>
                            <span>{openPlan.days.length} planner days</span>
                            <span>{(openTripMembers || []).length + 1} people</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ padding: 16 }}>
                        <p style={{ fontSize: 13, color: T.inkMid, lineHeight: 1.65, margin: '0 0 12px', fontWeight: 300 }}>
                          {openTrip.caption || 'Open a section below to edit this trip.'}
                        </p>

                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <Badge variant="blue">{openTrip.vibe || 'trip'}</Badge>
                          <Badge>{openTrip.budget || '$$'}</Badge>
                          {openPlan.groupBudget ? <Badge variant="warm">Budget ${openPlan.groupBudget}</Badge> : null}
                          {openTrip.source_platform ? <Badge variant="blue">{openTrip.source_platform}</Badge> : null}
                        </div>
                      </div>
                    </Card>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                      <Card
                        onClick={() => setMyTripsScreen('details')}
                        style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}
                      >
                        <IconBadge emoji="🧾" bg={T.sand} size={44} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: T.ink }}>Trip details</div>
                          <div style={{ fontSize: 12, color: T.inkMuted }}>Title, location, duration, vibe, caption, photo, visibility</div>
                        </div>
                        <div style={{ fontSize: 18, color: T.inkMuted }}>›</div>
                      </Card>

                      <Card
                        onClick={() => setMyTripsScreen('planner')}
                        style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}
                      >
                        <IconBadge emoji="🗓️" bg={T.bluePale} size={44} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: T.ink }}>Planner</div>
                          <div style={{ fontSize: 12, color: T.inkMuted }}>{openPlan.days.length} days · {(openPlan.days || []).reduce((sum, d) => sum + (d.items || []).length, 0)} places</div>
                        </div>
                        <div style={{ fontSize: 18, color: T.inkMuted }}>›</div>
                      </Card>

                      <Card
                        onClick={() => setMyTripsScreen('imported')}
                        style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}
                      >
                        <IconBadge emoji="✨" bg={T.warmPale} size={44} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: T.ink }}>Imported findings</div>
                          <div style={{ fontSize: 12, color: T.inkMuted }}>{openImportedItems.length} extracted items</div>
                        </div>
                        <div style={{ fontSize: 18, color: T.inkMuted }}>›</div>
                      </Card>

                      <Card
                        onClick={() => setMyTripsScreen('budget')}
                        style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}
                      >
                        <IconBadge emoji="💰" bg="#fff8e0" size={44} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: T.ink }}>Budget</div>
                          <div style={{ fontSize: 12, color: T.inkMuted }}>
                            Spent ${getTripSpent(openPlan).toFixed(0)} · Remaining ${getTripRemaining(openPlan).toFixed(0)}
                          </div>
                        </div>
                        <div style={{ fontSize: 18, color: T.inkMuted }}>›</div>
                      </Card>

                      <Card
                        onClick={() => setMyTripsScreen('members')}
                        style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}
                      >
                        <IconBadge emoji="👥" bg={T.sagePale} size={44} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: T.ink }}>Members & sharing</div>
                          <div style={{ fontSize: 12, color: T.inkMuted }}>
                            {(openTripMembers || []).length + 1} people · {openTrip.visibility || 'private'}
                          </div>
                        </div>
                        <div style={{ fontSize: 18, color: T.inkMuted }}>›</div>
                      </Card>

                      <Card
                        onClick={async () => {
                          for (let di = 0; di < openPlan.days.length; di += 1) {
                            for (let ii = 0; ii < openPlan.days[di].items.length; ii += 1) {
                              await geocodeIfNeeded(openTrip.id, di, ii)
                            }
                          }
                          setMapFocusId(openTrip.id)
                          setTab('map')
                        }}
                        style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}
                      >
                        <IconBadge emoji="🗺️" bg={T.bluePale} size={44} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: T.ink }}>View on map</div>
                          <div style={{ fontSize: 12, color: T.inkMuted }}>Open this trip’s places in the map tab</div>
                        </div>
                        <div style={{ fontSize: 18, color: T.inkMuted }}>›</div>
                      </Card>
                    </div>
                  </div>
                </div>
              )}
                            {myTripsScreen === 'details' && openTrip && openPlan && (
                <div>
                  <ScreenHeader
                    title="Trip details"
                    subtitle="Edit the basics"
                    onBack={() => setMyTripsScreen('tripHome')}
                  />

                  <div style={{ marginTop: 14 }}>
                    <ErrBanner msg={errorMsg} onClose={() => setErrorMsg('')} />

                    <Card style={{ padding: 16 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                        <div>
                          <label style={css.label}>TRIP TITLE</label>
                          <input
                            style={css.input}
                            value={openTrip.title || ''}
                            onChange={e => updateTripField(openTrip.id, 'title', e.target.value)}
                            onBlur={e => persistTripField(openTrip.id, 'title', e.target.value)}
                            placeholder="e.g. Tokyo with the crew"
                          />
                        </div>

                        <div>
                          <label style={css.label}>CITY</label>
                          <input
                            style={css.input}
                            value={openTrip.city || ''}
                            onChange={e => updateTripField(openTrip.id, 'city', e.target.value)}
                            onBlur={e => persistTripField(openTrip.id, 'city', e.target.value)}
                            placeholder="Tokyo"
                          />
                        </div>

                        <div>
                          <label style={css.label}>COUNTRY</label>
                          <input
                            style={css.input}
                            value={openTrip.country || ''}
                            onChange={e => updateTripField(openTrip.id, 'country', e.target.value)}
                            onBlur={e => persistTripField(openTrip.id, 'country', e.target.value)}
                            placeholder="Japan"
                          />
                        </div>

                        <div>
                          <label style={css.label}>DURATION (DAYS)</label>
                          <input
                            style={css.input}
                            type="number"
                            value={openTrip.duration || ''}
                            onChange={e => updateTripField(openTrip.id, 'duration', e.target.value)}
                            onBlur={e => persistTripField(openTrip.id, 'duration', normalizeDuration(e.target.value))}
                            placeholder="4"
                          />
                        </div>

                        <div>
                          <label style={css.label}>VIBE</label>
                          <select
                            style={css.input}
                            value={openTrip.vibe || 'city break'}
                            onChange={e => {
                              updateTripField(openTrip.id, 'vibe', e.target.value)
                              persistTripField(openTrip.id, 'vibe', e.target.value)
                            }}
                          >
                            {VIBES.filter(v => v !== 'all').map(v => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={css.label}>BUDGET STYLE</label>
                          <input
                            style={css.input}
                            value={openTrip.budget || ''}
                            onChange={e => updateTripField(openTrip.id, 'budget', e.target.value)}
                            onBlur={e => persistTripField(openTrip.id, 'budget', e.target.value)}
                            placeholder="$$"
                          />
                        </div>

                        <div>
                          <label style={css.label}>CAPTION</label>
                          <textarea
                            style={{ ...css.input, minHeight: 92, resize: 'vertical', lineHeight: 1.55 }}
                            value={openTrip.caption || ''}
                            onChange={e => updateTripField(openTrip.id, 'caption', e.target.value)}
                            onBlur={e => persistTripField(openTrip.id, 'caption', e.target.value)}
                            placeholder="Write a quick summary for this trip..."
                          />
                        </div>

                        {openTrip.source_url ? (
                          <div
                            style={{
                              marginTop: 4,
                              padding: 14,
                              borderRadius: T.radius,
                              background: T.bluePale,
                              border: '1px solid rgba(42,109,217,0.14)',
                            }}
                          >
                            <div style={{ fontSize: 12, fontWeight: 700, color: T.blue, marginBottom: 4 }}>
                              Imported source
                            </div>
                            <div style={{ fontSize: 12, color: T.inkMid, lineHeight: 1.5, wordBreak: 'break-word' }}>
                              {openTrip.source_title || openTrip.source_url}
                            </div>
                            <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 4 }}>
                              {openTrip.source_platform || 'web'} · {openTrip.import_status || 'draft_import'}
                            </div>
                          </div>
                        ) : null}

                        {isOwner ? (
                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                            <label
                              style={{
                                background: T.sand,
                                border: `1px solid ${T.border}`,
                                borderRadius: T.pill,
                                padding: '10px 14px',
                                fontSize: 12,
                                fontWeight: 600,
                                color: T.inkMid,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                              }}
                            >
                              📷 Upload
                              <input
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={async e => {
                                  const f = e.target.files?.[0]
                                  if (f) await uploadPhoto(f, openTrip.id)
                                  e.target.value = ''
                                }}
                              />
                            </label>

                            <label
                              style={{
                                background: T.sand,
                                border: `1px solid ${T.border}`,
                                borderRadius: T.pill,
                                padding: '10px 14px',
                                fontSize: 12,
                                fontWeight: 600,
                                color: T.inkMid,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                              }}
                            >
                              📱 Camera
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                style={{ display: 'none' }}
                                onChange={async e => {
                                  const f = e.target.files?.[0]
                                  if (f) await uploadPhoto(f, openTrip.id)
                                  e.target.value = ''
                                }}
                              />
                            </label>
                          </div>
                        ) : null}
                      </div>
                    </Card>
                  </div>
                </div>
              )}

              {myTripsScreen === 'imported' && openTrip && openPlan && (
                <div>
                  <ScreenHeader
                    title="Imported findings"
                    subtitle="Review what AI extracted"
                    onBack={() => setMyTripsScreen('tripHome')}
                    right={<Badge variant="blue">{openImportedItems.length} items</Badge>}
                  />

                  <div style={{ marginTop: 14 }}>
                    {openImportedItems.length ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {openImportedItems.map((item, index) => (
                          <Card key={item.id || index} style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                                  <Badge variant="blue">{item.item_type || 'place'}</Badge>
                                  {item.day_number ? <Badge>Day {item.day_number}</Badge> : null}
                                  {item.source_confidence ? (
                                    <Badge variant="sage">{Math.round(Number(item.source_confidence) * 100)}% confidence</Badge>
                                  ) : null}
                                </div>

                                <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, marginBottom: 4 }}>
                                  {item.title || item.location_name || 'Untitled item'}
                                </div>

                                {item.description ? (
                                  <div style={{ fontSize: 12, color: T.inkMid, lineHeight: 1.5, marginBottom: 4 }}>
                                    {item.description}
                                  </div>
                                ) : null}

                                {item.address ? (
                                  <div style={{ fontSize: 11, color: T.inkMuted }}>
                                    {item.address}
                                  </div>
                                ) : null}
                              </div>

                              <Btn
                                variant="secondary"
                                size="sm"
                                onClick={() => addImportedItemToPlanner(openTrip.id, item)}
                                style={{ flexShrink: 0 }}
                              >
                                Add
                              </Btn>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Card style={{ padding: 18 }}>
                        <p style={{ fontSize: 13, color: T.inkMuted, margin: 0, fontWeight: 300 }}>
                          No imported findings saved for this trip.
                        </p>
                      </Card>
                    )}
                  </div>
                </div>
              )}

              {myTripsScreen === 'budget' && openTrip && openPlan && (
                <div>
                  <ScreenHeader
                    title="Budget"
                    subtitle="Track spend vs budget"
                    onBack={() => setMyTripsScreen('tripHome')}
                  />

                  <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <Card style={{ padding: 16 }}>
                      <label style={css.label}>GROUP BUDGET ($)</label>
                      <input
                        style={css.input}
                        type="number"
                        value={openPlan.groupBudget || ''}
                        onChange={e => updatePlan(openTrip.id, { groupBudget: e.target.value })}
                        placeholder="e.g. 3000"
                      />
                    </Card>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {[
                        { l: 'Spent', v: `$${getTripSpent(openPlan).toFixed(0)}`, c: T.ink },
                        {
                          l: 'Remaining',
                          v: `$${getTripRemaining(openPlan).toFixed(0)}`,
                          c: getTripRemaining(openPlan) < 0 ? T.danger : T.success,
                        },
                      ].map(s => (
                        <Card key={s.l} style={{ padding: 16, textAlign: 'center' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.inkMuted, marginBottom: 5 }}>
                            {s.l}
                          </div>
                          <div style={{ fontSize: 24, fontWeight: 900, fontFamily: T.ffBlack, color: s.c, letterSpacing: '-0.03em' }}>
                            {s.v}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {myTripsScreen === 'members' && openTrip && openPlan && (
                <div>
                  <ScreenHeader
                    title="Members & sharing"
                    subtitle="Who can edit and who can see this trip"
                    onBack={() => setMyTripsScreen('tripHome')}
                    right={isOwner ? <Btn variant="ghost" size="sm" onClick={() => openInviteBox(openTrip.id)}>+ Invite</Btn> : null}
                  />

                  <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <Card style={{ padding: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                        <IconBadge emoji="👥" bg={T.bluePale} size={40} />
                        <div>
                          <div style={{ fontFamily: T.ffBlack, fontSize: 15, fontWeight: 900, color: T.ink, letterSpacing: '-0.02em' }}>
                            Trip members
                          </div>
                          <div style={{ fontSize: 11, color: T.inkMuted, fontWeight: 300 }}>
                            Who&apos;s on this trip
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ background: T.sand, borderRadius: T.pill, padding: '6px 12px', fontSize: 12, fontWeight: 700, color: T.inkMid }}>
                          Owner
                        </div>

                        {openTripMembers.map(m => (
                          <div
                            key={m.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              background: T.sand,
                              borderRadius: T.pill,
                              padding: '6px 12px',
                            }}
                          >
                            <span style={{ fontSize: 12, fontWeight: 700, color: T.ink }}>@{m.username}</span>
                            {isOwner ? (
                              <button
                                onClick={() => removeMember(openTrip.id, m.id)}
                                style={{
                                  border: 'none',
                                  background: 'none',
                                  color: T.danger,
                                  cursor: 'pointer',
                                  fontSize: 14,
                                  lineHeight: 1,
                                  padding: 0,
                                }}
                              >
                                ×
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>

                      {!openTripMembers.length ? (
                        <p style={{ fontSize: 12, color: T.inkMuted, margin: '8px 0 0', fontWeight: 300 }}>
                          No friends added yet.
                        </p>
                      ) : null}

                      {isOwner && showInviteBoxByTrip[openTrip.id] ? (
                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}`, position: 'relative' }}>
                          <label style={css.label}>SEARCH FRIENDS</label>
                          <input
                            style={css.input}
                            value={friendSearchByTrip[openTrip.id] || ''}
                            onChange={e => updateFriendSearch(openTrip.id, e.target.value)}
                            placeholder="@username"
                          />

                          {(friendSearchByTrip[openTrip.id] || '').trim() && openFriendSuggestions.length > 0 ? (
                            <div
                              style={{
                                marginTop: 8,
                                background: T.card,
                                border: `1px solid ${T.cardBorder}`,
                                borderRadius: T.radius,
                                boxShadow: T.shadowMd,
                                overflow: 'hidden',
                              }}
                            >
                              {openFriendSuggestions.map(f => (
                                <button
                                  key={f.id}
                                  className="invite-row"
                                  onClick={() => inviteMember(openTrip.id, f.username || '')}
                                  disabled={!!inviteLoadingByTrip[openTrip.id]}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    width: '100%',
                                    padding: '10px 14px',
                                    border: 'none',
                                    background: 'none',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    fontFamily: T.ff,
                                    transition: 'background .1s',
                                  }}
                                >
                                  <Avatar name={f.username} size={30} />
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>@{f.username}</div>
                                    {f.full_name ? <div style={{ fontSize: 11, color: T.inkMuted }}>{f.full_name}</div> : null}
                                  </div>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: T.blue }}>Add</span>
                                </button>
                              ))}
                            </div>
                          ) : null}

                          <p style={{ fontSize: 11, color: T.inkMuted, margin: '8px 0 0', fontWeight: 300 }}>
                            Only accepted friends can be invited.
                          </p>
                        </div>
                      ) : null}
                    </Card>

                    {isOwner ? (
                      <Card style={{ padding: 16 }}>
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: T.ink, marginBottom: 4 }}>Sharing</div>
                          <div style={{ fontSize: 12, color: T.inkMuted }}>Choose who can see this trip.</div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                          {[
                            ['private', '🔒', 'Just us'],
                            ['friends', '🫂', 'Friends'],
                            ['public', '🌍', 'Public'],
                          ].map(([vis, icon, label]) => (
                            <button
                              key={vis}
                              onClick={() => openShareComposer(openTrip.id, vis)}
                              style={{
                                minWidth: 0,
                                padding: '12px 8px',
                                border: `1.5px solid ${(openTrip.visibility || 'private') === vis ? T.ink : T.cardBorder}`,
                                borderRadius: T.radius,
                                background: (openTrip.visibility || 'private') === vis ? T.ink : T.card,
                                color: (openTrip.visibility || 'private') === vis ? '#fff' : T.inkMid,
                                cursor: 'pointer',
                                fontSize: 11,
                                fontWeight: 700,
                                transition: 'all .15s',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 5,
                                fontFamily: T.ff,
                              }}
                            >
                              <span style={{ fontSize: 18 }}>{icon}</span>
                              {label}
                            </button>
                          ))}
                        </div>
                      </Card>
                    ) : null}
                  </div>
                </div>
              )}

              {myTripsScreen === 'planner' && openTrip && openPlan && (
                <div>
                  <ScreenHeader
                    title="Planner"
                    subtitle="Build the trip day by day"
                    onBack={() => setMyTripsScreen('tripHome')}
                    right={
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Btn variant="secondary" size="sm" onClick={() => addDay(openTrip.id)}>
                          + Day
                        </Btn>
                        <Btn variant="secondary" size="sm" onClick={() => saveEntireTripPlan(openTrip.id)}>
                          Save
                        </Btn>
                      </div>
                    }
                  />

                  <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {openPlan.days.map((day, di) => (
                      <Card key={day.id || day.day} style={{ overflow: 'hidden' }}>
                        <div
                          style={{
                            padding: '16px 16px 14px',
                            borderBottom: `1px solid ${T.border}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            flexWrap: 'wrap',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                            <span style={{ fontFamily: T.ffBlack, fontSize: 22, fontWeight: 900, color: T.ink, letterSpacing: '-0.03em' }}>
                              Day {day.day}
                            </span>
                            <span style={{ fontSize: 12, color: T.inkMuted, fontWeight: 300 }}>
                              {di + 1} of {openPlan.days.length}
                            </span>
                          </div>

                          <button
                            onClick={() => removeDay(openTrip.id, di)}
                            style={{
                              border: 'none',
                              background: 'none',
                              color: T.danger,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Remove day
                          </button>
                        </div>

                        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <input
                            value={day.title || ''}
                            onChange={e => updateDay(openTrip.id, di, { title: e.target.value })}
                            placeholder="Day title (optional)"
                            style={css.input}
                          />

                          {day.items.map((it, ii) => (
                            <div
                              key={it.id}
                              style={{
                                border: `1px solid ${T.border}`,
                                borderRadius: T.radius,
                                padding: 12,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8,
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                                <select
                                  value={it.category || 'Restaurant'}
                                  onChange={e =>
                                    updateItem(openTrip.id, di, ii, {
                                      category: e.target.value,
                                    })
                                  }
                                  style={{ ...css.input, fontSize: 12, maxWidth: 180 }}
                                >
                                  {['Restaurant', 'Cafe', 'Bar', 'Activity', 'Sight', 'Hotel', 'Other'].map(c => (
                                    <option key={c} value={c}>{c}</option>
                                  ))}
                                </select>

                                <button
                                  onClick={() => removeItem(openTrip.id, di, ii)}
                                  style={{
                                    border: 'none',
                                    background: 'none',
                                    color: T.danger,
                                    fontSize: 16,
                                    cursor: 'pointer',
                                  }}
                                >
                                  ×
                                </button>
                              </div>

                              <PlaceInput
                                value={it.name || ''}
                                onChange={e =>
                                  updateItem(openTrip.id, di, ii, {
                                    name: e.target.value,
                                  })
                                }
                                onPlaceSelected={place =>
                                  updateItem(openTrip.id, di, ii, {
                                    name: place.name,
                                    note: place.address,
                                    lat: place.lat,
                                    lng: place.lng,
                                  })
                                }
                                placeholder="Place name"
                              />

                              <input
                                value={it.note || ''}
                                onChange={e =>
                                  updateItem(openTrip.id, di, ii, {
                                    note: e.target.value,
                                  })
                                }
                                placeholder="Address / area / notes"
                                style={css.input}
                              />

                              <input
                                value={it.url || ''}
                                onChange={e =>
                                  updateItem(openTrip.id, di, ii, {
                                    url: e.target.value,
                                  })
                                }
                                placeholder="Link (Google Maps, IG, etc.)"
                                style={css.input}
                              />

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <input
                                  value={it.timeText || ''}
                                  onChange={e =>
                                    updateItem(openTrip.id, di, ii, {
                                      timeText: e.target.value,
                                    })
                                  }
                                  placeholder="e.g. 10:30 AM"
                                  style={css.input}
                                />

                                <input
                                  type="number"
                                  value={it.spend || ''}
                                  onChange={e =>
                                    updateItem(openTrip.id, di, ii, {
                                      spend: e.target.value,
                                    })
                                  }
                                  placeholder="Spend $"
                                  style={css.input}
                                />
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <Btn variant="secondary" size="sm" onClick={() => geocodeIfNeeded(openTrip.id, di, ii)}>
                                  📍 Pin
                                </Btn>
                              </div>
                            </div>
                          ))}

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                            <Btn variant="secondary" size="sm" onClick={() => addItem(openTrip.id, di)}>
                              + Add place
                            </Btn>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'profile' && (
            <div>
              <ScreenHeader title={`@${profile?.username || 'you'}`} subtitle={profile?.full_name || 'Traveler'} />

              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 20 }}>
                  <Avatar name={profile?.username} size={64} />
                  <div>
                    <DisplayHeading black="@" blue={profile?.username || 'you'} size="md" />
                    <p style={{ fontSize: 13, color: T.inkMuted, margin: '6px 0 0', fontWeight: 300 }}>
                      {profile?.full_name || 'Traveler'}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                  {[
                    { l: 'Trips', v: myTrips.length },
                    { l: 'Imported', v: importedCount },
                    { l: 'Adopted', v: adoptedCount },
                    { l: 'Saved', v: savedCount },
                    { l: 'Friends', v: friendCount },
                  ].map(s => (
                    <Card key={s.l} style={{ padding: '14px 18px' }}>
                      <div style={{ fontSize: 11, color: T.inkMuted, fontWeight: 600, marginBottom: 4 }}>{s.l}</div>
                      <div style={{ fontSize: 22, fontWeight: 900, fontFamily: T.ffBlack, color: T.ink }}>{s.v}</div>
                    </Card>
                  ))}
                </div>

                <Card style={{ padding: 18 }}>
                  <DisplayHeading black="Account" blue="Actions" size="sm" />
                  <div style={{ marginTop: 16 }}>
                    <Btn
                      variant="danger"
                      onClick={async () => {
                        await supabase.auth.signOut()
                        window.location.reload()
                      }}
                    >
                      Log out
                    </Btn>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </main>

        <nav
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 120,
            background: 'rgba(255,255,255,0.94)',
            backdropFilter: 'blur(18px)',
            borderTop: `1px solid ${T.cardBorder}`,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 4,
            padding: '8px 10px calc(8px + env(safe-area-inset-bottom))',
          }}
        >
          {NAV.map(([key, label]) => (
            <button
              key={key}
              className="nav-item"
              onClick={() => {
                setTab(key)
                if (key === 'mytrips' && !openMyTripId) setMyTripsScreen('list')
              }}
              style={{
                background: tab === key ? T.ink : 'transparent',
                color: tab === key ? '#fff' : T.inkMid,
                border: 'none',
                borderRadius: T.pill,
                padding: '10px 8px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all .15s',
              }}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {shareModalTripId ? (
        <div
          onClick={() => setShareModalTripId(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 200,
            padding: 12,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 520,
              background: '#fff',
              borderRadius: `${T.radiusLg} ${T.radiusLg} 0 0`,
              padding: 20,
              boxShadow: T.shadowMd,
            }}
          >
            <DisplayHeading black="Share" blue="Trip" size="sm" />

            <div style={{ marginTop: 16 }}>
              <label style={css.label}>CAPTION</label>
              <textarea
                style={{ ...css.input, minHeight: 100 }}
                value={shareCaptionDraft}
                onChange={e => setShareCaptionDraft(e.target.value)}
                placeholder="Write a caption for this trip..."
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <Btn variant="secondary" onClick={() => setShareModalTripId(null)}>
                Cancel
              </Btn>
              <Btn variant="primary" onClick={submitShare} disabled={shareSubmitting}>
                {shareSubmitting ? 'Sharing…' : 'Share'}
              </Btn>
            </div>
          </div>
        </div>
      ) : null}

      {previewTrip ? (
        <TripPreviewModal
          trip={previewTrip}
          loading={previewLoading}
          onClose={() => {
            setPreviewTrip(null)
            setPreviewLoading(false)
          }}
          onAdopt={() => {
            const id = previewTrip.id
            setPreviewTrip(null)
            adoptTrip(id)
          }}
        />
      ) : null}
    </div>
  )
}

function TripPreviewModal({ trip, loading, onClose, onAdopt }) {
  return (
    <div style={css.overlay}>
      <Card
        style={{
          width: '100%',
          maxWidth: 760,
          maxHeight: '88vh',
          overflowY: 'auto',
          padding: 20,
          boxShadow: T.shadowLg,
          border: 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 12 }}>
          <div>
            <Badge variant="blue">Trip Preview</Badge>
            <div style={{ marginTop: 10 }}>
              <DisplayHeading black={trip?.title || 'Loading'} blue="." size="md" />
            </div>
            <p style={{ fontSize: 13, color: T.inkMuted, margin: '8px 0 0', fontWeight: 300 }}>
              {trip ? [trip.city, trip.country].filter(Boolean).join(', ') || 'Trip' : ''}
              {trip ? ` · ${trip.duration || 0} days` : ''}
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 22,
              color: T.inkMuted,
              cursor: 'pointer',
              lineHeight: 1,
              padding: 0,
              marginLeft: 12,
            }}
          >
            ×
          </button>
        </div>

        {loading ? (
          <Spinner />
        ) : trip ? (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              <Badge>{trip.budget || '$$'}</Badge>
              <Badge variant="blue">{trip.vibe || 'trip'}</Badge>
              {trip.groupBudget ? <Badge variant="warm">Group budget: ${trip.groupBudget}</Badge> : null}
              {trip.source_platform ? <Badge variant="blue">{trip.source_platform}</Badge> : null}
            </div>

            {trip.cover_img ? (
              <img
                src={trip.cover_img}
                alt={trip.title}
                style={{
                  width: '100%',
                  height: 220,
                  objectFit: 'cover',
                  borderRadius: T.radius,
                  marginBottom: 16,
                  display: 'block',
                }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: 170,
                  background: 'linear-gradient(135deg,#d8e8f8,#eef6e9)',
                  borderRadius: T.radius,
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconBadge emoji="🌍" bg="rgba(255,255,255,0.7)" size={48} />
              </div>
            )}

            <p style={{ fontSize: 14, color: T.inkMid, lineHeight: 1.65, margin: '0 0 20px', fontWeight: 300 }}>
              {trip.caption || 'No caption yet.'}
            </p>

            {(trip.importedItems || []).length ? (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 10 }}>
                  Imported findings
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {trip.importedItems.slice(0, 6).map((item, index) => (
                    <div key={item.id || index} style={{ background: T.sand, borderRadius: T.radius, padding: '10px 12px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>
                        {item.title || item.location_name || 'Untitled item'}
                      </div>
                      {item.description ? (
                        <div style={{ fontSize: 12, color: T.inkMid, marginTop: 3, fontWeight: 300 }}>
                          {item.description}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(trip.days || []).map((day, di) => (
                <div key={day.id || di} style={{ background: T.sand, borderRadius: T.radius, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.inkMuted, marginBottom: 3 }}>
                      Day {day.day}
                    </div>
                    <div style={{ fontFamily: T.ffBlack, fontSize: 16, fontWeight: 900, color: T.ink, letterSpacing: '-0.02em' }}>
                      {day.title || 'No title'}
                    </div>
                  </div>

                  {(day.items || []).map((item, ii) => (
                    <div
                      key={item.id || ii}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        padding: '12px 16px',
                        borderBottom: `1px solid ${T.border}`,
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 3 }}>
                          {item.name || 'Untitled'}
                        </div>
                        <div style={{ fontSize: 12, color: T.inkMuted, fontWeight: 300 }}>
                          {[item.category, item.timeText || item.time_text, item.note || item.location].filter(Boolean).join(' · ')}
                        </div>
                        {item.url ? <div style={{ fontSize: 11, color: T.blue, marginTop: 2 }}>{item.url}</div> : null}
                      </div>

                      {item.spend ? (
                        <span style={{ fontSize: 13, fontWeight: 800, color: T.ink, whiteSpace: 'nowrap', fontFamily: T.ffBlack }}>
                          ${item.spend}
                        </span>
                      ) : null}
                    </div>
                  ))}

                  {!(day.items || []).length ? (
                    <p style={{ fontSize: 12, color: T.inkMuted, padding: '12px 16px', margin: 0, fontWeight: 300 }}>
                      No places added yet.
                    </p>
                  ) : null}
                </div>
              ))}

              {!(trip.days || []).length ? (
                <p style={{ fontSize: 13, color: T.inkMuted, fontWeight: 300 }}>
                  No trip details added yet.
                </p>
              ) : null}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <Btn variant="secondary" onClick={onClose}>Close</Btn>
              <Btn variant="primary" onClick={onAdopt}>Adopt this trip</Btn>
            </div>
          </>
        ) : null}
      </Card>
    </div>
  )
}

const css = {
  label: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: T.inkMuted,
    display: 'block',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    background: T.card,
    border: `1.5px solid ${T.cardBorder}`,
    borderRadius: T.radius,
    padding: '11px 14px',
    fontFamily: T.ff,
    fontSize: 13,
    color: T.ink,
    outline: 'none',
    transition: 'border-color .15s, box-shadow .15s',
    display: 'block',
  },
  inputBlue: {
    width: '100%',
    background: '#e8f0f8',
    border: '1.5px solid rgba(42,109,217,0.15)',
    borderRadius: T.pill,
    padding: '14px 18px',
    fontFamily: T.ff,
    fontSize: 14,
    color: T.ink,
    outline: 'none',
    transition: 'border-color .15s, box-shadow .15s',
    display: 'block',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.28)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    zIndex: 200,
  },
}