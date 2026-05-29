# Contributing to HumanJS

Thanks for your interest in improving HumanJS! This guide covers how to get the monorepo running, the conventions we follow, and how to land a change.

By participating, you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Before you start: scope

HumanJS humanizes browser automation for **AI agents, QA tests, and demo/tutorial recordings**. Some things are deliberately out of scope and we will not merge them — captcha solving/bypass, fingerprint masking, proxy rotation, TLS/network stealth, "undetectable" framing, time-of-day variation, and AI-generated mouse trajectories. See the [non-goals](https://github.com/totigm/humanjs#non-goals) before opening a feature PR. If you're unsure whether an idea fits, open a [Discussion](https://github.com/totigm/humanjs/discussions) first.

## Prerequisites

- **Node** — version in [`.nvmrc`](./.nvmrc) (currently 22). `nvm use` picks it up.
- **pnpm** — this repo pins `pnpm@9.15.0` via `packageManager`. Use [Corepack](https://nodejs.org/api/corepack.html): `corepack enable`.

## Getting started

```bash
git clone https://github.com/totigm/humanjs.git
cd humanjs
pnpm install
pnpm build      # build all packages once (turbo)
```

It's a [pnpm workspace](https://pnpm.io/workspaces) driven by [Turborepo](https://turbo.build/). Packages live in `packages/*`; the docs site and runnable examples live in `apps/*`.

## Development workflow

Common root scripts (all fan out across the workspace via turbo):

| Command | What it does |
|---|---|
| `pnpm build` | Build every package |
| `pnpm test` | Run unit tests (vitest) |
| `pnpm typecheck` | `tsc --noEmit` across packages |
| `pnpm lint` | Biome check |
| `pnpm lint:fix` | Biome check + autofix |
| `pnpm check:exports` | `publint --strict` on every package |

To work on a single package, scope it: `pnpm --filter @humanjs/playwright build`. The `pnpm demo:*` scripts run the examples in `apps/examples` against a live browser.

## Before you commit

Run the same gate CI runs:

```bash
pnpm typecheck && pnpm test && pnpm lint && pnpm check:exports
```

A [lefthook](https://github.com/evilmartians/lefthook) pre-commit hook runs Biome, and a commit-msg hook runs commitlint — so a malformed commit or unformatted file is caught locally.

## Commits

We use [Conventional Commits](https://www.conventionalcommits.org/) with a **lowercase subject** (enforced by commitlint):

```
feat(playwright): add human.rightClick()
fix(recorder): stop dropping frames on slow CI
docs: clarify CDP viewport limitation
```

Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`. Keep each commit to **one logical change** — no squash-bombs.

## Changesets

If your change touches a **published package** (`@humanjs/*`), add a changeset so it gets a version bump and a changelog entry:

```bash
pnpm changeset
```

Pick the affected packages and a bump level (`patch` / `minor` / `major`), and write a short user-facing summary. Changes that only touch `apps/*` (private), tests, or repo config don't need one. Maintainers release by merging the changesets-generated "Version Packages" PR.

## Tests

- Unit tests are **colocated** with the module they test (`src/<module>/<module>.test.ts`) and run with [vitest](https://vitest.dev/).
- Playwright end-to-end tests go in `e2e/`.
- HumanJS is deterministic given a `seed`, and `{ speed: 'instant' }` bypasses humanization — use both so tests are stable and fast:

  ```ts
  const human = await createHuman(page, {
    speed: process.env.CI ? 'instant' : 'human',
    seed: test.info().title,
  });
  ```

## Opening a pull request

1. Branch off `main` (`feat/...`, `fix/...`, `chore/...`).
2. Make your change, add tests, and add a changeset if a published package changed.
3. Make sure the gate above is green.
4. Open the PR and fill out the template. Link any related issue (`Closes #123`).

A maintainer will review. Thanks for contributing! 💛
