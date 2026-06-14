import { useMemo, useRef, useState, useEffect } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import {
  Activity, Flame, TrendingUp, Heart, Mountain, Calendar,
  ArrowRight, AlertTriangle, CheckCircle, Info, ChevronDown, ArrowUpRight, Trophy
} from 'lucide-react'
import useTrainingStore from '../store/trainingStore'
import { analyzeTraining, computeStreaks } from '../utils/analysis'
import { format, parseISO } from 'date-fns'

/* ─── Photos ─────────────────────────────────────────────────── */
// Hero: empty Hayward Field / stadium at golden hour — no people
const HERO_PHOTO    = '/hayward_img.jpg'
// Schedule: athletics track close-up / lane lines
const VENUE_PHOTO   = 'https://images.unsplash.com/photo-1461897104016-0b3b00cc81ee?w=900&auto=format&fit=crop&q=80'
// Insights accent
const INSIGHT_PHOTO = 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=500&auto=format&fit=crop&q=80'

/* ─── Animated number hook ───────────────────────────────────── */
function useCountUp(target, decimals = 0) {
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-30px' })
  const [val, setVal] = useState('0')
  useEffect(() => {
    if (!inView) return
    const n = parseFloat(target)
    if (isNaN(n)) { setVal(String(target)); return }
    const dur = 1500, t0 = performance.now()
    const tick = now => {
      const p = Math.min(1, (now - t0) / dur)
      setVal(((1 - Math.pow(1 - p, 3)) * n).toFixed(decimals))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [inView, target, decimals])
  return [val, ref]
}


/* ─── VO₂ estimate from runs ─────────────────────────────────── */
function estimateVO2fromRuns(runs) {
  if (!runs || !runs.length) return null
  // 1. Device-reported (Garmin/Coros FIT)
  const vo2Runs = runs.filter(r => r.vo2max > 0)
  if (vo2Runs.length) {
    const sorted = [...vo2Runs].sort((a, b) => a.date.localeCompare(b.date))
    return +sorted[sorted.length - 1].vo2max.toFixed(1)
  }
  // 2. Jack Daniels VDOT from best ~5k effort
  const fiveK = runs.filter(r => r.mileage > 0 && r.durationMin > 0 && Math.abs(r.mileage - 3.1069) <= 0.5)
  if (fiveK.length) {
    const best = fiveK.reduce((b, r) => (r.durationMin / r.mileage) < (b.durationMin / b.mileage) ? r : b)
    const p = best.durationMin / best.mileage
    const v = 29.54 + 5.000663 * p - 0.007546 * p * p * p
    if (v > 20 && v < 90) return +v.toFixed(1)
  }
  // 3. HR-based estimate
  const hrRuns = runs.filter(r => r.avgHR > 0 && r.maxHR > 0)
  if (hrRuns.length >= 3) {
    const avgRest = hrRuns.reduce((s, r) => s + r.avgHR, 0) / hrRuns.length
    const maxHR   = Math.max(...hrRuns.map(r => r.maxHR))
    const est = 15 * (maxHR / avgRest)
    if (est > 20 && est < 90) return +est.toFixed(1)
  }
  return null
}

/* ─── Individual glass stat card ON the hero ─────────────────── */
function HeroStatCard({ label, value, suffix, dec, delay, icon: Icon, color }) {
  const num   = parseFloat(value)
  const isNum = !isNaN(num)
  const [anim, ref] = useCountUp(isNum ? num : 0, dec)

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.88, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.03, y: -4 }}
      style={{
        width: 300, height: 300,
        background:          'rgba(255,255,255,0.08)',
        backdropFilter:      'blur(48px)',
        WebkitBackdropFilter:'blur(48px)',
        border:              '1px solid rgba(255,255,255,0.22)',
        borderTop:           '1px solid rgba(255,255,255,0.38)',
        borderRadius:        24,
        padding:             '24px 28px 28px',
        display:             'flex',
        flexDirection:       'column',
        justifyContent:      'space-between',
        cursor:              'default',
        boxSizing:           'border-box',
        boxShadow:           '0 8px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.14)',
        overflow:            'hidden',
      }}
    >
      {/* Label row */}
      <div style={{ display:'flex', alignItems:'center', gap:9 }}>
        <div style={{ width:32, height:32, borderRadius:10, background:`${color}28`,
                      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Icon size={18} style={{ color }} strokeWidth={2.5}/>
        </div>
        <span style={{ fontSize:15, color:'rgba(255,255,255,0.65)', fontFamily:'monospace',
                       textTransform:'uppercase', letterSpacing:'0.14em', fontWeight:600 }}>{label}</span>
      </div>

      {/* Big number — fills the rest of the box */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
        <p className="font-display font-bold text-white tabular-nums"
           style={{ fontSize: 96, lineHeight: 0.82, letterSpacing:'-0.03em' }}>
          {isNum ? anim : value}
        </p>
        {suffix && (
          <p style={{ fontSize:22, color:`${color}cc`, fontFamily:'monospace',
                      fontWeight:600, marginTop:10, letterSpacing:'0.05em' }}>
            {suffix.trim()}
          </p>
        )}
      </div>

      {/* Subtle color accent bottom bar */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:3,
                    background:`linear-gradient(to right,${color}60,transparent)`,
                    borderRadius:'0 0 24px 24px' }}/>
    </motion.div>
  )
}

/* ─── Section 1: Cinematic hero ──────────────────────────────── */
function HeroSection({ thisWeekActual, thisWeekPlanned, last4Avg, avgHR, streaks, totalMiles, setActivePage, vo2Est }) {
  const profile = useTrainingStore(s => s.profile) || {}
  const vo2Display = profile.voMax || (vo2Est ? String(vo2Est) : null)
  return (
    <section style={{ height: 'calc(100vh - 56px)', position: 'relative', overflow: 'hidden' }}>

      {/* Slow-zoom background photo */}
      <motion.div className="absolute inset-0"
        initial={{ scale: 1.12 }} animate={{ scale: 1 }}
        transition={{ duration: 2.6, ease: [0, 0, 0.2, 1] }}>
        <img src={HERO_PHOTO} alt="" className="w-full h-full object-cover" />
      </motion.div>

      {/* Gradient overlays */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.02) 38%, rgba(0,0,0,0.82) 100%)' }}/>

      {/* Film grain */}
      <svg aria-hidden="true" style={{ position:'absolute',inset:0,width:'100%',height:'100%',opacity:0.06,mixBlendMode:'overlay',pointerEvents:'none' }}>
        <filter id="g-dash">
          <feTurbulence type="fractalNoise" baseFrequency="0.78" numOctaves="4" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0"/>
        </filter>
        <rect width="100%" height="100%" filter="url(#g-dash)"/>
      </svg>

      {/* ── Centered headline — one line, over the trees ── */}
      <div className="absolute inset-x-0 z-10 flex flex-col items-center text-center"
           style={{ top: '11%' }}>
        <motion.p
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6 }}
          className="font-mono text-white/45 uppercase mb-5"
          style={{ fontSize: 11, letterSpacing: '0.4em' }}>
          HAYDEN HOOPER · {format(new Date(), 'MMMM d, yyyy')}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="font-display font-bold text-white tracking-tight uppercase"
          style={{ fontSize: 'clamp(38px, 5vw, 78px)', whiteSpace: 'nowrap', lineHeight: 1 }}>
          BUILT FOR THE COURSE
        </motion.h1>
        <motion.div
          initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
          transition={{ delay: 0.7, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin:'center', marginTop:20, height:2, width:100,
                   background:'linear-gradient(to right,#22d3ee,#818cf8)' }}/>
      </div>

      {/* ── Cards: centered vertically in hero, spaced evenly horizontally ── */}
      <div className="absolute z-10" style={{ top:'27%', bottom:'3%', left:'4%', right:'4%', display:'flex', alignItems:'center', justifyContent:'space-evenly' }}>

        {/* Large profile card */}
        <motion.div
          initial={{ opacity:0, y:30, scale:0.93 }} animate={{ opacity:1, y:0, scale:1 }}
          transition={{ delay:0.42, duration:0.75, ease:[0.22,1,0.36,1] }}
          style={{
            width: 616, height: 616, flexShrink: 0,
            display:'flex', flexDirection:'column', justifyContent:'space-between',
            background:'rgba(10,12,24,0.55)',
            backdropFilter:'blur(32px)', WebkitBackdropFilter:'blur(32px)',
            border:'1px solid rgba(255,255,255,0.14)',
            borderRadius:22, padding:'44px 48px',
          }}>
          <p className="font-mono text-white/25 uppercase mb-1" style={{ fontSize:8.5, letterSpacing:'0.35em' }}>Athlete Profile</p>
          <p className="font-display font-bold text-white" style={{ fontSize:54, lineHeight:0.95, marginBottom:8 }}>Hayden Hooper</p>
          <p className="font-mono text-white/40" style={{ fontSize:14 }}>Colorado School of Mines · XC / Track</p>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'18px 24px', marginBottom:24 }}>
            <div>
              <p className="font-mono text-white/40 uppercase mb-2" style={{ fontSize:12, letterSpacing:'0.22em' }}>Total Miles</p>
              <p className="font-display font-bold text-white tabular-nums" style={{ fontSize:64 }}>{totalMiles.toLocaleString()}</p>
            </div>
            <div>
              <p className="font-mono text-white/40 uppercase mb-2" style={{ fontSize:12, letterSpacing:'0.22em' }}>VO₂ Max</p>
              <p className="font-display font-bold tabular-nums" style={{ fontSize:64, color: vo2Display ? '#22d3ee' : 'rgba(255,255,255,0.2)' }}>
                {vo2Display || '—'}
              </p>
            </div>
            <div>
              <p className="font-mono text-white/40 uppercase mb-2" style={{ fontSize:12, letterSpacing:'0.22em' }}>School</p>
              <p className="font-display font-bold text-white" style={{ fontSize:22 }}>Mines</p>
            </div>
            <div>
              <p className="font-mono text-white/40 uppercase mb-2" style={{ fontSize:12, letterSpacing:'0.22em' }}>Sport</p>
              <p className="font-display font-bold text-white" style={{ fontSize:22 }}>XC · Track</p>
            </div>
          </div>

          <button onClick={() => setActivePage('prs')}
            className="hover:bg-cyan-400/20 transition-colors"
            style={{
              width:'100%', background:'rgba(34,211,238,0.12)',
              border:'1px solid rgba(34,211,238,0.32)', borderRadius:12,
              padding:'18px 22px', color:'#22d3ee', fontSize:15,
              fontWeight:700, cursor:'pointer', letterSpacing:'0.04em',
              display:'flex', alignItems:'center', justifyContent:'center', gap:7,
            }}>
            <Trophy size={13}/> View PR Records
          </button>
        </motion.div>

        {/* 2×2 square stat grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,300px)', gridTemplateRows:'repeat(2,300px)', gap:16, flexShrink:0 }}>
          <HeroStatCard label="This Week"   value={thisWeekActual}  suffix=" mi"  dec={1} delay={0.55} icon={TrendingUp} color="#22d3ee"/>
          <HeroStatCard label="4-Week Avg"  value={last4Avg}        suffix=" mi"  dec={1} delay={0.62} icon={Flame}      color="#fb923c"/>
          <HeroStatCard label="Avg HR"      value={avgHR}           suffix=" bpm" dec={0} delay={0.69} icon={Heart}      color="#c084fc"/>
          <HeroStatCard label="Streak"      value={streaks.current} suffix="w"   dec={0} delay={0.76} icon={Activity}   color="#4ade80"/>
        </div>
      </div>

      {/* Scroll cue */}
      <motion.div className="absolute left-1/2 -translate-x-1/2 z-10"
        style={{ bottom: 6 }}
        animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}>
        <ChevronDown size={14} className="text-white/20"/>
      </motion.div>
    </section>
  )
}

