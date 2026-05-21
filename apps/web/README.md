# @humanjs/web

The humanjs.dev landing page. Next.js 16 + Tailwind v4 + bespoke components.

See [`docs/LANDING_PLAN.md`](../../docs/LANDING_PLAN.md) for the design system, IA, motion spec, and implementation phases.

## Develop

```bash
# From repo root
pnpm --filter @humanjs/web dev

# Or with turbo (also builds workspace deps)
pnpm dev
```

Visit http://localhost:3000.

## Build

```bash
pnpm --filter @humanjs/web build
pnpm --filter @humanjs/web start
```

## Deploy

Vercel project pointing at the `apps/web` directory. The repo's root `pnpm-workspace.yaml` and `turbo.json` are detected automatically.
