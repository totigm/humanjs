import {
  Audience,
  Comparison,
  FeatureBento,
  Footer,
  GetStarted,
  Hero,
  HonestLimits,
  Nav,
  Personalities,
} from '../components/sections';

export default function Page() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Comparison />
        <Audience />
        <FeatureBento />
        <Personalities />
        <GetStarted />
        <HonestLimits />
      </main>
      <Footer />
    </>
  );
}
