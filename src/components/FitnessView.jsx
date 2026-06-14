import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from 'recharts'
import { format, parseISO, subMonths, subDays } from 'date-fns'
import { TrendingUp, TrendingDown, Minus, Activity, Zap, Shield, AlertTriangle } from 'lucide-react'
import useTrainingStore from '../store/trainingStore'

// ── Helpers ───────────────────────────────────────────────────────────────────
const PERIODS = [
  { label: '1M',  months: 1  },
  { label: '3M',  months: 3  },
  { label: '6M',  months: 6  },
  { label: '1Y',  months: 12 },
  { label: 'All', months: 999 },
]

function FormBadge({ tsb }) {
  if (tsb === null || tsb === undefined) return null
  let label, color, Icon
  if (tsb > 10)        { label = 'Fresh';        color = 'emerald'; Icon = TrendingUp }
  else if (tsb > 0)    { label = 'Neutral';       color = 'cyan';    Icon = Minus }
  else if (tsb > -10)  { label = 'Productive';    color = 'blue';    Icon = Activity }
  else if (tsb > -25)  { label = 'Tired';         color = 'orange';  Icon = TrendingDown }
  else                  { label = 'Overreaching';  color = 'red';     Icon = AlertTriangle }
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-${color}-500/10 border border-${color}-500/20`}>
      <Icon size={13} className={`text-${color}-400`}/>
      <span className={`text-xs font-semibold text-${color}-400`}>{label}</span>
      <span className="text-xs text-slate-500">TSB {tsb > 0 ? '+' : ''}{tsb}</span>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="glass rounded-xl px-4 py-3 border border-white/10 text-xs space-y-1.5 shadow-xl">
      <p className="text-slate-400 font-mono mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{background:p.color}}/>
          <span className="text-slate-400">{p.name}:</span>
          <span className="text-white font-semibold">{p.value}</span>
        </div>
      ))}
      {d?.load > 0 && (
        <div className="flex items-center gap-2 mt-1 pt-1.5 border-t border-white/5">
          <div className="w-2 h-2 rounded-full bg-white/30"/>
          <span className="text-slate-400">Daily load:</span>
          <span className="text-white font-semibold">{d.load}</span>
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function FitnessView() {
  const { getFitnessCurve, runs, getLifetimeStats } = useTrainingStore()
  const [period, setPeriod] = useState('3M')

  const fullCurve = useMemo(() => getFitnessCurve(), [runs])

  const curve = useMemo(() => {
    const p = PERIODS.find(x => x.label === period)
    if (!p || fullCurve.length === 0) return fullCurve
    if (p.months >= 999) return fullCurve
    const cutoff = subMonths(new Date(), p.months).toISOString().split('T')[0]
    return fullCurve.filter(d => d.date >= cutoff)
  }, [fullCurve, period])

  const latest = curve[curve.length - 1]
  const stats = useMemo(() => getLifetimeStats(), [runs])

  const tickFormatter = (dateStr) => {
    try { return format(parseISO(dateStr), period === '1M' ? 'MMM d' : 'MMM yy') }
    catch { return dateStr }
  }

  if (runs.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-2">
          <Activity size={28} className="text-slate-500"/>
        </div>
        <h2 className="text-xl font-bold text-white">No runs imported yet</h2>
        <p className="text-slate-400 text-sm max-w-sm">Import your Coros or Garmin .zip export from the <span className="text-violet-400">Bulk FIT Import</span> tab to see your fitness curve.</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}}>
        <p className="text-xs text-slate-500 font-mono uppercase tracking-widest mb-1">Analytics</p>
        <h1 className="text-3xl font-bold text-white">Fitness <span className="text-gradient">Curve</span></h1>
        <p className="text-sm text-slate-400 mt-1">CTL (fitness), ATL (fatigue), and TSB (form) over time</p>
      </motion.div>

      {/* Current form + key metrics */}
      <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.1}}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Fitness (CTL)', value: latest?.ctl ?? '—', sub: '42-day avg load', color: 'text-blue-400' },
          { label: 'Fatigue (ATL)', value: latest?.atl ?? '—', sub: '7-day avg load',  color: 'text-orange-400' },
          { label: 'Form (TSB)',    value: latest ? (latest.tsb > 0 ? '+' : '') + latest.tsb : '—', sub: 'Fitness − Fatigue', color: latest?.tsb >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Total Runs',   value: stats?.totalRuns ?? '—', sub: `${stats?.totalMiles ?? 0} lifetime miles`, color: 'text-violet-400' },
        ].map(({label, value, sub, color}) => (
          <div key={label} className="glass rounded-xl p-4 border border-white/5">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-600 mt-0.5">{sub}</p>
          </div>
        ))}
      </motion.div>

      {/* Form badge + period selector */}
      <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.15}}
        className="flex items-center justify-between flex-wrap gap-3">
        {latest && <FormBadge tsb={latest.tsb}/>}
        <div className="flex gap-1 glass rounded-xl p-1 border border-white/5">
          {PERIODS.map(p => (
            <button key={p.label} onClick={() => setPeriod(p.label)}
              className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${period===p.label?'text-white':'text-slate-400 hover:text-white'}`}>
              {period===p.label && <motion.div layoutId="fitness-period" className="absolute inset-0 bg-blue-500/20 rounded-lg border border-blue-500/30" transition={{type:'spring',stiffness:350,damping:30}}/>}
              <span className="relative">{p.label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Main chart */}
      <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.2}}
        className="glass rounded-2xl border border-white/5 p-5">
        <p className="text-xs text-slate-500 mb-4 uppercase tracking-wider font-semibold">CTL / ATL / TSB</p>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={curve} margin={{top:5,right:5,bottom:0,left:0}}>
            <defs>
              <linearGradient id="ctlGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="atlGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#f97316" stopOpacity={0.25}/>
                <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
            <XAxis dataKey="date" tickFormatter={tickFormatter} tick={{fill:'#64748b',fontSize:11}} tickLine={false} axisLine={false}
              interval={Math.max(1, Math.floor(curve.length / 8))}/>
            <YAxis tick={{fill:'#64748b',fontSize:11}} tickLine={false} axisLine={false} width={30}/>
            <Tooltip content={<CustomTooltip/>}/>
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.08)"/>
            <Area type="monotone" dataKey="ctl" name="CTL" stroke="#3b82f6" strokeWidth={2} fill="url(#ctlGrad)" dot={false}/>
            <Area type="monotone" dataKey="atl" name="ATL" stroke="#f97316" strokeWidth={1.5} fill="url(#atlGrad)" dot={false}/>
            <Line type="monotone" dataKey="tsb" name="TSB" stroke="#a78bfa" strokeWidth={1.5} dot={false} strokeDasharray="none"/>
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Explainer */}
      <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.3}}
        className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        {[
          { icon: TrendingUp, color: 'blue',   title: 'CTL — Fitness',    body: 'Chronic Training Load. 42-day rolling average of daily TRIMP. Higher = more base fitness built up over weeks.' },
          { icon: Zap,        color: 'orange', title: 'ATL — Fatigue',    body: 'Acute Training Load. 7-day rolling average. Spikes when you train hard. High ATL relative to CTL = tired.' },
          { icon: Shield,     color: 'violet', title: 'TSB — Form',       body: 'Training Stress Balance = CTL − ATL. Positive means fresh (taper), negative means building fitness. Race at +5 to +15.' },
        ].map(({icon:Icon, color, title, body}) => (
          <div key={title} className={`glass rounded-xl p-4 border border-${color}-500/10`}>
            <div className="flex items-center gap-2 mb-2">
              <Icon size={13} className={`text-${color}-400`}/>
              <p className={`font-semibold text-${color}-300`}>{title}</p>
            </div>
            <p className="text-slate-500 leading-relaxed">{body}</p>
          </div>
        ))}
      </motion.div>
    </div>
  )
}
