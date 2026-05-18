# Third-Party Notices

HumanJS includes code derived from the following projects. Each entry preserves the original copyright and license terms as required.

---

## ghost-cursor

- **Project**: ghost-cursor
- **Author**: Xetera ([@Xetera](https://github.com/Xetera))
- **Repository**: https://github.com/Xetera/ghost-cursor
- **License**: MIT
- **What HumanJS uses**: The cubic Bezier path-generation approach — control points offset perpendicular to the start→end line, scaled by a curvature factor.
- **Where it lives in HumanJS**: [`packages/core/src/bezier.ts`](./packages/core/src/bezier.ts)
- **Modifications**:
  - Reimplemented in TypeScript with HumanJS's `Rng` interface for seeded determinism
  - Removed Puppeteer dependency (returns plain coordinates instead of executing on a page)
  - Parameterized via `Personality.mouse.curvature` rather than an options bag
  - Path post-processing (velocity profile, micro-jitter, overshoot) lives in separate modules

### License (verbatim)

```text
MIT License

Copyright (c) 2020 Xetera

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
