# invoicegate

Validate and generate **XRechnung / EN 16931** e-invoices from the command line.

```sh
npm install -g invoicegate
# or run it without installing:
npx invoicegate validate invoice.xml
```

## Commands

### `invoicegate validate <file.xml|dir...>`

Checks UBL or CII (ZUGFeRD / Factur-X) invoices against the EN 16931 business
rules — plus the German BR-DE rules when the profile is `xrechnung` (the default).
The syntax (UBL vs CII) is auto-detected. Directories are searched recursively
for `.xml` files.

```sh
invoicegate validate invoice.xml
invoicegate validate ./invoices                      # a whole folder
invoicegate validate invoice.xml --profile en16931   # core rules only
invoicegate validate invoice.xml --json              # machine-readable result
invoicegate validate invoice.xml --quiet             # summary line only
invoicegate validate ./invoices --fail-on warning    # warnings fail the build too
```

Example output:

```
invoice.xml  syntax: UBL | profile: xrechnung | ruleset: 2026-08.2
  ERROR  BR-CO-17  VAT breakdown S @ 7%: tax amount should be 22.04 (314.86 × 7%) but is 99.99. (line 78)
  ERROR  BR-DE-15  Missing buyer reference (BT-10). … (~line 2)
INVALID — 2 errors, 0 warnings (56 rules run)
```

A line marked `~` is **approximate**: the field is missing from the document, so
there is no line for it and the nearest enclosing element is reported instead.
The distinction is kept in every output format — a tool that sends you to the
wrong line without saying so is worse than one that admits it.

### CI output formats

`--format` selects how results are reported:

| Format   | Use                                                                 |
| -------- | ------------------------------------------------------------------- |
| `human`  | Readable report with line numbers (default)                          |
| `json`   | Machine-readable; every violation carries a `location`               |
| `github` | GitHub Actions workflow commands — inline pull-request annotations   |
| `sarif`  | SARIF 2.1.0 for GitHub code scanning and other CI systems            |

```sh
invoicegate validate ./invoices --format github
invoicegate validate ./invoices --format sarif > invoicegate.sarif
```

See [CI annotations](../../docs/ci-annotations.md) for the GitHub Action, an
example workflow, and how precise the line numbers actually are.

### `invoicegate fix <file.xml|dir...>`

Repairs the problems that have exactly one correct answer — totals and VAT
amounts that disagree with the figures they are derived from — by editing those
values in your file and nothing else.

```sh
invoicegate fix invoice.xml            # show what would change; writes nothing
invoicegate fix ./invoices --write     # apply the fixes
invoicegate fix ./invoices --json      # machine-readable plan
```

```
invoice.xml
  fix   line 77    BR-CO-17, BR-S-09  99.99 → 22.04
  keep            BR-DE-15  no derivable correct value — this needs a human decision, not arithmetic
1 fix applied, 1 error needing a person
```

It never regenerates the document — that would silently discard the ~26% of
elements our semantic model does not represent — and it never invents business
data. Anything needing a human decision is reported, never guessed. See
[Repair](../../docs/fixing.md).

Without `--write` it changes nothing and exits `1` while fixes are outstanding,
so it works as a CI gate like `prettier --check`.

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
alone keep it green. Use `--fail-on warning` to fail on warnings as well.

Exit code 2 always means the run never happened, so CI can tell "your invoices
are broken" apart from "the tool is broken".

## Library

The CLI is a thin wrapper around [`@invoicegate/core`](https://www.npmjs.com/package/@invoicegate/core),
a dependency-light TypeScript library with the full rule set (BR, BR-CO, BR-DE),
UBL/CII parsing, and XRechnung UBL generation — use it directly if you need
validation inside your own application. Hosted API and docs: <https://invoicegate.dev>.
