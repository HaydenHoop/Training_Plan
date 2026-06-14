
import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Edit2, Check, X, Trophy, Clock, Calendar, Zap, RefreshCw } from 'lucide-react'
import useTrainingStore from '../store/trainingStore'

/* ─── Event definitions ─────────────────────────────────────────── */
const EVENTS = [
  { key: '400m',        label: '400m',         sub: 'Sprint',       color: '#22d3ee', miles: 0.2485, tol: 0.06  },
  { key: '1mi',         label: '1 Mile',        sub: 'Middle',       color: '#34d399', miles: 1.0,    tol: 0.12  },
  { key: '2mi',         label: '2 Mile',        sub: 'Distance',     color: '#a78bfa', miles: 2.0,    tol: 0.18  },
  { key: '5k',          label: '5K',            sub: '3.1 miles',    color: '#f472b6', miles: 3.1069, tol: 0.3   },
  { key: '8k',          label: '8K',            sub: '4.97 miles',   color: '#fb923c', miles: 4.9709, tol: 0.4   },
  { key: '10k',         label: '10K',           sub: '6.2 miles',    color: '#fbbf24', miles: 6.2137, tol: 0.5   },
  { key: 'halfMarathon',label: 'Half Marathon', sub: '13.1 miles',   color: '#60a5fa', miles: 13.1094, tol: 0.9  },
]

