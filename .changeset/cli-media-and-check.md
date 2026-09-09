---
"@humanjs/cli": minor
---

Add media emulation flags to every command, and a `check` command that reports which ones a page responds to.

`--reduced-motion`, `--color-scheme <light|dark>` and `--forced-colors` are applied before the first navigation, so a page that reads the preference once at boot still sees it. Reduced motion is the one that matters: it cannot normally be exercised without changing an OS setting, so that branch ships unverified — and it fails quietly, since the people who depend on it are the least likely to report it. Paired with `--record`, the path can finally be watched:

```bash
humanjs demo https://your-app.com --reduced-motion --record motion.mp4
```

`humanjs check <url>` renders the page under baseline, dark, light, forced-colors and reduced-motion, writes a screenshot of each, and compares them. Four screenshots alone are four screenshots someone has to eyeball; the comparison is the value — a condition rendering byte-identical to baseline is a page that very likely has no branch for it.

Reduced motion is excluded from that verdict on purpose. The difference there is in movement, not layout, so a still frame cannot settle it either way; the command says so and points at the recording route instead of implying a conclusion it cannot support.
