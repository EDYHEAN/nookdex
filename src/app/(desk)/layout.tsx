import { headers } from "next/headers";
import { preload } from "react-dom";
import { ClientApp } from "@/components/ClientApp";
import { PATH_HEADER, isRoomless } from "@/lib/roomless";
import { LOGO_IMG_SIZES, logoSrcSet, sceneImg } from "@/lib/scene";

/**
 * The desk stays mounted across "/" and the notebook pages (about, privacy, terms, contact):
 * opening or closing one of them never reloads the room.
 */
export default async function DeskLayout({ children }: LayoutProps<"/">) {
  // The loader's logo is the first big paint, but the room is drawn by scripts: a <link rel="preload"> in the HTML
  // starts it at once, ahead of the room's pictures. Not on a page drawn without the room (lib/roomless).
  if (!isRoomless((await headers()).get(PATH_HEADER) ?? "")) {
    preload(sceneImg("logo-paper-1400.webp"), { as: "image", imageSrcSet: logoSrcSet, imageSizes: LOGO_IMG_SIZES, fetchPriority: "high" });
  }
  return (
    <>
      <ClientApp />
      {children}
    </>
  );
}
