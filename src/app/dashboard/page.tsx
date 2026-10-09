import DashboardShell from "@/components/dashboard/DashboardShell";

// Keep the route itself intentionally light on Cloudflare Workers.
// Authentication and personalized data are loaded in the browser by DashboardShell.
export default function DashboardPage() {
  return <DashboardShell />;
}
