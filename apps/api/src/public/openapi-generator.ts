import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  CATEGORIES,
  DEFAULT_PURCHASE_AMOUNT_CENTS,
  MIN_PURCHASE_AMOUNT_CENTS,
  MAX_PURCHASE_AMOUNT_CENTS,
} from "@swipewise/shared";

extendZodWithOpenApi(z);

export function buildOpenApiRegistry(): OpenAPIRegistry {
  const registry = new OpenAPIRegistry();

  const CategoryNameSchema = registry.register(
    "CategoryName",
    z.enum(CATEGORIES).openapi({
      description: "Allowed purchase categories in SwipeWise",
      example: "GROCERIES",
    }),
  );

  const CatalogRateSchema = registry.register(
    "CatalogRate",
    z.object({
      category: CategoryNameSchema,
      rateX100: z.number().int().positive().openapi({ example: 400 }),
      capCents: z
        .number()
        .int()
        .positive()
        .nullable()
        .optional()
        .openapi({ example: null }),
    }),
  );

  const RotatingCategoryRateSchema = registry.register(
    "RotatingCategoryRate",
    z.object({
      quarter: z
        .string()
        .regex(/^\d{4}-Q[1-4]$/)
        .openapi({ example: "2026-Q4" }),
      category: CategoryNameSchema,
      rateX100: z.number().int().positive().openapi({ example: 500 }),
      capCents: z
        .number()
        .int()
        .positive()
        .nullable()
        .optional()
        .openapi({ example: 150000 }),
    }),
  );

  const RewardsProgramSchema = registry.register(
    "RewardsProgram",
    z.object({
      name: z.string().min(1).openapi({ example: "Meadow Rewards" }),
      centsPer100Points: z.number().int().positive().openapi({ example: 100 }),
    }),
  );

  const CatalogCardSchema = registry.register(
    "CatalogCard",
    z.object({
      id: z
        .string()
        .uuid()
        .openapi({ example: "00000000-0000-4000-8000-000000000001" }),
      name: z.string().min(1).openapi({ example: "Mint Everyday" }),
      issuer: z.string().min(1).openapi({ example: "Demo Bank" }),
      artColor: z.string().min(1).openapi({ example: "#2F8C55" }),
      isDemo: z.boolean().openapi({ example: true }),
      annualFeeCents: z.number().int().nonnegative().openapi({ example: 0 }),
      baseRateX100: z.number().int().positive().openapi({ example: 150 }),
      program: RewardsProgramSchema,
      rates: z.array(CatalogRateSchema),
      rewardRules: z.array(CatalogRateSchema).optional(),
      rotatingCategories: z.array(RotatingCategoryRateSchema).optional(),
    }),
  );

  const PublicRankedCardSchema = registry.register(
    "PublicRankedCard",
    z.object({
      cardId: z.string().uuid(),
      name: z.string().openapi({ example: "Mint Everyday" }),
      issuer: z.string().openapi({ example: "Demo Bank" }),
      artColor: z.string().openapi({ example: "#2F8C55" }),
      isDemo: z.boolean().openapi({ example: true }),
      annualFeeCents: z.number().int().openapi({ example: 0 }),
      programName: z.string().openapi({ example: "Meadow Rewards" }),
      centsPer100Points: z.number().int().openapi({ example: 100 }),
      appliedRateX100: z.number().int().openapi({ example: 400 }),
      baseRateX100: z.number().int().openapi({ example: 150 }),
      usedBaseRate: z.boolean().openapi({ example: false }),
      capCents: z.number().int().nullable().openapi({ example: null }),
      isCapExceeded: z.boolean().openapi({ example: false }),
      rewardCents: z.number().int().openapi({ example: 400 }),
      activationNote: z.string().nullable().openapi({ example: null }),
      rank: z.number().int().openapi({ example: 1 }),
      isBestPick: z.boolean().openapi({ example: true }),
    }),
  );

  const StoreSearchResultSchema = registry.register(
    "StoreSearchResult",
    z.object({
      id: z.string().uuid(),
      name: z.string().openapi({ example: "Safeway" }),
      category: CategoryNameSchema,
      aliases: z
        .array(z.string())
        .openapi({ example: ["Safeway", "safeway.com"] }),
    }),
  );

  const ErrorResponseSchema = registry.register(
    "ErrorResponse",
    z.object({
      error: z.object({
        code: z.string().openapi({ example: "VALIDATION_ERROR" }),
        message: z.string().openapi({ example: "Invalid request parameters." }),
      }),
    }),
  );

  const ValidationErrorResponse = {
    description: "Validation error or Luhn card number rejected",
    content: {
      "application/json": {
        schema: ErrorResponseSchema,
      },
    },
  };

  const RateLimitErrorResponse = {
    description: "Rate limit exceeded",
    content: {
      "application/json": {
        schema: ErrorResponseSchema,
      },
    },
  };

  // Public Endpoints (#50)
  registry.registerPath({
    method: "get",
    path: "/api/public/v1/cards",
    summary: "List all active catalog cards",
    description:
      "Returns non-retired catalog cards with name, issuer, annual fee, base rate, and reward rules. Never returns user data.",
    responses: {
      200: {
        description: "List of catalog cards",
        content: {
          "application/json": {
            schema: z.object({
              cards: z.array(CatalogCardSchema),
            }),
          },
        },
      },
      400: ValidationErrorResponse,
      429: RateLimitErrorResponse,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/public/v1/categories",
    summary: "List all reward spend categories",
    description: "Returns the supported purchase categories.",
    responses: {
      200: {
        description: "List of categories",
        content: {
          "application/json": {
            schema: z.object({
              categories: z.array(CategoryNameSchema),
            }),
          },
        },
      },
      400: ValidationErrorResponse,
      429: RateLimitErrorResponse,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/public/v1/stores",
    summary: "Search stores and their category",
    description:
      "Finds matching stores by name or alias and returns their purchase category.",
    request: {
      query: z.object({
        query: z.string().min(1).max(100).optional().openapi({
          description: "Search query for store name or alias",
          example: "saf",
        }),
        q: z.string().min(1).max(100).optional().openapi({
          description: "Alternative query parameter alias",
          example: "saf",
        }),
      }),
    },
    responses: {
      200: {
        description: "Matching stores list",
        content: {
          "application/json": {
            schema: z.object({
              stores: z.array(StoreSearchResultSchema),
            }),
          },
        },
      },
      400: ValidationErrorResponse,
      429: RateLimitErrorResponse,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/public/v1/best-card",
    summary: "Rank catalog cards for a category",
    description:
      "Ranks catalog cards by reward value for a spend category and purchase amount. Optional cardIds filters the cards evaluated.",
    request: {
      query: z.object({
        category: CategoryNameSchema,
        amountCents: z
          .number()
          .int()
          .min(MIN_PURCHASE_AMOUNT_CENTS)
          .max(MAX_PURCHASE_AMOUNT_CENTS)
          .default(DEFAULT_PURCHASE_AMOUNT_CENTS)
          .optional()
          .openapi({
            description: "Purchase amount in integer cents",
            example: 10000,
          }),
        cardIds: z.string().optional().openapi({
          description:
            "Optional comma-separated list of catalog card IDs to rank",
          example: "00000000-0000-4000-8000-000000000001",
        }),
      }),
    },
    responses: {
      200: {
        description: "Ranked catalog cards and best recommendation pick",
        content: {
          "application/json": {
            schema: z.object({
              category: CategoryNameSchema,
              amountCents: z.number().int(),
              bestCard: PublicRankedCardSchema.nullable(),
              rankedCards: z.array(PublicRankedCardSchema),
            }),
          },
        },
      },
      400: ValidationErrorResponse,
      429: RateLimitErrorResponse,
    },
  });

  // Legacy /api/v1/public routes (#26)
  registry.registerPath({
    method: "get",
    path: "/api/v1/public/cards",
    summary: "List all active catalog cards (legacy path)",
    description: "Returns non-retired catalog cards with rewards and rates.",
    responses: {
      200: {
        description: "List of catalog cards",
        content: {
          "application/json": {
            schema: z.object({
              cards: z.array(CatalogCardSchema),
            }),
          },
        },
      },
      400: ValidationErrorResponse,
      429: RateLimitErrorResponse,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/public/recommendations",
    summary: "Rank catalog cards for a category (legacy path)",
    description: "Ranks non-retired catalog cards for a category.",
    request: {
      query: z.object({
        category: CategoryNameSchema,
        amountCents: z.number().int().optional(),
      }),
    },
    responses: {
      200: {
        description: "Ranked catalog cards",
        content: {
          "application/json": {
            schema: z.object({
              category: CategoryNameSchema,
              amountCents: z.number().int(),
              bestCard: PublicRankedCardSchema.nullable(),
              rankedCards: z.array(PublicRankedCardSchema),
            }),
          },
        },
      },
      400: ValidationErrorResponse,
      429: RateLimitErrorResponse,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/public/stores/search",
    summary: "Search stores (legacy path)",
    description: "Search stores and return matching stores.",
    request: {
      query: z.object({
        q: z.string().min(1).max(100),
      }),
    },
    responses: {
      200: {
        description: "Matching stores",
        content: {
          "application/json": {
            schema: z.object({
              stores: z.array(StoreSearchResultSchema),
            }),
          },
        },
      },
      400: ValidationErrorResponse,
      429: RateLimitErrorResponse,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/public/openapi.json",
    summary: "Public OpenAPI JSON specification (legacy path)",
    description: "Returns the OpenAPI specification.",
    responses: {
      200: {
        description: "OpenAPI specification document",
        content: {
          "application/json": {
            schema: z.any(),
          },
        },
      },
      400: ValidationErrorResponse,
      429: RateLimitErrorResponse,
    },
  });

  // Main /api/v1 routes
  registry.registerPath({
    method: "post",
    path: "/api/v1/auth/signup",
    summary: "Register new user account",
    description:
      "Creates an account with name, unique email, and argon2id password.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              name: z.string().min(1),
              email: z.string().email(),
              password: z.string().min(8),
              confirmPassword: z.string().min(8),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: "User registered successfully",
        content: {
          "application/json": {
            schema: z.object({
              user: z.object({
                id: z.string().uuid(),
                email: z.string().email(),
                name: z.string(),
              }),
            }),
          },
        },
      },
      400: ValidationErrorResponse,
      409: {
        description: "Email already registered",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
      429: RateLimitErrorResponse,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/v1/auth/login",
    summary: "User login",
    description: "Authenticates user and sets httpOnly JWT cookie.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              email: z.string().email(),
              password: z.string().min(1),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Logged in successfully",
        content: {
          "application/json": {
            schema: z.object({
              user: z.object({
                id: z.string().uuid(),
                email: z.string().email(),
                name: z.string(),
              }),
            }),
          },
        },
      },
      400: ValidationErrorResponse,
      401: {
        description: "Invalid credentials",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
      429: RateLimitErrorResponse,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/v1/auth/logout",
    summary: "User logout",
    description: "Clears httpOnly JWT cookie.",
    responses: {
      200: {
        description: "Logged out successfully",
        content: {
          "application/json": {
            schema: z.object({
              message: z.string(),
            }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/auth/me",
    summary: "Current authenticated user profile",
    description: "Returns the profile of the currently authenticated user.",
    responses: {
      200: {
        description: "Current user profile",
        content: {
          "application/json": {
            schema: z.object({
              user: z.object({
                id: z.string().uuid(),
                email: z.string().email(),
                name: z.string(),
                timeZone: z.string(),
              }),
            }),
          },
        },
      },
      401: {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/recommendations",
    summary: "Best card recommendation for authenticated user",
    description:
      "Ranks cards in the user wallet for a category and purchase amount.",
    request: {
      query: z.object({
        category: CategoryNameSchema,
        amountCents: z.number().int().optional(),
      }),
    },
    responses: {
      200: {
        description: "Ranked user wallet cards",
        content: {
          "application/json": {
            schema: z.object({
              category: CategoryNameSchema,
              amountCents: z.number().int(),
              isEmptyWallet: z.boolean(),
              rankedCards: z.array(z.any()),
            }),
          },
        },
      },
      401: { description: "Unauthorized" },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/stores/search",
    summary: "Store search with category mapping",
    description: "Searches store directory for category lookup.",
    request: {
      query: z.object({
        q: z.string().min(1),
      }),
    },
    responses: {
      200: {
        description: "Matching stores",
        content: {
          "application/json": {
            schema: z.object({
              stores: z.array(StoreSearchResultSchema),
            }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/catalog/cards",
    summary: "List catalog credit cards",
    description: "Returns catalog cards available to add to wallet.",
    responses: {
      200: {
        description: "Catalog cards",
        content: {
          "application/json": {
            schema: z.object({
              cards: z.array(CatalogCardSchema),
            }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/wallet/cards",
    summary: "List user wallet cards",
    description: "Returns all cards in the authenticated user's wallet.",
    responses: {
      200: {
        description: "Wallet cards list",
        content: {
          "application/json": {
            schema: z.object({
              walletCards: z.array(z.any()),
            }),
          },
        },
      },
      401: { description: "Unauthorized" },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/v1/wallet/cards",
    summary: "Add card to wallet",
    description: "Adds a catalog card to the user's wallet.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              cardId: z.string().uuid(),
              nickname: z.string().optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: { description: "Card added to wallet" },
      400: ValidationErrorResponse,
      401: { description: "Unauthorized" },
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/api/v1/wallet/cards/{id}",
    summary: "Update wallet card nickname",
    description: "Updates a wallet card's custom nickname.",
    request: {
      params: z.object({
        id: z.string().uuid(),
      }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              nickname: z.string().nullable().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: { description: "Wallet card updated" },
      401: { description: "Unauthorized" },
      404: { description: "Wallet card not found" },
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/v1/wallet/cards/{id}",
    summary: "Delete card from wallet",
    description: "Removes a card from the user's wallet.",
    request: {
      params: z.object({
        id: z.string().uuid(),
      }),
    },
    responses: {
      200: { description: "Card removed from wallet" },
      401: { description: "Unauthorized" },
      404: { description: "Wallet card not found" },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/perks",
    summary: "List user perks",
    description: "Returns recurring perks for cards in the user wallet.",
    responses: {
      200: { description: "Perks list" },
      401: { description: "Unauthorized" },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/bonus-offers",
    summary: "List user bonus spend offers",
    description: "Returns welcome bonus offers and progress tracking.",
    responses: {
      200: { description: "Bonus offers list" },
      401: { description: "Unauthorized" },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/points-balances",
    summary: "List reward points balances",
    description: "Returns program point balances and expiration dates.",
    responses: {
      200: { description: "Points balances" },
      401: { description: "Unauthorized" },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/notifications",
    summary: "List user in-app notifications",
    description: "Returns unread notifications and alerts.",
    responses: {
      200: { description: "Notifications list" },
      401: { description: "Unauthorized" },
    },
  });

  return registry;
}

export function generateOpenApiSpec(): Record<string, unknown> {
  const registry = buildOpenApiRegistry();
  const generator = new OpenApiGeneratorV3(registry.definitions);

  const document = generator.generateDocument({
    openapi: "3.0.3",
    info: {
      title: "SwipeWise API",
      version: "1.0.0",
      description:
        "SwipeWise OpenAPI documentation covering the public read-only API and authenticated wallet endpoints.",
    },
    servers: [
      {
        url: "/",
        description: "Current environment",
      },
    ],
  });

  return document as unknown as Record<string, unknown>;
}
