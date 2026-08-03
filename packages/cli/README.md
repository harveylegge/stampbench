# invoicegate

Validate and generate **XRechnung / EN 16931** e-invoices from the command line.

```sh
npm install -g invoicegate
# or run it without installing:
npx invoicegate validate invoice.xml
```

## Commands

### `invoicegate validate <file.xml>`

Checks a UBL or CII (ZUGFeRD / Factur-X) invoice against the EN 16931 business
rules — plus the German BR-DE rules when the profile is `xrechnung` (the default).
The syntax (UBL vs CII) is auto-detected.

```sh
invoicegate validate invoice.xml
invoicegate validate invoice.xml --profile en16931   # core rules only
invoicegate validate invoice.xml --json              # machine-readable result
invoicegate validate invoice.xml --quiet             # summary line only
```

Example output:

```
invoice.xml  syntax: UBL | profile: xrechnung | ruleset: 2026-08.1
  ERROR  BR-DE-15  The buyer reference must be provided.
INVALID — 1 error, 0 warnings (31 rules run)
```

### `invoicegate generate <invoice.json>`

Builds XRechnung 3.0 UBL XML from a JSON semantic model (either the bare
invoice object or `{ "invoice": { ... } }`). Defaults (spec id, type code,
currency) and totals are computed for you, and the result is validated
before it is written.

```sh
invoicegate generate invoice.json -o invoice.xml
invoicegate generate invoice.json > invoice.xml      # stdout works too
invoicegate generate invoice.json --no-validate      # skip the validation step
```

## Exit codes

| Code | Meaning                              |
| ---- | ------------------------------------ |
| 0    | valid / success                      |
| 1    | validation errors found              |
| 2    | usage or IO error (bad JSON, missing file, unknown flag) |

This makes the CLI directly usable as a CI gate — `invoicegate validate invoice.xml`
in a pipeline fails the job when the invoice is non-compliant, while warnings
alone keep it green.

## Library

The CLI is a thin wrapper around [`@invoicegate/core`](https://www.npmjs.com/package/@invoicegate/core),
a dependency-light TypeScript library with the full rule set (BR, BR-CO, BR-DE),
UBL/CII parsing, and XRechnung UBL generation — use it directly if you need
validation inside your own application. Hosted API and docs: <https://invoicegate.dev>.
