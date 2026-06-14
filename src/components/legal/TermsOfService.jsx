import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'

export default function TermsOfService({ onBack }) {
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
                       fontFamily:'Space Grotesk, Inter, sans-serif' }}>Terms of Service</h1>
          <p style={{ color:'rgba(255,255,255,0.35)', fontSize:13, marginBottom:40 }}>
            Last updated: June 14, 2026
          </p>

          <Section title="1. Acceptance of Terms">
            <p>By creating an account on XC Training ("the App"), you agree to be bound by these Terms of Service. If you do not agree, do not create an account or use the App.</p>
          </Section>

          <Section title="2. Description of Service">
            <p>XC Training is a personal athletic training tracker that helps cross country and track athletes log workouts, visualize training load, and track personal records. The App is provided as-is for personal, non-commercial use.</p>
          </Section>

          <Section title="3. Account Eligibility">
            <p>You must be at least 13 years of age to create an account. By registering, you confirm that the information you provide is accurate and that you are eligible to use the App. You are responsible for maintaining the security of your password.</p>
          </Section>

          <Section title="4. Acceptable Use">
            <p>You agree not to: (a) use the App for any unlawful purpose; (b) attempt to gain unauthorized access to other users' data or the App's infrastructure; (c) upload malicious files or content; (d) reverse-engineer or attempt to extract source code from the App.</p>
          </Section>

          <Section title="5. Your Data">
            <p>All training data you upload (workouts, GPS files, personal records) belongs to you. You may delete your account and all associated data at any time. See our Privacy Policy for full details on how your data is stored and used.</p>
          </Section>

          <Section title="6. Health & Fitness Disclaimer">
            <p>XC Training provides training data analytics tools only. The App does not provide medical advice. Training metrics (VO₂ max estimates, training load scores) are estimates and should not be used as a substitute for professional medical or coaching advice. Always consult a qualified professional before beginning any new training program.</p>
          </Section>

          <Section title="7. Intellectual Property">
            <p>The App's design, code, and original content are owned by the developers. Your personal training data remains yours. No license to our intellectual property is granted beyond the right to use the App as intended.</p>
          </Section>

          <Section title="8. Limitation of Liability">
            <p>To the fullest extent permitted by law, XC Training and its developers shall not be liable for any indirect, incidental, or consequential damages arising from your use of the App. The App is provided "as is" without warranties of any kind.</p>
          </Section>

          <Section title="9. Account Termination">
            <p>We reserve the right to suspend or terminate accounts that violate these Terms. You may delete your account at any time, which will permanently delete all associated data.</p>
          </Section>

          <Section title="10. Changes to Terms">
            <p>We may update these Terms from time to time. Continued use of the App after changes are posted constitutes acceptance of the new Terms.</p>
          </Section>

          <Section title="11. Contact">
            <p>Questions about these Terms? Contact us at the email associated with the App.</p>
          </Section>
        </motion.div>
      </div>
    </div>
  )
}
