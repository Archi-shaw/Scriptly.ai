import type { Metadata } from "next";
import LegalPage from "@/app/components/Landing/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy" };

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@scriptly.ai";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="November 26, 2026">
      <p>This policy explains what Scriptly.ai collects, why, and the choices you have.</p>
      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account data:</strong> your name, email address and a salted hash of your password (never the password itself). If you
          sign in with Google we receive your name, email and profile picture.
        </li>
        <li>
          <strong>Content:</strong> the details you enter into templates, the content generated for you, and documents you save.
        </li>
        <li>
          <strong>Usage and billing:</strong> generations, credit transactions and orders. Card details are handled by our payment
          provider and never reach our servers.
        </li>
        <li>
          <strong>Security data:</strong> IP address and browser information used for rate limiting and to protect sign-in, plus
          one-time codes stored only as hashes until they expire.
        </li>
      </ul>
      <h2>How we use it</h2>
      <p>
        To provide the Service, generate content, keep your account secure (email verification and sign-in codes), process payments,
        and support you. We do not sell your personal data.
      </p>
      <h2>Service providers</h2>
      <p>
        Your template inputs are sent to our AI model provider to generate content. Emails are delivered through our email provider and
        payments are processed by our payment provider. To keep automated abuse out of sign-up and sign-in, those pages may use a
        bot check from our security provider, which processes technical data such as your IP address and browser signals. These
        providers process data on our behalf.
      </p>
      <h2>Cookies</h2>
      <p>
        We use essential cookies to keep you signed in and protect against cross-site request forgery. Your browser may also store
        editor drafts and preferences locally on your device.
      </p>
      <h2>Retention and deletion</h2>
      <p>
        You can delete documents and history at any time, and delete your account from Settings, which erases your profile, documents
        and generation history. Payment and credit records may be kept as required for accounting.
      </p>
      <h2>Contact</h2>
      <p>
        Privacy questions or requests: <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
      </p>
    </LegalPage>
  );
}
