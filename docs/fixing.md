# Repair — answering "what do I change?"

Every e-invoice validator tells you a document is invalid. The question people
actually have next is *what do I change*, and for a large class of failures
there is exactly one correct answer, computable from the rest of the document.

`stampbench fix` computes it and edits that value — and nothing else.

```sh
npx stampbench fix ./invoices          # show what would change
npx stampbench fix ./invoices --write  # apply it
```

```
rechnung-2026-08.xml
  fix   line 77    BR-CO-17, BR-S-09  99.99 → 22.04
  fix   line 91    BR-CO-16  999.00 → 336.90
  keep            BR-DE-15  no derivable correct value — this needs a human decision, not arithmetic
2 fixes applied, 1 error needing a person
```

## The two rules it obeys

**It never regenerates the document.** Our semantic model is a documented
subset of UBL and CII, so rebuilding a file from it silently discards
everything the model does not represent. Measured over the 45 UBL documents of
the official XRechnung test suite, `parse → generate` retains **74.1% of
elements**: 72 distinct element names lose content, including whole nested
`SubInvoiceLine` structures, line-level allowances, `InvoicePeriod` and
`CompanyLegalForm`. A "repair" that did that would destroy a quarter of a legal
document while reporting success.

So repairs are text edits against the original bytes. Formatting, comment
blocks, namespace prefixes, attribute order, indentation and line endings are
all untouched, as is every element we do not model.

**It never invents business data.** Only values a rule derived from the rest of
the document are written. A missing VAT identifier, buyer reference or postal
address has no computable answer — and fabricating one would turn a document
that is merely *invalid* into one that is quietly *wrong*, which is worse,
because it would then pass validation. Those are listed as `keep`, with the
reason.

## What it can repair

The arithmetic chain — the values EN 16931 defines as derived from others:

| Rule | Field | Derived from |
| --- | --- | --- |
| BR-CO-10 | Sum of line net amounts (BT-106) | the line amounts |
| BR-CO-13 | Total without VAT (BT-109) | BT-106 − BT-107 + BT-108 |
| BR-CO-14 | Total VAT (BT-110) | the VAT breakdown amounts |
| BR-CO-15 | Total with VAT (BT-112) | BT-109 + BT-110 |
| BR-CO-16 | Amount due (BT-115) | BT-112 − BT-113 + BT-114 |
| BR-CO-17 | VAT breakdown amount (BT-117) | taxable amount × rate |
| BR-S/Z/E/AE/K/G-08 | Taxable amount per category (BT-116) | lines − allowances + charges in that category |
| BR-S/Z/E/AE/K/G-09 | VAT amount per category (BT-117) | taxable amount × rate, or 0 for the zero-rated categories |

One **structural** repair is included under the same no-guessing standard: a
closing tag that does not match the tag it closes (`</ubl:Invoce>` under an
opening `<ubl:Invoice>`). The parser states the expected tag name, so the
correction is derived, not guessed — and without it a single typo blocks every
other check, because a document that does not parse cannot be validated at all.
Any other kind of malformed XML is still refused, with the reason.

Everything else is reported and left alone. That includes every missing
mandatory field, every code-list violation, and every rule whose remedy depends
on facts the document does not contain.

## Why the order matters

Totals are computed from other totals, so a single wrong figure makes rules
contradict each other: one says "this total disagrees with the lines", the next
says "the total derived from it disagrees with *it*". Naively applying both
drags the correct value into agreement with the corrupted one.

Repair therefore walks the dependency chain upstream-first — VAT breakdown, then
net total, then VAT total, then gross, then amount due — fixing one level per
pass and re-deriving the rest from corrected inputs. Convergence is measured at
**1.0 passes on average**.

## The amount-due guard

On a document that states a prepaid or rounding amount, a failing BR-CO-16
cannot tell whether the **amount due** or the **prepaid figure** is the wrong
one — and rewriting the amount due to agree with a mistyped prepaid amount
changes what the customer owes while leaving the invoice fully valid. Measured
across 917 successful repairs, all 39 that altered the payable amount were
exactly this case.

So those edits are withheld by default and reported as needing confirmation.
Pass `--fix-amount-due` (CLI) or `confirmAmountDue: true` (library) once a
person has decided the amount due is the figure to correct.

## The safety net

After editing, the document is re-validated. **If the error count did not fall,
the entire attempt is discarded** and the original text is returned. A repair
that cannot demonstrate an improvement is treated as a bug in the repair logic,
not as a result.

Preview is the default. `fix` without `--write` changes nothing and exits `1`
while fixes are outstanding, so it works as a CI gate in the same way
`prettier --check` does.

## Measured

Against the official XRechnung 3.0.2 test suite: take each of the 83 documents
that validate clean, corrupt one derived figure, and repair it.

| | |
| --- | --- |
| Corruption cases | 248 |
| Fully repaired to valid | **248 (100%)** |
| Result byte-identical to the pristine original | **186 (75%)** |
| Mean passes to converge | 1.0 |

The 25% that are not byte-identical differ only in decimal presentation: a
document stating `336.9` comes back as `336.90`. The value is unchanged and both
are valid EN 16931 — the original formatting cannot be recovered from a document
that no longer contains it.

Reproduce with `packages/core/tests/fix.corpus.test.ts` after
`node tools/parity/download.mjs`.

## Honest limits

- **It fixes arithmetic, not compliance.** A document that repairs to "valid"
  is valid against [our documented rule subset](rules-coverage.md), which is not
  the same as the official KoSIT validator signing it off.
- **It cannot know which number was the wrong one.** If a line amount is
  mistyped, the totals derived from it are "wrong" by our rules and will be
  rewritten to agree with the mistyped line. Repair makes a document
  self-consistent; it does not make it *true*. Review the diff.
- **Decimal presentation is normalised** to two places on corrected values.
- Repair is not a substitute for fixing the system that produced the invoice.
  If the same fix appears every month, the generator is what needs changing.

## In code

```ts
import { fixXml, planFixes, applyEdits } from '@stampbench/core';

const result = fixXml(xml, { profile: 'xrechnung' });
result.applied;      // TextEdit[] — line, column, previous, replacement, ruleId
result.unfixable;    // what was left alone, and why
result.valid;        // did it end up valid
result.xml;          // the repaired text, or the original if nothing improved
```

`planFixes(xml, violations, syntax)` returns the edits without applying them, if
you want to present them for approval or turn them into a suggested change on a
pull request.
