// Overview: number cards, heatmap, chart, outcomes and recent visits. Built for real in step 6.
import { Link } from "react-router";
import { Card, Notice } from "../ui";

export function OverviewPage() {
  return (
    <Card>
      <Notice title="The overview arrives in step 6">
        Number cards, the click heatmap and the events chart will be built from your real visits.
        For now, open the{" "}
        <Link to="/sessions" className="text-violet underline-offset-4 hover:underline">
          sessions list
        </Link>
        .
      </Notice>
    </Card>
  );
}
