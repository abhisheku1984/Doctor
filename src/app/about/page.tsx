import { getConfig } from "@/lib/config";
import AboutContent from "@/components/content/AboutContent";

export const metadata = { title: "About Dr. XYZ" };

export default function AboutPage() {
  return <AboutContent cfg={getConfig()} />;
}
