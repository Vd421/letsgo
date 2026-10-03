// The browser-style frame the replay plays in. The visitor's window can be any size: a wide
// laptop (1280 × 720) or a narrow phone-shaped panel (310 × 672). Like a video player, we shrink
// the replay to fit INSIDE the space (by width and by height) and centre it, so the controls
// below always stay on screen.
import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import "rrweb/dist/style.css"; // rrweb's own styles for the replayed mouse cursor and clicks
import { shortUrl } from "../format";

type Props = {
  mountRef: RefObject<HTMLDivElement | null>;
  url: string;
  screen: { width: number; height: number };
};

// The tallest the replay may get: 62% of the window's height (and never above 640px).
const maxHeight = () => Math.min(window.innerHeight * 0.62, 640);

export function Theatre({ mountRef, url, screen }: Props) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const fit = () =>
      setScale(Math.min(area.clientWidth / screen.width, maxHeight() / screen.height));
    fit();
    const observer = new ResizeObserver(fit); // sidebar collapsed, window resized, full screen…
    observer.observe(area);
    window.addEventListener("resize", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [screen.width, screen.height]);

  return (
    <div className="overflow-hidden rounded-[14px] ring-1 ring-line">
      <div className="flex h-9 items-center gap-[7px] bg-panel-2 px-3">
        <i className="h-[9px] w-[9px] rounded-full bg-line" />
        <i className="h-[9px] w-[9px] rounded-full bg-line" />
        <i className="h-[9px] w-[9px] rounded-full bg-line" />
        <span className="ml-2.5 max-w-[340px] flex-1 truncate rounded-full bg-panel px-3 py-1 font-mono text-xs text-muted">
          {shortUrl(url)}
        </span>
        <span className="ml-auto font-mono text-xs whitespace-nowrap text-muted max-sm:hidden">
          {screen.width} × {screen.height}
        </span>
      </div>
      {/* The grey area; the recorded page sits centred inside it at the fitted size. */}
      <div ref={areaRef} className="flex justify-center bg-panel-2">
        <div
          className="relative overflow-hidden bg-white"
          style={{ width: screen.width * scale, height: screen.height * scale }}
        >
          <div
            ref={mountRef}
            className="pointer-events-none absolute top-0 left-0 origin-top-left"
            style={{ width: screen.width, height: screen.height, transform: `scale(${scale})` }}
          />
        </div>
      </div>
    </div>
  );
}
