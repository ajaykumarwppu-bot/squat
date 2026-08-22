import React from "react";

type P = React.SVGProps<SVGSVGElement> & { size?: number };

const base = (size?: number) => ({
  width: size ?? 20,
  height: size ?? 20,
  viewBox: "0 0 32 32",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

/** side-view stick figure: push-up position */
export const PushupIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="7.5" cy="12" r="2.4" />
    <path d="M9.5 13.5 L17 16.5 L26 17.5" />
    <path d="M17 16.5 L15.5 23 M15.5 23 L13 23.5" />
    <path d="M26 17.5 L27.5 21.5 L25.5 23" />
    <path d="M4 26.5 H28" strokeOpacity="0.45" />
  </svg>
);

/** side-view stick figure: deep squat */
export const SquatIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="14" cy="6" r="2.4" />
    <path d="M14 8.5 L15 14" />
    <path d="M14 10.5 L19.5 10" />
    <path d="M15 14 L21 15.5 L19.5 22" />
    <path d="M19.5 22 L22.5 22" />
    <path d="M4 26.5 H28" strokeOpacity="0.45" />
  </svg>
);

/** side-view stick figure: forearm plank */
export const PlankIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="6.5" cy="14.5" r="2.4" />
    <path d="M8.8 15.8 L20 17 L27 18.5" />
    <path d="M11.5 16 L11 22 M11 22 L14.5 22" />
    <path d="M27 18.5 L28 22.5" />
    <path d="M4 25.5 H28" strokeOpacity="0.45" />
  </svg>
);

/** radar / auto-detect */
export const AutoIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="16" cy="16" r="3" />
    <path d="M16 4 A12 12 0 0 1 28 16" strokeOpacity="0.9" />
    <path d="M28 16 A12 12 0 0 1 16 28" strokeOpacity="0.55" />
    <path d="M16 28 A12 12 0 0 1 4 16" strokeOpacity="0.35" />
    <path d="M16 8.5 A7.5 7.5 0 0 1 23.5 16" />
  </svg>
);

export const CameraIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="3.5" y="8" width="18" height="15" rx="2" />
    <path d="M21.5 13.5 L28.5 9.5 V21.5 L21.5 17.5" />
  </svg>
);

export const StopIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="16" cy="16" r="12" />
    <rect x="11.5" y="11.5" width="9" height="9" fill="currentColor" stroke="none" />
  </svg>
);

export const TargetIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="16" cy="16" r="11" />
    <circle cx="16" cy="16" r="5.5" strokeOpacity="0.6" />
    <circle cx="16" cy="16" r="1.6" fill="currentColor" stroke="none" />
  </svg>
);

export const BoltIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M17.5 3.5 L7.5 17.5 H14.5 L13 28.5 L24.5 13.5 H16.5 Z" />
  </svg>
);

export const FlameIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M16 3.5 C16 3.5 22.5 9 22.5 16.5 A6.5 6.5 0 0 1 9.5 16.5 C9.5 13 11.5 10.5 13 8.5 C13.5 11 14.8 12 16 12.5 C15.5 9 16 6 16 3.5 Z" />
  </svg>
);

export const ClockIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="16" cy="16" r="12" />
    <path d="M16 9 V16 L21 19" />
  </svg>
);

export const AngleIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M6 26 L14 6 L22 26" />
    <path d="M9.5 18.5 A8 8 0 0 0 18.5 18.5" strokeOpacity="0.65" />
  </svg>
);

export const ResetIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M26.5 16 A10.5 10.5 0 1 1 22 7.5" />
    <path d="M22.5 3.5 L22.5 8.5 L17.5 8.5" />
  </svg>
);

export const CheckIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M5 17 L13 25 L27 8" />
  </svg>
);

export const AlertIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M16 4 L29 27 H3 Z" />
    <path d="M16 13 V20" />
    <circle cx="16" cy="23.5" r="0.6" fill="currentColor" />
  </svg>
);

export const PulseIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M2.5 16 H9 L12.5 7 L18 25 L21.5 16 H29.5" />
  </svg>
);

export const EyeIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M2.5 16 C7 8.5 25 8.5 29.5 16 C25 23.5 7 23.5 2.5 16 Z" />
    <circle cx="16" cy="16" r="4" />
  </svg>
);

/** KINETIQ wordmark mark: skeleton joint + beam */
export const Mark = ({ size, ...p }: P) => (
  <svg width={size ?? 26} height={size ?? 26} viewBox="0 0 32 32" fill="none" {...p}>
    <path d="M6 26 L16 6 L26 26" stroke="#c6f235" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M10.4 17.2 H21.6" stroke="#5fe0f7" strokeWidth="2" strokeLinecap="round" />
    <circle cx="16" cy="6" r="3" fill="#0b0e11" stroke="#e9efea" strokeWidth="2" />
    <circle cx="6" cy="26" r="3" fill="#0b0e11" stroke="#c6f235" strokeWidth="2" />
    <circle cx="26" cy="26" r="3" fill="#0b0e11" stroke="#5fe0f7" strokeWidth="2" />
  </svg>
);
