import dynamic from "next/dynamic";
const SystemDashboard = dynamic(() => import("../_components/system-monitoring/SystemDashboard"));

export default function Page() {
  return <SystemDashboard />;
}
