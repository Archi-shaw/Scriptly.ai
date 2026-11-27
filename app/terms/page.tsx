import type { Metadata } from "next";
import LegalPage from "@/app/components/Landing/LegalPage";

export const metadata: Metadata = { title: "Terms of Service" };

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@scriptly.ai";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="November 26, 2026">
      <p>
        These terms govern your use of Scriptly.ai (the “Service”). By creating an account or using the Service you agree to them.
      </p>
      <h2>Your account</h2>
      <p>
        You must provide a valid email address and keep your password and verification codes confidential. You are responsible for
        activity under your account. Tell us promptly at <a href={`mailto:${supportEmail}`}>{supportEmail}</a> if you suspect
        unauthorised access.
      </p>
      <h2>Credits and payments</h2>
      <ul>
        <li>The Service uses prepaid credits. Each generation or AI editing action uses the number of credits shown before you run it.</li>
        <li>New accounts receive complimentary credits. Purchased credits are added only after the payment provider confirms payment.</li>
        <li>Credits do not expire, have no cash value and are not transferable. If a generation fails, its credits are refunded automatically.</li>
        <li>If a payment is refunded, the credits it bought are removed from your balance (credits you have already used are not affected).</li>
        <li>Payments are processed by our payment provider; we do not store your card details.</li>
      </ul>
      <h2>Your content</h2>
      <p>
        You own the inputs you provide and the content you generate, to the extent permitted by law. You are responsible for reviewing
        generated content for accuracy and for how you use it. AI output can be incorrect or similar to content generated for others.
      </p>
      <h2>Acceptable use</h2>
      <p>
        Do not use the Service to create unlawful, deceptive, harassing or infringing content, to impersonate others, to send spam, or
        to attempt to disrupt or reverse-engineer the Service. We may suspend accounts that violate these terms.
      </p>
      <h2>Availability and changes</h2>
      <p>
        We work to keep the Service available but do not guarantee uninterrupted operation. We may update features and these terms;
        material changes will be communicated in the app or by email.
      </p>
      <h2>Liability</h2>
      <p>
        The Service is provided “as is”. To the extent permitted by law, our liability for any claim relating to the Service is limited
        to the amount you paid us in the three months before the claim.
      </p>
      <h2>Contact</h2>
      <p>
        Questions about these terms: <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
      </p>
    </LegalPage>
  );
}
