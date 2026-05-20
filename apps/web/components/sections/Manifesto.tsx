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
        <ScrollReveal>
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-muted">
            <span className="text-accent">·</span> A note on intent
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.08}>
          <p className="mt-8 text-balance text-3xl font-medium leading-[1.18] tracking-[-0.015em] text-foreground md:text-5xl lg:text-6xl">
            The web was built by humans.{' '}
            <span className="text-muted-strong">The automation we build to ride on top of it</span>{' '}
            <span className="font-display italic text-accent">deserves to feel that way too.</span>
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.18}>
          <p className="mt-10 max-w-xl text-base text-muted md:text-lg">
            HumanJS is the small library that adds the bits Playwright leaves out: a Bezier path
            instead of a teleport, a rhythm instead of an instant, a pause before the click.
          </p>
        </ScrollReveal>
      </Container>
    </Section>
  );
}
