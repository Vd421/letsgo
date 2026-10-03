// The map of the app: which page to show for which address.
import { BrowserRouter, Route, Routes } from "react-router";
import { Layout } from "./layout/Layout";
import { LatestReplayPage } from "./pages/LatestReplayPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ReplayPage } from "./pages/ReplayPage";
import { SessionsPage } from "./pages/SessionsPage";
import { Card, Notice } from "./ui";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Every page shares the Layout (sidebar + top bar); the page fills its <Outlet />. */}
        <Route element={<Layout />}>
          <Route index element={<OverviewPage />} />
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="sessions/:id" element={<ReplayPage />} />
          <Route path="replay" element={<LatestReplayPage />} />
          <Route
            path="*"
            element={
              <Card>
                <Notice title="Page not found">There's nothing at this address.</Notice>
              </Card>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
