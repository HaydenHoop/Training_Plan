import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { format, parseISO, startOfMonth, subMonths } from 'date-fns'
import {
  TrendingUp, Award, Clock, Mountain, Heart, Activity,
  Zap, BarChart2, Wind, Calendar
} from 'lucide-react'
import useTrainingStore from '../store/trainingStore'

// ── Zone colors ───────────────────────────────────────────────────────────────
const ZONE_COLORS  = ['#22d3ee','#34d399','#facc15','#f97316','#ef4444']
const ZONE_NAMES   = ['Z1 Recovery','Z2 Aerobic','Z3 Tempo','Z4 Threshold','Z5 Max']
const MONTH_ABBR   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ── Sub-components ────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'text-cyan-400' }) {
  return (
    <div className="glass rounded-xl p-4 border border-white/5 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
        <Icon size={16} className={color}/>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 mb-0.5">{label}</p>
        <p className={`text-xl font-bold text-white`}>{value}</p>
        {sub && <p className="text-xs text-slate-600 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  )
}

const CustomBarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass rounded-xl px-4 py-3 border border-white/10 text-xs shadow-xl">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="text-white font-bold">{payload[0]?.value?.toFixed(1)} mi</p>
      {payload[0]?.payload?.runs && <p className="text-slate-500">{payload[0].payload.runs} runs</p>}
    </div>
  )
}

const CustomLineTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass rounded-xl px-4 py-3 border border-white/10 text-xs shadow-xl">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{background:p.color}}/>
          <span className="text-white font-bold">{p.value}</span>
          <span className="text-slate-500">{p.name}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function StatsView() {
  const { runs, getLifetimeStats } = useTrainingStore()
  const stats = useMemo(() => getLifetimeStats(), [runs])

  // Monthly mileage (all time)
  const monthlyData = useMemo(() => {
    const map = {}
    for (const run of runs) {
      if (!run.date) continue
      const key = run.date.slice(0, 7) // YYYY-MM
      if (!map[key]) map[key] = { miles: 0, runs: 0 }
      map[key].miles += run.mileage || 0
      map[key].runs  += 1
    }
    return Object.entries(map)
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([key, val]) => ({
        label: format(parseISO(key + '-01'), 'MMM yy'),
        miles: +val.miles.toFixed(1),
        runs: val.runs,
      }))
  }, [runs])

  // 90-day rolling avg pace trend (in seconds/mi for math, display as M:SS)
  const paceTrend = useMemo(() => {
    const paceRuns = runs.filter(r => r.avgPace && r.mileage >= 2)
    if (paceRuns.length < 3) return []
    const WINDOW = 10 // 10-run rolling avg
    return paceRuns.map((r, i) => {
      if (i < WINDOW - 1) return null
      const wnd = paceRuns.slice(i - WINDOW + 1, i + 1)
      const avgSecs = wnd.reduce((s, x) => {
        const [min, sec] = x.avgPace.split(':').map(Number)
        return s + min * 60 + sec
      }, 0) / WINDOW
      const min = Math.floor(avgSecs / 60)
      const sec = Math.round(avgSecs % 60)
      return {
        date: r.date,
        label: format(parseISO(r.date), 'MMM d'),
        paceStr: `${min}:${String(sec).padStart(2,'0')}`,
        paceSecs: +avgSecs.toFixed(0),
      }
    }).filter(Boolean)
  }, [runs])

  // HR zones aggregate (sum all zones across all runs)
  const hrZoneData = useMemo(() => {
    const totals = [0, 0, 0, 0, 0]
    let count = 0
    for (const r of runs) {
      if (!r.hrZones) continue
      totals[0] += r.hrZones.z1 || 0
      totals[1] += r.hrZones.z2 || 0
      totals[2] += r.hrZones.z3 || 0
      totals[3] += r.hrZones.z4 || 0
      totals[4] += r.hrZones.z5 || 0
      count++
    }
    if (count === 0) return []
    const total = totals.reduce((a,b) => a + b, 1)
    return ZONE_NAMES.map((name, i) => ({
      name,
      value: +(totals[i] / 3600).toFixed(1), // convert to hours
      pct: +(totals[i] / total * 100).toFixed(1),
      color: ZONE_COLORS[i],
    })).filter(z => z.value > 0)
  }, [runs])

  // Cadence trend (10-run rolling avg)
  const cadenceTrend = useMemo(() => {
    const cadRuns = runs.filter(r => r.avgCadence && r.avgCadence > 100)
    if (cadRuns.length < 3) return []
    const WINDOW = 10
    return cadRuns.map((r, i) => {
      if (i < WINDOW - 1) return null
      const wnd = cadRuns.slice(i - WINDOW + 1, i + 1)
      const avg = Math.round(wnd.reduce((s, x) => s + x.avgCadence, 0) / WINDOW)
      return { date: r.date, label: format(parseISO(r.date), "MMM yy"), cadence: avg }
    }).filter(Boolean)
  }, [runs])

  // VO2max trend
  const vo2Trend = useMemo(() => {
    return runs.filter(r => r.vo2max).map(r => ({
      label: format(parseISO(r.date), "MMM yy"),
      vo2max: r.vo2max,
    }))
  }, [runs])

  // PRs
  const prs = useMemo(() => {
    if (runs.length === 0) return null
    const longest = runs.reduce((m, r) => r.mileage > (m?.mileage||0) ? r : m, null)
    const mostElevation = runs.reduce((m, r) => (r.elevGainFt||0) > (m?.elevGainFt||0) ? r : m, null)
    const fastRuns = runs.filter(r => r.avgPace && r.mileage >= 3)
    const paceToSec = p => { const [a,b] = (p||"99:99").split(":"); return +a*60 + +b }
    const fastest = fastRuns.length ? fastRuns.reduce((m, r) => paceToSec(r.avgPace) < paceToSec(m.avgPace) ? r : m) : null
    const highHr = runs.filter(r => r.maxHR).reduce((m, r) => (r.maxHR||0) > (m?.maxHR||0) ? r : m, null)
    return { longest, mostElevation, fastest, highHr }
  }, [runs])

  if (runs.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-2">
          <BarChart2 size={28} className="text-slate-500"/>
        </div>
        <h2 className="text-xl font-bold text-white">No run data yet</h2>
        <p className="text-slate-400 text-sm max-w-sm">Import your Coros or Garmin export from <span className="text-violet-400">Bulk FIT Import</span> to unlock lifetime stats.</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}}>
        <p className="text-xs text-slate-500 font-mono uppercase tracking-widest mb-1">Analytics</p>
        <h1 className="text-3xl font-bold text-white">Running <span className="text-gradient">Stats</span></h1>
        <p className="text-sm text-slate-400 mt-1">
          {stats?.firstRunDate && stats?.lastRunDate ? `${format(parseISO(stats.firstRunDate),'MMM d, yyyy')} — ${format(parseISO(stats.lastRunDate),'MMM d, yyyy')}` : ''}
        </p>
      </motion.div>

      {/* Lifetime stats grid */}
      <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.05}}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard icon={Activity}   label="Total runs"     value={stats?.totalRuns?.toLocaleString() ?? '—'}  color="text-violet-400"/>
        <StatCard icon={TrendingUp} label="Total miles"    value={stats?.totalMiles?.toLocaleString() ?? '—'} sub="lifetime distance" color="text-cyan-400"/>
        <StatCard icon={Clock}      label="Total hours"    value={stats?.totalHours?.toLocaleString() ?? '—'} sub="of running"        color="text-blue-400"/>
        <StatCard icon={Mountain}   label="Total elevation" value={stats?.totalElevFt ? (stats.totalElevFt / 5280).toFixed(0) + ' miles up' : '—'} sub={`${stats?.totalElevFt?.toLocaleString() ?? 0} ft`} color="text-emerald-400"/>
        <StatCard icon={Heart}      label="Avg heart rate" value={stats?.avgHR ? `${stats.avgHR} bpm` : '—'}  color="text-rose-400"/>
        <StatCard icon={Wind}       label="Best avg pace"  value={stats?.bestPace ? `${stats.bestPace}/mi` : '—'} sub="on runs ≥1 mi" color="text-orange-400"/>
        <StatCard icon={Award}      label="Longest run"    value={stats?.longestRun ? `${stats.longestRun.mileage} mi` : '—'} sub={stats?.longestRun?.date ? format(parseISO(stats.longestRun.date),'MMM d, yyyy') : ''} color="text-yellow-400"/>
        <StatCard icon={Zap}        label="VO₂ Max"        value={stats?.latestVo2 ? stats.latestVo2.toFixed(1) : '—'} sub="latest from device" color="text-pink-400"/>
      </motion.div>

      {/* Monthly mileage bar chart */}
      <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.1}}
        className="glass rounded-2xl border border-white/5 p-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Monthly Mileage — All Time</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthlyData} margin={{top:0,right:0,bottom:0,left:-10}}>
            <defs>
              <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#818cf8" stopOpacity={0.9}/>
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.4}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
            <XAxis dataKey="label" tick={{fill:'#64748b',fontSize:10}} tickLine={false} axisLine={false}
              interval={Math.max(0, Math.floor(monthlyData.length / 12))}/>
            <YAxis tick={{fill:'#64748b',fontSize:10}} tickLine={false} axisLine={false} width={30}/>
            <Tooltip content={<CustomBarTooltip/>}/>
            <Bar dataKey="miles" fill="url(#barGrad)" radius={[3,3,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pace trend */}
        {paceTrend.length >= 3 && (
          <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.15}}
            className="glass rounded-2xl border border-white/5 p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">10-Run Avg Pace Trend</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={paceTrend} margin={{top:5,right:5,bottom:0,left:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                <XAxis dataKey="label" tick={{fill:'#64748b',fontSize:10}} tickLine={false} axisLine={false}
                  interval={Math.max(0, Math.floor(paceTrend.length / 6))}/>
                <YAxis tick={{fill:'#64748b',fontSize:10}} tickLine={false} axisLine={false} width={35}
                  domain={['auto','auto']} reversed
                  tickFormatter={secs => { const m=Math.floor(secs/60),s=Math.round(secs%60); return `${m}:${String(s).padStart(2,'0')}` }}/>
                <Tooltip content={<CustomLineTooltip/>} formatter={(v) => {
                  const m=Math.floor(v/60),s=Math.round(v%60); return [`${m}:${String(s).padStart(2,'0')}/mi`,'Pace']
                }}/>
                <Line type="monotone" dataKey="paceSecs" stroke="#22d3ee" strokeWidth={2} dot={false} name="/mi pace"/>
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* HR Zone pie */}
        {hrZoneData.length > 0 && (
          <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.2}}
            className="glass rounded-2xl border border-white/5 p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">HR Zone Distribution (hours)</p>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={hrZoneData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                    dataKey="value" paddingAngle={2}>
                    {hrZoneData.map((z, i) => <Cell key={i} fill={z.color} opacity={0.85}/>)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {hrZoneData.map((z, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{background:z.color}}/>
                    <span className="text-xs text-slate-400 flex-1">{z.name}</span>
                    <span className="text-xs font-semibold text-white">{z.pct}%</span>
                    <span className="text-xs text-slate-600 w-12 text-right">{z.value}h</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Cadence trend */}
        {cadenceTrend.length >= 3 && (
          <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.25}}
            className="glass rounded-2xl border border-white/5 p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Cadence Trend (spm)</p>
            <p className="text-xs text-slate-600 mb-4">10-run rolling average — target 170–180 spm</p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={cadenceTrend} margin={{top:5,right:5,bottom:0,left:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                <XAxis dataKey="label" tick={{fill:'#64748b',fontSize:10}} tickLine={false} axisLine={false}
                  interval={Math.max(0, Math.floor(cadenceTrend.length / 6))}/>
                <YAxis tick={{fill:'#64748b',fontSize:10}} tickLine={false} axisLine={false} width={35} domain={['auto','auto']}/>
                <Tooltip content={<CustomLineTooltip/>} formatter={v=>[`${v} spm`,'Cadence']}/>
                <Line type="monotone" dataKey="cadence" stroke="#a78bfa" strokeWidth={2} dot={false} name="spm"/>
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* VO2max trend */}
        {vo2Trend.length >= 2 && (
          <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.3}}
            className="glass rounded-2xl border border-white/5 p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">VO₂ Max Trend</p>
            <p className="text-xs text-slate-600 mb-4">From Coros device estimates</p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={vo2Trend} margin={{top:5,right:5,bottom:0,left:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                <XAxis dataKey="label" tick={{fill:'#64748b',fontSize:10}} tickLine={false} axisLine={false}
                  interval={Math.max(0, Math.floor(vo2Trend.length / 6))}/>
                <YAxis tick={{fill:'#64748b',fontSize:10}} tickLine={false} axisLine={false} width={35} domain={['auto','auto']}/>
                <Tooltip content={<CustomLineTooltip/>} formatter={v=>[`${v} mL/kg/min`,'VO₂max']}/>
                <Line type="monotone" dataKey="vo2max" stroke="#f472b6" strokeWidth={2} dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </div>

      {/* Personal records */}
      {prs && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.35}}
          className="glass rounded-2xl border border-white/5 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
            <Award size={15} className="text-yellow-400"/>
            <p className="text-sm font-semibold text-white">Personal Records</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/5">
            {[
              { label: 'Longest Run', value: prs.longest ? `${prs.longest.mileage} mi` : '—', sub: prs.longest?.date ? format(parseISO(prs.longest.date),'MMM d, yyyy') : '' },
              { label: 'Fastest Pace', value: prs.fastest?.avgPace ? `${prs.fastest.avgPace}/mi` : '—', sub: prs.fastest?.date ? `${prs.fastest.mileage}mi on ${format(parseISO(prs.fastest.date),'MMM d')}` : '' },
              { label: 'Most Elevation', value: prs.mostElevation?.elevGainFt ? `${prs.mostElevation.elevGainFt.toLocaleString()} ft` : '—', sub: prs.mostElevation?.date ? format(parseISO(prs.mostElevation.date),'MMM d, yyyy') : '' },
              { label: 'Max Heart Rate', value: prs.highHr?.maxHR ? `${prs.highHr.maxHR} bpm` : '—', sub: prs.highHr?.date ? format(parseISO(prs.highHr.date),'MMM d, yyyy') : '' },
            ].map(({label,value,sub}) => (
              <div key={label} className="bg-black/20 px-5 py-4">
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className="text-lg font-bold text-white">{value}</p>
                {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
