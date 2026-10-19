import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { LanguageProvider } from "@/components/LanguageProvider";
import { ReceptionistWidget } from "@/components/ReceptionistWidget";
import { ClinicConfigProvider } from "@/components/ClinicConfigProvider";
import { getConfig } from "@/lib/config";
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
            <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-teal-600 focus:text-white focus:px-4 focus:py-2 focus:m-2">
              Skip to main content
            </a>
            <DemoModeBanner />
            <Navbar />
            <main id="main">{children}</main>
            <Footer />
            <ReceptionistWidget />
          </LanguageProvider>
        </ClinicConfigProvider>
      </body>
    </html>
  );
}
