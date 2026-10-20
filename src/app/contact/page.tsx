import { getConfig } from "@/lib/config";
import { initDb } from "@/lib/db";
import ContactContent from "@/components/content/ContactContent";

export default function ContactPage() {
  initDb();
  return <ContactContent cfg={getConfig()} />;
}
