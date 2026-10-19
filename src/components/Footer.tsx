import Link from "next/link";
import { getConfig, isConfigured } from "@/lib/config";

export default function Footer() {
  const cfg = getConfig();
  return (
    <footer className="border-t border-navy-100 bg-navy-950 text-navy-100">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <p className="font-display text-xl font-semibold text-white">{cfg.doctor.name}</p>
          <p className="mt-1 text-sm text-navy-300">{isConfigured(cfg.clinic.name) ? cfg.clinic.name : "Clinic website"}</p>
          <p className="mt-4 text-xs leading-relaxed text-navy-400">
            This website is for appointment booking and clinic information. It is not a substitute for
            professional medical advice.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-400">Quick links</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="hover:text-teal-300" href="/book">Book an appointment</Link></li>
            <li><Link className="hover:text-teal-300" href="/services">Services</Link></li>
            <li><Link className="hover:text-teal-300" href="/appointments/lookup">Look up an appointment</Link></li>
            <li><Link className="hover:text-teal-300" href="/privacy">Privacy Policy</Link></li>
            <li><Link className="hover:text-teal-300" href="/terms">Terms &amp; Cancellation</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-400">Emergency</p>
          <p className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
            {cfg.clinic.emergencyNumber || "112"} — India emergency number. For medical emergencies, call immediately.
          </p>
        </div>
      </div>
      <div className="border-t border-navy-800 py-4 text-center text-xs text-navy-400">
        © {new Date().getFullYear()} {cfg.doctor.name}. All rights reserved.
      </div>
    </footer>
  );
}
