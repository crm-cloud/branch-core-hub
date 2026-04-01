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

export default function TermsPage() {
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
          <Link to="/privacy-policy" className="text-sm text-orange-400 hover:text-orange-300 transition-colors">
            View Privacy Policy
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
        <div className="space-y-4">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Terms and Conditions</h1>
          <p className="text-white/60">Last updated: {LAST_UPDATED}</p>
          <p className="text-white/70 text-sm sm:text-base leading-relaxed">
            These Terms govern use of our website, platform, member services, and communication channels.
            By using the services, you agree to these Terms.
          </p>
          <p className="text-white/70 text-sm sm:text-base leading-relaxed">
            These Terms are issued by {theme.gymName} and apply across its authorized branch operations.
          </p>
        </div>

        <Section title="1. Use of Service">
          <ul className="list-disc pl-5 space-y-2">
            <li>You must provide accurate information during registration and ongoing account use.</li>
            <li>You are responsible for activity performed through your account credentials.</li>
            <li>You agree not to misuse the platform, interfere with operations, or attempt unauthorized access.</li>
          </ul>
        </Section>

        <Section title="2. Membership and Fitness Services">
          <ul className="list-disc pl-5 space-y-2">
            <li>Membership plans, durations, and benefits are defined by the selected branch and plan terms.</li>
            <li>Fees may be non-refundable and non-transferable unless explicitly stated otherwise.</li>
            <li>Members must follow safety instructions, facility rules, and staff guidance.</li>
            <li>
              You confirm you are fit to participate in physical activity and must disclose relevant health risks
              where required.
            </li>
          </ul>
        </Section>

        <Section title="3. Payments, Invoices, and Billing">
          <ul className="list-disc pl-5 space-y-2">
            <li>Payments can be processed through configured gateways and/or approved manual methods.</li>
            <li>You authorize processing of payment details for invoice settlement and verification.</li>
            <li>Payment failures, reversals, gateway downtime, or bank delays may impact confirmation timing.</li>
            <li>Tax and billing records are maintained according to applicable legal and accounting requirements.</li>
          </ul>
        </Section>

        <Section title="4. WhatsApp, Email, and SMS Communications">
          <p>
            By sharing contact details and opting in where required, you agree to receive service communication
            through channels such as WhatsApp, email, and SMS.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>WhatsApp messaging is powered by Meta WhatsApp Cloud API integrations.</li>
            <li>Service communications may include reminders, booking updates, payment notices, and support messages.</li>
            <li>Promotional messages are sent only where consent or lawful basis exists.</li>
            <li>
              You can request opt-out from promotional communication by contacting your branch; transactional notices may still be sent when necessary.
            </li>
          </ul>
        </Section>

        <Section title="5. Data, Privacy, and Records">
          <p>
            Your use of the service is also subject to our Privacy Policy, which describes data handling and your rights.
            Uploaded forms, signatures, communication logs, member evidence records, and audit events may be retained for compliance,
            internal audit controls, and operations, in line with local legal guidelines.
          </p>
          <p>
            We do not sell, rent, or trade personal data to third parties. Member image files and related media are stored on our own managed servers.
          </p>
        </Section>

        <Section title="6. AI and Informational Features">
          <p>
            AI-enabled insights, suggestions, and automated replies are informational tools and do not constitute
            medical advice or guaranteed outcomes.
          </p>
          <p>
            Consult qualified professionals before making health, nutrition, or treatment decisions.
          </p>
        </Section>

        <Section title="7. Suspension or Termination">
          <ul className="list-disc pl-5 space-y-2">
            <li>We may suspend or terminate access for policy violations, abuse, non-payment, fraud, or legal reasons.</li>
            <li>Termination does not waive obligations already accrued (including outstanding dues where applicable).</li>
          </ul>
        </Section>

        <Section title="8. Limitation of Liability">
          <p>
            To the maximum extent permitted by law, we are not liable for indirect, incidental, special, or consequential damages,
            including interruption, data loss, or third-party service outages.
          </p>
        </Section>

        <Section title="9. Governing Law and Disputes">
          <p>
            These Terms are governed by applicable local law and regulatory guidelines. Unless mandatory law requires otherwise,
            disputes will be subject to the competent courts having jurisdiction where the relevant branch operates.
          </p>
        </Section>

        <Section title="10. Updates to Terms">
          <p>
            We may update these Terms from time to time. Continued use after updates means you accept the revised Terms.
          </p>
        </Section>

        <Section title="11. Contact">
          <ul className="list-disc pl-5 space-y-2">
            <li>Entity: {theme.gymName}</li>
            <li>Email: {theme.contactEmail}</li>
            <li>Phone: {theme.contactPhone}</li>
            <li>Address: {theme.address}</li>
          </ul>
        </Section>
      </main>
    </div>
  );
}
