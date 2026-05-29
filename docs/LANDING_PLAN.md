# HumanJS Landing Page — Plan

Reference document for the humanjs.dev landing page build. Lives under `apps/web` in the monorepo.

## Goal

A professional, cinematic first impression for HumanJS. Audience: AI agent builders, QA engineers, demo/tutorial creators. Doubles as a portfolio piece — the landing itself should signal staff-grade frontend craft.

## Stack

- **Framework**: Next.js 15 (App Router) on Vercel
- **Styling**: Tailwind v4 (CSS-first `@theme`, no JS config file)
- **Components**: Bespoke (no shadcn) — full ownership of brand expression
- **Fonts**: Inter (display + body) + JetBrains Mono (code)
- **Motion**: Framer Motion for complex animations, CSS for simple transitions
- **Code rendering**: Shiki at build time (no client runtime)
- **Icons**: lucide-react (direct imports, tree-shaken)
- **Video**: Mux or Cloudflare Stream for the hero (adaptive bitrate)
- **Analytics**: Vercel Analytics + Speed Insights

## Design system

### Color tokens

| Token | Value | Usage |
|---|---|---|
| `--bg-deep` | `#020203` | Page baseline (never pure `#000` — OLED smear) |
| `--bg-base` | `#050506` | Sections |
| `--bg-elevated` | `#0a0a0c` | Cards, code blocks |
| `--surface` | `rgba(255,255,255,0.04)` | Hairline glass surfaces |
| `--foreground` | `#EDEDEF` | Body text (14.8:1 contrast) |
| `--foreground-muted` | `#8A8F98` | Secondary text |
| `--accent` | `#F5A55C` | HumanJS signature (warm amber) |
| `--accent-cool` | `#5B7CC9` | "Robotic Playwright" counterpoint (comparison only) |
| `--accent-glow` | `rgba(245, 165, 92, 0.18)` | CTA and hero ambient glow |
| `--border` | `rgba(255,255,255,0.08)` | Hairline dividers |
| `--radius` | `12–16px` | Cards/buttons |
| `--easing` | `cubic-bezier(0.16, 1, 0.3, 1)` | Universal ease-out |

**Why amber as signature:** every dev-tool landing uses blue/indigo/green. Warm amber maps directly to "human warmth" and gives us a built-in visual storytelling tool (cold blue = robotic, warm amber = HumanJS) for the side-by-side comparison.

### Typography

- **Inter** — display + body, weights 300/400/500/600/700
- **JetBrains Mono** — code blocks, weights 400/500/700
- **Scale**: 12 / 14 / 16 / 18 / 24 / 32 / 48 / 64 / 80 px
- **Display sizes**: `clamp(2.25rem, 8vw, 5rem)` for fluid scaling
- **Tracking**: -1.5% on display, -0.5% on H1/H2, normal on body
- **Line height**: 1.1 on display, 1.3 on H1/H2, 1.6 on body

### Effects discipline

- Ambient blur blobs: 1-2 per fold, opacity 0.06-0.10, slow oscillation (10s+ cycle)
- Glassmorphism: ONLY on nav-on-scroll
- Accent glow: behind primary CTA only
- NO scanlines, NO glitch effects, NO neon, NO heavy parallax

## Information architecture — 9 sections

| # | Section | Purpose |
|---|---|---|
| 1 | Nav | Wayfinding (logo + 3 links + CTA) |
| 2 | Hero | Hook + 30s side-by-side video |
| 3 | Side-by-side comparison | Show, don't tell — Playwright vs HumanJS code + animated cursor |
| 4 | Who's it for | 3 audience cards (AI agents / QA / Demos) |
| 5 | Feature bento | 6-cell asymmetric grid |
| 6 | Personalities | 4 personality cards with mini-trajectory previews |
| 7 | Get started | Install snippet + minimal example |
| 8 | Honest limits | What HumanJS won't do (trust signal) |
| 9 | Footer | Floor links + license |

**Deliberately NOT in v1:**
- Testimonials (none yet — never fake)
- Pricing (MIT/free)
- Social proof logos (none yet)
- Blog (premature)

## Brand decisions

- **Signature accent**: warm amber `#F5A55C`
- **Cursor demo**: site-wide opt-in toggle ("See the magic") — defaults to OFF, persists in localStorage, hidden on touch, respects `prefers-reduced-motion`
- **Voice**: confident, cinematic, honest. Never scrapy, stealth, or "undetectable."

## Component inventory

```
apps/web/components/
├── primitives/
│   ├── Button.tsx         (variants: primary, secondary, ghost)
│   ├── Container.tsx
│   ├── Section.tsx
│   ├── Link.tsx
│   └── ScrollReveal.tsx
├── code/
│   ├── CodeBlock.tsx      (Shiki-rendered, copy button)
│   ├── CodeCompare.tsx    (side-by-side container)
│   └── InstallCommand.tsx (pnpm/npm/yarn tabs)
├── sections/
│   ├── Nav.tsx
│   ├── Hero.tsx
│   ├── Comparison.tsx
│   ├── Audience.tsx
│   ├── FeatureBento.tsx
│   ├── Personalities.tsx
│   ├── GetStarted.tsx
│   ├── HonestLimits.tsx
│   └── Footer.tsx
├── media/
│   ├── VideoFrame.tsx     (lazy-load + poster + placeholder)
│   └── AmbientBlob.tsx
└── motion/
    ├── HumanCursor.tsx    (site-wide opt-in humanized cursor)
    └── TrajectoryCanvas.tsx (personality cards' mini-canvas)
```

