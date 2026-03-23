import Link from 'next/link';
import styles from './privacy.module.css';

export const metadata = {
    title: 'Privacy Policy – Quote Flow',
    description: 'Privacy policy for Quote Flow, the AI-powered quoting assistant.',
};

export default function PrivacyPage() {
    return (
        <div className={styles.privacyContainer}>
            <div className={styles.privacyInner}>
                <Link href="/login" className={styles.backLink}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
                    Back
                </Link>

                <h1 className={styles.title}>Privacy Policy</h1>
                <p className={styles.lastUpdated}>Last updated: March 2026</p>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>1. Introduction</h2>
                    <div className={styles.sectionContent}>
                        <p>
                            Quote Flow (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is operated by AI Sphere Automations. This Privacy Policy
                            explains how we collect, use, store, and protect your personal information when you use
                            our AI-powered quoting application.
                        </p>
                        <p>
                            By using Quote Flow, you agree to the collection and use of information in accordance
                            with this policy. We are committed to compliance with the General Data Protection Regulation
                            (GDPR) and applicable data protection laws.
                        </p>
                    </div>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>2. Data We Collect</h2>
                    <div className={styles.sectionContent}>
                        <p>We collect and process the following types of data:</p>
                        <ul>
                            <li><strong>Account information:</strong> Email address and password (encrypted) for authentication.</li>
                            <li><strong>Company information:</strong> Company name, phone, email, website, logo, and any extra header lines you configure in Settings.</li>
                            <li><strong>Quote data:</strong> Service descriptions, pricing, photo blocks, and any content you add to your quotes.</li>
                            <li><strong>Chat history:</strong> Conversations with the AI assistant, including text messages and attachments you send.</li>
                            <li><strong>Notes:</strong> Any notes you create in the Notepad feature.</li>
                            <li><strong>Usage data:</strong> Subscription status, media upload counts, and AI token usage for plan management.</li>
                            <li><strong>Custom pricing:</strong> Your personal price list stored in Settings.</li>
                        </ul>
                    </div>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>3. How We Use Your Data</h2>
                    <div className={styles.sectionContent}>
                        <p>Your data is used exclusively to:</p>
                        <ul>
                            <li>Provide and maintain the Quote Flow service.</li>
                            <li>Generate AI-assisted quotes using your chat inputs and custom pricing.</li>
                            <li>Store and retrieve your quotes, conversations, and settings.</li>
                            <li>Process payments and manage your subscription.</li>
                            <li>Send transactional emails (e.g., password reset, account confirmation).</li>
                        </ul>
                        <p>
                            We do <strong>not</strong> sell, rent, or share your personal data with third parties for
                            marketing purposes.
                        </p>
                    </div>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>4. Third-Party Services</h2>
                    <div className={styles.sectionContent}>
                        <p>We use the following third-party services to operate Quote Flow:</p>
                        <ul>
                            <li>
                                <strong>Supabase</strong> — Database and authentication. Your data is stored in Supabase&apos;s
                                servers with encryption at rest and in transit.
                                {' '}<a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">Supabase Privacy Policy</a>
                            </li>
                            <li>
                                <strong>OpenAI</strong> — AI chat and voice transcription. Your chat messages and voice recordings
                                are sent to OpenAI&apos;s API for processing. OpenAI does not use API data for training.
                                {' '}<a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer">OpenAI Privacy Policy</a>
                            </li>
                            <li>
                                <strong>Airwallex</strong> — Payment processing. Your payment information is handled directly
                                by Airwallex; we do not store credit card details.
                                {' '}<a href="https://www.airwallex.com/privacy-policy" target="_blank" rel="noopener noreferrer">Airwallex Privacy Policy</a>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>5. AI-Generated Content</h2>
                    <div className={styles.sectionContent}>
                        <p>
                            Quote Flow uses artificial intelligence to assist with quote generation. Please note:
                        </p>
                        <ul>
                            <li>AI-generated prices and descriptions are suggestions and may contain errors.</li>
                            <li>You are responsible for reviewing and verifying all values before sending quotes to clients.</li>
                            <li>AI responses are generated based on your input and are not guaranteed to be accurate.</li>
                            <li>Your chat messages are processed by OpenAI but are not used to train their models (API usage policy).</li>
                        </ul>
                    </div>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>6. Data Storage & Security</h2>
                    <div className={styles.sectionContent}>
                        <ul>
                            <li>All data is encrypted in transit (TLS/SSL) and at rest.</li>
                            <li>Passwords are hashed and never stored in plain text.</li>
                            <li>Access to databases is restricted to authorized personnel only.</li>
                            <li>We regularly review our security practices to maintain protection.</li>
                        </ul>
                    </div>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>7. Your Rights (GDPR)</h2>
                    <div className={styles.sectionContent}>
                        <p>Under the GDPR, you have the right to:</p>
                        <ul>
                            <li><strong>Access</strong> — Request a copy of your personal data.</li>
                            <li><strong>Rectification</strong> — Correct inaccurate data.</li>
                            <li><strong>Erasure</strong> — Request deletion of your account and data.</li>
                            <li><strong>Portability</strong> — Receive your data in a structured format.</li>
                            <li><strong>Restriction</strong> — Limit how we process your data.</li>
                            <li><strong>Objection</strong> — Object to certain processing activities.</li>
                        </ul>
                        <p>
                            To exercise any of these rights, please contact us at the email address provided below.
                        </p>
                    </div>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>8. Data Retention</h2>
                    <div className={styles.sectionContent}>
                        <p>
                            We retain your data for as long as your account is active. If you delete your account,
                            all associated data (quotes, chat history, settings, notes) will be permanently removed
                            within 30 days.
                        </p>
                    </div>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>9. Cookies</h2>
                    <div className={styles.sectionContent}>
                        <p>
                            Quote Flow uses essential cookies only for authentication and session management.
                            We do not use tracking cookies or third-party analytics cookies.
                        </p>
                    </div>
                </div>

                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>10. Contact</h2>
                    <div className={styles.sectionContent}>
                        <p>
                            If you have any questions about this Privacy Policy or wish to exercise your data rights,
                            please contact us:
                        </p>
                        <p><strong>AI Sphere Automations</strong></p>
                        <p>Email: privacy@aisphereauto.com</p>
                    </div>
                </div>

                <div className={styles.footer}>
                    © {new Date().getFullYear()} AI Sphere Automations. All rights reserved.
                </div>
            </div>
        </div>
    );
}
