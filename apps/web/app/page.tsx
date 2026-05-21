import {
  Audience,
  Comparison,
  FeatureBento,
  Footer,
  GetStarted,
  Hero,
  HonestLimits,
  Nav,
  PersonalityLab,
  Playground,
  ReadingShowcase,
  TrustStrip,
  TypingShowcase,
} from '../components/sections';

export default function Page() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Comparison />
        <Playground />
        <TypingShowcase />
        <ReadingShowcase />
        <Audience />
        <FeatureBento />
        <PersonalityLab />
        <GetStarted />
        <TrustStrip />
        <HonestLimits />
      </main>
      <Footer />
    </>
  );
}
