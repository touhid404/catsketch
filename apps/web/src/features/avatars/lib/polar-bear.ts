const palettes = [
  ['#f7dfcf', '#da7857'],
  ['#dce7d4', '#738d65'],
  ['#e2dcf3', '#8a72c0'],
  ['#d3e8ee', '#4b94ac'],
  ['#f4dce5', '#bc6c91'],
  ['#f6eacb', '#c69e4a'],
];
/** A guest's random UUID selects a stable, locally rendered avatar. */
export function polarBearImage(seed: string) {
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  const [background, accent] = palettes[hash % palettes.length];
  const accessory = Math.floor(hash / palettes.length) % 4;
  const glasses =
    accessory === 0
      ? '<g fill="#293b40" stroke="#293b40" stroke-width="2"><rect x="24" y="39" width="14" height="10" rx="4"/><rect x="43" y="39" width="14" height="10" rx="4"/><path d="M38 43h5"/></g><path d="m27 41 6 3m13-3 6 3" stroke="#ffffff" stroke-width="1.4" opacity=".5"/>'
      : '<g fill="#293b40"><circle cx="31" cy="43" r="2.2"/><circle cx="50" cy="43" r="2.2"/></g>';
  const hat =
    accessory === 1
      ? `<path d="M23 29q0-17 18-17t18 17" fill="${accent}"/><rect x="21" y="25" width="40" height="8" rx="4" fill="${accent}"/><circle cx="41" cy="10" r="5" fill="#fffaf3"/>`
      : accessory === 2
        ? `<path d="M18 44q-2-26 23-26t23 26" fill="none" stroke="${accent}" stroke-width="4"/><rect x="15" y="37" width="8" height="17" rx="4" fill="${accent}"/><rect x="58" y="37" width="8" height="17" rx="4" fill="${accent}"/>`
        : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="22" fill="${background}"/><path d="M12 80q1-21 28-21t28 21" fill="${accent}"/><circle cx="24" cy="29" r="10" fill="#fffaf3"/><circle cx="56" cy="29" r="10" fill="#fffaf3"/><circle cx="24" cy="29" r="5" fill="#e6ded5"/><circle cx="56" cy="29" r="5" fill="#e6ded5"/><path d="M18 44q0-20 22-20t22 20v7q0 17-22 17T18 51z" fill="#fffaf3"/>${glasses}<ellipse cx="40" cy="53" rx="13" ry="9" fill="#ede8df"/><path d="M35 49q5-3 10 0l-5 5z" fill="#293b40"/><path d="M40 54v3m-5 0q5 5 10 0" fill="none" stroke="#293b40" stroke-width="1.5" stroke-linecap="round"/><circle cx="25" cy="52" r="3" fill="#e6aaa0" opacity=".5"/><circle cx="55" cy="52" r="3" fill="#e6aaa0" opacity=".5"/>${hat}<path d="M27 65q13 9 26 0" fill="none" stroke="${accent}" stroke-width="6" stroke-linecap="round"/>${accessory === 3 ? `<path d="m40 70-7 6 7 2 7-2z" fill="#fffaf3"/>` : ''}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
