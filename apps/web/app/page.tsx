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
  TrustStrip,
} from '../components/sections';

export default function Page() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Comparison />
        <Playground />
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
