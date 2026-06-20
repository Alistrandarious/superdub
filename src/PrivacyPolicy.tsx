import React from 'react';
import { useNavigate } from 'react-router-dom';
import './App.css';

const THEME = '#2E8BFF';

const PrivacyPolicy: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="app flush" style={{ '--theme': THEME, '--theme-dim': THEME + '55', '--theme-glow': THEME + '22' } as React.CSSProperties}>
      <div className="page-content" style={{ overflowY: 'auto', flex: 1, maxWidth: 720, margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, paddingBottom: 64, color: '#c8cdd4' }}>
          <div className="page-intro-row">
            <button className="page-back" onClick={() => navigate(-1)}><span className="page-back-arrow">‹</span> Back</button>
            <h1 className="page-intro-title">Privacy Policy</h1>
          </div>

          <div className="diet-section">
            <p style={{ fontSize: '0.82rem', color: '#6b7280', margin: 0 }}>Last updated: 16 June 2026</p>
            <p style={{ marginTop: 12, lineHeight: 1.7 }}>
              This Privacy Policy explains how <strong style={{ color: '#fff' }}>Superdub</strong> ("we", "us", "our") collects, uses, and protects your personal data when you use our habit and health tracking application. We are committed to protecting your privacy and complying with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.
            </p>
          </div>

          <Section title="1. Who We Are">
            <p>Superdub is a personal health and habit tracking application. For questions about this policy or your data, contact us at: <strong style={{ color: '#fff' }}>privacy@superdub.app</strong></p>
          </Section>

          <Section title="2. Data We Collect">
            <p>When you create an account and use Superdub, we collect:</p>
            <ul style={{ marginTop: 10, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li><strong style={{ color: '#fff' }}>Account data:</strong> email address, hashed password</li>
              <li><strong style={{ color: '#fff' }}>Profile data:</strong> first name, last name, date of birth, sex, height, weight</li>
              <li><strong style={{ color: '#fff' }}>Health & activity data:</strong> daily weight logs, calorie and macro entries, step counts, habit completions</li>
              <li><strong style={{ color: '#fff' }}>Goal data:</strong> goal weight, loss targets, activity level, calorie targets</li>
              <li><strong style={{ color: '#fff' }}>Meal plans:</strong> any meal plans you create within the app</li>
              <li><strong style={{ color: '#fff' }}>Tasks:</strong> to-do items you add</li>
            </ul>
            <p style={{ marginTop: 12 }}>We do <strong style={{ color: '#fff' }}>not</strong> collect location data, browsing history, device identifiers, or any data beyond what you directly enter.</p>
          </Section>

          <Section title="3. Legal Basis for Processing">
            <p>We process your personal data on the following legal bases under UK GDPR:</p>
            <ul style={{ marginTop: 10, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li><strong style={{ color: '#fff' }}>Consent (Article 6(1)(a)):</strong> You consent to processing when you create your account.</li>
              <li><strong style={{ color: '#fff' }}>Contract (Article 6(1)(b)):</strong> Processing is necessary to provide you with the Superdub service.</li>
              <li><strong style={{ color: '#fff' }}>Legitimate interests (Article 6(1)(f)):</strong> For security and fraud prevention.</li>
            </ul>
            <p style={{ marginTop: 12 }}>Health-related data (weight, calories, etc.) constitutes special category data under Article 9 GDPR. We process this solely based on your explicit consent.</p>
          </Section>

          <Section title="4. How We Use Your Data">
            <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>To provide and operate the Superdub service</li>
              <li>To calculate personalised calorie and macro targets</li>
              <li>To display your progress charts and history</li>
              <li>To send transactional emails (welcome email, password reset)</li>
              <li>To maintain the security of your account</li>
            </ul>
            <p style={{ marginTop: 12 }}>We do <strong style={{ color: '#fff' }}>not</strong> sell your data, share it with advertisers, or use it for any purpose other than providing the service.</p>
          </Section>

          <Section title="5. Data Storage & Security">
            <p>Your data is stored in a secure PostgreSQL database hosted on Neon (EU West region). Passwords are never stored in plain text — they are hashed using bcrypt with a work factor of 10 before storage. All connections use TLS encryption in transit.</p>
            <p style={{ marginTop: 10 }}>We retain your data for as long as your account exists. When you delete your account, all your personal data is permanently and irreversibly deleted within 30 days.</p>
          </Section>

          <Section title="6. Cookies & Local Storage">
            <p>Superdub does not use tracking cookies or third-party analytics. We store a single authentication token in your browser's <strong style={{ color: '#fff' }}>localStorage</strong> to keep you logged in. This token is not shared with any third party and can be removed by logging out.</p>
          </Section>

          <Section title="7. Third-Party Services">
            <p>We use the following third-party processors:</p>
            <ul style={{ marginTop: 10, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li><strong style={{ color: '#fff' }}>Neon (database):</strong> Stores your account and health data. EU-based. <a href="https://neon.tech/privacy" target="_blank" rel="noreferrer" style={{ color: THEME }}>Privacy policy →</a></li>
              <li><strong style={{ color: '#fff' }}>Render (hosting):</strong> Hosts the Superdub server. <a href="https://render.com/privacy" target="_blank" rel="noreferrer" style={{ color: THEME }}>Privacy policy →</a></li>
              <li><strong style={{ color: '#fff' }}>Resend (email):</strong> Sends transactional emails. <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noreferrer" style={{ color: THEME }}>Privacy policy →</a></li>
            </ul>
          </Section>

          <Section title="8. Your Rights Under UK GDPR">
            <p>You have the following rights regarding your personal data:</p>
            <ul style={{ marginTop: 10, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li><strong style={{ color: '#fff' }}>Right of access:</strong> Request a copy of all data we hold about you.</li>
              <li><strong style={{ color: '#fff' }}>Right to rectification:</strong> Correct inaccurate data via your Profile page at any time.</li>
              <li><strong style={{ color: '#fff' }}>Right to erasure:</strong> Delete your account and all associated data from your Profile page.</li>
              <li><strong style={{ color: '#fff' }}>Right to restriction:</strong> Request that we limit processing of your data.</li>
              <li><strong style={{ color: '#fff' }}>Right to data portability:</strong> Request an export of your data in a structured format.</li>
              <li><strong style={{ color: '#fff' }}>Right to object:</strong> Object to processing based on legitimate interests.</li>
              <li><strong style={{ color: '#fff' }}>Right to withdraw consent:</strong> Withdraw consent at any time by deleting your account.</li>
            </ul>
            <p style={{ marginTop: 12 }}>To exercise any of these rights, contact us at <strong style={{ color: '#fff' }}>privacy@superdub.app</strong>. We will respond within 30 days. You also have the right to lodge a complaint with the <a href="https://ico.org.uk" target="_blank" rel="noreferrer" style={{ color: THEME }}>Information Commissioner's Office (ICO)</a>.</p>
          </Section>

          <Section title="9. Children's Privacy">
            <p>Superdub is not intended for children under the age of 13. We do not knowingly collect data from children under 13. If you believe we have inadvertently collected such data, please contact us immediately.</p>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by email or via an in-app notice. Continued use of Superdub after changes constitutes acceptance of the updated policy.</p>
          </Section>

          <Section title="11. Contact Us">
            <p>For any privacy-related questions or to exercise your rights:</p>
            <p style={{ marginTop: 8 }}>
              <strong style={{ color: '#fff' }}>Email:</strong> privacy@superdub.app<br />
            </p>
          </Section>

        </div>
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="diet-section">
    <h2 className="diet-heading">{title}</h2>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, lineHeight: 1.7, fontSize: '0.92rem' }}>
      {children}
    </div>
  </div>
);

export default PrivacyPolicy;
