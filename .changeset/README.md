# Changesets

This folder is managed by [Changesets](https://github.com/changesets/changesets). Each time you make a user-visible change, run:

```bash
pnpm changeset
```

Pick the affected packages, choose `patch` / `minor` / `major`, and write a one-line summary. Commit the generated markdown file alongside your code.

On merge to `main`, CI either opens a "Version Packages" PR (rolling all pending changesets into version bumps and changelogs) or publishes to npm if that PR was just merged.

See the [common questions](https://github.com/changesets/changesets/blob/main/docs/common-questions.md) for details.
