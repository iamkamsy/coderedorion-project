import type { Metadata } from "next";
import { Dashboard } from "@/components/Dashboard";

export const metadata: Metadata = { title: "Dashboard · Gesture Rack" };

export default function DashboardPage() {
  return <Dashboard />;
}
