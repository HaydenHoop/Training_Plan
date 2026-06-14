import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyPolicy({ onBack }) {
  const Section = ({ title, children }) => (
    <div style={{ marginBottom:32 }}>
      <h2 style={{ fontSize:16, fontWeight:700, color:'white', marginBottom:10 }}>{title}</h2>
      <div style={{ fontSize:14, color:'rgba(255,255,255,0.55)', lineHeight:1.8 }}>{children}</div>
    </div>
  )
  return (
    <div style={{ minHeight:'100vh', background:'#060912', color:'white', padding:'48px 24px' }}>
      <div style={{ maxWidth:720, margin:'0 auto' }}>
        <motion.button onClick={onBack}
          initial={{ opacity:0 }} animate={{ opacity:1 }}
          style={{ display:'flex', alignItems:'center', gap:8, background:'none', border:'none',
                   color:'#22d3ee', fontSize:14, cursor:'pointer', marginBottom:36, padding:0 }}>
          <ArrowLeft size={14}/> Back
        </motion.button>
        <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5 }}>
          <p style={{ fontSize:9, fontFamily:'monospace', color:'rgba(255,255,255,0.25)',
                      textTransform:'uppercase', letterSpacing:'0.4em', marginBottom:10 }}>Legal</p>
          <h1 style={{ fontSize:40, fontWeight:800, marginBottom:8,
                       fontFamily:'Space Grotesk, Inter, sans-serif' }}>Privacy Policy</h1>
          <p style={{ color:'rgba(255,255,255,0.35)', fontSize:13, marginBottom:40 }}>
            Last updated: June 14, 2026
          </p>

          <Section title="1. What We Collect">
            <p><strong style={{color:'rgba(255,255,255,0.75)'}}>Account data:</strong> Your email address and display name when you register.</p>
            <p style={{marginTop:8}}><strong style={{color:'rgba(255,255,255,0.75)'}}>Training data:</strong> Workout files you upload (FIT, GPX, TCX), including metrics such as distance, duration, heart rate, pace, GPS coordinates, and elevation.</p>
            <p style={{marginTop:8}}><strong style={{color:'rgba(255,255,255,0.75)'}}>Usage data:</strong> Basic app interactions to help us improve the service (no third-party analytics).</p>
          </Section>

          <Section title="2. How We Use Your Data">
            <p>Your data is used solely to provide the XC Training service: displaying your training history, computing fitness metrics, and storing your personal records. We do not use your data for advertising, profiling, or any purpose unrelated to the App.</p>
          </Section>

          <Section title="3. Data Storage & Security">
            <p>Your data is stored in a PostgreSQL database provided by Supabase (supabase.com), hosted on secure cloud infrastructure. All data is encrypted in transit (TLS) and at rest. Row-level security policies ensure that no user can access another user's data — ever.</p>
          </Section>

          <Section title="4. Data Sharing">
            <p>We do not sell, rent, or share your personal data with third parties. The only exception is Supabase as our infrastructure provider, who processes data on our behalf under their own privacy policy.</p>
          </Section>

          <Section title="5. Emails">
            <p>We do not send marketing emails, newsletters, or promotional communications. Account-related notifications are limited to what is strictly necessary for account security (if enabled). No email verification is required to use the App.</p>
          </Section>

          <Section title="6. Data Retention">
            <p>Your data is retained as long as your account exists. When you delete your account, all associated training data, personal records, and profile information are permanently deleted within 30 days.</p>
          </Section>

          <Section title="7. Your Rights">
            <p>You have the right to: (a) access all data we hold about you (available directly in the App); (b) correct inaccurate data; (c) delete your account and all data; (d) export your training data. To exercise any of these rights, use the in-app settings or contact us directly.</p>
          </Section>

          <Section title="8. Children's Privacy">
            <p>The App is not directed at children under 13. If we become aware that a user under 13 has created an account, we will delete it promptly.</p>
          </Section>

          <Section title="9. Changes to This Policy">
            <p>We may update this Privacy Policy. Material changes will be noted within the App. Continued use after changes constitutes acceptance.</p>
          </Section>

          <Section title="10. Contact">
            <p>For any privacy questions or data requests, contact us through the App.</p>
          </Section>
        </motion.div>
      </div>
    </div>
  )
}
