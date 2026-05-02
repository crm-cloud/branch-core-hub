export type NavMode = 'vertical' | 'collapsed' | 'hybrid';

const KEY = 'incline.nav-mode';
const LEGACY_COLLAPSED_KEY = 'sidebar-collapsed';
const EVENT = 'incline:nav-mode-changed';

function isValid(v: unknown): v is NavMode {
  return v === 'vertical' || v === 'collapsed' || v === 'hybrid';
}

export function getNavMode(): NavMode {
  try {
    const stored = localStorage.getItem(KEY);
    if (isValid(stored)) return stored;
    // one-time migration from old "sidebar-collapsed" boolean
    const legacy = localStorage.getItem(LEGACY_COLLAPSED_KEY);
    if (legacy === 'true') {
      localStorage.setItem(KEY, 'collapsed');
      return 'collapsed';
    }
    return 'vertical';
  } catch {
    return 'vertical';
  }
}

export function setNavMode(mode: NavMode): void {
  try {
    localStorage.setItem(KEY, mode);
    // legacy mirror so older code paths still work
    localStorage.setItem(LEGACY_COLLAPSED_KEY, String(mode === 'collapsed'));
    window.dispatchEvent(new CustomEvent(EVENT, { detail: mode }));
  } catch {
    /* no-op */
  }
}

export function subscribeNavMode(cb: (mode: NavMode) => void): () => void {
  const handler = () => cb(getNavMode());
  window.addEventListener(EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}
