import { StoreSearchResponse } from "@swipewise/shared";
import {
  StoreRepository,
  storeRepo as defaultStoreRepo,
} from "../repositories/store.repository.js";

export class StoreService {
  private repo: StoreRepository;

  constructor(repo: StoreRepository = defaultStoreRepo) {
    this.repo = repo;
  }

  async searchStores(query: string): Promise<StoreSearchResponse> {
    const stores = await this.repo.searchStores(query);
    return { stores };
  }
}

export const storeService = new StoreService();
