/**
 * The collector's gear, drawn (the accessories page, /accessoires-pokemon): ink on the NookDex colours like lib/kindArt,
 * no product pictures (these are Amazon searches, any brand). SVG markup for dangerouslySetInnerHTML.
 */
export type GearKind = "binder" | "sleeves" | "toploader" | "magnet" | "box";

const S = 'stroke="#2b2230" stroke-width="3" stroke-linejoin="round"';
const card = (x: number, y: number, w: number, h: number, fill = "#ffd35a") =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${fill}" ${S} stroke-width="2"/>`;

const ART: Record<GearKind, string> = {
  // a 9-pocket binder open: two pages of three by three, its zip around
  binder:
    `<rect x="4" y="12" width="56" height="42" rx="4" fill="#a096cd" ${S}/><path d="M32 12v42" ${S}/>` +
    [0, 1, 2]
      .flatMap((r) => [0, 1, 2].flatMap((c) => [card(8 + c * 7.6, 16 + r * 12, 6, 10, (r + c) % 3 ? "#fff6e2" : "#ffd35a"), card(35 + c * 7.6, 16 + r * 12, 6, 10, (r + c) % 2 ? "#fff6e2" : "#8fdc7a")]))
      .join(""),
  // a card slipped half into its sleeve
  sleeves:
    `${card(16, 14, 26, 38)}<path d="M20 20h18v12H20z" fill="#b8433d" stroke="#2b2230" stroke-width="2"/>` +
    `<rect x="12" y="26" width="34" height="32" rx="3" fill="#bfe3ff" fill-opacity=".55" ${S}/><path d="M16 30l8 8" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`,
  // a toploader: rigid, its thumb notch, the card inside
  toploader:
    `<rect x="14" y="6" width="36" height="52" rx="3" fill="#dfeef8" ${S}/><path d="M27 6a5 5 0 0 0 10 0" fill="#fff" ${S} stroke-width="2"/>` +
    `${card(19, 13, 26, 40)}<path d="M23 18h18v14H23z" fill="#a096cd" stroke="#2b2230" stroke-width="2"/><path d="M18 50l6-6" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`,
  // a magnetic one-touch: a thick frame, the card under glass, its magnet seam
  magnet:
    `<rect x="10" y="4" width="44" height="56" rx="5" fill="#2b2230" ${S}/><rect x="14" y="8" width="36" height="48" rx="3" fill="#c9ccd6"/>` +
    `${card(18, 12, 28, 40, "#ffd35a")}<path d="M22 17h20v15H22z" fill="#8fdc7a" stroke="#2b2230" stroke-width="2"/><path d="M10 32h4M50 32h4" stroke="#ffd35a" stroke-width="3"/>`,
  // a storage box: long, its lid lifted, the cards standing in a row
  box:
    `<path d="M6 28h52v26H6z" fill="#e0a868" ${S}/>` +
    [0, 1, 2, 3, 4, 5].map((i) => card(10 + i * 7.4, 18 + (i % 2) * 3, 6, 12, i % 2 ? "#fff6e2" : "#ffd35a")).join("") +
    `<path d="M6 28h52" ${S}/><path d="M4 26 14 14h44l-6 12z" fill="#b8433d" ${S}/>`,
};

export const gearArt = (kind: GearKind) => `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">${ART[kind]}</svg>`;
