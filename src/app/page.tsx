import { getConfig } from "@/lib/config";
import HomeContent from "@/components/content/HomeContent";

export default function HomePage() {
  return <HomeContent cfg={getConfig()} />;
}
