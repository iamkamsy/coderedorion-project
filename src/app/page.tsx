import { SessionBoundary } from "@/components/SessionBoundary";
import { Studio } from "@/components/Studio";

export default function Home() {
  return (
    <SessionBoundary>
      <Studio />
    </SessionBoundary>
  );
}
