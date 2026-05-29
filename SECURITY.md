# Security Policy

## Supported versions

HumanJS is published as independently versioned `@humanjs/*` packages. Fixes are released against the **latest published version** of each package. If you're on an older release, please upgrade before reporting.

## Reporting a vulnerability

Please report security issues **privately** — don't open a public issue.

Two ways to reach us:

- **GitHub** (preferred): go to the repo's **Security** tab → **Report a vulnerability** ([private advisory](https://github.com/totigm/humanjs/security/advisories/new)).
- **Email**: [toti@eventurex.com.ar](mailto:toti@eventurex.com.ar).

Please include:

- the affected package and version (e.g. `@humanjs/playwright@0.7.0`),
- steps to reproduce or a minimal proof of concept,
- the impact you believe it has.

We aim to acknowledge a report within a few business days and will keep you updated on the fix and disclosure timeline. We'll credit you in the advisory unless you'd prefer to stay anonymous.

## What's in scope

Issues in HumanJS's own code or published packages — for example, a bug that lets untrusted input trigger unintended code execution, or a vulnerable dependency we ship.

## What's *not* in scope

- **The [non-goals](https://github.com/totigm/humanjs#what-humanjs-is-not).** HumanJS does not — and will not — defeat bot detection, solve or bypass captchas, mask fingerprints, rotate proxies, or provide "undetectable" automation. Reports or requests framed around those are feature requests we decline, not security issues.
- Vulnerabilities in **your own automation scripts**, the **sites you automate**, or **Playwright / the browser** themselves (report those upstream).

## Responsible use

HumanJS drives a real browser and performs real actions. Only use it on sites and in ways you are authorized to.
