import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dumbbell } from 'lucide-react';
import { cmsService, ThemeSettings } from '@/services/cmsService';

const LAST_UPDATED = 'April 1, 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
      <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">{title}</h2>
      <div className="space-y-3 text-white/70 text-sm sm:text-base leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  const [theme, setTheme] = useState<ThemeSettings>(cmsService.getDefaultTheme());

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    setTheme(cmsService.getTheme());
    cmsService.getThemeAsync().then(dbTheme => setTheme(dbTheme)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <header className="border-b border-white/10 bg-[#050508]/90 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-white/90 hover:text-white transition-colors">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
              <Dumbbell className="h-5 w-5" />
            </div>
            <span className="font-bold">Back to Home</span>
          </Link>
          <Link to="/terms" className="text-sm text-orange-400 hover:text-orange-300 transition-colors">
            View Terms
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
        <div className="space-y-4">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Privacy Policy</h1>
          <p className="text-white/60">Last updated: {LAST_UPDATED}</p>
          <p className="text-white/70 text-sm sm:text-base leading-relaxed">
            This Privacy Policy explains how we collect, use, store, and share personal information when you use our public website,
            gym management platform, member portals, and communication tools, including Meta WhatsApp messaging.
          </p>
          <p className="text-white/70 text-sm sm:text-base leading-relaxed">
            This Policy applies to {theme.gymName} and its authorized branch operations.
          </p>
        </div>

        <Section title="1. Information We Collect">
          <p>We collect information you provide directly, such as:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Lead form data: full name, phone number, email (optional), source.</li>
            <li>Membership data: contact details, date of birth, gender, address, emergency contact, plan details.</li>
            <li>Fitness and health declarations: fitness goals, medical conditions, workout preferences.</li>
            <li>Identity and compliance records: government ID details, digitally signed forms, uploaded documents.</li>
            <li>Communication content: messages sent via email, SMS, and WhatsApp channels.</li>
            <li>Payment and billing data: invoice details, transaction references, payment status, method, and amount paid.</li>
          </ul>
          <p>
            We also process system data such as login records, role-based access details, branch context, audit logs, and feature usage events.
          </p>
        </Section>

        <Section title="2. How We Use Your Information">
          <ul className="list-disc pl-5 space-y-2">
            <li>To manage memberships, attendance, classes, sessions, invoices, and branch operations.</li>
            <li>To communicate with leads and members about onboarding, reminders, services, and support.</li>
            <li>To process and verify payments via configured payment gateways.</li>
            <li>To generate documents, maintain records, and improve platform performance and safety.</li>
            <li>To detect misuse, secure accounts, and comply with legal or regulatory requirements.</li>
          </ul>
        </Section>

        <Section title="3. WhatsApp and Meta Messaging">
          <p>
            We use Meta WhatsApp Cloud API integrations to send and receive branch-level WhatsApp communications.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>We process phone numbers, contact names, message content, status metadata, and timestamps.</li>
            <li>Incoming webhook events are used to store message threads and delivery/read status updates.</li>
            <li>Messages may include service updates, reminders, confirmations, and support replies.</li>
            <li>
              You may opt out of WhatsApp promotional communication by contacting the branch directly and requesting removal from campaigns.
            </li>
          </ul>
        </Section>

        <Section title="4. Legal Bases and Consent">
          <p>Depending on your location and use case, we process data under one or more of these bases:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Performance of a contract (membership, service delivery, and billing).</li>
            <li>Legitimate interests (operations, service quality, fraud prevention, and security).</li>
            <li>Consent (marketing, optional communication channels, and certain health declarations).</li>
            <li>Legal obligations (tax, accounting, law-enforcement requests, and compliance reporting).</li>
          </ul>
        </Section>

        <Section title="5. Data Sharing">
          <p>We may share information with trusted processors and integrations as needed to run the service:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Cloud database and authentication providers.</li>
            <li>Payment gateway providers (for transaction processing and verification).</li>
            <li>Meta/WhatsApp infrastructure for message transport and webhook events.</li>
            <li>Document storage and communication providers.</li>
          </ul>
          <p>We do not sell, rent, or trade personal data to third parties.</p>
        </Section>

        <Section title="6. Data Retention and Security">
          <ul className="list-disc pl-5 space-y-2">
            <li>We retain records for operational, internal audit, legal, tax, and dispute-resolution requirements.</li>
            <li>Member records, invoices, communication logs, audit logs, signed forms, and related evidence may be retained according to local guidelines and mandatory retention timelines.</li>
            <li>Retention periods vary by data type and regulatory requirement, and deletion is applied only where legally permitted.</li>
            <li>Access controls, role-based permissions, and monitoring are used to protect data.</li>
            <li>No internet transmission or storage is 100% secure, but we apply reasonable safeguards.</li>
          </ul>
        </Section>

        <Section title="7. Image and File Storage">
          <ul className="list-disc pl-5 space-y-2">
            <li>Member images and uploaded files are stored on our own managed servers and storage infrastructure.</li>
            <li>These files are used strictly for operations, member servicing, verification, and internal audit purposes.</li>
            <li>Access is restricted to authorized personnel and controlled by role-based permissions.</li>
          </ul>
        </Section>

        <Section title="8. Your Rights">
          <p>Subject to applicable law, you may request access, correction, deletion, restriction, portability, or objection.</p>
          <p>
            To make a request, contact your branch or support team with enough information to verify your identity.
            We may retain certain records when required by law, local guidelines, internal audit controls, or legitimate business needs.
          </p>
        </Section>

        <Section title="9. Children">
          <p>
            Our services are not intended for children below the minimum legal age applicable in your jurisdiction
            without parent or guardian authorization.
          </p>
        </Section>

        <Section title="10. Policy Updates">
          <p>
            We may update this Privacy Policy to reflect product, legal, or operational changes. Updates will be posted on this page
            with a revised "Last updated" date.
          </p>
        </Section>

        <Section title="11. Contact">
          <p>For privacy requests, WhatsApp consent updates, internal-audit data requests, or complaints, contact:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Entity: {theme.gymName}</li>
            <li>Email: {theme.contactEmail}</li>
            <li>Phone: {theme.contactPhone}</li>
            <li>Address: {theme.address}</li>
          </ul>
          <p>
            We handle requests in line with applicable local guidelines, regulatory obligations, and internal audit controls.
          </p>
        </Section>
      </main>
    </div>
  );
}
