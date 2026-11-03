import { z } from "zod";
import { noCardNumberRefinement } from "./auth.js";
import { CategoryName } from "./recommendations.js";

export const MIN_STORE_SEARCH_LENGTH = 1;
export const MAX_STORE_SEARCH_LENGTH = 100;
export const MAX_STORE_SEARCH_RESULTS = 10;

export const storeSearchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(
      MIN_STORE_SEARCH_LENGTH,
      "Enter a store name between 1 and 100 characters.",
    )
    .max(
      MAX_STORE_SEARCH_LENGTH,
      "Enter a store name between 1 and 100 characters.",
    )
    .refine(
      noCardNumberRefinement,
      "Don't enter card numbers. SwipeWise only needs the card name.",
    ),
});

export type StoreSearchQuery = z.infer<typeof storeSearchQuerySchema>;

export interface StoreSearchResult {
  id: string;
  name: string;
  category: CategoryName;
  aliases: string[];
}

export interface StoreSearchResponse {
  stores: StoreSearchResult[];
}
