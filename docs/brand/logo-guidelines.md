# Engineerious identity: brief, logo system, and review plan

Status: proposed MVP identity, ready for a structured review round. The context below accepts the supplied audience, values, and production constraints and grounds them in the current product.

## 1. Brand and design brief

### Working assumptions

- **Brand purpose:** help people making consequential AI product decisions find signal, understand tradeoffs, and build with evidence rather than hype. Engineerious is both a ranked AI engineering feed and a practitioner-led editorial brand.
- **Primary audience:** startup founders, technical founders, and investors evaluating AI products or technical risk.
- **Secondary audience:** engineering leaders and senior practitioners who influence those decisions.
- **Brand promise:** useful signal for people who build and fund technical companies.
- **Values:** trust, innovation, and simplicity. In behavior, these become evidence-led, constructively curious, and direct.
- **Personality:** pragmatic, observant, quietly confident, human. Never breathless, synthetic, or science-fictional.

### Constraints

- Recognizable at 16 px and legible in a 120 px-wide horizontal lockup.
- Works as one color, reversed, embroidered, laser etched, and printed on an office printer.
- Does not depend on color to read; the silhouette must survive grayscale and common color-vision differences.
- Uses flat fills, no gradients, masks, filters, or fragile hairlines.
- Keeps the existing warm-orange visual equity and Inter-based product typography.
- Avoids category clichés: sparkles, brains, circuit traces, chat bubbles, infinity loops, robot faces, and generic hexagons.
- Must receive a basic trademark similarity screen before external launch. This document is a design proposal, not a legal clearance.

## 2. Initial logo concept: **The Built Signal**

### Visual idea

The symbol is a deliberately assembled letter **E**: a structural spine, two stable rails, and a rounded center bar that reaches farther. The E gives immediate name recognition. The assembled geometry suggests engineering. The extended center bar is the useful signal moving beyond the frame: curiosity with direction, not novelty for its own sake.

The bar lengths are intentionally asymmetric. That small irregularity makes the mark easier to remember and keeps it from feeling like a generated “tech glyph.” Rounded terminals add a human, approachable edge without turning playful. The silhouette remains an E when the orange is removed.

### Concrete geometry

- Master artboard: 64 × 64 units.
- Structural module: 12 units; terminal radius: 6 units.
- Stable top and bottom rails end at x=46; the signal rail reaches x=56.
- No stroke. All geometry is filled, closed, and aligned to whole units for clean rasterization.
- The mark should not be redrawn with type. Its asymmetry is the identifying feature.

### Color system

| Role | Light UI | Dark UI | Use |
| --- | --- | --- | --- |
| Structural neutral | Ink `#0B0D10` | Chalk `#F3F3F1` | Spine, stable rails, wordmark |
| Signal | Burnt Orange `#E6570E` | Signal Orange `#FF7A2E` | Extended middle rail only |
| Ground | Warm Paper `#FAFAF8` | Deep Ink `#0A0A0B` | Preferred backgrounds |

Ink on Warm Paper is 18.62:1, Chalk on Deep Ink is 17.81:1, Burnt Orange on Warm Paper is 3.50:1, and Signal Orange on Deep Ink is 7.61:1. A logo is exempt from WCAG text contrast, but these combinations also keep its component edges distinct. Color is redundant: the protruding geometry carries the idea in monochrome.

### Typography

- **Wordmark:** Inter Bold 700, optical size appropriate to output, with modestly tight tracking (approximately -2% at display sizes).
- **Product/editorial:** retain Inter for interface and prose, and JetBrains Mono for metadata, labels, code, and evidence-oriented details.
- The type is intentionally familiar. Distinction comes from the custom mark and editorial behavior, not an ornamental “future” font.
- Browser UI should render the wordmark as live Inter text beside the inline SVG mark. Exported lockups include a standard Arial fallback; convert the type to outlines before sending artwork to a vendor that cannot install Inter.

### Composition

- **Primary:** horizontal mark + wordmark, vertically centered, with a gap equal to roughly one mark stem width.
- **Compact:** symbol alone for favicons, social avatars, app tiles, and spaces below the lockup minimum.
- **Never:** symbol stacked above the wordmark in small UI. The long brand name makes the horizontal lockup clearer and more economical.

