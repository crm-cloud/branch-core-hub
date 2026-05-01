import { Helmet } from 'react-helmet-async';

const SITE_URL = 'https://www.theincline.in';
const DEFAULT_OG_IMAGE =
  'https://storage.googleapis.com/gpt-engineer-file-uploads/0ouy66fX8iWTS70TdUu55fd7fhv1/social-images/social-1772792815982-Incline.webp';

export interface SEOProps {
  title: string;
  description: string;
  /** Path beginning with `/` — used to build the canonical URL. */
  path: string;
  image?: string;
  type?: 'website' | 'article';
  noindex?: boolean;
  /** One or more JSON-LD objects to inject as <script type="application/ld+json">. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

/**
 * Per-route SEO tags. Renders <title>, meta description, canonical,
 * Open Graph + Twitter Card, optional JSON-LD, and a noindex hint when needed.
 *
 * The public website is fully static — this component injects all per-route
 * metadata at render time without any backend reads.
 */
export const SEO = ({
  title,
  description,
  path,
  image = DEFAULT_OG_IMAGE,
  type = 'website',
  noindex = false,
  jsonLd,
}: SEOProps) => {
  const canonical = `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const blocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
      )}

      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="The Incline Life" />
      <meta property="og:url" content={canonical} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {blocks.map((b, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(b)}</script>
      ))}
    </Helmet>
  );
};

export default SEO;
