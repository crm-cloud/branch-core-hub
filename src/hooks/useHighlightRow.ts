import { useEffect } from 'react';

/**
 * If `?focus=<id>` is present in the URL, scroll the matching DOM element
 * (with `data-row-id="<id>"`) into view and apply a brief highlight ring.
 * Strips the param after running so a refresh doesn't re-highlight.
 */
export function useHighlightRow() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('focus');
    if (!id) return;

    const apply = () => {
      const el = document.querySelector<HTMLElement>(`[data-row-id="${id}"]`);
      if (!el) return false;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-indigo-500', 'rounded-lg', 'transition-all');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-indigo-500');
      }, 2000);
      return true;
    };

    let attempts = 0;
    const tick = () => {
      attempts += 1;
      if (apply() || attempts > 20) {
        const url = new URL(window.location.href);
        url.searchParams.delete('focus');
        window.history.replaceState({}, '', url.toString());
        return;
      }
      setTimeout(tick, 150);
    };
    tick();
  }, []);
}
