"use client";

import { useLanguage } from "./LanguageProvider";

/**
 * Animated virtual-receptionist avatar.
 *
 * This is the LOCAL provider: a friendly, professional SVG
 * character with natural blinking, subtle idle motion, and a
 * speaking mouth while the voice plays. When a video-avatar
 * provider (HeyGen / D-ID) is configured, the widget swaps in
 * that provider's video stream instead — see src/lib/avatar.ts.
 */
export default function Avatar({
  speaking = false,
  size = 120,
}: {
  speaking?: boolean;
  size?: number;
}) {
  const { t } = useLanguage();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="img"
      aria-label={t("rw.avatarAria")}
      className={speaking ? "avatar-speaking" : ""}
    >
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0C1B33" />
          <stop offset="100%" stopColor="#16294A" />
        </linearGradient>
        <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F3C9A6" />
          <stop offset="100%" stopColor="#E3A87E" />
        </linearGradient>
        <linearGradient id="shirt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#269A90" />
          <stop offset="100%" stopColor="#1B7D76" />
        </linearGradient>
      </defs>

      <circle cx="100" cy="100" r="98" fill="url(#bg)" />
      {/* soft halo */}
      <circle cx="100" cy="100" r="98" fill="none" stroke="#269A90" strokeOpacity="0.35" strokeWidth="3" />

      {/* hair */}
      <path d="M55 95 Q55 45 100 42 Q145 45 145 95 Q145 78 132 70 Q118 58 100 58 Q82 58 68 70 Q55 78 55 95 Z" fill="#2B2B33" />

      {/* face */}
      <ellipse cx="100" cy="108" rx="38" ry="46" fill="url(#skin)" />

      {/* brows */}
      <path d="M72 88 Q80 82 90 87" stroke="#3B2F2F" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M110 87 Q120 82 128 88" stroke="#3B2F2F" strokeWidth="3" fill="none" strokeLinecap="round" />

      {/* eyes with blinking */}
      <g className="avatar-eye">
        <ellipse cx="84" cy="104" rx="7" ry="8" fill="#1F2937" />
        <circle cx="86" cy="101" r="2.2" fill="#fff" />
      </g>
      <g className="avatar-eye" style={{ animationDelay: "0.15s" }}>
        <ellipse cx="116" cy="104" rx="7" ry="8" fill="#1F2937" />
        <circle cx="118" cy="101" r="2.2" fill="#fff" />
      </g>

      {/* nose */}
      <path d="M100 108 Q103 118 99 122" stroke="#C98B5E" strokeWidth="2.5" fill="none" strokeLinecap="round" />

      {/* mouth — animated while speaking */}
      <ellipse className="avatar-mouth" cx="100" cy="140" rx="11" ry="4.5" fill="#8C4A3C" />

      {/* smile hint */}
      <path d="M88 138 Q100 146 112 138" stroke="#8C4A3C" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.6" />

      {/* shoulders / clinical uniform */}
      <path d="M48 200 Q52 160 100 158 Q148 160 152 200 Z" fill="url(#shirt)" />
      <path d="M88 160 L100 176 L112 160 L106 158 L100 166 L94 158 Z" fill="#fff" opacity="0.9" />

      {/* headset (receptionist) */}
      <path d="M62 96 Q62 48 100 46 Q138 48 138 96" stroke="#0C1B33" strokeWidth="6" fill="none" strokeLinecap="round" />
      <rect x="56" y="92" width="12" height="22" rx="5" fill="#0C1B33" />
      <rect x="132" y="92" width="12" height="22" rx="5" fill="#0C1B33" />
      <circle cx="62" cy="102" r="4" fill="#269A90" />
      <circle cx="138" cy="102" r="4" fill="#269A90" />
      <path d="M138 112 Q150 128 142 140" stroke="#0C1B33" strokeWidth="4" fill="none" strokeLinecap="round" />
      <circle cx="141" cy="142" r="4" fill="#269A90" />
    </svg>
  );
}
