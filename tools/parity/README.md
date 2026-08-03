# KoSIT parity harness

**The trust artifact: we publish our delta against the legal reference validator.**

`@invoicegate/core` validates XRechnung / EN 16931 e-invoices in pure TypeScript. The
legal reference for XRechnung, however, is the [KoSIT validator](https://github.com/itplr-kosit/validator)
with the official [XRechnung configuration](https://github.com/itplr-kosit/validator-configuration-xrechnung).
Anyone can *claim* compliance; this harness measures it. It runs **both** validators over
the official [XRechnung test-suite](https://github.com/itplr-kosit/xrechnung-testsuite)
(UBL and CII instances) and emits a machine-readable delta report — the data behind the
public parity page.

Our validator implements a **documented subset** of the rules (see `docs/rules-coverage.md`
in the repo). The point of this harness is not to hide that — it is to quantify it,
per rule id, against the validator that legally decides acceptance in Germany.

## Pinned versions

Exact release tags, asset names, URLs, and byte sizes live in [`VERSIONS.json`](./VERSIONS.json).
The downloader verifies sizes byte-exact and refuses drift. Current pins:

| Component | Version | Asset |
| --- | --- | --- |
| KoSIT validator | `v1.6.2` | `validator-1.6.2-standalone.jar` |
| XRechnung configuration | `v2026-01-31` (XRechnung 3.0.2) | `xrechnung-3.0.2-validator-configuration-2026-01-31.zip` |
| XRechnung test-suite | `v2026-01-31` (XRechnung 3.0.2) | `xrechnung-3.0.2-testsuite-2026-01-31.zip` |

## Running locally

Requirements: Node >= 20, **Java 17+** on PATH (the KoSIT validator is a Java tool),
and either `unzip` or a zip-capable `tar` (bsdtar — the default on Windows 10/11 and
macOS; GitHub's ubuntu runners ship `unzip`). No npm dependencies.

```sh
# from the repo root
npm run build -w @invoicegate/core     # our validator must be built
node tools/parity/download.mjs         # fetch pinned KoSIT tooling into tools/parity/vendor/ (gitignored)
node tools/parity/run.mjs              # full dual run -> tools/parity/report/
```

Useful flags for `run.mjs`:

- `--limit N` — smoke-run only N instances (interleaved UBL/CII). Partial numbers are
  marked as partial in the report and must not be published as parity results.
- `--skip-kosit` — run only the InvoiceGate half (for machines without Java). Every
  KoSIT verdict is recorded literally as `"skipped"` and **no agreement rate is
  computed**. This mode exists to test the harness, never to produce parity claims.
- `--java <path>` — explicit Java binary.

Output:

- `tools/parity/report/parity-report.json` — machine-readable; per file
  `{ file, syntax, kosit: accept|reject, invoicegate: valid|invalid, agreement }`
  plus rule ids on both sides, tool versions, and the summary block.
- `tools/parity/report/summary.md` — the same as a human-readable table (also written
  to the GitHub Actions job summary).

## CI

[`.github/workflows/parity.yml`](../../.github/workflows/parity.yml) runs the full
dual-run on `ubuntu-latest` (Node 20 + Temurin 17) on manual dispatch and weekly
(Mondays 04:17 UTC), uploads `report/` as the `parity-report` artifact, and writes
`summary.md` into the job summary.

## Reading the report: the two divergence categories

For every instance, KoSIT says **accept**/**reject** and InvoiceGate says
**valid**/**invalid**. Two ways to disagree — they are *not* symmetric:

- **False green** (`koSitRejectWeAccept`) — KoSIT rejects the file, we call it valid.
  **This is the dangerous direction**: a user relying on us would submit an invoice
  the official validator refuses. Driving this to zero on the covered rule set is the
  primary goal. The report lists which KoSIT rule ids we missed (`kosit-only` in
  `topDivergentRules`).
- **False alarm** (`koSitAcceptWeReject`) — we reject a file KoSIT accepts. Annoying
  (we are stricter than the reference, or wrong), but fails safe. The report lists
  which of our rule ids fired (`invoicegate-only`).

`agreementRate` is computed **only** over files where both validators produced a
definite verdict; skipped/errored/unknown files are counted separately and never
imputed. `topDivergentRules` breaks divergences down by rule id, because with a
documented rule subset the honest question is *which rules* diverge, not just how
many files.

**Corpus caveat (read before quoting numbers):** the official test-suite is a corpus
of *reference* instances — documents that are supposed to validate (`instances/standard`,
`instances/extension`, `instances/technical-cases/{cius,cvd}`; 86 instances, 45 UBL /
41 CII in the pinned release). It exercises the false-alarm direction well, but only
weakly probes false greens (there are few deliberately-broken documents in it). A high
agreement rate here means "we don't reject good invoices and we agree on the corpus" —
it is **not** proof that we catch everything KoSIT catches. Rule-level coverage claims
belong to `docs/rules-coverage.md`; a mutation corpus (deliberately corrupted instances)
is the natural next step for probing the false-green direction.

## Current status

- Harness implemented and versions pinned (verified against the GitHub releases API
  on 2026-08-03).
- Local machine used for development has no Java, so the full dual-run has only been
  exercised half-way locally (`--skip-kosit`); the download/extract/verify path and
  the InvoiceGate half run for real. The full comparison runs in CI.
- No parity numbers are published until a full CI run produces them.
