import { createFileRoute } from "@tanstack/react-router";
import { MonchelRunner } from "@/components/monchel-runner";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <MonchelRunner />;
}
