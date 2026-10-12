// The toolbar icon follows the browser's light or dark look: the ink clock on a light
// toolbar, the white one on a dark toolbar. Only a page can tell which look is on, so
// each page reports it; the service worker puts the last report back after a restart.

const SIZES = [16, 32, 48, 128];
const set = suffix => Object.fromEntries(SIZES.map(s => [s, `/icons/icon${s}${suffix}.png`]));
export const TOOLBAR_ICONS = { light: set(''), dark: set('-on-dark') };

export async function toolbarLook() {
  const { toolbarLook: look } = await chrome.storage.local.get('toolbarLook');
  return look === 'dark' ? 'dark' : 'light';
}

// service worker: on install, update and browser start (the manifest's icon is the light one)
export async function restoreToolbarIcon() {
  if (await toolbarLook() === 'dark') await chrome.action.setIcon({ path: TOOLBAR_ICONS.dark }).catch(() => {});
}

// pages: set the icon for the look that's on now, and again whenever it changes
export function followToolbarIcon() {
  const dark = matchMedia('(prefers-color-scheme: dark)');
  const apply = async () => {
    const look = dark.matches ? 'dark' : 'light';
    chrome.action.setIcon({ path: TOOLBAR_ICONS[look] }).catch(() => {});
    if (await toolbarLook() !== look) chrome.storage.local.set({ toolbarLook: look });
  };
  apply();
  dark.addEventListener('change', apply);
}
