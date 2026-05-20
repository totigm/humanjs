import { Container, ScrollReveal, Section } from '../primitives';

export function Manifesto() {
  return (
    <Section density="default" className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-px"
        style={{
          background: 'linear-gradient(to right, transparent, rgba(245,165,92,0.25), transparent)',
        }}
      />
      <Container width="md">
        <div className="relative">
          <ScrollReveal>
            <span
              aria-hidden
              className="font-display block text-[10rem] leading-[0.7] text-accent/15 md:text-[14rem]"
            >
              &ldquo;
            </span>
          </ScrollReveal>

          <ScrollReveal delay={0.08}>
            <blockquote className="-mt-12 md:-mt-20">
              <p className="font-display text-balance text-3xl italic leading-[1.18] tracking-[-0.01em] text-foreground md:text-5xl lg:text-6xl">
                The web was built by humans. The automation we layer on top of it deserves to feel
                that way too.
              </p>
            </blockquote>
          </ScrollReveal>

          <ScrollReveal delay={0.18}>
            <footer className="mt-10 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.25em] text-muted/70">
              <span className="h-px w-8 bg-accent/60" aria-hidden />
              <span>A note on intent</span>
            </footer>
          </ScrollReveal>
        </div>
      </Container>
    </Section>
  );
}
