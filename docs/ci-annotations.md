# CI annotations — failing invoices, on the failing line

`invoicegate validate` can report results as GitHub Actions annotations or as
SARIF, so a non-compliant invoice shows up **on the line of the offending
element** in the pull request rather than as a wall of text in a log.

```
invoices/2026-08-rechnung.xml
  78 |       <cbc:TaxAmount currencyID="EUR">99.99</cbc:TaxAmount>
     |       ^ BR-CO-17 — VAT breakdown S @ 7%: tax amount should be 22.04
     |         (314.86 × 7%) but is 99.99. (BT-117)
```

## Quick start

```yaml
name: e-invoices
on: pull_request

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: invoicegate/invoicegate@v1
        with:
          paths: ./invoices
```

That is the whole thing. The step fails when an invoice has errors, and each
error becomes an annotation on the pull request.

## Without the Action

The Action is a thin wrapper — the CLI does the work, so any CI system can use
it:

```sh
npx invoicegate validate ./invoices --format github
```

Anything printed in the `::error file=…,line=…::message` shape is picked up by
GitHub Actions. For other CI systems use `--format sarif` or `--format json`.

## Action inputs

| Input               | Default             | Meaning |
| ------------------- | ------------------- | ------- |
| `paths`             | `.`                 | Files and/or directories, space separated. Directories are searched recursively for `.xml`. |
| `profile`           | `xrechnung`         | `xrechnung` adds the German BR-DE rules; `en16931` is the European core only. |
| `format`            | `github`            | `github` for inline annotations, `sarif` to upload to code scanning. |
| `fail-on`           | `error`             | `warning` also fails the step on warnings. |
| `max-annotations`   | *(none)*            | Cap on annotations emitted. See the limits below. |
| `sarif-file`        | `invoicegate.sarif` | Where to write the SARIF report. |
| `version`           | `latest`            | npm version of the CLI. **Pin this** for reproducible builds. |
| `working-directory` | `.`                 | Directory to run in; paths resolve relative to it. |
| `node-version`      | `20`                | Set to `''` to use the runner's existing Node. |

Outputs: `exit-code`, and `sarif-file` when `format: sarif`.

## SARIF and code scanning

SARIF puts findings in the Security tab and keeps them across commits, which
suits a large existing corpus better than per-PR annotations.

```yaml
jobs:
  validate:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
      contents: read
      actions: read          # both of these are needed for private repos
    steps:
      - uses: actions/checkout@v4
      - uses: invoicegate/invoicegate@v1
        id: invoices
        with:
          paths: ./invoices
          format: sarif
      - uses: github/codeql-action/upload-sarif@v4
        if: always()         # upload the report even when validation failed
        with:
          sarif_file: ${{ steps.invoices.outputs.sarif-file }}
```

Code scanning is free on public repositories. On private repositories it
requires GitHub Advanced Security.

## How precise are the line numbers?

This is the part worth reading, because the honest answer is "it depends on why
the rule fired".

Every violation gets one of three precisions, and **the imprecise ones say so**
in the annotation text:

| Precision  | What it means | Example |
| ---------- | ------------- | ------- |
| `exact`    | The element or attribute the rule is about was found. The line and column point straight at it. | A VAT amount that does not match its own rate. |
| `ancestor` | The field is *missing* — there is no line for something that was never written — so the nearest enclosing element is reported. | A missing buyer post code lands on the buyer's `PostalAddress`. |
| `document` | Nothing could be located; the root element is used. | Should not happen in practice; see the measurement below. |

An approximate annotation carries the caveat inline:

```
[no element for this field in the document; showing its closest parent
 /Invoice/cac:AccountingCustomerParty/cac:Party/cac:PostalAddress]
```

and the human CLI report marks it with `~`:

```
  ERROR  BR-DE-9   Missing buyer post code (BT-53) — required by XRechnung. (~line 41)
```

This matters more than the raw hit rate. A linter that quietly sends a reviewer
to the wrong line twice stops being trusted, and a compliance tool that is not
trusted is worthless. Where we cannot be exact, we say so.

### Measured

The official XRechnung test corpus is entirely *valid*, so it cannot tell us
how good the line numbers are on broken invoices — 86 documents raise 9
violations between them. So we measure by breaking them: delete one required
field at a time from every corpus document and see where the resulting
violations land.

**9,983 mutations → 6,149 violations:**

| | Share |
| --- | --- |
| Anchored to a real element | **100%** |
| — of which exact element or attribute | 27.1% |
| — of which nearest enclosing element | 72.9% |
| Fell back to the document root | **0%** |

Mean anchor depth is 3.7 path segments, i.e. anchors are specific
(`…/Party/PostalAddress`), not the document root.

Deletion is the dominant real failure mode — nearly every EN 16931 rule fires
because something mandatory is absent — which is also why the *ancestor* share
is the large one. It is not a defect: a missing element has no line, and its
parent is the closest true answer.

Reproduce it with `packages/core/tests/locate.sweep.test.ts` (needs the corpus:
`node tools/parity/download.mjs`). That test also fails the build if any rule
starts falling through to the document root.

## GitHub's annotation limits

GitHub renders **10 annotations per level per step, 50 per job**, and discards
the rest **silently** — no marker, no "and 40 more". This is a GitHub limit, not
ours, and it is not documented on docs.github.com (it is stated in
`actions/toolkit`'s problem-matchers documentation).

So `--format github` always writes the true totals to stderr:

```
invoicegate: 37 errors, 4 warnings in 12 files.
```

The Action also puts that line in the job summary. The raw `::error` lines stay
in the step log even when the rendered annotation is dropped, so nothing is
lost — but if you validate a large corpus, prefer `format: sarif`, which has a
25,000-result ceiling instead of 50.

Annotations appear in the run summary, the PR **Checks** tab, and the PR **Files
changed** tab. Since 2019 they show on Files changed even when the annotated
line is not part of the diff — inline within the diff hunk when it is, and
grouped separately when it is not.

## Exit codes

| Code | Meaning |
| ---- | ------- |
| 0    | No problems meeting `fail-on`. |
| 1    | Validation problems found. |
| 2    | The run never happened — bad flag, unreadable file. |

Code 2 is deliberately distinct so CI can tell "your invoices are broken" from
"the tool is broken".

## Using the location data directly

Locations are part of the library API, not just the CLI:

```ts
import { validateXml, locateViolations } from '@invoicegate/core';

const result = validateXml(xml);
for (const v of locateViolations(xml, result.violations, result.syntax ?? 'ubl')) {
  console.log(`${v.location.line}:${v.location.column} ${v.ruleId} (${v.location.precision})`);
  console.log(`  at ${v.location.xpath}`);
}
```

`--format json` includes the same `location` object on every violation.
