# Asset provenance register

Update this register whenever a public visual is added.

| Asset | Provenance | Status |
|---|---|---|
| `stampbench-icon.svg`, `stampbench-mark*.svg`, `stampbench-logo.png` | Stampbench brand assets supplied in the project | Keep |
| `hero-axonometric.png`, `hero-axonometric-cutout.png` | Generated specifically for Stampbench during the September 2026 redesign | Keep; retain generation record |
| `invoice-autopilot-flipbook.png` | Generated specifically for Stampbench on 28 September 2026 | Keep; retain generation record |
| `workbench-pass.mp4`, `workbench-pass.webm`, `workbench-pass-mobile.mp4`, `workbench-pass-mobile.webm`, `workbench-pass-poster.webp` | Procedurally generated for Stampbench on 6 October 2026 with `scripts/generate-workbench-pass-video.py`; original 2160px desktop loop plus 1440px mobile derivatives; no third-party imagery or footage | Keep; generator and pinned Python dependencies retained in repository; requires FFmpeg 6.x |
| `stampbench-bench.webp` | Existing project asset; author/source/licence not documented in the repository | **Resolve before launch or remove** |

Do not add stock, scraped, customer-logo or third-party illustration assets without a source URL, author, licence and acquisition date.
