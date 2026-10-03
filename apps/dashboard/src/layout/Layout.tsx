// The frame every page sits in: sidebar on the left, top bar above, and the page itself in the
// <Outlet /> (React Router swaps what's in the outlet when the address changes).
import { Outlet } from "react-router";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function Layout() {
  return (
    <div className="mx-auto grid max-w-[1400px] items-start gap-5 px-4 py-5 sm:px-7 md:grid-cols-[236px_minmax(0,1fr)]">
      <Sidebar />
      <main className="grid min-w-0 gap-5">
        <TopBar />
        <Outlet />
      </main>
    </div>
  );
}
