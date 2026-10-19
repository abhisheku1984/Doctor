"use client";

/** Opens the floating AI receptionist widget. */
export default function ReceptionistLauncher({ className = "" }: { className?: string }) {
  return (
    <button
      onClick={() => {
        const btn = document.querySelector<HTMLButtonElement>('button[aria-label="Talk to our AI receptionist"]');
        btn?.click();
        btn?.focus();
      }}
      className={className}
    >
      Start a conversation
    </button>
  );
}
