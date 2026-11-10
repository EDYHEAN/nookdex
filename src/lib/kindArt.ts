import type { ShopKind } from "./amazonShop";

/**
 * A drawn tile per kind of sealed product (Johan, 2026-10-31: the real product's picture, else this, never a booster
 * standing in for an Elite Trainer Box): what's in the box at a glance, ink on the NookDex colours. SVG markup, for the
 * React pages (dangerouslySetInnerHTML) and the blog's HTML alike. The English pages show only these (amazon.com
 * products have no pictures of ours).
 */
const S = 'stroke="#2b2230" stroke-width="3" stroke-linejoin="round"';
const ball = (cx: number, cy: number, r: number) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" ${S} stroke-width="2.5"/><path d="M${cx - r} ${cy}h${2 * r}" stroke="#2b2230" stroke-width="2.5"/>` +
  `<path d="M${cx - r} ${cy}a${r} ${r} 0 0 1 ${2 * r} 0z" fill="#b8433d" ${S} stroke-width="2.5"/><circle cx="${cx}" cy="${cy}" r="${r / 3}" fill="#fff" ${S} stroke-width="2"/>`;

const ART: Record<ShopKind, string> = {
  // the Elite Trainer Box: a deep box, its lid's ball
  etb: `<path d="M8 22 32 12l24 10v28L32 60 8 50z" fill="#ffd35a" ${S}/><path d="M8 22l24 10 24-10M32 32v28" fill="none" ${S}/>${ball(20, 41, 6)}`,
  // a display: the box of 36 (18) boosters, its lid open
  display: `<rect x="6" y="22" width="52" height="32" rx="3" fill="#b8433d" ${S}/><path d="M6 32h52" ${S}/><path d="M12 22V14h12v8M26 22V12h12v10M40 22V14h12v8" fill="#ffd35a" ${S}/><path d="M4 22h56" ${S}/>`,
  // a bundle: six boosters, fanned
  bundle: `<g ${S}><path d="M10 14h18v40H10z" fill="#a096cd" transform="rotate(-10 19 34)"/><path d="M23 10h18v44H23z" fill="#ffd35a"/><path d="M36 14h18v40H36z" fill="#8fdc7a" transform="rotate(10 45 34)"/></g>`,
  // a tripack: three boosters on a card, its hanging hole
  tripack: `<rect x="8" y="8" width="48" height="50" rx="6" fill="#efe3c8" ${S}/><rect x="26" y="12" width="12" height="4" rx="2" fill="#2b2230"/><g ${S} stroke-width="2.5"><rect x="13" y="22" width="11" height="30" fill="#ffd35a"/><rect x="26.5" y="22" width="11" height="30" fill="#b8433d"/><rect x="40" y="22" width="11" height="30" fill="#a096cd"/></g>`,
  // a box (coffret): a flat box, a card behind its window
  box: `<rect x="6" y="14" width="52" height="40" rx="4" fill="#a096cd" ${S}/><rect x="12" y="20" width="20" height="28" rx="2" fill="#fff6e2" ${S} stroke-width="2.5"/><path d="M16 26h12M16 31h8" stroke="#b8433d" stroke-width="2.5"/><path d="M38 24h14v8H38zM38 36h14v8H38z" fill="#ffd35a" ${S} stroke-width="2.5"/>`,
  // a collection: a box with a poster or a binder rolled in, a ribbon across
  collection: `<rect x="6" y="16" width="52" height="38" rx="4" fill="#8fdc7a" ${S}/><path d="M14 16v38M6 26h52" stroke="#b8433d" stroke-width="4"/><rect x="24" y="22" width="26" height="26" rx="2" fill="#fff6e2" ${S} stroke-width="2.5"/>${ball(37, 35, 7)}`,
  // a blister: two boosters and a coin under plastic
  blister: `<rect x="10" y="6" width="44" height="54" rx="6" fill="#efe3c8" ${S}/><rect x="26" y="10" width="12" height="4" rx="2" fill="#2b2230"/><g ${S} stroke-width="2.5"><rect x="15" y="20" width="14" height="34" fill="#ffd35a"/><rect x="35" y="20" width="14" height="34" fill="#a096cd"/></g><circle cx="32" cy="20" r="5" fill="#e0a868" ${S} stroke-width="2"/>`,
  // a Pokébox: a box under a big ball
  pokebox: `<rect x="8" y="22" width="48" height="34" rx="4" fill="#efe3c8" ${S}/><path d="M8 32h48" ${S}/>${ball(32, 22, 13)}`,
  // a mini tin: a round-cornered tin, its lid
  tin: `<rect x="10" y="12" width="44" height="44" rx="12" fill="#c9ccd6" ${S}/><path d="M10 26h44" ${S}/><rect x="14" y="16" width="36" height="7" rx="3" fill="#fff" opacity=".55"/>${ball(32, 41, 8)}`,
};

