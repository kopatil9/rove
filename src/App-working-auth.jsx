import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './index.css'

const C = {
  bg: '#F2F1EF',
  surface: '#FFFFFF',
  border: '#DCDAD5',
  green: '#2D5A3D',
  greenLight: '#E8F0EB',
  greenMid: '#3D7A52',
  text: '#1A1A18',
  textMuted: '#8A8880',
  danger: '#C0392B',
  greenPale: '#F0F5F1'
}

const s = {
  label: {
    fontFamily: "'DM Mono',monospace",
    fontSize: 10,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: C.textMuted,
    marginBottom: 7,
    display: 'block'
  },
  input: {
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '10px 13px',
    fontFamily: "'DM Sans',sans-serif",
    fontSize: 13,
    color: C.text,
    outline: 'none',
    width: '100%'
  },
  button: {
    background: C.green,
    color: '#fff',
    border: 'none',
    borderRadius: 40,
    padding: '12px 26px',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: "'DM Sans',sans-serif"
  }
}

function ErrBanner({ msg }) {

  if (!msg) return null

  return (
    <div
      style={{
        background: '#FEF2F2',
        border: '1px solid #FECACA',
        borderRadius: 10,
        padding: '10px 14px',
        fontSize: 13,
        color: C.danger,
        marginBottom: 16
      }}
    >
      {msg}
    </div>
  )
}

function AuthScreen() {

  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const testSupabaseConnection = async () => {

    setError('')
    setInfo('')

    try {

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`,
        {
          method: 'GET',
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY
          }
        }
      )

      const text = await res.text()

      console.log('STATUS:', res.status)
      console.log('BODY:', text)

      if (!res.ok) {
        setError(`Fetch failed: ${res.status}`)
        return
      }

      setInfo('Supabase connection works')

    } catch (err) {

      console.error(err)
      setError('Failed to fetch')

    }

  }

  const submit = async () => {

    setError('')
    setInfo('')

    if (!email || !pass) {
      setError('Please fill in all fields')
      return
    }

    if (pass.length < 6) {
      setError('Password must be 6 characters')
      return
    }

    setLoading(true)

    try {

      if (mode === 'signup') {

        const { data, error } = await supabase.auth.signUp({
          email: email,
          password: pass,
          options: {
            data: { full_name: name },
            emailRedirectTo: 'http://localhost:5173'
          }
        })

        console.log(data, error)

        if (error) {
          setError(error.message)
        } else {
          setInfo('Account created')
        }

      } else {

        const { data, error } = await supabase.auth.signInWithPassword({
          email: email,
          password: pass
        })

        console.log(data, error)

        if (error) {
          setError(error.message)
        }

      }

    } catch (err) {

      console.error(err)
      setError('Failed to fetch')

    }

    setLoading(false)

  }

  return (

    <div
      style={{
        minHeight: '100vh',
        background: C.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >

      <div style={{ width: 400 }}>

        <h1
          style={{
            textAlign: 'center',
            fontFamily: "'Instrument Serif',serif",
            color: C.green
          }}
        >
          roamr
        </h1>

        <ErrBanner msg={error} />

        {info && <div style={{ marginBottom: 10 }}>{info}</div>}

        {mode === 'signup' && (
          <>
            <label style={s.label}>full name</label>
            <input
              style={s.input}
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </>
        )}

        <label style={s.label}>email</label>
        <input
          style={s.input}
          value={email}
          onChange={e => setEmail(e.target.value)}
        />

        <label style={s.label}>password</label>
        <input
          style={s.input}
          type="password"
          value={pass}
          onChange={e => setPass(e.target.value)}
        />

        <div style={{ marginTop: 15 }}>

          <button
            style={s.button}
            onClick={submit}
            disabled={loading}
          >
            {mode === 'login' ? 'log in' : 'create account'}
          </button>

        </div>

        <div style={{ marginTop: 10 }}>

          <button
            style={{ ...s.button, background: '#888' }}
            onClick={testSupabaseConnection}
          >
            test supabase connection
          </button>

        </div>

        <div style={{ marginTop: 20 }}>

          <button
            onClick={() =>
              setMode(mode === 'login' ? 'signup' : 'login')
            }
          >
            switch to {mode === 'login' ? 'signup' : 'login'}
          </button>

        </div>

      </div>

    </div>

  )

}

function RoamrApp() {

  return (
    <div style={{ padding: 40 }}>
      Logged in app test
    </div>
  )

}

export default function App() {

  const [session, setSession] = useState(undefined)

  useEffect(() => {

    const load = async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data?.session ?? null)
    }

    load()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()

  }, [])

  if (session === undefined) {
    return <div style={{ padding: 40 }}>Checking session...</div>
  }

  if (!session) return <AuthScreen />

  return <RoamrApp />

}