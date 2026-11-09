import { cookies } from 'next/headers';
import { Nav } from '@/components/features/landing/nav';
import { Hero } from '@/components/features/landing/hero';
import { Marquee } from '@/components/features/landing/marquee';
import { Commitments } from '@/components/features/landing/commitments';
import { Services } from '@/components/features/landing/services';
import { HowItWorks } from '@/components/features/landing/how-it-works';
import { Manifesto } from '@/components/features/landing/manifesto';
import { Estimator } from '@/components/features/landing/estimator';
import { Coverage } from '@/components/features/landing/coverage';
import { Movers } from '@/components/features/landing/movers';
import { Faq } from '@/components/features/landing/faq';
import { CloseCta } from '@/components/features/landing/close-cta';
import { Footer } from '@/components/features/landing/footer';
import { SmoothScroll } from '@/components/features/landing/smooth-scroll';
import { ContentService } from '@/server/modules/content/content.service';
import { PricingService } from '@/server/modules/pricing/pricing.service';
import { LOCALE_COOKIE, landingMessages, toLandingLocale } from '@/lib/i18n/landing';

// Copy is managed in the admin Content module and prices come from the live
// pricing rule, so the landing always renders from current data.
export const dynamic = 'force-dynamic';

/**
 * Public landing page.
 * AIDA: Hero (attention) → Commitments + Services (interest) → How it works,
 * Manifesto, Estimator, Coverage (desire) → Movers, FAQ, Close (action).
 */
export default async function HomePage() {
  const locale = toLandingLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const t = landingMessages(locale);
  const [copy, rule] = await Promise.all([
    new ContentService().getLandingCopy(locale),
    new PricingService().findActivePublic(),
  ]);

  const tag = locale === 'fr' ? 'fr-FR' : 'en-GB';
  const minLabel = rule
    ? new Intl.NumberFormat(tag, { maximumFractionDigits: 3 }).format(rule.minQuote)
    : null;
  const estimatorRule = rule
    ? {
        name: rule.name,
        version: rule.version,
        currency: rule.currency,
        baseFare: rule.baseFare,
        perKm: rule.perKm,
        perM3: rule.perM3,
        expressSurcharge: rule.expressSurcharge,
        minQuote: rule.minQuote,
        effectiveFrom: rule.effectiveFrom,
      }
    : null;

  return (
    <SmoothScroll>
      <a
        href="#main"
        className="mono fixed left-4 top-2 z-[60] -translate-y-20 bg-ink px-4 py-3 text-xs text-paper focus:translate-y-0"
      >
        {t.meta.skip}
      </a>
      <div lang={locale} className="landing w-full max-w-full overflow-x-clip">
        <Nav t={t} locale={locale} />
        <main id="main" tabIndex={-1} className="outline-none">
          <Hero
            copy={copy.hero}
            t={t}
            rule={rule ? { name: rule.name, version: rule.version, minQuote: rule.minQuote } : null}
            minLabel={minLabel}
          />
          <Marquee words={t.marquee} />
          <Commitments t={t.commitments} />
          <Services t={t.services} />
          <HowItWorks steps={copy.steps} t={t.how} />
          <Manifesto t={t.manifesto} />
          <Estimator rule={estimatorRule} t={t.estimate} locale={locale} />
          <Coverage intro={copy.coverageIntro} t={t.coverage} />
          <Movers t={t.movers} />
          <Faq t={t.faq} />
          <CloseCta t={t.close} />
        </main>
        <Footer t={t.footer} ruleVersion={rule?.version ?? null} />
      </div>
    </SmoothScroll>
  );
}
