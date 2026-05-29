---
"@humanjs/core": patch
"@humanjs/playwright": patch
"@humanjs/recorder": patch
"@humanjs/mcp": patch
"@humanjs/skill": patch
---

Ship the MIT `LICENSE` file inside every package tarball. Each package listed `LICENSE` in its `files` array but had no license file in its own directory, so published tarballs omitted it — this adds the file to each package. Also broadens every package's npm keywords for discoverability.

Tooling (not published): a `check:exports` task runs `publint --strict` on every package in CI, validating the published exports map, `files`, and type fields against the packed output (warnings fail the check).
