import { z } from "zod";
import { CategoryName } from "./recommendations.js";

export const MIN_STORE_SEARCH_LENGTH = 1;
export const MAX_STORE_SEARCH_LENGTH = 100;
export const MAX_STORE_SEARCH_RESULTS = 10;

// Stubbed for Red phase — implemented in Green phase
export const storeSearchQuerySchema = z.object({
  q: z.string(),
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