15 components total. No shadcn — all bespoke.

## Motion design rulebook

| Element | Trigger | Duration | Easing |
|---|---|---|---|
| Hero text entrance | onMount | 400ms | ease-out, 30ms stagger |
| Scroll-reveal sections | in-view 30% | 400ms | `cubic-bezier(0.16,1,0.3,1)`, fade + translateY(16px) |
| Bento cards | in-view | 350ms | ease-out, 50ms stagger |
| Button hover | hover | 200ms | ease-out, scale(1.02) + glow expand |
| Nav-on-scroll | scroll > 60px | 250ms | ease-out, blur backdrop fades in |
| HumanCursor loop | always-on (opt-in) | RAF, ~1.8s per arc | Bezier path |
| Code copy feedback | onClick | 1.5s | checkmark + "Copied" |

**Universal rules:**
- Animate only `transform` and `opacity` (never width/height/layout)
- Exit animations 60% of enter duration
- All animations interruptible
- `prefers-reduced-motion: reduce` strips translates, keeps opacity fades only

## Responsive strategy

| Breakpoint | Width | Behavior |
|---|---|---|
| Mobile | 375-639px | Single column, stacked code blocks, hamburger nav, full-width CTAs, ambient blobs hidden, 1-col bento, video below headline |
| Tablet | 640-1023px | 2-col bento, top-bottom code comparison, nav links visible, audience cards 2x2 |
| Desktop | 1024+ | Full layout, side-by-side comparison, asymmetric bento, all animations |

Hero headline: `clamp(2.25rem, 8vw, 5rem)`.

## Performance targets (non-negotiable)

| Metric | Target |
|---|---|
| LCP | < 1.5s |
| CLS | < 0.05 |
| TBT | < 100ms |
| Lighthouse Desktop | 100/100/100/100 |
| Lighthouse Mobile | 95+/100/100/100 |
| Initial JS bundle | < 100KB gzipped |

**Tactics:**
- Video via Mux/Cloudflare Stream (adaptive bitrate, no `.mp4` in `/public`)
- Self-hosted fonts with `font-display: swap` and preload only Inter weight 400/700
- Framer Motion split via dynamic imports — only loaded on motion components
- Shiki at build time (zero client runtime cost)
- Direct icon imports: `import Check from 'lucide-react/dist/esm/icons/check'`
- `next/dynamic` for heavy below-fold sections
- `loading="lazy"` on all below-the-fold images

## Pre-launch asset checklist

| Asset | Status | Blocker |
|---|---|---|
| Hero video (30s side-by-side) | Placeholder | Record after `feat/type` lands |
| Logo / wordmark | Missing | Need to design or commission |
| Favicon set | Missing | Needs logo first |
| OG image (1200×630) | Missing | Needs logo + tagline |
| Hero copy | Draft below | Confirm wording |
| Bento copy (6 cells) | Pending | Draft from CLAUDE.md feature list |
| Audience copy (3 paragraphs) | Pending | Draft |
| Personality descriptions | Pending | Source from preset files in `@humanjs/core` |
| Honest limits copy | Direct from CLAUDE.md | Lift verbatim |
| DNS for humanjs.dev | Not pointed | Point at Vercel after first deploy |

### Initial copy draft

- **Headline**: "Humanize your browser automation."
- **Subhead**: "Realistic mouse paths, typing rhythm, reading dwell, and four personalities. Built on Playwright. MIT-licensed."
- **Primary CTA**: "Get started"
- **Secondary CTA**: "Read the docs"

### Audience card draft

1. **AI agent builders** — "Playwright MCP and custom agents — without the giveaway robotic clicks."
2. **QA engineers** — "Catch race conditions that only show up at human speed. CI bypass with one flag."
3. **Demo & tutorial creators** — "Record polished walkthroughs without manual operation."

### Honest limits (lifted from CLAUDE.md)

- Won't defeat sophisticated bot detection
- Adds humanization on top of Playwright — doesn't replace it
- Playwright-first; Puppeteer/Selenium come later

## Implementation phases

1. **Scaffold** (1h) — `apps/web` Next.js 15 + Tailwind v4 + workspace wiring + fonts + Vercel preview deploy
2. **Foundation** (2-3h) — primitives, color tokens, type scale, motion tokens, dark theme
3. **Nav + Hero** (4-5h) — top of page, video placeholder, ambient blobs, scroll-blur nav
4. **Comparison + Audience** (3-4h) — side-by-side code, animated HumanCursor demo, 3 audience cards
5. **Bento + Personalities** (4-5h) — asymmetric grid, TrajectoryCanvas for personality previews
6. **Get Started + Limits + Footer** (2-3h) — install commands, copy button, footer
7. **Site-wide HumanCursor toggle** (2-3h) — opt-in cursor humanization across the whole page
8. **Responsive + Reduced Motion** (3-4h) — 375/768/1024/1440 testing, RM testing, mobile-specific touchups
9. **Performance pass** (2-3h) — Lighthouse 95+, video lazy-load, font optimization, image audit
10. **Deploy** (1h) — point humanjs.dev at Vercel, OG image, analytics wiring

**Total estimated effort: 24-32 hours.**

## Open questions

- DNS: where is humanjs.dev currently pointed? Need to switch to Vercel before launch.
- Hero video production: timing depends on `feat/type` shipping (typing in the comparison demo).
- Logo: design in-house, commission, or wordmark-only for v1?
