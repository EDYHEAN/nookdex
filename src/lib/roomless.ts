/**
 * The pages drawn without the room behind them (Johan, 2026-10-31: the Amazon pages, full width): a visitor landing there
 * gets the page alone, not the room's 5 MB of pictures and scripts (they were the page's biggest paint, and its first h1).
 * « Mon bureau » opens the room (components/ClientApp mounts it then); a visitor who came from the desk keeps it mounted.
 */
const ROOMLESS = /^\/(invitations-amazon|calendrier-des-sorties|en\/release-calendar)\/?$/;
export const isRoomless = (path: string) => ROOMLESS.test(path);

/** the page's path, set by the proxy for the server layout (which isn't told its page's address) */
export const PATH_HEADER = "x-nookdex-path";