/** the drawn tile of a kind, as SVG markup */
export const kindArt = (kind: ShopKind) => `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">${ART[kind]}</svg>`;

/** the boxes a set's logo can dress (the rest are made of boosters: their own drawing) */
const BOXES: ShopKind[] = ["etb", "display", "box", "collection", "pokebox"];
const INK = 'stroke="#2b2230" stroke-width="3" stroke-linejoin="round"';
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/**
 * A box still without its official picture (Johan, 2026-11-10: « toujours pas de visuels »; Poképédia uploads an Elite
 * Trainer Box weeks after the release, displays never): the box drawn in the NookDex ink, the set's real logo on its face.
 * A display is wide and low, its lid open; the rest stand like an Elite Trainer Box. No logo known: the plain drawing.
 */
export function boxArt(kind: ShopKind, logo?: string | null) {
  if (!logo || !BOXES.includes(kind)) return kindArt(kind);
  const id = `bx${Math.abs([...logo + kind].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)).toString(36)}`;
  const face = `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a64bf"/><stop offset="1" stop-color="#3a2c66"/></linearGradient>`;
  const img = (x: number, y: number, w: number, h: number) =>
    `<image href="${esc(logo)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
  const body =
    kind === "display"
      ? // wide and low, the lid open behind, a row of boosters peeking out
        `<path d="M14 46 30 30h80L94 46z" fill="#2b2230"/>` +
        `<path d="M30 30 22 8h80l8 22z" fill="#9a86da" ${INK}/>` +
        `<g ${INK} stroke-width="2"><path d="M34 46V34h10v12M48 46V32h10v14M62 46V34h10v12M76 46V32h10v14" fill="#ffd35a"/></g>` +
        `<path d="M14 46h80v54H14z" fill="url(#${id})" ${INK}/><path d="M94 46l16-16v54l-16 16z" fill="#4a3a7c" ${INK}/>` +
        `<path d="M14 54h80" stroke="#ffd35a" stroke-width="4"/>` +
        img(17, 59, 74, 38)
      : // standing, a ball on its side, a yellow band on its face
        `<path d="M14 26 34 10h76L90 26z" fill="#9a86da" ${INK}/>` +
        `<path d="M14 26h76v84H14z" fill="url(#${id})" ${INK}/><path d="M90 26l20-16v84l-20 16z" fill="#4a3a7c" ${INK}/>` +
        `<circle cx="100" cy="56" r="7" fill="#fff" stroke="#2b2230" stroke-width="2"/><path d="M93 56a7 7 0 0 1 14 0z" fill="#b8433d" stroke="#2b2230" stroke-width="2"/>` +
        `<path d="M14 36h76" stroke="#ffd35a" stroke-width="5"/>` +
        img(17, 44, 70, 60);
  return `<svg class="box-art" viewBox="0 0 124 120" aria-hidden="true" focusable="false"><defs>${face}</defs>${body}</svg>`;
}
