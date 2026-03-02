export const dynamic = "force-dynamic";
import nextDynamic from "next/dynamic";
const SystemDashboard = nextDynamic(() => import("../_components/system-monitoring/SystemDashboard"));

export default function Page() {
  return <SystemDashboard />;
}
