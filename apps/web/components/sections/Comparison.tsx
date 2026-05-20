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
    <Section id="features">
      <Container width="lg">
        <ScrollReveal>
          <div className="mb-12 text-center md:mb-16">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-muted">
              Side by side
            </p>
            <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em] md:text-5xl">
              What changes when a click becomes <span className="text-accent">human</span>.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-balance text-base text-muted md:text-lg">
              Same selector, same target, same Playwright underneath. Different signal.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <ComparisonDemo className="mx-auto mb-12 max-w-3xl" />
        </ScrollReveal>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
          <ScrollReveal delay={0.15}>
            <CodeBlock label="Playwright" accent="cool" code={playwrightCode} />
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <CodeBlock label="HumanJS" accent="warm" code={humanjsCode} />
          </ScrollReveal>
        </div>
      </Container>
    </Section>
  );
}
