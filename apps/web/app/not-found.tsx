import type { Metadata } from 'next';
import { LostCursor } from '../components/motion';
import { Button, SectionEyebrow } from '../components/primitives';

export const metadata: Metadata = {
  title: '404 — Lost the cursor',
  description:
    'The cursor took a real humanized path, but there was nothing at the end. Head back to the landing page.',
};

export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-6 py-24">
      {/* Atmospheric halo behind everything */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-20 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(245,165,92,0.18), transparent 60%)',
        }}
      />

      {/* Interactive cursor background — click anywhere to send the cursor */}
      <LostCursor />

      {/* Foreground content is pointer-events-none so background clicks pass
          through to the LostCursor svg; only the CTAs catch their own clicks. */}
      <div className="pointer-events-none relative mx-auto max-w-2xl text-center [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
        <SectionEyebrow className="mb-6">Error 404</SectionEyebrow>

        <h1
          className="font-medium leading-[0.9] tracking-[-0.045em] text-foreground"
          style={{ fontSize: 'clamp(6rem, 22vw, 15rem)' }}
        >
          4<span className="font-display italic text-accent">0</span>4
        </h1>

        <p className="mx-auto mt-8 max-w-md text-balance text-lg leading-snug text-muted-strong md:mt-10 md:text-xl">
          The cursor took its path.{' '}
          <span className="font-display italic text-accent">Nothing was at the end.</span>
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button href="/">Back to the landing</Button>
          <Button variant="secondary" href="/#playground">
            Try the playground
          </Button>
        </div>
      </div>
    </main>
  );
}