## 3. Alternate palettes and usage

The shape is the identity; palette alternates are controlled production modes, not campaign recolors.

| Mode | Colors | Best context | Rule |
| --- | --- | --- | --- |
| Core light | Ink `#0B0D10`, Burnt Orange `#E6570E`, Warm Paper `#FAFAF8` | Website, reports, editorial, pitch decks | Default when the ground is light and quiet |
| Core dark | Chalk `#F3F3F1`, Signal Orange `#FF7A2E`, Deep Ink `#0A0A0B` | Dark UI, stage screens, video end cards | Use the dark SVG; do not simply invert the light asset |
| Institutional | Midnight `#13233A`, Copper `#D4551B`, Ivory `#FFFDF7` | Investor memos and restrained partner materials | Use for a whole artifact, not beside the core palette in one view |
| One color | 100% black or 100% white | Legal footers, embossing, embroidery, fax/office print | Use the supplied joined silhouette; no tints or gray substitutions |

Orange is a signal color, not a body-text color. On orange fields, use Ink for text. Do not place the two-color mark on photography unless it sits on a calm, solid panel with adequate separation.

## 4. Formal review plan

### Review agent persona

**“Mara Chen, YC-style brand reviewer”** is a fictional composite: former technical founder, seed-stage partner, and product operator. She reviews identity as a compression problem: can a busy founder understand it in two seconds, remember it tomorrow, and deploy it without a brand team?

Her feedback panel contains fictional top-tier CEO perspectives:

- **The product CEO:** asks whether the mark earns trust in-product and fits the product’s actual behavior.
- **The technical CEO:** tests small-size rendering, system consistency, and whether implementation introduces brittle exceptions.
- **The category CEO:** checks differentiation from AI/news/dev-tool conventions and whether the story is ownable.
- **The accessibility CEO:** checks color independence, contrast, motion/visual burden, and inclusive interpretation.

These are roles for disciplined critique, not claims of participation or endorsement by YC or any real executive.

### Weighted reviewer rubric

Score every item from 1 (fails) to 5 (exceptional), without allowing half-points.

| Criterion | Weight | Pass evidence |
| --- | ---: | --- |
| Clarity | 20% | Reads as an E/Engineerious cue within two seconds; story can be repeated in one sentence |
| Memorability | 20% | Recognized from five distractors after a 24-hour delay; protruding rail is recalled |
| Scalability | 15% | Clean at 16, 24, 32, 64, and 256 px; no fused or disappearing details |
| Black/white resilience | 10% | Retains silhouette, hierarchy, and recognition on desktop print and reverse video |
| Production feasibility | 15% | Valid SVG, flat fills, no hairlines; survives embroidery and single-ink reproduction |
| Accessibility | 15% | Meaning does not depend on hue; approved color pairs remain distinguishable |
| Strategic fit | 5% | Feels evidence-led, constructive, and low-hype rather than generic “AI” |

Advance when the weighted mean is at least **4.0/5**, no criterion is below **3**, and clarity, memorability, and accessibility each receive a median of at least **4**. A strong CEO opinion does not override observed recognition or accessibility failure.

### Feedback collection

Give every reviewer the same package:

1. A one-page PDF with the mark shown once without rationale, then with the one-sentence rationale.
2. PNG proofs at actual size: 16, 24, 32, and 64 px marks; 120 and 240 px lockups; light, dark, and monochrome.
3. SVG masters for engineering/production inspection.
4. A five-distractor recognition sheet using real category-adjacent marks only after licensing permits internal comparison.
5. A short form containing rubric scores, “keep,” “change,” “risk,” and one forced-choice question: **ship / iterate / reject**.

Collect scores independently before group discussion to reduce anchoring. Ask reviewers to identify the problem, context, and severity; do not accept “make it pop” as actionable feedback. Record role and audience familiarity, but not names in the working synthesis.

Preferred working formats are SVG for masters, PNG for visual review, PDF for the frozen review board, and CSV/JSON for score export. Keep comments attached to an asset version such as `built-signal-v1.1`, never to “the latest.”

## 5. Feedback synthesis workflow

