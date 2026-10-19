import { getConfig } from "@/lib/config";
import ContactContent from "@/components/content/ContactContent";

export const metadata = { title: "Contact & Clinic Location" };

export default function ContactPage() {
  return <ContactContent cfg={getConfig()} />;
}
