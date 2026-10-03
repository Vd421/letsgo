// The bar across the top: search, today's date, theme switch, API status, avatar.
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { isApiHealthy } from "../api";
import { IconCalendar, IconMoon, IconRecord, IconSearch, IconSun } from "../icons";
import { useTheme } from "../useTheme";

const roundButton = "grid h-11 w-11 shrink-0 place-items-center rounded-full bg-panel-2 text-ink";

export function TopBar() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const [apiUp, setApiUp] = useState<boolean | null>(null); // null = not checked yet

  // Check the API now, then every 15 seconds, so the dot stays honest.
  useEffect(() => {
    const check = () => isApiHealthy().then(setApiUp);
    check();
    const timer = setInterval(check, 15_000);
    return () => clearInterval(timer); // stop checking when this component goes away
  }, []);

  // The search text lives in the address (/sessions?q=mug), so the Sessions page can read it.
  const query = pathname === "/sessions" ? (params.get("q") ?? "") : "";
  function onSearch(text: string) {
    navigate(text ? `/sessions?q=${encodeURIComponent(text)}` : "/sessions", { replace: true });
  }

  const today = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex max-w-[540px] flex-[1_1_320px] items-center gap-2.5 rounded-full bg-panel px-[18px] py-3 text-muted">
        <IconSearch width={18} height={18} />
        <input
          type="search"
          value={query}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search visits by page or browser"
          aria-label="Search visits"
          className="w-full bg-transparent text-ink outline-none placeholder:text-muted"
        />
      </label>

      <div className="ml-auto flex items-center gap-2.5">
        <div className="flex items-center gap-3 rounded-full bg-panel py-1.5 pr-1.5 pl-[18px] whitespace-nowrap text-ink">
          <span className="max-sm:hidden">{today}</span>
          <span className="grid h-[38px] w-[38px] place-items-center rounded-full bg-panel-2">
            <IconCalendar />
          </span>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className={roundButton}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <IconMoon /> : <IconSun />}
        </button>

        <span
          className={`${roundButton} relative`}
          title={apiUp === false ? "API not reachable" : "Recording: API connected"}
          aria-label={apiUp === false ? "API not reachable" : "API connected"}
        >
          <IconRecord className={apiUp === false ? "text-muted" : "text-ink"} />
          <span
            className={`absolute top-2.5 right-2.5 h-2 w-2 rounded-full ring-2 ring-panel-2 ${
              apiUp === false ? "bg-muted" : "bg-accent"
            }`}
          />
        </span>

        <span
          className="grid h-11 w-11 place-items-center rounded-full bg-violet-soft text-sm font-semibold text-violet"
          aria-label="Vaibhav"
        >
          VD
        </span>
      </div>
    </div>
  );
}
