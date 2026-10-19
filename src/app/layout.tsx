import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import SkipLink from "@/components/SkipLink";
import Footer from "@/components/Footer";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { LanguageProvider } from "@/components/LanguageProvider";
import { ReceptionistWidget } from "@/components/ReceptionistWidget";
import { ClinicConfigProvider } from "@/components/ClinicConfigProvider";
import { getConfig, isConfigured } from "@/lib/config";
import { initDb } from "@/lib/db";

export const metadata: Metadata = {
  title: "Dr. XYZ — Clinic & Online Consultations",
  description: "Book in-person or online consultations with Dr. XYZ. Live availability, instant confirmation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  initDb();
  const cfg = getConfig();
  const publicConfig = {
    doctor: {
      name: cfg.doctor.name,
      title: cfg.doctor.title,
      speciality: cfg.doctor.speciality,
      qualifications: cfg.doctor.qualifications,
    },
    clinic: {
      name: cfg.clinic.name,
      tagline: cfg.clinic.tagline,
      phone: cfg.clinic.phone,
      email: cfg.clinic.email,
    },
    booking: {
      modes: cfg.booking.modes,
      defaultDurationMinutes: cfg.booking.defaultDurationMinutes,
    },
  };

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ClinicConfigProvider config={publicConfig}>
          <LanguageProvider>
            <SkipLink />
            <DemoModeBanner />
            <Navbar />
            <main id="main">{children}</main>
            <Footer
              doctorName={cfg.doctor.name}
              clinicName={isConfigured(cfg.clinic.name) ? cfg.clinic.name : ""}
              emergencyNumber={cfg.clinic.emergencyNumber || "112"}
            />
            <ReceptionistWidget />
          </LanguageProvider>
        </ClinicConfigProvider>
      </body>
    </html>
  );
}
