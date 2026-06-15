import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import useTrainingStore from '../store/trainingStore'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(undefined) // undefined = loading
  const [loading, setLoading] = useState(true)

  // ── Load user data from Supabase into Zustand store ───────────────────────
  // Wrapped in try/catch: a failure here must never crash the app or leave it
  // stuck — the UI renders from the persisted store while this runs.
  async function loadUserData(userId) {
    if (!supabase) return
    try {
      const [runsRes, weeksRes, prsRes, profileRes] = await Promise.all([
        supabase.from('runs').select('*').eq('user_id', userId),
        supabase.from('weeks').select('*').eq('user_id', userId),
        supabase.from('personal_records').select('*').eq('user_id', userId),
        supabase.from('athlete_profiles').select('*').eq('user_id', userId).single(),
      ])

      // Runs
      if (runsRes.data?.length) {
        const runs = runsRes.data.map(r => ({
          id: r.id, date: r.date, mileage: r.mileage,
          durationMin: r.duration_min, avgPace: r.avg_pace,
          avgHR: r.avg_hr, maxHR: r.max_hr, avgCadence: r.avg_cadence,
          elevGainFt: r.elev_gain_ft, tss: r.tss, trimp: r.trimp,
          sport: r.sport, filename: r.filename, vo2max: r.vo2max,
          hrZones: r.hr_zones, laps: r.laps,
        }))
        useTrainingStore.setState({ runs })
      }

      // Weeks
      if (weeksRes.data?.length) {
        const weeks = weeksRes.data
          .map(w => ({ ...w.days_json, id: w.id, startDate: w.start_date,
                       plannedMileage: w.planned_mileage, actualMileage: w.actual_mileage,
                       days: w.days }))
          .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))
        useTrainingStore.setState({ weeks })
      }

      // PRs
      if (prsRes.data?.length) {
        const prs = {}
        for (const pr of prsRes.data) {
          prs[pr.event] = { time: pr.time_str || '', date: pr.date_set || '' }
        }
        useTrainingStore.setState({ prs })
      }

      // Profile
      if (profileRes.data) {
        const p = profileRes.data
        useTrainingStore.setState({
          profile: { voMax: p.vo_max ? String(p.vo_max) : '', name: p.name || '', school: p.school || '', sport: p.sport || '' }
        })
      }
    } catch (e) {
      console.error('[Auth] Failed to load user data:', e)
    }
  }

  // ── Clear store on logout ─────────────────────────────────────────────────
  function clearStore() {
    useTrainingStore.setState({
      runs: [], weeks: [],
      prs: { '400m':{time:'',date:''}, '1mi':{time:'',date:''}, '2mi':{time:'',date:''},
             '5k':{time:'',date:''}, '8k':{time:'',date:''}, '10k':{time:'',date:''},
             halfMarathon:{time:'',date:''} },
      profile: { voMax: '' },
    })
  }

  // ── Auth state listener ───────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) { setLoading(false); return }

    let mounted = true

    // Resolve auth state from the stored session. `loading` is ALWAYS cleared
    // (even if getSession rejects) so the app can never get stuck on the dark
    // loading screen. Data loading is fired off separately and never blocks the
    // UI from rendering.
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return
        const u = session?.user ?? null
        setUser(u)
        if (u) {
          useTrainingStore.getState().setSupabaseUserId(u.id)
          loadUserData(u.id)
        }
      })
      .catch((err) => {
        console.error('[Auth] getSession failed:', err)
        if (mounted) setUser(null)
      })
      .finally(() => { if (mounted) setLoading(false) })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      setLoading(false)
      // Defer Supabase data calls OUT of the auth callback — calling them
      // synchronously inside onAuthStateChange can deadlock the auth lock.
      if (u) {
        useTrainingStore.getState().setSupabaseUserId(u.id)
        setTimeout(() => loadUserData(u.id), 0)
      } else {
        useTrainingStore.getState().setSupabaseUserId(null)
        clearStore()
      }
    })

    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  // ── Sign up ───────────────────────────────────────────────────────────────
  async function signUp({ email, password, name }) {
    if (!supabase) throw new Error('Supabase not configured')
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    // Create athlete profile
    if (data.user) {
      await supabase.from('athlete_profiles').upsert({
        user_id: data.user.id, name: name || email.split('@')[0],
        school: '', sport: 'XC · Track',
        agreed_to_tos: true, agreed_at: new Date().toISOString(),
      })
    }
    return data
  }

  // ── Sign in ───────────────────────────────────────────────────────────────
  async function signIn({ email, password }) {
    if (!supabase) throw new Error('Supabase not configured')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  // ── Sign out ──────────────────────────────────────────────────────────────
  async function signOut() {
    if (supabase) await supabase.auth.signOut()
    clearStore()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
