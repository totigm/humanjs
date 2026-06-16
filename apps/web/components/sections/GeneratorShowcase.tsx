'use client';

import { ArrowRight } from 'lucide-react';
import { CodeBlock } from '../code/CodeBlock';
import { Container, ScrollReveal, Section, SectionEyebrow, SectionHeadline } from '../primitives';

/** A captured session, shown as the recorder's live step list. */
const steps: { type: string; target: string; detail?: string }[] = [
  { type: 'goto', target: 'your-app.com' },
  { type: 'click', target: 'Sign in', detail: 'button' },
  { type: 'type', target: 'Email', detail: 'me@acme.com' },
  { type: 'type', target: 'Password', detail: '•••••••• · masked' },
  { type: 'selectText', target: 'Terms', detail: '"privacy policy"' },
  { type: 'click', target: 'Continue', detail: 'button' },
];

/** The exported test — what those steps become, verbatim from the codegen. */
const exported = `await human.goto('https://your-app.com');
await human.click('role=button[name="Sign in"]');
await human.type('role=textbox[name="Email"]', 'me@acme.com');
await human.type('role=textbox[name="Password"]', ''); // filled in
await human.selectText('role=group[name="Terms"]', {
  text: 'privacy policy',
});
await human.click('role=button[name="Continue"]');`;

const features: { title: string; body: string }[] = [
  {
    title: 'Role-first selectors',
    body: 'Each step is captured by accessible name and role — the way a person sees the page, not a brittle CSS path.',
  },
  {
    title: 'A real editor, not a dump',
    body: 'Reorder, relabel, and delete steps, point-and-add assertions, mark secrets as env vars, and switch personalities live.',
  },
  {
    title: 'Export clean code',
    body: 'One click writes a @playwright/test spec or a standalone HumanJS script — the same codegen the library ships.',
  },
];

export function GeneratorShowcase() {
  return (
    <Section id="generator" density="default">
      <Container width="lg">
        <ScrollReveal>
          <div className="mb-10 max-w-3xl md:mb-12">
            <SectionEyebrow>Record, don't write</SectionEyebrow>
            <SectionHeadline data-ghost-cursor="true">
              Click through your app.{' '}
              <span className="font-display italic text-accent">Ship the test.</span>
            </SectionHeadline>
            <p className="mt-6 max-w-xl text-balance text-base text-muted-strong md:text-lg">
              One command opens a real Chromium window and a local dashboard. As you click, type,
              scroll, and select, every action streams into a live editor as a step with a
              role-first selector — then exports a clean, humanized Playwright test. No code until
              you want it.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.06}>
          <div className="mb-6 max-w-xl overflow-hidden rounded-card-lg border border-hairline bg-surface">
            <div className="border-b border-hairline px-4 py-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted/70">
                Terminal
              </span>
            </div>
            <pre className="overflow-x-auto px-5 py-4 font-mono text-sm text-foreground/90">
              <span className="select-none text-muted">$ </span>npx{' '}
              <span className="text-accent">@humanjs/generator</span> https://your-app.com
            </pre>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <div className="relative grid gap-4 lg:grid-cols-[0.85fr_auto_1.15fr] lg:items-stretch lg:gap-3">
            {/* Captured session */}
            <div className="overflow-hidden rounded-card-lg border border-hairline bg-surface">
              <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-accent/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-hairline-strong" />
                <span className="h-2.5 w-2.5 rounded-full bg-hairline-strong" />
                <span className="ml-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                  Captured session
                </span>
                <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-accent">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                  recording
                </span>
              </div>
              <ul className="divide-y divide-hairline/60">
                {steps.map((step, i) => (
                  <li
                    key={`${step.type}-${step.target}`}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    <span className="w-4 shrink-0 text-right font-mono text-[11px] text-muted/50">
                      {i + 1}
                    </span>
                    <span className="shrink-0 rounded border border-hairline bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-accent">
                      {step.type}
                    </span>
                    <span className="truncate text-sm text-foreground/90">{step.target}</span>
                    {step.detail && (
                      <span className="ml-auto truncate font-mono text-[11px] text-muted/70">
                        {step.detail}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Transform arrow */}
            <div aria-hidden className="flex items-center justify-center text-muted lg:px-1">
              <ArrowRight className="hidden h-5 w-5 lg:block" />
              <ArrowRight className="h-5 w-5 rotate-90 lg:hidden" />
            </div>

            {/* Generated test */}
            <CodeBlock
              code={exported}
              language="ts"
              label="login.spec.ts"
              accent="warm"
              className="lg:self-stretch"
            />
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.14}>
          <dl className="mt-10 grid gap-x-8 gap-y-6 md:mt-12 md:grid-cols-3">
            {features.map((f) => (
              <div key={f.title}>
                <dt className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  {f.title}
                </dt>
                <dd className="mt-2 pl-3.5 text-sm leading-relaxed text-muted">{f.body}</dd>
              </div>
            ))}
          </dl>
        </ScrollReveal>
      </Container>
    </Section>
  );
}
