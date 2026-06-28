import { Minus, Plus } from 'lucide-react';
import { Container, ScrollReveal, Section, SectionEyebrow } from '../primitives';

const inScope = [
  'Bezier mouse paths with overshoot & micro-jitter',
  'Typing rhythm with typo + backspace recovery',
  'Reading dwell tied to word count',
  'Four personalities, composable & extendable',
  'Deterministic by seed (snapshot-friendly)',
  'Plugin contract from day one',
];

const outOfScope = [
  'Browser fingerprint masking',
  'TLS / request-pattern stealth',
  'CAPTCHA solving or bypass',
  'Proxy rotation & IP management',
  'Puppeteer & Selenium adapters (later)',
];

export function HonestLimits() {
  return (
    <Section density="loose" className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-30"
        style={{
          background: 'radial-gradient(80% 50% at 50% 0%, rgba(245,165,92,0.06), transparent 60%)',
        }}
      />

      <Container width="lg">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <ScrollReveal>
              <SectionEyebrow>
                <span className="text-accent">·</span> Designed scope
              </SectionEyebrow>
            </ScrollReveal>

            <ScrollReveal delay={0.06}>
              <h2 className="text-balance text-4xl font-medium leading-[1.02] tracking-[-0.02em] md:text-5xl lg:text-6xl">
                Small surface. <span className="font-display italic text-accent">Big honesty.</span>
              </h2>
            </ScrollReveal>

            <ScrollReveal delay={0.14}>
              <p className="mt-6 max-w-md text-balance text-base leading-relaxed text-muted-strong md:text-lg">
                HumanJS humanizes the timing between two points. It doesn't pretend to be a full
                anti-detection stack. Here's what we ship — and what we leave to others.
              </p>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.22em] text-muted/60">
                MIT licensed
                <span aria-hidden className="mx-2 text-muted/40">
                  ·
                </span>
                latest <span className="text-accent">v0.9</span>
              </p>
            </ScrollReveal>
          </div>

          <div className="lg:col-span-7">
            <ScrollReveal delay={0.12}>
              <div className="grid grid-cols-1 overflow-hidden rounded-card-lg border border-hairline bg-surface/40 sm:grid-cols-2">
                <div className="border-b border-hairline p-6 sm:border-b-0 sm:border-r md:p-8">
                  <div className="mb-5 flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15">
                      <Plus className="h-3 w-3 text-accent" strokeWidth={2.5} />
                    </span>
                    <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
                      In v1
                    </p>
                  </div>
                  <ul className="space-y-3.5">
                    {inScope.map((item, i) => (
                      <ScopeItem key={item} text={item} kind="in" delay={i * 0.04} />
                    ))}
                  </ul>
                </div>

                <div className="p-6 md:p-8">
                  <div className="mb-5 flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5">
                      <Minus className="h-3 w-3 text-muted" strokeWidth={2.5} />
                    </span>
                    <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
                      Out of scope
                    </p>
                  </div>
                  <ul className="space-y-3.5">
                    {outOfScope.map((item, i) => (
                      <ScopeItem key={item} text={item} kind="out" delay={i * 0.04} />
                    ))}
                  </ul>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </Container>
    </Section>
  );
}

function ScopeItem({ text, kind, delay }: { text: string; kind: 'in' | 'out'; delay: number }) {
  return (
    <ScrollReveal delay={0.2 + delay} y={8} duration={0.5}>
      <li className="flex items-start gap-3">
        <span
          aria-hidden
          className={
            kind === 'in'
              ? 'mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_8px_rgba(245,165,92,0.5)]'
              : 'mt-[10px] h-px w-2 shrink-0 bg-muted/60'
          }
        />
        <span
          className={
            kind === 'in'
              ? 'text-[15px] leading-snug text-foreground'
              : 'text-[15px] leading-snug text-muted-strong'
          }
        >
          {text}
        </span>
      </li>
    </ScrollReveal>
  );
}
