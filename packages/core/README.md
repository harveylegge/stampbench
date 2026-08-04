# @invoicegate/core

Validate, repair and generate **EN 16931 / XRechnung / ZUGFeRD** e-invoices in
pure TypeScript. No Java, no hosted API — your invoice bytes never leave the
process.

```sh
npm install @invoicegate/core
```

## Validate

```ts
import { validateXml } from '@invoicegate/core';

const result = validateXml(xml); // UBL or CII, auto-detected
result.valid;        // false
result.violations;   // [{ ruleId: 'BR-DE-15', message: '…', severity: 'error', … }]
```

Rule ids are the official EN 16931 / XRechnung ones (`BR-*`, `BR-CO-*`,
`BR-DE-*`). Coverage is a **documented subset** — 56 rules in the `xrechnung`
profile, 40 in `en16931` — not a replacement for the official KoSIT validator.
Run 86 official test-suite documents through both and they agree on 83; the 3
divergences are published, and all 3 are this library being stricter.

## Locate — line numbers for every violation

```ts
import { validateXml, locateViolations } from '@invoicegate/core';

const r = validateXml(xml);
for (const v of locateViolations(xml, r.violations, r.syntax ?? 'ubl')) {
  console.log(`${v.location.line}:${v.location.column} ${v.ruleId} (${v.location.precision})`);
}
```

`precision` is honest: `exact` when the offending element was found,
`ancestor` when the field is missing and the nearest parent is reported
instead. Approximate locations say so — in every output format.

## Fix — repair what has one correct answer

```ts
import { fixXml } from '@invoicegate/core';

const fixed = fixXml(xml);
fixed.applied;    // edits: line, column, previous, replacement, ruleId
fixed.unfixable;  // what was left alone, and why
```

Fixes totals and VAT amounts that disagree with the figures they are computed
from, by editing those values **in the original text** — formatting, comments
and everything the semantic model doesn't cover stay byte-for-byte intact. It
never invents business data (a missing VAT id is reported, not guessed), and an
edit that would change the amount due on a document with a prepaid amount is
withheld until you pass `confirmAmountDue: true`.

## Generate

```ts
import { generateXRechnungUbl, withComputedTotals, withXRechnungDefaults } from '@invoicegate/core';

const invoice = withComputedTotals(withXRechnungDefaults({ lines, seller, buyer }));
const xml = generateXRechnungUbl(invoice); // XRechnung 3.0 UBL
```

For authoring new invoices — not for round-tripping existing ones (the model is
a subset; regeneration drops what it doesn't represent).

## Regression testing

```ts
import { compareRulesets } from '@invoicegate/core';

const report = compareRulesets(documents, 'en16931@2017', 'xrechnung@3.0');
report.summary.regressions; // documents that would START failing
```

Test the next ruleset before it takes effect, instead of on the switchover
date.

## CLI

The [`invoicegate`](https://www.npmjs.com/package/invoicegate) package wraps
all of this for the command line and CI, including GitHub pull-request
annotations and SARIF output.

## License

MIT. Developer tooling, not legal advice — for certification-grade sign-off
also run the official KoSIT validator.
