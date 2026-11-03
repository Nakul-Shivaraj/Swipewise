import React from "react";

export interface CardArtProps {
  name: string;
  issuer?: string;
  artColor: string;
  isDemo?: boolean;
  rateBadgeText?: string;
  variant?: "full" | "thumbnail";
}

/**
 * Renders credit card art (1.586 aspect ratio, 14px corners for full size;
 * small rounded rectangle for table/list thumbnails). Never displays card numbers.
 */
export function CardArt({
  name,
  issuer,
  artColor,
  isDemo = false,
  rateBadgeText,
  variant = "full",
}: CardArtProps) {
  if (variant === "thumbnail") {
    return (
      <div
        style={{ backgroundColor: artColor }}
        className="relative w-12 h-8 rounded-[9px] shrink-0 overflow-hidden shadow-xs ring-1 ring-glass/50 flex items-end p-1.5"
        aria-hidden="true"
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-glass/15 to-glass/35" />
        <div className="w-2.5 h-2 rounded-[2px] bg-glass/60" />
      </div>
    );
  }

  return (
    <div
      style={{ backgroundColor: artColor }}
      className="relative w-full aspect-[1.586] rounded-[14px] p-5 text-on-primary shadow-md ring-1 ring-glass/40 overflow-hidden flex flex-col justify-between select-none"
    >
      {/* Diagonal shine */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-full rotate-12 bg-gradient-to-tr from-transparent via-glass/15 to-glass/30"
      />

      {/* Top row: Card name + Demo badge */}
      <div className="relative z-10 flex items-start justify-between gap-2">
        <span className="font-semibold text-[17px] leading-snug tracking-tight text-on-primary drop-shadow-xs">
          {name}
        </span>
        {isDemo && (
          <span className="px-2.5 py-0.5 rounded-full bg-glass/25 backdrop-blur-xs text-[11px] font-medium text-on-primary">
            Demo
          </span>
        )}
      </div>

      {/* Middle row: Subtle chip */}
      <div className="relative z-10 my-auto">
        <div
          aria-hidden="true"
          className="w-9 h-6 rounded-[6px] bg-glass/45 border border-glass/60 shadow-inner"
        />
      </div>

      {/* Bottom row: Issuer & rate badge */}
      <div className="relative z-10 flex items-center justify-between gap-2 text-[13px]">
        <span className="text-on-primary/85 font-medium">
          {issuer || "SwipeWise Wallet"}
        </span>
        {rateBadgeText && (
          <span className="font-semibold text-on-primary">{rateBadgeText}</span>
        )}
      </div>
    </div>
  );
}