1. **Normalize:** export all scores and tag comments by criterion, context, severity, and confidence.
2. **Aggregate:** calculate weighted mean, median by criterion, score spread, and the percentage choosing ship/iterate/reject. Segment founders, investors, and technical operators to expose audience conflicts.
3. **Separate evidence from taste:** reproduction failures, misreads, and accessibility issues outrank palette preference. A repeated independent observation is stronger than a long group-thread consensus.
4. **Cluster:** combine comments that point to the same root issue, such as “middle bar reads like minus” and “E disappears at 16 px.”
5. **Write a decision sentence:** for each cluster, use “Because [evidence], change [element] to improve [criterion], while preserving [asset].”
6. **Prioritize:** P0 = legibility/accessibility/production failure; P1 = clarity or memorability pattern; P2 = preference. Fix P0, test P1, document or defer P2.
7. **Prototype one variable at a time:** rail length, stem weight, terminal radius, spacing, then color. Never change geometry, color, and type simultaneously in a validation round.
8. **Re-test at actual sizes:** compare the challenger to the current master with the same panel and rubric. Promote only if it improves the target criterion without reducing any P0 criterion.

Maintain a decision log with version, hypothesis, change, evidence, decision, and owner. This gives engineers a stable asset and prevents opinion loops.

## 6. Final deliverables and usage rules

### Asset inventory

- `engineerious-mark-light.svg`, `engineerious-mark-dark.svg`
- `engineerious-mark-black.svg`, `engineerious-mark-white.svg`
- `engineerious-lockup-light.svg`, `engineerious-lockup-dark.svg`
- PNG marks at 64 px (1x) and 128 px (2x), light and dark
- PNG horizontal lockups at 320 × 64 px (1x) and 640 × 128 px (2x), light and dark
- `app/icon.svg` for the product favicon/app icon
- `components/Logo.tsx` as the source-of-truth web implementation

### Clear space

Define **x** as the mark’s 12-unit stem width. Keep at least 1x clear space on all sides of the symbol and lockup. At large presentation sizes, prefer 2x. Background panels do not count as clear space if another mark, headline, or high-contrast edge enters the zone.

### Minimum size

- Symbol: 16 px digital or 6 mm print.
- Horizontal lockup: 120 px digital or 32 mm print.
- Below these sizes, use the one-color symbol and test the actual output device.

### Do

- Use supplied assets and preserve their aspect ratio.
- Choose light/dark artwork from the background, not from device theme alone.
- Prefer the horizontal lockup at first mention and the symbol after brand context is established.
- Use monochrome when the process supports only one ink or when the background competes with orange.

### Do not

- Do not equalize the three rail lengths; the extension is the mnemonic.
- Do not add glow, gradient, shadow, bevel, texture, animation, or a containing hexagon.
- Do not rotate, skew, stretch, outline, or independently recolor the pieces.
- Do not place a tagline inside the clear-space zone.
- Do not use the symbol as the letter E inside ordinary copy.

### Stakeholder rationale

Engineerious turns technical noise into useful signal. Its mark is a purpose-built E: stable structural rails represent engineering discipline, while one rounded bar reaches forward to express constructive curiosity and progress. The result is recognizable at favicon size, distinctive without AI-category clichés, and practical across product UI, investor material, print, and monochrome production.

## 7. MVP timeline and checkpoints

| Time | Checkpoint | Exit condition |
| --- | --- | --- |
| Day 0, 2 hours | Confirm brief and audit category conventions | Audience, promise, exclusions, and production list approved |
| Day 0, 3 hours | Build master geometry and core lockups | SVG passes visual and structural inspection at all target sizes |
| Day 1 morning | Internal rubric review | No P0 failures; weighted score recorded; one challenger maximum selected |
| Day 1 afternoon | Founder/investor recognition test | At least 80% associate the mark with Engineerious after delayed five-choice recall |
| Day 2 morning | Refine one variable and accessibility proofs | Challenger meets gates and does not regress monochrome or 16 px rendering |
| Day 2 afternoon | Freeze MVP v1.0 and integrate | Asset manifest, usage rules, favicon, and product header merged and verified |
| Week 2 | Observe in context | Capture support/social confusion, implementation exceptions, and unprompted recall |
| Week 4 | Decide retain or v1.1 | Change only if observed evidence crosses the same rubric thresholds |

The MVP can ship in two working days. Trademark screening and broad external research may extend the launch decision but should not block testing the identity inside the product.
