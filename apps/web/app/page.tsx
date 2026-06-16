import {
  Audience,
  Comparison,
  FeatureBento,
  Footer,
  GeneratorShowcase,
  GetStarted,
  Hero,
  HonestLimits,
  Nav,
  PersonalityLab,
  Playground,
  ReadingShowcase,
  RecorderShowcase,
  ScrollShowcase,
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
        <ScrollShowcase />
        <RecorderShowcase />
        <GeneratorShowcase />
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
