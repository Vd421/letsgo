// The left menu: brand, the pages, and (greyed out) items that aren't built yet.
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import {
  IconAlert,
  IconCursor,
  IconHelp,
  IconHome,
  IconList,
  IconPlayBox,
  IconSettings,
} from "../icons";

const itemClass =
  "flex w-full items-center gap-3 rounded-[14px] px-3 py-[11px] text-[15px] font-medium transition-colors";

function NavItem(props: { to: string; active: boolean; icon: ReactNode; label: string }) {
  return (
    <Link
      to={props.to}
      aria-current={props.active ? "page" : undefined}
      className={`${itemClass} ${
        props.active
          ? "bg-panel-2 text-accent"
          : "text-text hover:bg-panel-2 hover:text-ink active:scale-[0.98]"
      }`}
    >
      {props.icon}
      {props.label}
    </Link>
  );
}

// Not built yet: shown so the menu looks complete, but it does nothing.
function SoonItem(props: { icon: ReactNode; label: string; note?: string }) {
  return (
    <span
      className={`${itemClass} cursor-not-allowed text-muted opacity-70`}
      aria-disabled="true"
      title={props.note ? `Coming in ${props.note}` : "Not built yet"}
    >
      {props.icon}
      {props.label}
      {props.note && (
        <span className="ml-auto rounded-full bg-panel-2 px-2 py-0.5 text-[11px] font-semibold">
          {props.note}
        </span>
      )}
    </span>
  );
}

export function Sidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="flex flex-col gap-1.5 rounded-card bg-panel px-3.5 py-[18px] md:sticky md:top-5 md:min-h-[calc(100vh-40px)]">
      <div className="flex items-center gap-2.5 px-2 pb-[18px] text-lg font-semibold text-ink">
        <span className="grid h-[30px] w-[30px] place-items-center rounded-[9px] bg-accent text-white">
          <IconCursor width={15} height={15} />
        </span>
        Replay
      </div>

      <nav className="grid gap-1 max-md:grid-cols-2" aria-label="Main">
        <NavItem to="/" active={pathname === "/"} icon={<IconHome />} label="Overview" />
        <NavItem
          to="/sessions"
          active={pathname === "/sessions"}
          icon={<IconList />}
          label="Sessions"
        />
        <NavItem
          to="/replay"
          active={pathname.startsWith("/sessions/") || pathname === "/replay"}
          icon={<IconPlayBox />}
          label="Replay"
        />
        <SoonItem icon={<IconAlert />} label="Issues" note="Phase 5" />
      </nav>

      <nav className="grid gap-1 max-md:hidden md:mt-auto" aria-label="More">
        <SoonItem icon={<IconSettings />} label="Settings" />
        <SoonItem icon={<IconHelp />} label="Help Center" />
      </nav>
    </aside>
  );
}
