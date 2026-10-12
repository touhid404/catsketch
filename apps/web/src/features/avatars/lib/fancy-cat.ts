const palettes = [
  ['#f7dfcf', '#d07a51', '#f4bf8b'],
  ['#e3e8d9', '#839775', '#fff6e8'],
  ['#e5def2', '#8e78b5', '#b9bac8'],
  ['#dceaf0', '#6196ae', '#e4cfa8'],
  ['#f2dfe5', '#b77d91', '#dfb0a2'],
  ['#ede5cb', '#b59a5e', '#7e8585'],
];
/** Each random guest UUID selects a consistent, locally rendered cat. */
export function fancyCatImage(seed: string) {
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  const [background, accent, fur] = palettes[hash % palettes.length];
  const accessory = Math.floor(hash / palettes.length) % 4;
  const eyes =
    accessory === 0
      ? '<g fill="#30403c" stroke="#30403c" stroke-width="2"><rect x="23" y="37" width="15" height="11" rx="4"/><rect x="42" y="37" width="15" height="11" rx="4"/><path d="M38 42h4"/></g><path d="m26 40 6 3m13-3 6 3" stroke="#fff" stroke-width="1.4" opacity=".5"/>'
      : '<path d="M27 43q4-5 8 0m10 0q4-5 8 0" fill="none" stroke="#30403c" stroke-width="2.2" stroke-linecap="round"/>';
  const outfit =
    accessory === 1
      ? `<ellipse cx="42" cy="26" rx="23" ry="7" fill="${accent}"/><path d="M25 24q2-12 18-12t16 12" fill="${accent}"/><circle cx="47" cy="15" r="3" fill="#fff7eb"/>`
      : accessory === 2
        ? `<path d="M18 43q-2-27 23-27t23 27" fill="none" stroke="${accent}" stroke-width="4"/><rect x="15" y="37" width="8" height="17" rx="4" fill="${accent}"/><rect x="58" y="37" width="8" height="17" rx="4" fill="${accent}"/>`
        : `<path d="M27 65q13 8 26 0" fill="none" stroke="${accent}" stroke-width="6" stroke-linecap="round"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="22" fill="${background}"/><path d="M15 80q3-19 25-19t25 19" fill="${accent}"/><path d="m19 38-2-24q1-5 6-1l12 11h10l13-11q5-4 5 2l-1 23q5 6 3 15-2 16-25 16T16 54q-2-10 3-16" fill="${fur}"/><path d="m21 30-1-12 10 10m21 0 10-10-1 12" fill="#d79391" opacity=".7"/><path d="m35 26 5 7 5-7" fill="none" stroke="${accent}" stroke-width="3" opacity=".4" stroke-linecap="round"/>${eyes}<ellipse cx="40" cy="52" rx="13" ry="9" fill="#fff5e5" opacity=".75"/><path d="m36 48 4 4 4-4z" fill="#af7371"/><path d="M40 52v4m-6 0q3 5 6 0 3 5 6 0m-21-6-10-3m10 8-11 1m42-6 10-3m-10 8 11 1" fill="none" stroke="#30403c" stroke-width="1.3" stroke-linecap="round"/>${outfit}${accessory === 3 ? `<path d="m40 70-8-4v10l8-4 8 4V66z" fill="#fff6e9"/>` : ''}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
