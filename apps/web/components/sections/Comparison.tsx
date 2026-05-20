import { CodeBlock } from '../code';
import { ComparisonDemo } from '../motion';
import { Container, ScrollReveal, Section } from '../primitives';

const playwrightCode = `// Playwright — straight to the click
await page.click('button[type=submit]');

// Done. No hover, no path,
// no human signal whatsoever.`;

const humanjsCode = `// HumanJS — humanized click
import { createHuman } from '@humanjs/playwright';

const human = await createHuman(page, {
  personality: 'careful',
  seed: 'session-42',
});

await human.click('button[type=submit]');
// Bezier path · micro-jitter
// pre-click dwell · post-action settle`;

export function Comparison() {
  return (
    <Section id="features" density="loose">
      <Container width="lg">
        <ScrollReveal>
          <div className="mb-14 max-w-3xl md:mb-20">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
              Side by side
            </p>
            <h2
              className="text-balance text-4xl font-medium leading-[1.05] tracking-[-0.02em] md:text-6xl"
              data-ghost-cursor="true"
            >
              The click stays the same.{' '}
              <span className="font-display italic text-accent">Everything around it changes.</span>
            </h2>
            <p className="mt-6 max-w-xl text-balance text-base text-muted-strong md:text-lg">
              Same selector. Same Playwright underneath. The library only edits how it gets to the
              button — and how it leaves.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.08}>
          <ComparisonDemo className="mx-auto mb-14 max-w-3xl md:mb-20" />
        </ScrollReveal>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
          <ScrollReveal delay={0.12}>
            <CodeBlock label="Playwright" accent="cool" code={playwrightCode} />
          </ScrollReveal>
          <ScrollReveal delay={0.18}>
            <CodeBlock label="HumanJS" accent="warm" code={humanjsCode} />
          </ScrollReveal>
        </div>
      </Container>
    </Section>
  );
}
