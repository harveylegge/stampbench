# Stampbench strategy — October 2026

Status: direction locked for 30 days.

## Primary business

**European e-invoicing validation for software companies.**

Help software vendors integrate reliable invoice validation without building the validation
engine, source-location mapping and diagnostic contract from scratch.

## Decisions

| Area | Decision |
| --- | --- |
| Homepage | Technical EN 16931 workbench design |
| Primary customer | Software companies |
| Public engine | MIT-licensed `@stampbench/core` and the `stampbench` CLI |
| Initial commercial offer | £3,000 fixed-scope integration pilot; test price, not validated demand |
| Potential continuing revenue | Engineering support or shared infrastructure, scoped only after a successful pilot |
| Business invoice creator | Remains available as a secondary product route |
| Homepage freeze | No architectural redesign for 30 days unless buyer evidence identifies a problem |

## Pilot boundary

The founding pilot covers one product and one staging integration path. Before work begins, both
sides agree representative UBL or CII documents, supported profile, output contract and measurable
acceptance criteria.

Expected deliverables:

1. Integration of the current validator into the agreed staging workflow.
2. Structured findings containing supported rule ids, business terms and source locations.
3. Tests against the agreed representative documents.
4. A written coverage and acceptance report.
5. Implementation handover and one technical workshop.
6. Thirty days of defect support for the delivered pilot scope.

The pilot is tooling and engineering work. It is not certification, recipient approval or legal
advice. Complete KoSIT parity, custom national profiles and additional product workflows are out of
scope unless separately agreed.

## Commercial honesty

- The core is MIT licensed. Customers do not pay for permission to use it.
- The core currently depends on `fast-xml-parser` and `zod`; do not claim zero dependencies.
- Do not market managed hosting, private deployments, uptime commitments or guaranteed response
  times until those services can be operated and supported.
- Do not claim complete KoSIT parity, certification, SOC 2, ISO 27001 or unverified partnerships.
- Describe standards support using exact ruleset versions and documented coverage.

## Thirty-day milestone

One qualified software company agrees to evaluate the integration pilot.

Product work during the freeze must improve evidence for that milestone: representative-invoice
testing, coverage documentation, a five-minute integration example, reliable diagnostics and buyer
conversations. Visual changes are limited to defects or evidence from those conversations.
