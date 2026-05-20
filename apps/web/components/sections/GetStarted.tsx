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
    <Section id="install" density="default">
      <Container width="lg">
        <ScrollReveal>
          <div className="mb-12 text-center md:mb-16">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-muted">
              Get started
            </p>
            <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em] md:text-5xl">
              Drop it in. <span className="text-accent">Looks like a human.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-balance text-base text-muted md:text-lg">
              Wraps Playwright. Same selectors, same APIs you already know — humanized.
            </p>
          </div>
        </ScrollReveal>

        <div className="mx-auto max-w-3xl space-y-6">
          <ScrollReveal delay={0.05}>
            <div>
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
                1 · Install
              </p>
              <InstallCommand pkg="@humanjs/playwright" />
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.15}>
            <div>
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
                2 · Use it
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
