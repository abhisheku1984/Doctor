"use client";
import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(" ");

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
        variant === "primary" && "bg-teal-600 text-white hover:bg-teal-700 shadow-soft",
        variant === "secondary" && "bg-white text-navy-800 border border-navy-200 hover:border-teal-500 hover:text-teal-700 shadow-soft",
        variant === "ghost" && "text-navy-700 hover:bg-navy-50",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        className
      )}
      {...props}
    />
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-2xl bg-white border border-navy-100 shadow-soft", className)}>{children}</div>;
}

export function Badge({ tone = "teal", children }: { tone?: "teal" | "navy" | "amber" | "green" | "gray"; children: ReactNode }) {
  const tones: Record<string, string> = {
    teal: "bg-teal-50 text-teal-700 border-teal-200",
    navy: "bg-navy-50 text-navy-700 border-navy-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    gray: "bg-slate-50 text-slate-600 border-slate-200",
  };
  return <span className={cx("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

export function SectionHeading({ kicker, title, description }: { kicker?: string; title: string; description?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {kicker && <p className="text-sm font-semibold uppercase tracking-widest text-teal-600">{kicker}</p>}
      <h2 className="font-display mt-2 text-3xl font-semibold text-navy-900 sm:text-4xl">{title}</h2>
      {description && <p className="mt-4 text-base leading-relaxed text-navy-600">{description}</p>}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full rounded-xl border border-navy-200 bg-white px-4 py-3 text-sm text-navy-900 placeholder:text-navy-300 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
      {...props}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="w-full rounded-xl border border-navy-200 bg-white px-4 py-3 text-sm text-navy-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
      {...props}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className="w-full rounded-xl border border-navy-200 bg-white px-4 py-3 text-sm text-navy-900 placeholder:text-navy-300 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
      rows={4}
      {...props}
    />
  );
}

export function Field({ label, error, children, hint }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-navy-800">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-navy-400">{hint}</span>}
      {error && (
        <span role="alert" className="mt-1 block text-xs font-medium text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}

export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={cx("reveal", className)} data-reveal>{children}</div>;
}
