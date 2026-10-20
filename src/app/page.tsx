import { getConfig } from "@/lib/config";
import { initDb } from "@/lib/db";
import HomeContent from "@/components/content/HomeContent";

export default function HomePage() {
  initDb();
  return <HomeContent cfg={getConfig()} />;
}
