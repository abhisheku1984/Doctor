import { getConfig } from "@/lib/config";
import PrivacyContent from "@/components/content/PrivacyContent";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  const cfg = getConfig();
  return <PrivacyContent clinicName={cfg.clinic.name !== "[TO BE CONFIGURED]" ? cfg.clinic.name : ""} />;
}
