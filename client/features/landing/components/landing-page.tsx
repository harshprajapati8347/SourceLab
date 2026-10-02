import { PricingPage } from "@/features/billing";
import { LandingFeatures } from "./landing-features";
import { LandingFooter } from "./landing-footer";
import { LandingHero } from "./landing-hero";
import { LandingHowItWorks } from "./landing-how-it-works";
import { LandingNav } from "./landing-nav";
import { LandingStudy } from "./landing-study";
import { LandingUseCases } from "./landing-use-cases";

/** Signed-out home. Always dark: the wrapper carries `dark`, so every token resolves to the dark set. */
export function LandingPage() {
  return (
    <div className="dark landing-page">
      <LandingNav />
      <main className="landing-hero-glow">
        <LandingHero />
        <LandingFeatures />
        <LandingStudy />
        <LandingUseCases />
        <LandingHowItWorks />
        <PricingPage embedded />
      </main>
      <LandingFooter />
    </div>
  );
}
