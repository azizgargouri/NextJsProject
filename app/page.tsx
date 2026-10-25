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

/**
 * Public landing page — server component; each section owns its own GSAP setup.
 * AIDA: Hero (attention) → Metrics + Services (interest) → How-it-works +
 * Manifesto + Coverage (desire) → Become-mover (action).
 */
export default function HomePage() {
  return (
    <main className="w-full max-w-full overflow-x-hidden">
      <Nav />
      <Hero />
      <Marquee />
      <Metrics />
      <Services />
      <HowItWorks />
      <Manifesto />
      <Coverage />
      <BecomeMover />
      <Footer />
    </main>
  );
}
