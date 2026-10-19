import { getConfig } from "@/lib/config";
import ServicesContent from "@/components/content/ServicesContent";

export const metadata = { title: "Specialities & Services" };

export default function ServicesPage() {
  return <ServicesContent cfg={getConfig()} />;
}
