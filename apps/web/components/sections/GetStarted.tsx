import { ArrowRight } from 'lucide-react';
import { CodeBlock, InstallCommand } from '../code';
import { GithubMark } from '../icons';
import { Button, Container, ScrollReveal, Section } from '../primitives';

const exampleCode = `import { chromium } from 'playwright';
import { createHuman } from '@humanjs/playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

const human = await createHuman(page, {
  personality: 'careful',
  seed: 'session-42',
});

await human.goto('https://example.com');
await human.click('button[type=submit]');

await browser.close();`;

export function GetStarted() {
  return (
    <Section id="install" density="loose">
      <Container width="lg">
        <ScrollReveal>
          <div className="mb-12 max-w-3xl md:mb-16">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
              Get started
            </p>
            <h2
              className="text-balance text-4xl font-medium leading-[1.05] tracking-[-0.02em] md:text-6xl"
              data-ghost-cursor="true"
            >
              One install.{' '}
              <span className="font-display italic text-accent">One line of code different.</span>
            </h2>
            <p className="mt-6 max-w-xl text-balance text-base text-muted-strong md:text-lg">
              HumanJS wraps Playwright. Same selectors, same locator API. The only thing that
              changes is what happens between two points.
            </p>
          </div>
        </ScrollReveal>

        <div className="mx-auto max-w-3xl space-y-6">
          <ScrollReveal delay={0.05}>
            <div>
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
                <span className="text-accent">01</span>
                <span aria-hidden className="mx-2 text-muted/40">
                  /
                </span>
                Install
              </p>
              <InstallCommand pkg="@humanjs/playwright" />
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.15}>
            <div>
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
                <span className="text-accent">02</span>
                <span aria-hidden className="mx-2 text-muted/40">
                  /
                </span>
                Use it
              </p>
              <CodeBlock code={exampleCode} accent="warm" label="example.ts" />
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.25}>
            <div className="flex flex-col items-center justify-center gap-3 pt-4 sm:flex-row">
              <Button size="lg" href="https://github.com/totigm/humanjs">
                <GithubMark size={16} />
                Star on GitHub
              </Button>
              <Button
                size="lg"
                variant="secondary"
                href="https://www.npmjs.com/package/@humanjs/playwright"
              >
                View on npm
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </ScrollReveal>
        </div>
      </Container>
    </Section>
  );
}
