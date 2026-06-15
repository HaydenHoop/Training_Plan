import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import Papa from 'papaparse'
import {
  Upload, FileText, CheckCircle, AlertTriangle, X, ClipboardPaste,
  MapPin, Heart, Activity, Mountain, Clock, Trash2, Zap, Archive,
  BarChart2, TrendingUp, Timer
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import useTrainingStore from '../store/trainingStore'
import { parsePastedPlan, getCurrentMonday, getUpcomingMonday } from '../utils/parsePlan'
import { matchRunToWeek } from '../utils/parseGpx'
import { parseFitBuffer, fitRunToDay } from '../utils/parseFit'

const WORKOUT_COLORS = {
  'Easy Run':'text-emerald-400','Tempo':'text-orange-400','Intervals':'text-red-400',
  'Long Run':'text-violet-400','Recovery':'text-blue-400','Shakeout':'text-cyan-400','Rest':'text-slate-500',
}

function Toast({ status, msg, onClose }) {
  if (!status) return null
  return (
    <motion.div initial={{opacity:0,y:20,scale:0.95}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:20}}
      className={`fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium backdrop-blur-xl z-50 ${status==='success'?'bg-emerald-900/90 border-emerald-500/30 text-emerald-300':'bg-red-900/90 border-red-500/30 text-red-300'}`}>
      {status==='success'?<CheckCircle size={16}/>:<AlertTriangle size={16}/>}
      {msg}
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><X size={14}/></button>
    </motion.div>
  )
}

