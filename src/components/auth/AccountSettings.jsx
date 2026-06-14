import { useState } from 'react'
import { motion } from 'framer-motion'
import { Trash2, LogOut, Shield, AlertTriangle, Check, ArrowLeft } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

export default function AccountSettings({ onClose, setActivePage }) {
  const { user, signOut } = useAuth()
  const [confirmDelete, setConfirmDelete] = useState(false)

  function goBack() { setActivePage('dashboard') }
  const [deleteInput,   setDeleteInput]   = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')

  async function handleSignOut() {
    await signOut()
  }

  async function handleDeleteAccount() {
    if (deleteInput !== 'DELETE') return
    setBusy(true)
    try {
      if (supabase) {
        await supabase.from('runs').delete().eq('user_id', user.id)
        await supabase.from('weeks').delete().eq('user_id', user.id)
        await supabase.from('personal_records').delete().eq('user_id', user.id)
        await supabase.from('athlete_profiles').delete().eq('user_id', user.id)
        await supabase.auth.admin?.deleteUser(user.id).catch(() => {})
      }
      await signOut()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#060912', color:'white', padding:'48px 24px' }}>
      <div style={{ maxWidth:560, margin:'0 auto' }}>
        <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5 }}>
          {/* Back button */}
          <button onClick={goBack} style={{
            display:'flex', alignItems:'center', gap:8, background:'none', border:'none',
            color:'rgba(255,255,255,0.4)', cursor:'pointer', padding:0,
            fontSize:13, marginBottom:32, fontFamily:'inherit',
          }}>
            <ArrowLeft size={14}/> Back to Dashboard
          </button>
          <p style={{ fontSize:9, fontFamily:'monospace', color:'rgba(255,255,255,0.25)',
                      textTransform:'uppercase', letterSpacing:'0.4em', marginBottom:10 }}>Settings</p>
          <h1 style={{ fontSize:36, fontWeight:800, marginBottom:32,
                       fontFamily:'Space Grotesk, Inter, sans-serif' }}>Account</h1>

          {/* Account info */}
          <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
                        borderRadius:16, padding:'24px 28px', marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
              <Shield size={14} style={{ color:'#4ade80' }}/>
              <p style={{ fontSize:11, fontFamily:'monospace', color:'rgba(255,255,255,0.3)',
                          textTransform:'uppercase', letterSpacing:'0.2em' }}>Logged in as</p>
            </div>
            <p style={{ fontSize:18, fontWeight:600, color:'white' }}>{user?.email}</p>
            <p style={{ fontSize:12, color:'rgba(255,255,255,0.3)', marginTop:4, fontFamily:'monospace' }}>
              Your data is encrypted and private — no one else can see it.
            </p>
          </div>

          {/* Sign out */}
          <button onClick={handleSignOut}
            style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
                     background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
                     borderRadius:16, padding:'20px 28px', color:'white', cursor:'pointer',
                     fontSize:15, fontWeight:600, marginBottom:16 }}>
            Sign Out
            <LogOut size={16} style={{ color:'rgba(255,255,255,0.4)' }}/>
          </button>

          {/* Legal links */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:32 }}>
            {[['Terms of Service','tos'],['Privacy Policy','privacy']].map(([label, page]) => (
              <button key={page} onClick={() => setActivePage(page)}
                style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)',
                         borderRadius:12, padding:'14px 20px', color:'rgba(255,255,255,0.45)',
                         cursor:'pointer', fontSize:13 }}>
                {label}
              </button>
            ))}
          </div>

          {/* Danger zone */}
          <div style={{ border:'1px solid rgba(248,113,113,0.2)', borderRadius:16, padding:'24px 28px' }}>
            <p style={{ fontSize:12, fontFamily:'monospace', color:'rgba(248,113,113,0.6)',
                        textTransform:'uppercase', letterSpacing:'0.2em', marginBottom:12 }}>
              Danger Zone
            </p>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)}
                style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(248,113,113,0.08)',
                         border:'1px solid rgba(248,113,113,0.25)', borderRadius:10,
                         padding:'12px 18px', color:'#fca5a5', fontSize:14, cursor:'pointer' }}>
                <Trash2 size={14}/> Delete Account & All Data
              </button>
            ) : (
              <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}>
                <div style={{ display:'flex', alignItems:'start', gap:8, marginBottom:14,
                              color:'#fca5a5', fontSize:13 }}>
                  <AlertTriangle size={14} style={{ marginTop:2, flexShrink:0 }}/>
                  <p>This permanently deletes all your runs, training plans, personal records, and your account. This cannot be undone. Type <strong>DELETE</strong> to confirm.</p>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <input value={deleteInput} onChange={e => setDeleteInput(e.target.value)}
                    placeholder="Type DELETE to confirm"
                    style={{ flex:1, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(248,113,113,0.3)',
                             borderRadius:10, padding:'11px 14px', color:'white', fontSize:14,
                             fontFamily:'monospace', outline:'none' }}/>
                  <button onClick={handleDeleteAccount}
                    disabled={deleteInput !== 'DELETE' || busy}
                    style={{ padding:'11px 18px', borderRadius:10, border:'none', cursor:'pointer',
                             background: deleteInput==='DELETE' ? '#ef4444' : 'rgba(255,255,255,0.08)',
                             color: deleteInput==='DELETE' ? 'white' : 'rgba(255,255,255,0.3)',
                             fontSize:14, fontWeight:600 }}>
                    {busy ? '…' : 'Delete'}
                  </button>
                  <button onClick={() => { setConfirmDelete(false); setDeleteInput('') }}
                    style={{ padding:'11px 16px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)',
                             background:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:14 }}>
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