/* ─── Time helpers ──────────────────────────────────────────────── */
function fmtMins(totalMins) {
  if (!totalMins || isNaN(totalMins)) return null
  const h = Math.floor(totalMins / 60)
  const m = Math.floor(totalMins % 60)
  const s = Math.round((totalMins * 60) % 60)
  const ss = String(s).padStart(2, '0')
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${ss}`
  return `${m}:${ss}`
}

/* ─── Estimate PRs from imported runs ───────────────────────────── */
function estimatePRs(runs) {
  const result = {}
  for (const ev of EVENTS) {
    const cands = runs.filter(r =>
      r.mileage > 0 && r.durationMin > 0 &&
      Math.abs(r.mileage - ev.miles) <= ev.tol
    )
    if (!cands.length) { result[ev.key] = null; continue }
    // Best = lowest pace (durationMin / mileage)
    const best = cands.reduce((b, r) =>
      (r.durationMin / r.mileage) < (b.durationMin / b.mileage) ? r : b
    )
    // Scale to exact distance
    const pacePerMile = best.durationMin / best.mileage
    const raceMins = pacePerMile * ev.miles
    result[ev.key] = { time: fmtMins(raceMins), date: best.date, source: 'estimated' }
  }
  return result
}

/* ─── Estimate VO₂ max from runs ────────────────────────────────── */
function estimateVO2(runs) {
  // 1. Prefer device-reported vo2max (from FIT files)
  const vo2Runs = runs.filter(r => r.vo2max > 0)
  if (vo2Runs.length) {
    const sorted = [...vo2Runs].sort((a, b) => a.date.localeCompare(b.date))
    return { value: sorted[sorted.length - 1].vo2max.toFixed(1), source: 'device' }
  }
  // 2. Estimate from best 5k-ish effort using Jack Daniels' formula
  const fiveK = runs.filter(r => r.mileage > 0 && r.durationMin > 0 &&
    Math.abs(r.mileage - 3.1069) <= 0.5)
  if (fiveK.length) {
    const best = fiveK.reduce((b, r) =>
      (r.durationMin / r.mileage) < (b.durationMin / b.mileage) ? r : b)
    const paceMin = best.durationMin / best.mileage          // min/mile
    const vdot = 29.54 + 5.000663 * paceMin - 0.007546 * paceMin * paceMin * paceMin
    if (vdot > 20 && vdot < 90) return { value: vdot.toFixed(1), source: 'estimated' }
  }
  // 3. Estimate from HRmax/HRrest (Karvonen)
  const hrRuns = runs.filter(r => r.avgHR > 0 && r.maxHR > 0)
  if (hrRuns.length >= 5) {
    const avgRest = hrRuns.reduce((s, r) => s + r.avgHR, 0) / hrRuns.length
    const maxHR = Math.max(...hrRuns.map(r => r.maxHR))
    const est = 15 * (maxHR / avgRest)
    if (est > 20 && est < 90) return { value: est.toFixed(1), source: 'estimated' }
  }
  return null
}

/* ─── PR Card ───────────────────────────────────────────────────── */
function PRCard({ event, pr, estimated, setPR }) {
  const [editField, setEditField] = useState(null)
  const [draft, setDraft]         = useState('')

  const displayTime = pr?.time || estimated?.time
  const displayDate = pr?.date || estimated?.date
  const isEstimated = !pr?.time && !!estimated?.time

  const startEdit = (field) => { setEditField(field); setDraft((field==='time'?pr?.time:pr?.date)||'') }
  const commit = (field) => { setPR(event.key, field, draft.trim()); setEditField(null) }

  return (
    <motion.div
      initial={{ opacity:0, y:18 }} whileInView={{ opacity:1, y:0 }}
      viewport={{ once:true }} transition={{ duration:0.45 }}
      style={{
        position:'relative', overflow:'hidden', borderRadius:20,
        border:`1px solid ${event.color}28`,
        background:`linear-gradient(135deg, ${event.color}12 0%, rgba(255,255,255,0.03) 100%)`,
        padding:'24px 26px',
      }}>
      <div style={{ position:'absolute',top:0,left:0,right:0,height:2,background:`linear-gradient(to right,${event.color},transparent)` }}/>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:16 }}>
        <div>
          <p className="font-display font-bold text-white" style={{ fontSize:26 }}>{event.label}</p>
          <p className="font-mono text-slate-400 uppercase" style={{ fontSize:9, letterSpacing:'0.2em', marginTop:2 }}>{event.sub}</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {isEstimated && (
            <span style={{ fontSize:8, fontFamily:'monospace', color:event.color, background:`${event.color}18`,
                           border:`1px solid ${event.color}35`, borderRadius:6, padding:'2px 7px',
                           textTransform:'uppercase', letterSpacing:'0.15em' }}>est.</span>
          )}
          <Trophy size={16} style={{ color:event.color, opacity:0.6 }}/>
        </div>
      </div>

      {/* Time */}
      <div style={{ marginBottom:12 }}>
        <p style={{ fontSize:9, color:'#64748b', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.2em', marginBottom:6, display:'flex', alignItems:'center', gap:5 }}>
          <Clock size={8}/> Best Time
        </p>
        {editField==='time' ? (
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <input autoFocus value={draft} onChange={e=>setDraft(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter')commit('time'); if(e.key==='Escape')setEditField(null) }}
              placeholder="e.g. 4:32 or 15:44"
              style={{ flex:1, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.2)',
                       borderRadius:10, padding:'9px 13px', color:'white', fontSize:14, fontFamily:'monospace',
                       outline:'none' }}/>
            <button onClick={()=>commit('time')} style={{ padding:'8px 10px', borderRadius:10, background:'rgba(74,222,128,0.2)', color:'#4ade80', border:'none', cursor:'pointer' }}><Check size={14}/></button>
            <button onClick={()=>setEditField(null)} style={{ padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.08)', color:'#94a3b8', border:'none', cursor:'pointer' }}><X size={14}/></button>
          </div>
        ) : (
          <button onClick={()=>startEdit('time')} className="group" style={{ display:'flex', alignItems:'baseline', gap:8, background:'none', border:'none', cursor:'pointer', textAlign:'left' }}>
            <span className="font-display font-bold text-white tabular-nums"
                  style={{ fontSize: displayTime ? 40 : 28, opacity: displayTime ? 1 : 0.2, color: isEstimated ? event.color : 'white' }}>
              {displayTime || '—:——'}
            </span>
            <Edit2 size={11} style={{ color:'#475569', opacity:0, marginBottom:2 }} className="group-hover:opacity-100 transition-opacity"/>
          </button>
        )}
      </div>

      {/* Date */}
      <div>
        <p style={{ fontSize:9, color:'#64748b', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.2em', marginBottom:5, display:'flex', alignItems:'center', gap:5 }}>
          <Calendar size={8}/> Date
        </p>
        {editField==='date' ? (
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <input autoFocus type="date" value={draft} onChange={e=>setDraft(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter')commit('date'); if(e.key==='Escape')setEditField(null) }}
              style={{ flex:1, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.2)',
                       borderRadius:10, padding:'9px 13px', color:'white', fontSize:13,
                       outline:'none' }}/>
            <button onClick={()=>commit('date')} style={{ padding:'8px 10px', borderRadius:10, background:'rgba(74,222,128,0.2)', color:'#4ade80', border:'none', cursor:'pointer' }}><Check size={14}/></button>
            <button onClick={()=>setEditField(null)} style={{ padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.08)', color:'#94a3b8', border:'none', cursor:'pointer' }}><X size={14}/></button>
          </div>
        ) : (
          <button onClick={()=>startEdit('date')} className="group" style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer' }}>
            <span style={{ fontSize:13, color: displayDate ? '#94a3b8' : '#334155', fontFamily:'monospace' }}>
              {displayDate || 'Not set'}
            </span>
            <Edit2 size={10} style={{ color:'#475569', opacity:0 }} className="group-hover:opacity-100 transition-opacity"/>
          </button>
        )}
      </div>
    </motion.div>
  )
}

/* ─── PRsView ───────────────────────────────────────────────────── */
export default function PRsView() {
  const prs        = useTrainingStore(s => s.prs) || {}
  const profile    = useTrainingStore(s => s.profile) || {}
  const runs       = useTrainingStore(s => s.runs) || []
  const setPR      = useTrainingStore(s => s.setPR)
  const setProfile = useTrainingStore(s => s.setProfile)

  const estimated  = useMemo(() => estimatePRs(runs), [runs])
  const estVO2     = useMemo(() => estimateVO2(runs), [runs])

  const [editVo2, setEditVo2]   = useState(false)
  const [vo2Draft, setVo2Draft] = useState('')

  // Auto-suggest VO2 if not set
  const displayVO2   = profile.voMax || estVO2?.value
  const vo2IsEst     = !profile.voMax && !!estVO2?.value
  const vo2Source    = estVO2?.source

  return (
    <div style={{ background:'#060912', minHeight:'100vh', color:'white' }}>
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'64px 40px' }}>

        {/* Header */}
        <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.55 }} style={{ marginBottom:48 }}>
          <p style={{ fontSize:10, fontFamily:'monospace', color:'rgba(255,255,255,0.22)', textTransform:'uppercase', letterSpacing:'0.4em', marginBottom:14 }}>— Personal Records</p>
          <h1 className="font-display font-bold text-white" style={{ fontSize:52, lineHeight:1 }}>
            Hayden's <span style={{ background:'linear-gradient(to right,#22d3ee,#818cf8)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>PR Board</span>
          </h1>
          {runs.length > 0 && (
            <p style={{ fontSize:13, color:'#475569', marginTop:12, display:'flex', alignItems:'center', gap:6 }}>
              <RefreshCw size={11}/> Times marked <span style={{ color:'#22d3ee' }}>est.</span> are automatically detected from your {runs.length} imported runs. Click to override.
            </p>
          )}
          {runs.length === 0 && (
            <p style={{ fontSize:13, color:'#475569', marginTop:12 }}>Import runs from the Upload tab to auto-detect your PRs.</p>
          )}
        </motion.div>

        {/* VO₂ Max banner */}
        <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1, duration:0.5 }}
          style={{ marginBottom:36, borderRadius:20, border:'1px solid rgba(255,255,255,0.08)', padding:'24px 28px',
                   background:'rgba(255,255,255,0.03)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <p style={{ fontSize:9, fontFamily:'monospace', color:'rgba(255,255,255,0.28)', textTransform:'uppercase', letterSpacing:'0.3em', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
              <Zap size={10}/> VO₂ Max
              {vo2IsEst && <span style={{ color:'#22d3ee', fontSize:8, background:'rgba(34,211,238,0.1)', border:'1px solid rgba(34,211,238,0.25)', borderRadius:5, padding:'1px 6px' }}>
                {vo2Source === 'device' ? 'from device' : 'estimated'}
              </span>}
            </p>
            {editVo2 ? (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <input autoFocus value={vo2Draft} onChange={e=>setVo2Draft(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter'){setProfile('voMax',vo2Draft.trim());setEditVo2(false)} if(e.key==='Escape')setEditVo2(false) }}
                  placeholder="e.g. 62.4"
                  style={{ width:110, background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:10, padding:'10px 14px', color:'white', fontSize:15, fontFamily:'monospace', outline:'none' }}/>
                <button onClick={()=>{setProfile('voMax',vo2Draft.trim());setEditVo2(false)}} style={{ padding:'9px 11px', borderRadius:10, background:'rgba(74,222,128,0.18)', color:'#4ade80', border:'none', cursor:'pointer' }}><Check size={14}/></button>
                <button onClick={()=>setEditVo2(false)} style={{ padding:'9px 11px', borderRadius:10, background:'rgba(255,255,255,0.07)', color:'#94a3b8', border:'none', cursor:'pointer' }}><X size={14}/></button>
              </div>
            ) : (
              <button onClick={()=>{setVo2Draft(profile.voMax||'');setEditVo2(true)}} className="group" style={{ display:'flex', alignItems:'baseline', gap:10, background:'none', border:'none', cursor:'pointer' }}>
                <span className="font-display font-bold tabular-nums" style={{ fontSize:48, color: displayVO2 ? '#22d3ee' : 'rgba(255,255,255,0.2)' }}>
                  {displayVO2 || '—'}
                </span>
                {displayVO2 && <span style={{ fontSize:14, color:'#475569', fontFamily:'monospace' }}>mL/kg/min</span>}
                <Edit2 size={13} style={{ color:'#475569', opacity:0, marginBottom:6 }} className="group-hover:opacity-100 transition-opacity"/>
              </button>
            )}
          </div>
          <div style={{ textAlign:'right', fontSize:11, color:'#334155', fontFamily:'monospace', lineHeight:1.7 }}>
            <p>Click to manually override</p>
            <p>Auto-detected from imported runs</p>
          </div>
        </motion.div>

        {/* PR grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 }}>
          {EVENTS.map((ev, i) => (
            <motion.div key={ev.key} initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.08+i*0.06, duration:0.5 }}>
              <PRCard event={ev} pr={prs[ev.key]||{time:'',date:''}} estimated={estimated[ev.key]} setPR={setPR}/>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
