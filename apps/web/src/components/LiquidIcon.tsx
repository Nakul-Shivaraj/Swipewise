import React from "react";
import { CategoryName } from "@swipewise/shared";
import { ShoppingCart, Utensils, Fuel, Plane } from "lucide-react";

export interface LiquidIconProps {
  category: CategoryName;
  size?: "home" | "widget" | "row";
  selected?: boolean;
}

const CATEGORY_BG_CLASS: Record<CategoryName, string> = {
  GROCERIES: "bg-cat-groceries",
  DINING: "bg-cat-dining",
  GAS: "bg-cat-gas",
  TRAVEL: "bg-cat-travel",
};

const SIZE_CLASSES: Record<
  "home" | "widget" | "row",
  { box: string; icon: string }
> = {
  home: {
    box: "w-[52px] h-[52px] rounded-[16px]",
    icon: "w-6 h-6",
  },
  widget: {
    box: "w-[40px] h-[40px] rounded-[12px]",
    icon: "w-5 h-5",
  },
  row: {
    box: "w-[30px] h-[30px] rounded-[9px]",
    icon: "w-4 h-4",
  },
};

export function LiquidIcon({
  category,
  size = "home",
  selected = false,
}: LiquidIconProps) {
  const bgClass = CATEGORY_BG_CLASS[category];
  const sizeSpec = SIZE_CLASSES[size];

  const renderGlyph = () => {
    switch (category) {
      case "GROCERIES":
        return (
          <ShoppingCart
            className={`${sizeSpec.icon} text-on-primary`}
            aria-hidden="true"
          />
        );
      case "DINING":
        return (
          <Utensils
            className={`${sizeSpec.icon} text-on-primary`}
            aria-hidden="true"
          />
        );
      case "GAS":
        return (
          <Fuel
            className={`${sizeSpec.icon} text-on-primary`}
            aria-hidden="true"
          />
        );
      case "TRAVEL":
        return (
          <Plane
            className={`${sizeSpec.icon} text-on-primary`}
            aria-hidden="true"
          />
        );
    }
  };

  return (
    <div
      className={`relative ${sizeSpec.box} ${bgClass} flex items-center justify-center shadow-sm overflow-hidden transition-transform ${
        selected
          ? "ring-3 ring-glass shadow-md scale-[1.03]"
          : "ring-1 ring-glass/40"
      }`}
    >
      {/* Top 45% glossy liquid shine */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[45%] bg-gradient-to-b from-glass/45 to-transparent"
      />
      <div className="relative z-10">{renderGlyph()}</div>
    </div>
  );
}
