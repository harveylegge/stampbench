import type { Metadata } from 'next';
import Link from 'next/link';
import { Clause, LegalPage } from '@/components/legal';

export const metadata: Metadata = { title: 'Cancellation and Refund Policy', description: 'How Stampbench subscriptions can be cancelled and when refunds are available.' };

export default function RefundPolicyPage() {
  return <LegalPage title="Cancellation and Refund Policy" updated="28 September 2026" intro={<p>This policy applies to Stampbench paid subscriptions. Stampbench accounts are offered for business use. Nothing here removes a right that applicable law gives you.</p>}>
    <Clause n="1." title="Cancel at any time"><p>You can cancel a card subscription through the billing portal in your account. PayPal subscriptions can be cancelled from your account or in PayPal. Cancellation stops the next renewal; paid access normally continues until the end of the current billing period.</p></Clause>
    <Clause n="2." title="Refunds"><p>We do not normally provide a pro-rata refund for an unused part of a billing month. We will refund duplicate or incorrect charges, and may provide a full or proportionate refund where a material paid feature was unavailable or did not match its description. Statutory rights continue to apply.</p></Clause>
    <Clause n="3." title="Requesting a refund"><p>Email <a href="mailto:hello@stampbench.com?subject=Refund%20request" className="text-accent-hi underline">hello@stampbench.com</a> from the address on the account. Include the charge date and payment-provider reference, but never send a complete card number or password. We aim to acknowledge requests within two working days and return approved refunds to the original payment method.</p></Clause>
    <Clause n="4." title="Consumer rights"><p>The Service is intended for people acting for business purposes. If consumer law nevertheless applies to your purchase, including a statutory cancellation right, that law takes priority over this policy. Contact us before using a paid feature if you wish to exercise a cooling-off right.</p></Clause>
    <Clause n="5." title="Related terms"><p>See the <Link href="/terms" className="text-accent-hi underline">Terms of Service</Link> for billing terms and the <Link href="/privacy" className="text-accent-hi underline">Privacy Policy</Link> for payment data.</p></Clause>
  </LegalPage>;
}
