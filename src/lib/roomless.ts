/**
 * The pages drawn without the room behind them (Johan, 2026-10-31: the Amazon pages, full width): a visitor landing there
 * gets the page alone, not the room's 5 MB of pictures and scripts (they were the page's biggest paint, and its first h1).
 * « Mon bureau » opens the room (components/ClientApp mounts it then); a visitor who came from the desk keeps it mounted.
 */
// the set pages, their index and the cards' pages too (~45,000 of them, crawled all day: the room was 3 MB a visit), the
// market and the blog (the shell's tabs: they jumped back to the notebook)
const ROOMLESS = /^\/(invitations-amazon|calendrier-des-sorties|en\/release-calendar|marche|en\/market|blog(\/[^/]+)?|(extensions|en\/sets)(\/[^/]+){0,2})\/?$/;
export const isRoomless = (path: string) => ROOMLESS.test(path);

/** the page's path, set by the proxy for the server layout (which isn't told its page's address) */
export const PATH_HEADER = "x-nookdex-path";
