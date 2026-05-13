import { useEffect } from 'react';

/**
 * Add a per-route noindex robots meta tag and override the document title.
 * Used on private/utility/token-gated routes (setup, checkout, contract-sign,
 * embed lead form, public report tokens) to keep them out of search indexes
 * without polluting the sitewide index.html head.
 *
 * Cleans up on unmount so the sitewide tags from index.html resume.
 */
export function useNoindex(title?: string) {
  useEffect(() => {
    const prevTitle = document.title;
    if (title) document.title = title;

    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);

    return () => {
      document.head.removeChild(meta);
      if (title) document.title = prevTitle;
    };
  }, [title]);
}
