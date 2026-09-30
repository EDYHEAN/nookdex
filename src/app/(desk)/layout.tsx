import { ClientApp } from "@/components/ClientApp";

/**
 * The desk stays mounted across "/" and the notebook pages (about, privacy, terms, contact):
 * opening or closing one of them never reloads the room.
 */
export default function DeskLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <ClientApp />
      {children}
    </>
  );
}
