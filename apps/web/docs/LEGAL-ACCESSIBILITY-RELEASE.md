# Legal and accessibility release check

Checked: 28 September 2026. This is an engineering review, not legal advice.

## Implemented

- Privacy Policy, Terms, Cookie and Local Storage Policy, Cancellation and Refund Policy, security page and provider notice are linked from every footer.
- Signup requires a separate, unchecked agreement to the Terms and acknowledgement of the Privacy Policy. The accepted version and timestamp are stored; this is not bundled with marketing consent.
- No advertising pixels, third-party analytics scripts or ordinary-page embeds were found. Aggregate page counts run at the edge without a browser identifier. A cookie consent banner is therefore not required for the present design; reassess before adding optional tracking or embeds.
- Stripe and PayPal are described as payment subprocessors. Payment credentials remain with the payment provider.
- A keyboard skip link, visible focus outlines, semantic form labels, alerts and descriptive image alternatives are present. Decorative images use empty alternative text.
- Unsupported fixed test-count claims were replaced with verifiable descriptions of the public test and parity suites. No customer reviews or testimonials were found.
- Footer business identity now names Harvey Legge trading as Stampbench, the UK and the contact email.

## Must be completed before public launch

1. **Postal address:** `/privacy`, `/terms` and `/impressum` still contain a highlighted postal-address placeholder. Supply an address at which legal notices can be received. The German-facing provider notice is incomplete without it.
2. **Telephone or equivalent rapid contact:** the Impressum still contains a telephone placeholder. Confirm the chosen direct-contact channel with a solicitor familiar with German DDG requirements.
3. **Professional legal review:** have the Terms, Privacy Policy, processor wording, liability cap and international sales position reviewed for the actual legal form and target countries.
4. **DPA and Gmail:** do not enable invoice-email ingestion until Google OAuth scope review, a data-processing agreement, retention/deletion controls, audit logging and a customer-facing connection revocation flow exist.
5. **Payments:** finish Stripe/PayPal production configuration and test renewal, failed payment, duplicate webhook, cancellation and refund handling before accepting money.
6. **Asset provenance:** keep source and licence evidence for every visual. The axonometric hero and invoice-autopilot flipbook were generated specifically for Stampbench. The logo files are Stampbench brand assets. Confirm and record who created or licensed `stampbench-bench.webp`; remove it if provenance cannot be demonstrated.
7. **Accessibility:** run a human keyboard and screen-reader pass on the deployed build and test at 200% zoom. Automated checks cannot establish full WCAG conformance.

## Current storage decision

The current cookies authenticate accounts and protect sessions. Local/session storage keeps user-requested drafts, history, preferences and the current assistant transcript on the device. Under the current implementation there is no optional tracking to accept. If analytics, advertising or third-party embeds are added, block them until the applicable consent or objection mechanism has run and update both policies first.

## Primary guidance consulted

- UK ICO guidance on cookies, storage and strictly necessary/statistical exceptions.
- GOV.UK online and distance-selling guidance and refund rules.
- Electronic Commerce (EC Directive) Regulations 2002.
- CMA guidance on fair commercial practices, fake reviews and accurate purchase information.
- Equality Act 2010 duties applicable to service providers; WCAG 2.2 AA used as the engineering target.
