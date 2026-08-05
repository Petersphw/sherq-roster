"use client";

export function SASLogo({ size = "md", className = "" }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const dims = size === "sm" ? "w-10 h-10" : size === "lg" ? "w-20 h-20" : "w-12 h-12";
  const textSize = size === "sm" ? "text-[6px]" : size === "lg" ? "text-sm" : "text-[9px]";
  const subSize = size === "sm" ? "text-[3px]" : size === "lg" ? "text-[6px]" : "text-[4px]";

  return (
    <div className={`${dims} ${className} rounded-2xl relative overflow-hidden group`}>
      {/* Premium gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1A4687] via-[#225CB2] to-[#0a1628] opacity-90" />
      {/* Glass shine */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent" />
      {/* Animated glow ring */}
      <div className="absolute inset-0 rounded-2xl anim-glow" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full">
        {/* Anchor icon */}
        <svg
          className={`${size === "sm" ? "w-3.5 h-3.5" : size === "lg" ? "w-8 h-8" : "w-4.5 h-4.5"} text-[#6EC1E4] drop-shadow-[0_0_6px_rgba(110,193,228,0.5)]`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="5" r="2.5" />
          <line x1="12" y1="7.5" x2="12" y2="21" />
          <path d="M5 12H2a10 10 0 0020 0h-3" />
          <line x1="12" y1="16" x2="8" y2="12" />
          <line x1="12" y1="16" x2="16" y2="12" />
        </svg>
        {/* Text */}
        <span className={`font-black tracking-[0.2em] text-white leading-none mt-0.5 drop-shadow-lg ${textSize}`}>
          SAS
        </span>
        {size !== "sm" && (
          <span className={`text-[#6EC1E4]/80 font-semibold tracking-[0.15em] leading-none mt-px ${subSize}`}>
            SHIPYARDS
          </span>
        )}
      </div>

      {/* Decorative wave */}
      <svg
        className="absolute bottom-0 left-0 right-0 opacity-15"
        viewBox="0 0 60 8"
        fill="none"
        preserveAspectRatio="none"
        style={{ height: "20%" }}
      >
        <path d="M0 4 Q7 0 15 4 Q22 8 30 4 Q37 0 45 4 Q52 8 60 4 L60 8 L0 8 Z" fill="#6EC1E4" />
      </svg>
    </div>
  );
}

export function SASLogoText({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <SASLogo size="sm" />
    </div>
  );
}
