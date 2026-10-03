// Turning raw data from the API into short, readable text.

/** A browser's long "user agent" text → a short name. The order matters: Edge and VS Code also say "Chrome". */
export function browserName(userAgent: string | null): string {
  if (!userAgent) return "Unknown";
  if (userAgent.includes("HeadlessChrome")) return "Test robot";
  if (userAgent.includes(" Code/")) return "VS Code";
  if (userAgent.includes("Edg/")) return "Edge";
  if (userAgent.includes("Firefox/")) return "Firefox";
  if (userAgent.includes("Chrome/")) return "Chrome";
  if (userAgent.includes("Safari/")) return "Safari";
  return "Other";
}

/** 9043 milliseconds → "0:09", 95000 → "1:35". */
export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** "2026-10-03T16:41:41Z" → "22:11" in the viewer's own time zone. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** "2026-10-03T16:41:41Z" → "3 Oct". */
export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** "http://localhost:5173/cart?x=1" → "localhost:5173/cart". Falls back to the raw text. */
export function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.host + (u.pathname === "/" ? "" : u.pathname);
  } catch {
    return url;
  }
}
