// Small building blocks shared by several pages.
import type { ReactNode } from "react";

/** A rounded panel, the main surface of the design. */
export function Card(props: { children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 rounded-card bg-panel p-[22px] ${props.className ?? ""}`}>
      {props.children}
    </div>
  );
}

/** A message in the middle of a card: for loading, empty and error states. */
export function Notice(props: { title: string; children?: ReactNode }) {
  return (
    <div className="grid place-items-center gap-1 px-4 py-14 text-center">
      <p className="font-medium text-ink">{props.title}</p>
      {props.children && <p className="max-w-[46ch] text-muted">{props.children}</p>}
    </div>
  );
}
