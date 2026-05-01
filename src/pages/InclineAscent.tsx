import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import ScrollProgressBar from '@/components/ui/ScrollProgressBar';
import RegisterModal from '@/components/ui/RegisterModal';
import LegalModal from '@/components/ui/LegalModal';
import useSoundEffects from '@/hooks/useSoundEffects';
import SEO from '@/components/seo/SEO';
import { PUBLIC_BRANCHES, PUBLIC_FAQS } from '@/config/publicSite';

// Lazy-load Scene3D so the heavy Three.js / drei bundle does not block the
// main thread during initial paint. This dramatically reduces Max Potential FID.
const Scene3D = lazy(() => import('@/components/3d/Scene3D'));

const InclineAscent = () => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [mountScene, setMountScene] = useState(false);
  const interactionRootRef = useRef<HTMLDivElement | null>(null);
  const { handleScrollProgress } = useSoundEffects({ enabled: true });

  // Defer mounting the 3D scene until (a) the browser is idle and (b) the
  // hero section is on-screen. Both gates exist so we never block the LCP
  // image / static H1 on a multi-MB GPU pipeline.
  useEffect(() => {
    let cancelled = false;
    const target = interactionRootRef.current;
    if (!target) return;

    const idleMount = () => {
      if (cancelled) return;
      const idle = (window as any).requestIdleCallback as
        | ((cb: () => void, opts?: { timeout?: number }) => number)
        | undefined;
      if (idle) idle(() => !cancelled && setMountScene(true), { timeout: 1200 });
      else window.setTimeout(() => !cancelled && setMountScene(true), 200);
    };

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        entries => {
          if (entries.some(e => e.isIntersecting)) {
            io.disconnect();
            idleMount();
          }
        },
        { rootMargin: '0px', threshold: 0.05 },
      );
      io.observe(target);
      return () => {
        cancelled = true;
        io.disconnect();
      };
    }

    idleMount();
    return () => {
      cancelled = true;
    };
  }, []);

  const onScrollProgress = (progress: number) => {
    setScrollProgress(progress);
    handleScrollProgress(progress);
  };

  const branchJsonLd = PUBLIC_BRANCHES.map(b => ({
    '@context': 'https://schema.org',
    '@type': 'HealthClub',
    name: b.name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: b.address,
      addressLocality: b.city,
      addressCountry: 'IN',
    },
    openingHours: b.hours,
    amenityFeature: b.facilities.map(f => ({
      '@type': 'LocationFeatureSpecification',
      name: f,
      value: true,
    })),
  }));

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: PUBLIC_FAQS.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <div ref={interactionRootRef} className="w-full min-h-[100dvh] bg-background">
      <SEO
        title="The Incline Life | Luxury Gym & Recovery Club in Udaipur"
        description="Udaipur's most luxurious fitness destination. Panatta equipment, elite personal training, group classes, sauna, ice bath & recovery suite. Join Incline today."
        path="/"
        jsonLd={[...branchJsonLd, faqJsonLd]}
      />
      <ScrollProgressBar progress={scrollProgress} />

      {/*
        Static SEO hero — paints instantly for LCP / crawlers.
        The 3D Canvas mounts on top (z-0 + fixed) and visually covers this
        layer once ready, so users see no change. The H1 text matches the
        Scroll overlay exactly to avoid any visual mismatch during handoff.
      */}
      <section
        aria-hidden={mountScene}
        className="fixed inset-0 -z-10 flex items-center px-4 pointer-events-none"
        style={{ height: '100dvh' }}
      >
        <div className="w-full max-w-7xl mx-auto flex justify-end">
          <div className="max-w-md text-right mr-8 md:mr-32">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-foreground leading-tight mb-6 tracking-tight">
              WHERE <span className="text-primary">GLOBAL STRENGTH</span>
              <br />
              MEETS <span className="text-primary">CLINICAL SERENITY.</span>
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed">
              Rajasthan's new benchmark for excellence. An elevated sanctuary designed for the driven—delivering Italian
              biomechanics in every rep, and advanced restoration in every recovery.
            </p>
          </div>
        </div>
      </section>

      {mountScene && (
        <Suspense fallback={null}>
          <Scene3D onScrollProgress={onScrollProgress} />
        </Suspense>
      )}

      {/* Crawlable, static branches & FAQ. Visually hidden from the 3D
          experience but available to bots, screen readers, and AI crawlers. */}
      <div className="sr-only" aria-hidden="false">
        <section aria-labelledby="branches-heading">
          <h2 id="branches-heading">Our Branches & Services</h2>
          {PUBLIC_BRANCHES.map(b => (
            <article key={b.slug}>
              <h3>{b.name}</h3>
              <p>{b.address}</p>
              <p>Hours: {b.hours}</p>
              <h4>Facilities</h4>
              <ul>{b.facilities.map(f => <li key={f}>{f}</li>)}</ul>
              <h4>Group Classes</h4>
              <ul>{b.classes.map(c => <li key={c}>{c}</li>)}</ul>
              {b.pt && <p>Personal training available.</p>}
              <h4>Premium Add-ons</h4>
              <ul>{b.addOns.map(a => <li key={a}>{a}</li>)}</ul>
            </article>
          ))}
        </section>
        <section aria-labelledby="faq-heading">
          <h2 id="faq-heading">Frequently Asked Questions</h2>
          {PUBLIC_FAQS.map(f => (
            <div key={f.q}>
              <h3>{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}
        </section>
      </div>

      <RegisterModal />
      <LegalModal />
    </div>
  );
};

export default InclineAscent;
