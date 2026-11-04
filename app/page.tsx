import { Nav } from '@/components/features/landing/nav';
import { Hero } from '@/components/features/landing/hero';
import { Marquee } from '@/components/features/landing/marquee';
import { Metrics } from '@/components/features/landing/metrics';
import { Services } from '@/components/features/landing/services';
import { HowItWorks } from '@/components/features/landing/how-it-works';
import { Manifesto } from '@/components/features/landing/manifesto';
import { Coverage } from '@/components/features/landing/coverage';
import { BecomeMover } from '@/components/features/landing/become-mover';
import { Footer } from '@/components/features/landing/footer';
import { ContentService } from '@/server/modules/content/content.service';

// Copy is managed in the admin Content module; always render from live data.
export const dynamic = 'force-dynamic';

/**
 * Public landing page — server component; each section owns its own GSAP setup.
 * AIDA: Hero (attention) → Metrics + Services (interest) → How-it-works +
 * Manifesto + Coverage (desire) → Become-mover (action).
 * Managed copy comes from Mongo with in-code defaults as a guaranteed fallback.
 */
export default async function HomePage() {
  const copy = await new ContentService().getLandingCopy('en');

  return (
    <main className="w-full max-w-full overflow-x-hidden">
      <Nav />
      <Hero copy={copy.hero} />
      <Marquee />
      <Metrics />
      <Services />
      <HowItWorks steps={copy.steps} />
      <Manifesto />
      <Coverage intro={copy.coverageIntro} />
      <BecomeMover />
      <Footer />
    </main>
  );
}
