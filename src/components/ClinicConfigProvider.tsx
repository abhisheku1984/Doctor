"use client";

/**
 * Client-safe clinic configuration. The server reads
 * config/clinic.json and passes the PUBLIC (non-secret)
 * subset down — client components never touch fs.
 */
import { createContext, useContext, ReactNode } from "react";

export interface PublicClinicConfig {
  doctor: { name: string; title: string; speciality: string; qualifications: string[] };
  clinic: { name: string; tagline: string; phone: string; email: string };
  booking: { modes: string[]; defaultDurationMinutes: number };
}

const Ctx = createContext<PublicClinicConfig | null>(null);

export function ClinicConfigProvider({ config, children }: { config: PublicClinicConfig; children: ReactNode }) {
  return <Ctx.Provider value={config}>{children}</Ctx.Provider>;
}

export function useClinicConfig(): PublicClinicConfig {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useClinicConfig must be used within ClinicConfigProvider");
  return ctx;
}
