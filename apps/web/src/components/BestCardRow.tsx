import React from "react";
import { CategoryName, RankedCardResult, formatCents } from "@swipewise/shared";
import { CardArt } from "./CardArt.js";

export interface BestCardRowProps {
  card: RankedCardResult;
  category: CategoryName;
}

const CATEGORY_LABEL_LOWER: Record<CategoryName, string> = {
  GROCERIES: "groceries",
  DINING: "dining",
  GAS: "gas",
  TRAVEL: "travel",
};

export function formatCardRateLabel(
  card: RankedCardResult,
  category: CategoryName,
): string {
  const isCashBack = card.programName.toLowerCase() === "cash back";
  const rateNumber = card.appliedRateX100 / 100;
  const rateStr = Number.isInteger(rateNumber)
    ? String(rateNumber)
    : rateNumber.toFixed(2).replace(/0$/, "");

  const unit = isCashBack ? `${rateStr}%` : `${rateStr}x points`;
  if (card.usedBaseRate) {
    return isCashBack ? `${unit} on everything` : `${unit} base rate`;
  }

  const catName = CATEGORY_LABEL_LOWER[category];
  if (card.isCapExceeded && card.capCents !== null) {
    const baseNum = card.baseRateX100 / 100;
    const baseStr = Number.isInteger(baseNum)
      ? String(baseNum)
      : baseNum.toFixed(2).replace(/0$/, "");
    const baseUnit = isCashBack ? `${baseStr}%` : `${baseStr}x`;
    return `${unit} up to ${formatCents(card.capCents)}, then ${baseUnit}`;
  }

  return `${unit} ${catName}`;
}

export function BestCardRow({ card, category }: BestCardRowProps) {
  const rateDescription = formatCardRateLabel(card, category);

  return (
    <div
      data-testid={`ranked-card-${card.rank}`}
      className={`flex items-center justify-between gap-3 transition-colors ${
        card.isBestPick
          ? "bg-primary-tint/90 border border-primary/40 rounded-[16px] p-[10px] shadow-xs"
          : "px-[10px] py-2.5 rounded-[16px]"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <CardArt
          name={card.name}
          artColor={card.artColor}
          variant="thumbnail"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[15px] text-ink truncate">
              {card.name}
            </span>
            {card.isDemo && (
              <span className="px-2 py-0.5 rounded-full bg-glass/80 border border-ink-muted/20 text-[11px] font-medium text-primary leading-tight">
                Demo
              </span>
            )}
          </div>
          <div
            className={`text-[13px] leading-snug ${
              card.isBestPick ? "text-primary font-semibold" : "text-ink-muted"
            }`}
          >
            {card.isBestPick
              ? `Best pick, ${rateDescription}`
              : rateDescription}
          </div>
          {card.activationNote && (
            <div className="text-[12px] font-medium text-primary mt-0.5">
              {card.activationNote}
            </div>
          )}
        </div>
      </div>

      <div className="text-right shrink-0">
        <span
          className={`tabular-nums font-semibold ${
            card.isBestPick
              ? "text-[20px] text-ink font-bold"
              : "text-[16px] text-ink"
          }`}
        >
          {formatCents(card.rewardCents)}
        </span>
      </div>
    </div>
  );
}