// ── PASTE TAB ─────────────────────────────────────────────────────────────────
function PasteTab({ onSuccess }) {
  const { addWeek } = useTrainingStore()
  const [text, setText] = useState('')
  // Sunday → next Monday (about to start that week); Mon–Sat → this week's Monday
  const [weekStart, setWeekStart] = useState(new Date().getDay() === 0 ? getUpcomingMonday() : getCurrentMonday())
  const [preview, setPreview] = useState(null)
  const [errors, setErrors] = useState([])

  const handleParse = () => {
    const { week, errors: errs } = parsePastedPlan(text, weekStart)
    setErrors(errs); setPreview(week)
  }
  const handleSave = () => {
    if (!preview) return
    addWeek(preview); setText(''); setPreview(null)
    onSuccess(`Week of ${format(parseISO(weekStart),'MMM d')} saved — ${preview.plannedMileage} mi planned.`)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Week starts (Monday)</label>
          <input type="date" value={weekStart} onChange={e=>setWeekStart(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"/>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={()=>setWeekStart(getCurrentMonday())} className="text-xs text-slate-400 hover:text-white px-3 py-2 rounded-lg border border-white/8 hover:border-white/15 transition-colors">This week</button>
          <button onClick={()=>setWeekStart(getUpcomingMonday())} className="text-xs text-slate-400 hover:text-white px-3 py-2 rounded-lg border border-white/8 hover:border-white/15 transition-colors">Next week</button>
        </div>
      </div>
      <div>
        <label className="text-xs text-slate-500 mb-1 block">Paste your training plan</label>
        <textarea value={text} onChange={e=>{setText(e.target.value);setPreview(null)}}
          placeholder={"Monday - 8 + Drills + 5 Strides\nTuesday - 10 + Core\nWednesday - 9\nThursday - 8 + Drills + 5 Hill Sprints\nFriday - 11 + Core\nSaturday - 5\nSunday - 14\nYour weekly miles should be around 65 miles.\nYour Tuesday workout: Hill repeats...\nLevel 6  5:30-5:20"}
          rows={11} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-700 focus:outline-none focus:border-cyan-500/50 font-mono leading-relaxed resize-none"/>
      </div>
      {errors.length > 0 && <div className="glass rounded-xl p-3 border border-red-500/20">{errors.map((e,i)=><p key={i} className="text-xs text-red-400">{e}</p>)}</div>}
      <motion.button onClick={handleParse} whileHover={{scale:1.01}} whileTap={{scale:0.98}} disabled={!text.trim()}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
        <ClipboardPaste size={15}/> Parse Plan
      </motion.button>
      <AnimatePresence>
        {preview && (
          <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:12}} className="glass rounded-2xl border border-cyan-500/20 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Preview — Week of {format(parseISO(weekStart),'MMM d, yyyy')}</p>
                <p className="text-xs text-slate-400 mt-0.5">{preview.plannedMileage} miles planned
                  {preview.targetMileage !== preview.plannedMileage && ` (target ~${preview.targetMileage} mi)`}</p>
              </div>
              <CheckCircle size={18} className="text-cyan-400"/>
            </div>
            <div className="divide-y divide-white/3">
              {preview.days.map(day=>(
                <div key={day.date} className="px-5 py-3 flex items-start gap-4">
                  <p className="text-xs text-slate-500 font-mono w-20 shrink-0">{format(parseISO(day.date),'EEE MMM d')}</p>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${WORKOUT_COLORS[day.workoutType]||'text-white'}`}>{day.workoutType}</span>
                      <span className="text-slate-400 text-sm">— {day.plannedMileage} mi</span>
                      {day.plannedPace&&<span className="text-xs text-slate-500 font-mono">{day.plannedPace}/mi</span>}
                    </div>
                    {day.notes&&<p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mt-0.5">{day.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-white/5 flex gap-3">
              <motion.button onClick={handleSave} whileHover={{scale:1.02}} whileTap={{scale:0.97}}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold">
                <CheckCircle size={14}/> Save to Training Log
              </motion.button>
              <button onClick={()=>setPreview(null)} className="px-4 py-2 rounded-xl border border-white/10 text-slate-400 text-sm hover:text-white transition-colors">Edit</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── FIT BULK IMPORT TAB ───────────────────────────────────────────────────────
function FitTab({ onSuccess, onError }) {
  const { weeks, addRuns, updateDay } = useTrainingStore()
  const [phase, setPhase] = useState('idle') // idle | parsing | done
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: 0, skipped: 0 })
  const [summary, setSummary] = useState(null)
  const [log, setLog] = useState([])   // last few messages
  const abortRef = useRef(false)

  const addLog = (msg) => setLog(prev => [...prev.slice(-4), msg])

  const processZip = useCallback(async (file) => {
    if (!file) return
    abortRef.current = false
    setPhase('parsing')
    setProgress({ done: 0, total: 0, errors: 0, skipped: 0 })
    setLog([])
    setSummary(null)

    let JSZip, fitFiles
    try {
      const mod = await import('jszip')
      JSZip = mod.default
      const zip = await JSZip.loadAsync(file)
      fitFiles = Object.values(zip.files).filter(f => !f.dir && f.name.toLowerCase().endsWith('.fit'))
    } catch(e) {
      onError('Could not read zip file: ' + e.message)
      setPhase('idle')
      return
    }

    if (fitFiles.length === 0) {
      onError('No .fit files found in the zip.')
      setPhase('idle')
      return
    }

    setProgress(p => ({ ...p, total: fitFiles.length }))
    addLog(`Found ${fitFiles.length} .fit files`)

    const parsed = []
    let errors = 0, skipped = 0

    for (let i = 0; i < fitFiles.length; i++) {
      if (abortRef.current) break
      const f = fitFiles[i]
      try {
        const buf = await f.async('arraybuffer')
        const run = await parseFitBuffer(buf, f.name)
        if (run === null) {
          skipped++  // non-run activity (bike, swim, etc.)
        } else if (run.error) {
          errors++
          if (errors <= 3) addLog(`⚠ ${f.name.split('/').pop()}: ${run.error}`)
        } else {
          parsed.push(run)
          if (parsed.length % 50 === 0) addLog(`Parsed ${parsed.length} runs so far...`)
        }
      } catch(e) {
        errors++
      }
      setProgress({ done: i + 1, total: fitFiles.length, errors, skipped })
    }

    // Batch save all runs
    addRuns(parsed)

    // Backfill matching week-day actuals
    let backfilled = 0
    for (const run of parsed) {
      const week = weeks.find(w => {
        const start = new Date(w.startDate)
        const end   = new Date(start); end.setDate(end.getDate() + 6)
        const d = new Date(run.date)
        return d >= start && d <= end
      })
      if (week) {
        const dayFields = fitRunToDay(run)
        updateDay(week.id, run.date, dayFields)
        backfilled++
      }
    }

    // Compute summary stats
    const totalMiles  = +parsed.reduce((s, r) => s + (r.mileage || 0), 0).toFixed(1)
    const totalHours  = +(parsed.reduce((s, r) => s + (r.durationMin || 0), 0) / 60).toFixed(1)
    const dates       = parsed.map(r => r.date).sort()
    const hrRuns      = parsed.filter(r => r.avgHR)
    const avgHR       = hrRuns.length ? Math.round(hrRuns.reduce((s, r) => s + r.avgHR, 0) / hrRuns.length) : null

    setSummary({
      count: parsed.length, totalMiles, totalHours, errors, skipped, backfilled,
      dateRange: dates.length ? `${dates[0]} → ${dates[dates.length-1]}` : '',
      avgHR,
    })
    setPhase('done')

    if (parsed.length > 0) {
      onSuccess(`Imported ${parsed.length} runs (${totalMiles} mi) into your training history!`)
    } else {
      onError('No valid run activities found.')
    }
  }, [weeks, addRuns, updateDay, onSuccess, onError])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => processZip(files[0]),
    accept: { 'application/zip': ['.zip'], 'application/x-zip-compressed': ['.zip'] },
    multiple: false,
    disabled: phase === 'parsing',
  })

  const pct = progress.total ? Math.round(progress.done / progress.total * 100) : 0

  return (
    <div className="space-y-5">
      {/* Instructions */}
      <div className="glass rounded-xl p-4 border border-violet-500/15 space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <Archive size={15} className="text-violet-400"/>
          <p className="text-xs font-semibold text-violet-300 uppercase tracking-wider">Coros Bulk Export</p>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          In the <span className="text-white font-medium">Coros app</span> → Me → Settings → Export Data → select all → Export. 
          You'll get a .zip with every run as a .fit file. Drop it below.
        </p>
        <p className="text-xs text-slate-500">Garmin users: garmin.com → Account → Data Management → Export All. Works with any Garmin .zip export too.</p>
      </div>

      {/* Drop zone */}
      {phase !== 'done' && (
        <div {...getRootProps()} className={`rounded-2xl border-2 border-dashed p-12 text-center transition-all ${
          phase==='parsing' ? 'border-violet-500/40 bg-violet-500/5 cursor-default' :
          isDragActive ? 'border-violet-400 bg-violet-500/8 cursor-copy' :
          'border-white/10 hover:border-violet-500/40 hover:bg-white/2 cursor-pointer'
        }`}>
          <input {...getInputProps()}/>
          {phase === 'idle' && (
            <motion.div animate={{scale:isDragActive?1.04:1}} transition={{type:'spring',stiffness:300}}>
              <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${isDragActive?'bg-violet-500/20':'bg-white/5'}`}>
                <Archive size={28} className={isDragActive?'text-violet-400':'text-slate-400'}/>
              </div>
              <p className="text-white font-semibold text-lg mb-1">{isDragActive ? 'Drop your .zip' : 'Drop Coros/Garmin .zip export'}</p>
              <p className="text-slate-500 text-sm">All .fit files parsed in browser — your data never leaves your computer</p>
            </motion.div>
          )}
          {phase === 'parsing' && (
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-violet-500/15">
                <motion.div animate={{rotate:360}} transition={{duration:2,repeat:Infinity,ease:'linear'}}>
                  <Zap size={28} className="text-violet-400"/>
                </motion.div>
              </div>
              <div>
                <p className="text-white font-semibold mb-1">Parsing {progress.done} / {progress.total} files</p>
                <p className="text-slate-500 text-sm">{log[log.length-1] || 'Processing...'}</p>
              </div>
              {/* Progress bar */}
              <div className="w-full max-w-sm mx-auto bg-white/5 rounded-full h-2">
                <motion.div className="h-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-400"
                  animate={{width:`${pct}%`}} transition={{ease:'linear'}}/>
              </div>
              <p className="text-xs text-slate-600">{pct}% — {progress.errors > 0 ? `${progress.errors} errors, ` : ''}{progress.skipped > 0 ? `${progress.skipped} non-runs skipped` : ''}</p>
            </div>
          )}
        </div>
      )}

      {/* Summary after import */}
      <AnimatePresence>
        {phase === 'done' && summary && (
          <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="space-y-4">
            <div className="glass rounded-2xl border border-emerald-500/20 overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5 flex items-center gap-3">
                <CheckCircle size={20} className="text-emerald-400"/>
                <div>
                  <p className="text-sm font-semibold text-white">Import complete</p>
                  <p className="text-xs text-slate-400">{summary.dateRange}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/5">
                {[
                  { icon:Activity, label:'Runs imported', value: summary.count.toLocaleString(), color:'text-emerald-400' },
                  { icon:TrendingUp, label:'Total miles', value: summary.totalMiles.toLocaleString(), color:'text-cyan-400' },
                  { icon:Timer, label:'Total hours', value: summary.totalHours.toLocaleString(), color:'text-violet-400' },
                  { icon:Heart, label:'Avg HR', value: summary.avgHR ? `${summary.avgHR} bpm` : '—', color:'text-rose-400' },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="bg-black/20 px-4 py-4 text-center">
                    <Icon size={16} className={`${color} mx-auto mb-1.5`}/>
                    <p className="text-xl font-bold text-white">{value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
              {(summary.errors > 0 || summary.skipped > 0 || summary.backfilled > 0) && (
                <div className="px-5 py-3 border-t border-white/5 flex gap-4 text-xs text-slate-500">
                  {summary.backfilled > 0 && <span className="text-emerald-400">✓ {summary.backfilled} days backfilled to training weeks</span>}
                  {summary.skipped > 0 && <span>{summary.skipped} non-run activities skipped</span>}
                  {summary.errors > 0 && <span className="text-orange-400">{summary.errors} files could not be parsed</span>}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={()=>{setPhase('idle');setSummary(null);setLog([])}}
                className="px-4 py-2 rounded-xl border border-white/10 text-slate-400 text-sm hover:text-white transition-colors">
                Import another file
              </button>
              <p className="text-xs text-slate-600 self-center">Check Fitness & Stats pages to explore your history</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── INDIVIDUAL .FIT IMPORT TAB ─────────────────────────────────────────────────
function FitFileTab({ onSuccess, onError }) {
  const { weeks, addRuns, updateDay } = useTrainingStore()
  const [parsed, setParsed] = useState([])
  const [saving, setSaving] = useState(false)

  const processFiles = useCallback(async (files) => {
    const results = []
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.fit')) {
        results.push({ name: file.name, run: null, week: null, status: 'error', error: 'Not a .fit file' }); continue
      }
      try {
        const buf = await file.arrayBuffer()
        const run = await parseFitBuffer(buf, file.name)
        if (run === null) { results.push({ name: file.name, run: null, week: null, status: 'skipped' }); continue }
        if (run.error)    { results.push({ name: file.name, run: null, week: null, status: 'error', error: run.error }); continue }
        const week = matchRunToWeek(run.date, weeks)
        results.push({ name: file.name, run, week, status: week ? 'matched' : 'unmatched' })
      } catch (e) {
        results.push({ name: file.name, run: null, week: null, status: 'error', error: e.message })
      }
    }
    setParsed(prev => [...prev, ...results])
  }, [weeks])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: processFiles,
    accept: { 'application/octet-stream': ['.fit'], 'application/vnd.ant.fit': ['.fit'] },
  })

  const saveAll = async () => {
    setSaving(true)
    // Every valid run is added to training history so it counts toward total
    // stats, mileage and insights — whether or not it matches a planned week.
    const runsToAdd = parsed.filter(p => p.run && (p.status === 'matched' || p.status === 'unmatched')).map(p => p.run)
    addRuns(runsToAdd)
    // Backfill the matching plan day for runs that fell inside a planned week.
    for (const item of parsed) {
      if (item.status === 'matched' && item.week && item.run) {
        updateDay(item.week.id, item.run.date, fitRunToDay(item.run))
      }
    }
    setSaving(false)
    setParsed([])
    onSuccess(`Saved ${runsToAdd.length} run${runsToAdd.length !== 1 ? 's' : ''} — added to your totals, mileage & insights.`)
  }

  const removeAt = (idx) => setParsed(p => p.filter((_, i) => i !== idx))
  const validCount = parsed.filter(p => p.status === 'matched' || p.status === 'unmatched').length

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-4 border border-cyan-500/15">
        <div className="flex items-center gap-2 mb-1">
          <FileText size={15} className="text-cyan-400"/>
          <p className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">Individual .fit files</p>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Drop one or more <span className="text-white font-medium">.fit</span> files (single-activity export from Coros / Garmin).
          Every run is added to your history; runs inside a planned week auto-match to that day.
          For a whole export at once, use the <span className="text-white font-medium">Bulk FIT Import</span> tab.
        </p>
      </div>

      <div {...getRootProps()} className={`rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all ${isDragActive?'border-cyan-400 bg-cyan-500/5':'border-white/10 hover:border-cyan-500/40 hover:bg-white/2'}`}>
        <input {...getInputProps()}/>
        <motion.div animate={{scale:isDragActive?1.05:1}} transition={{type:'spring',stiffness:300}}>
          <div className={`w-14 h-14 rounded-xl mx-auto mb-3 flex items-center justify-center ${isDragActive?'bg-cyan-500/20':'bg-white/5'}`}>
            <Activity size={24} className={isDragActive?'text-cyan-400':'text-slate-400'}/>
          </div>
          <p className="text-white font-semibold mb-1">{isDragActive?'Drop .fit files':'Drop .fit files here'}</p>
          <p className="text-slate-500 text-sm">Multiple files — added to totals & matched to weeks by date</p>
        </motion.div>
      </div>

      <AnimatePresence>
        {parsed.length > 0 && (
          <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {parsed.length} file{parsed.length!==1?'s':''} — {validCount} ready
              </p>
              <button onClick={()=>setParsed([])} className="text-xs text-slate-600 hover:text-slate-400 transition-colors">Clear all</button>
            </div>
            <div className="glass rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/3">
              {parsed.map((item, i) => (
                <motion.div key={i} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:i*0.04}}
                  className="px-4 py-3 flex items-start gap-3">
                  <div className="mt-0.5">
                    {item.status==='matched'   && <CheckCircle size={15} className="text-emerald-400"/>}
                    {item.status==='unmatched' && <CheckCircle size={15} className="text-cyan-400"/>}
                    {item.status==='skipped'   && <AlertTriangle size={15} className="text-slate-500"/>}
                    {item.status==='error'     && <X size={15} className="text-red-400"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-white truncate">{(item.name||'').split('/').pop()}</p>
                      {item.run?.date && <span className="text-xs text-slate-500 font-mono shrink-0">{item.run.date}</span>}
                    </div>
                    {(item.status==='matched'||item.status==='unmatched') && item.run && (
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-emerald-400"><Activity size={11}/>{item.run.mileage} mi</span>
                        {item.run.avgHR&&<span className="flex items-center gap-1 text-xs text-rose-400"><Heart size={11}/>{item.run.avgHR} bpm</span>}
                        {item.run.avgPace&&<span className="flex items-center gap-1 text-xs text-cyan-400"><Clock size={11}/>{item.run.avgPace}/mi</span>}
                        {item.run.elevGainFt>0&&<span className="flex items-center gap-1 text-xs text-violet-400"><Mountain size={11}/>{item.run.elevGainFt} ft</span>}
                        <span className="text-xs text-slate-500">
                          {item.week?.startDate ? `→ week of ${format(parseISO(item.week.startDate),'MMM d')}` : '→ added to history'}
                        </span>
                      </div>
                    )}
                    {item.status==='skipped' && <p className="text-xs text-slate-500">Not a run activity — skipped.</p>}
                    {item.status==='error'   && <p className="text-xs text-red-400">{item.error}</p>}
                  </div>
                  <button onClick={()=>removeAt(i)} className="text-slate-600 hover:text-red-400 transition-colors mt-0.5 shrink-0"><Trash2 size={13}/></button>
                </motion.div>
              ))}
            </div>
            {validCount > 0 && (
              <motion.button onClick={saveAll} disabled={saving} whileHover={{scale:1.01}} whileTap={{scale:0.98}}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm shadow-lg shadow-cyan-500/20">
                <CheckCircle size={15}/> Save {validCount} Run{validCount!==1?'s':''} to Training Log
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── CSV TAB ───────────────────────────────────────────────────────────────────
function FileTab({ onSuccess, onError }) {
  const { addWeek } = useTrainingStore()
  const processRows = useCallback((rows) => {
    rows = rows.filter(r=>r.date)
    if (!rows.length) { onError('No valid rows.'); return }
    const startDate = rows.reduce((min,r)=>r.date<min?r.date:min, rows[0].date)
    const start = parseISO(startDate)
    const weekKey = `${start.getFullYear()}-W${String(Math.ceil((start.getDate()+6-start.getDay())/7)).padStart(2,'0')}`
    const days = rows.map(r=>({date:r.date,workoutType:r.workoutType||'Easy Run',plannedMileage:parseFloat(r.plannedMileage)||0,plannedPace:r.plannedPace||'',notes:r.notes||'',mileage:null,avgHeartRate:null,avgPace:null,elevationGain:null,completed:false}))
    const plannedMileage = days.reduce((s,d)=>s+d.plannedMileage,0)
    addWeek({id:weekKey,startDate,plannedMileage:+plannedMileage.toFixed(1),actualMileage:0,notes:'',days})
    onSuccess(`Week of ${format(start,'MMM d')} saved — ${plannedMileage.toFixed(0)} mi planned.`)
  },[addWeek,onSuccess,onError])

  const onDrop = useCallback((files) => {
    const file = files[0]; if (!file) return
    if (file.name.endsWith('.csv')) {
      Papa.parse(file,{header:true,skipEmptyLines:true,complete:({data})=>processRows(data),error:()=>onError('Could not parse CSV.')})
    } else { onError('Use .csv format') }
  },[processRows,onError])

  const {getRootProps,getInputProps,isDragActive} = useDropzone({onDrop,accept:{'text/csv':['.csv']},multiple:false})
  const downloadTemplate = () => {
    const csv=`date,workoutType,plannedMileage,plannedPace,notes\n2026-06-16,Easy Run,6,7:45,Aerobic base\n2026-06-17,Tempo,8,6:30,4mi tempo\n2026-06-18,Rest,0,,Recovery`
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='training-template.csv';a.click()
  }

  return (
    <div className="space-y-4">
      <div {...getRootProps()} className={`rounded-2xl border-2 border-dashed p-14 text-center cursor-pointer transition-all ${isDragActive?'border-cyan-400 bg-cyan-500/5':'border-white/10 hover:border-cyan-500/40 hover:bg-white/2'}`}>
        <input {...getInputProps()}/>
        <motion.div animate={{scale:isDragActive?1.05:1}}>
          <div className={`w-14 h-14 rounded-xl mx-auto mb-3 flex items-center justify-center ${isDragActive?'bg-cyan-500/20':'bg-white/5'}`}>
            <Upload size={24} className={isDragActive?'text-cyan-400':'text-slate-400'}/>
          </div>
          <p className="text-white font-semibold mb-1">{isDragActive?'Drop to upload':'Drag & drop .csv'}</p>
          <p className="text-slate-500 text-sm">Training plan spreadsheet format</p>
        </motion.div>
      </div>
      <div className="glass rounded-xl p-4 border border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3"><FileText size={16} className="text-cyan-400"/>
          <div><p className="text-sm font-medium text-white">CSV Template</p><p className="text-xs text-slate-500">date, workoutType, plannedMileage, plannedPace, notes</p></div>
        </div>
        <button onClick={downloadTemplate} className="text-xs text-cyan-400 border border-cyan-500/30 px-3 py-1.5 rounded-lg hover:bg-cyan-500/10 transition-colors">Download</button>
      </div>
    </div>
  )
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id:'fit',    label:'Bulk FIT Import', icon:Archive },
  { id:'paste',  label:'Paste Plan',      icon:ClipboardPaste },
  { id:'fitfile', label:'Import .fit',     icon:FileText },
  { id:'upload', label:'Upload CSV',      icon:Upload },
]

export default function UploadPlan() {
  const [tab, setTab] = useState('fit')
  const [toast, setToast] = useState(null)
  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),5000) }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}}>
        <p className="text-xs text-slate-500 font-mono uppercase tracking-widest mb-1">Import</p>
        <h1 className="text-3xl font-bold text-white mb-6">Add <span className="text-gradient">Training Data</span></h1>
      </motion.div>

      <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.1}}
        className="flex gap-1 glass rounded-xl p-1 border border-white/5 w-fit mb-6 flex-wrap">
        {TABS.map(({id,label,icon:Icon})=>(
          <button key={id} onClick={()=>setTab(id)}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab===id?'text-white':'text-slate-400 hover:text-white'}`}>
            {tab===id&&<motion.div layoutId="upload-tab" className="absolute inset-0 bg-gradient-to-r from-violet-500/20 to-cyan-600/15 rounded-lg border border-violet-500/25" transition={{type:'spring',stiffness:350,damping:30}}/>}
            <Icon size={14} className="relative"/>
            <span className="relative">{label}</span>
          </button>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.2}}>
          {tab==='fit'    && <FitTab    onSuccess={msg=>showToast(msg)} onError={msg=>showToast(msg,'error')}/>}
          {tab==='paste'  && <PasteTab  onSuccess={msg=>showToast(msg)}/>}
          {tab==='fitfile' && <FitFileTab onSuccess={msg=>showToast(msg)} onError={msg=>showToast(msg,'error')}/>}
          {tab==='upload' && <FileTab   onSuccess={msg=>showToast(msg)} onError={msg=>showToast(msg,'error')}/>}
        </motion.div>
      </AnimatePresence>
      <AnimatePresence>
        {toast && <Toast status={toast.type} msg={toast.msg} onClose={()=>setToast(null)}/>}
      </AnimatePresence>
    </div>
  )
}