/* ─── Section 2: 50/50 venue photo + schedule ────────────────── */
function ScheduleSection({ currentWeek, runs, todayStr, weekPct, thisWeekActual, thisWeekPlanned, setActivePage }) {
  return (
    <section style={{ minHeight: '75vh', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>

      {/* Left: venue photo */}
      <div className="relative overflow-hidden">
        <motion.div className="absolute inset-0"
          initial={{ scale: 1.08 }} whileInView={{ scale: 1 }} viewport={{ once: true }}
          transition={{ duration: 1.4, ease: [0, 0, 0.2, 1] }}>
          <img src={VENUE_PHOTO} alt="Track" className="w-full h-full object-cover"/>
        </motion.div>
        <div className="absolute inset-0" style={{ background:'linear-gradient(to right,rgba(0,0,0,0.55) 0%,rgba(0,0,0,0.15) 100%)' }}/>
        <div className="absolute inset-0" style={{ background:'linear-gradient(to top,rgba(0,0,0,0.7) 0%,transparent 50%)' }}/>

        <motion.div className="absolute bottom-10 left-10"
          initial={{ opacity:0,y:18 }} whileInView={{ opacity:1,y:0 }} viewport={{ once:true }}
          transition={{ delay:0.2,duration:0.7 }}>
          <p style={{ fontSize:9,color:'rgba(255,255,255,0.38)',fontFamily:'monospace',textTransform:'uppercase',letterSpacing:'0.3em',marginBottom:8 }}>
            Eugene, OR · Athletics
          </p>
          <p className="font-display text-white font-bold leading-tight" style={{ fontSize:36 }}>
            This<br/>Week
          </p>
          <div style={{ marginTop:14,height:2,width:60,background:'linear-gradient(to right,#22d3ee,#818cf8)',borderRadius:1 }}/>
        </motion.div>

        {/* Floating progress pill */}
        <motion.div className="absolute top-10 right-10"
          initial={{ opacity:0,scale:0.85 }} whileInView={{ opacity:1,scale:1 }} viewport={{ once:true }}
          transition={{ delay:0.35,duration:0.6 }}
          style={{ background:'rgba(5,10,20,0.78)',backdropFilter:'blur(14px)',
                   border:'1px solid rgba(255,255,255,0.1)',borderRadius:16,
                   padding:'16px 20px',textAlign:'center',minWidth:110 }}>
          <p className="font-display font-bold text-cyan-300 tabular-nums" style={{ fontSize:32 }}>
            {weekPct.toFixed(0)}%
          </p>
          <p style={{ fontSize:9,color:'rgba(255,255,255,0.38)',fontFamily:'monospace',textTransform:'uppercase',letterSpacing:'0.2em',marginTop:4 }}>of plan</p>
          <div style={{ marginTop:8,height:3,background:'rgba(255,255,255,0.1)',borderRadius:2,overflow:'hidden' }}>
            <motion.div
              initial={{ width:0 }} whileInView={{ width:`${weekPct}%` }} viewport={{ once:true }}
              transition={{ delay:0.6,duration:1.3,ease:[0.22,1,0.36,1] }}
              style={{ height:'100%',background:'linear-gradient(to right,#22d3ee,#3b82f6)',borderRadius:2 }}/>
          </div>
        </motion.div>
      </div>

      {/* Right: schedule list */}
      <div style={{ background:'#f8fafc',color:'#0f172a',padding:'48px 40px',overflowY:'auto' }}>
        <div className="flex items-center justify-between" style={{ marginBottom:28 }}>
          <div>
            <p style={{ fontSize:10,color:'#94a3b8',fontFamily:'monospace',textTransform:'uppercase',letterSpacing:'0.2em',marginBottom:4 }}>
              {currentWeek
                ? `${format(parseISO(currentWeek.startDate),'MMM d')} — ${format(parseISO(currentWeek.days[6].date),'MMM d')}`
                : ''}
            </p>
            <h2 className="font-display font-bold text-slate-900" style={{ fontSize:22 }}>Training Schedule</h2>
          </div>
          <button onClick={() => setActivePage('log')}
            className="flex items-center gap-1.5 text-sm font-semibold text-cyan-600 hover:text-cyan-700 bg-cyan-50 hover:bg-cyan-100 px-3 py-2 rounded-xl transition-colors">
            Edit <ArrowRight size={13}/>
          </button>
        </div>

        <div className="space-y-1">
          {currentWeek?.days.map((day, idx) => {
            const dayRuns = runs.filter(r => r.date === day.date)
            const run = dayRuns.length === 0 ? null : {
              mileage: +dayRuns.reduce((s,r)=>s+(r.mileage||0),0).toFixed(1),
              avgHR: (() => { const hr=dayRuns.filter(r=>r.avgHR>0); return hr.length?Math.round(hr.reduce((s,r)=>s+r.avgHR,0)/hr.length):0 })(),
              avgPace: dayRuns.filter(r=>r.avgPace&&r.mileage>0).sort((a,b)=>b.mileage-a.mileage)[0]?.avgPace||null,
            }
            const isToday = day.date === todayStr
            const isPast  = new Date(day.date) < new Date(new Date().toDateString())
            const hasRun  = !!run
            return (
              <motion.div key={day.date}
                initial={{ opacity:0,x:28 }} whileInView={{ opacity:1,x:0 }} viewport={{ once:true,margin:'-10px' }}
                transition={{ delay:idx*0.045,duration:0.5,ease:[0.22,1,0.36,1] }}
                className={`flex items-center gap-3 py-3 px-4 rounded-xl border transition-all
                  ${isToday ? 'bg-cyan-50 border-cyan-200/80 ring-1 ring-cyan-200/50' : 'border-transparent hover:bg-slate-50 hover:border-slate-100'}`}>
                <div className="text-center w-10 shrink-0">
                  <p style={{ fontSize:9,color:'#94a3b8',textTransform:'uppercase',fontFamily:'monospace' }}>{format(parseISO(day.date),'EEE')}</p>
                  <p className={`text-sm font-bold ${isToday?'text-cyan-600':'text-slate-400'}`}>{format(parseISO(day.date),'d')}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{day.workoutType}</p>
                  <p className="text-xs text-slate-400">{day.plannedMileage} mi planned</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {hasRun && run.avgHR > 0 && (
                    <span className="flex items-center gap-1 text-xs text-rose-500">
                      <Heart size={10} strokeWidth={2.5}/>{run.avgHR}
                    </span>
                  )}
                  {hasRun && run.avgPace && (
                    <span className="text-xs font-mono text-slate-400">{run.avgPace}/mi</span>
                  )}
                  <span className={`text-xs font-bold tabular-nums w-14 text-right
                    ${hasRun?'text-emerald-600':isPast?'text-slate-300':'text-slate-400'}`}>
                    {hasRun ? `${run.mileage?.toFixed(1)} mi` : day.plannedMileage>0?'—':'Rest'}
                  </span>
                </div>
              </motion.div>
            )
          }) || (
            <p className="text-sm text-slate-400 py-8 text-center">
              No plan — <button onClick={()=>setActivePage('upload')} className="text-cyan-600 font-semibold">upload one</button>
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

/* ─── Section 3: Dark insights + accent photo ────────────────── */
const INS_CFG = {
  warning:  { bg:'rgba(251,146,60,0.09)',  border:'rgba(251,146,60,0.28)',  Icon:AlertTriangle, ic:'#fb923c' },
  positive: { bg:'rgba(74,222,128,0.09)',  border:'rgba(74,222,128,0.28)',  Icon:CheckCircle,   ic:'#4ade80' },
  info:     { bg:'rgba(34,211,238,0.09)',  border:'rgba(34,211,238,0.28)',  Icon:Info,          ic:'#22d3ee' },
}

function InsightsSection({ insights }) {
  return (
    <section className="relative bg-[#060912] py-24 overflow-hidden">
      <div className="dot-grid absolute inset-0 pointer-events-none"/>
      <div style={{ position:'absolute',top:'-20%',left:'5%',width:500,height:500,borderRadius:'50%',background:'radial-gradient(circle,rgba(34,211,238,0.05),transparent 70%)' }}/>

      <div className="max-w-screen-xl mx-auto px-10">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:64, alignItems:'start' }}>
          <div>
            <motion.div initial={{ opacity:0,y:18 }} whileInView={{ opacity:1,y:0 }} viewport={{ once:true }} transition={{ duration:0.6 }}>
              <p style={{ fontSize:10,color:'rgba(255,255,255,0.22)',fontFamily:'monospace',textTransform:'uppercase',letterSpacing:'0.35em',marginBottom:12 }}>— Analysis</p>
              <h2 className="font-display font-bold text-white leading-tight" style={{ fontSize:48, marginBottom:36 }}>
                Training<br/><span className="text-gradient">Insights</span>
              </h2>
            </motion.div>
            <div className="space-y-3">
              {insights.length === 0 ? (
                <motion.div initial={{ opacity:0,y:14 }} whileInView={{ opacity:1,y:0 }} viewport={{ once:true }}
                  style={{ background:'rgba(74,222,128,0.09)',border:'1px solid rgba(74,222,128,0.28)',borderRadius:16,padding:'20px 24px' }}>
                  <div className="flex items-center gap-3">
                    <CheckCircle size={15} style={{ color:'#4ade80' }}/>
                    <p className="font-semibold text-white">All systems go</p>
                  </div>
                  <p className="text-sm text-slate-400 mt-1.5">Training load looks healthy. Keep it up!</p>
                </motion.div>
              ) : insights.slice(0,6).map((ins,i) => {
                const c = INS_CFG[ins.type] || INS_CFG.info
                const { Icon } = c
                return (
                  <motion.div key={i}
                    initial={{ opacity:0,x:-28 }} whileInView={{ opacity:1,x:0 }} viewport={{ once:true,margin:'-16px' }}
                    transition={{ delay:i*0.07,duration:0.55,ease:[0.22,1,0.36,1] }}
                    whileHover={{ x:5 }}
                    style={{ background:c.bg,border:`1px solid ${c.border}`,borderRadius:16,padding:'18px 22px' }}>
                    <div className="flex items-start gap-3">
                      <Icon size={14} style={{ color:c.ic,marginTop:2,flexShrink:0 }}/>
                      <div>
                        <p className="text-sm font-semibold text-white">{ins.title}</p>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{ins.body}</p>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>

          {/* Right: accent photo */}
          <motion.div
            initial={{ opacity:0,scale:0.9,y:24 }} whileInView={{ opacity:1,scale:1,y:0 }}
            viewport={{ once:true }} transition={{ duration:0.85,ease:[0.22,1,0.36,1],delay:0.15 }}
            style={{ borderRadius:22,overflow:'hidden',position:'sticky',top:24 }}>
            <img src={INSIGHT_PHOTO} alt="" style={{ width:'100%',height:440,objectFit:'cover',display:'block' }}/>
            <div style={{ position:'absolute',inset:0,background:'linear-gradient(to top,rgba(6,9,18,0.8) 0%,transparent 55%)' }}/>
            <div style={{ position:'absolute',bottom:22,left:22 }}>
              <p style={{ fontSize:9,color:'rgba(255,255,255,0.38)',fontFamily:'monospace',textTransform:'uppercase',letterSpacing:'0.25em',marginBottom:6 }}>In Motion</p>
              <p className="font-display font-bold text-white" style={{ fontSize:18,lineHeight:1.2 }}>Every Mile<br/>Counts</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

/* ─── Section 4: Giant all-time number ───────────────────────── */
function AllTimeSection({ total, setActivePage }) {
  const [anim, ref] = useCountUp(total, 0)
  return (
    <section className="relative section-light py-32 overflow-hidden text-center">
      <div className="dot-grid-light absolute inset-0 pointer-events-none"/>
      <div style={{ position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',
                    width:700,height:700,borderRadius:'50%',
                    background:'radial-gradient(circle,rgba(34,211,238,0.07),transparent 65%)' }}/>
      <div className="relative">
        <motion.p initial={{ opacity:0,y:10 }} whileInView={{ opacity:1,y:0 }} viewport={{ once:true }} transition={{ duration:0.5 }}
          style={{ fontSize:10,color:'#94a3b8',fontFamily:'monospace',textTransform:'uppercase',letterSpacing:'0.4em',marginBottom:20 }}>
          All-Time Mileage
        </motion.p>
        <motion.div ref={ref} initial={{ opacity:0,scale:0.82 }} whileInView={{ opacity:1,scale:1 }}
          viewport={{ once:true }} transition={{ duration:0.95,ease:[0.22,1,0.36,1],delay:0.1 }}>
          <p className="font-display font-bold text-slate-900 leading-none tabular-nums"
             style={{ fontSize:'clamp(80px,13vw,160px)' }}>
            {anim}
          </p>
        </motion.div>
        <motion.p initial={{ opacity:0,y:10 }} whileInView={{ opacity:1,y:0 }} viewport={{ once:true }}
          transition={{ delay:0.2,duration:0.6 }}
          style={{ fontSize:22,color:'#94a3b8',fontWeight:300,marginTop:16,letterSpacing:'0.04em' }}>
          miles logged
        </motion.p>
        <motion.button onClick={() => setActivePage('graph')}
          initial={{ opacity:0,y:12 }} whileInView={{ opacity:1,y:0 }} viewport={{ once:true }}
          transition={{ delay:0.35,duration:0.5 }}
          whileHover={{ scale:1.04,y:-2 }} whileTap={{ scale:0.97 }}
          style={{ marginTop:36,display:'inline-flex',alignItems:'center',gap:8,
                   fontSize:14,fontWeight:600,color:'white',
                   background:'#0f172a',padding:'14px 28px',borderRadius:50,
                   boxShadow:'0 4px 20px rgba(0,0,0,0.15)',border:'none',cursor:'pointer' }}>
          View Mileage Graph <ArrowUpRight size={14}/>
        </motion.button>
      </div>
    </section>
  )
}

/* ─── Root Dashboard ─────────────────────────────────────────── */
export default function Dashboard() {
  const { weeks, runs, setActivePage } = useTrainingStore()
  const currentWeek = useTrainingStore(s => s.getCurrentWeek())
  const insights    = useMemo(() => analyzeTraining(weeks, runs), [weeks, runs])
  const streaks     = useMemo(() => computeStreaks(weeks), [weeks])
  const todayStr    = new Date().toISOString().split('T')[0]

  const totalMiles = useMemo(() =>
    +runs.reduce((s,r) => s + (r.mileage||0), 0).toFixed(0), [runs])

  const thisWeekActual = useMemo(() => {
    const t=new Date(), df=t.getDay()===0?-6:1-t.getDay()
    const mon=new Date(t); mon.setDate(t.getDate()+df); mon.setHours(0,0,0,0)
    const sun=new Date(mon); sun.setDate(mon.getDate()+6)
    return +runs.filter(r=>r.date>=mon.toISOString().split('T')[0]&&r.date<=sun.toISOString().split('T')[0])
               .reduce((s,r)=>s+(r.mileage||0),0).toFixed(1)
  }, [runs])

  const thisWeekPlanned = currentWeek?.plannedMileage || 0

  const avgHR = useMemo(() => {
    const hr=runs.filter(r=>r.avgHR>0)
    return hr.length ? Math.round(hr.reduce((s,r)=>s+r.avgHR,0)/hr.length) : '—'
  }, [runs])

  const last4Avg = useMemo(() => {
    const wk={}
    for (const r of runs) {
      if(!r.date||!r.mileage) continue
      const d=new Date(r.date+'T12:00:00'), df=d.getDay()===0?-6:1-d.getDay()
      d.setDate(d.getDate()+df)
      const k=d.toISOString().split('T')[0]
      wk[k]=(wk[k]||0)+r.mileage
    }
    const t=new Date(), df=t.getDay()===0?-6:1-t.getDay()
    const mon=new Date(t); mon.setDate(t.getDate()+df)
    const cut=mon.toISOString().split('T')[0]
    const done=Object.entries(wk).filter(([k])=>k<cut).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,4).map(([,v])=>v)
    return done.length ? (done.reduce((s,v)=>s+v,0)/done.length).toFixed(1) : 0
  }, [runs])

  const weekPct = thisWeekPlanned > 0 ? Math.min((thisWeekActual/thisWeekPlanned)*100, 100) : 0
  const vo2Est  = useMemo(() => estimateVO2fromRuns(runs), [runs])

  return (
    <div>
      <HeroSection
        thisWeekActual={thisWeekActual} thisWeekPlanned={thisWeekPlanned}
        last4Avg={last4Avg} avgHR={avgHR} streaks={streaks}
        totalMiles={totalMiles} setActivePage={setActivePage} vo2Est={vo2Est}/>
      <ScheduleSection
        currentWeek={currentWeek} runs={runs} todayStr={todayStr}
        weekPct={weekPct} thisWeekActual={thisWeekActual} thisWeekPlanned={thisWeekPlanned}
        setActivePage={setActivePage}/>
      <InsightsSection insights={insights}/>
      <AllTimeSection total={totalMiles} setActivePage={setActivePage}/>
    </div>
  )
}
