export const PUBLIC_OPENAPI_SPEC = {
  openapi: "3.0.3",
  info: {
    title: "SwipeWise Public Card API",
    version: "1.0.0",
    description:
      "Public, read-only endpoints for SwipeWise catalog cards, best-card category recommendations, and store lookup. Never returns or touches user data.",
  },
  servers: [
    {
      url: "/",
      description: "SwipeWise API server",
    },
  ],
  paths: {
    "/api/v1/public/cards": {
      get: {
        operationId: "listPublicCatalogCards",
        summary: "List all active catalog credit cards",
        description:
          "Returns all non-retired catalog cards with their rewards programs, static category reward rules, and rotating bonus categories.",
        responses: {
          "200": {
            description: "Catalog cards list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["cards"],
                  properties: {
                    cards: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/CatalogCard",
                      },
                    },
                  },
                },
              },
            },
          },
          "400": {
            $ref: "#/components/responses/ValidationError",
          },
          "429": {
            $ref: "#/components/responses/RateLimitExceeded",
          },
        },
      },
    },
    "/api/v1/public/recommendations": {
      get: {
        operationId: "getPublicRecommendations",
        summary: "Rank catalog cards for a purchase category",
        description:
          "Ranks all non-retired catalog cards for a category and integer purchase amount in cents. Rotating categories with no user activation rank at the card's base rate with an activation note using the current UTC quarter.",
        parameters: [
          {
            name: "category",
            in: "query",
            required: true,
            description: "Purchase category",
            schema: {
              $ref: "#/components/schemas/CategoryName",
            },
          },
          {
            name: "amountCents",
            in: "query",
            required: false,
            description:
              "Purchase amount in integer cents (defaults to 10000 = $100.00)",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 100000000,
              default: 10000,
            },
          },
        ],
        responses: {
          "200": {
            description: "Ranked catalog cards and best card for the category",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: [
                    "category",
                    "amountCents",
                    "bestCard",
                    "rankedCards",
                  ],
                  properties: {
                    category: {
                      $ref: "#/components/schemas/CategoryName",
                    },
                    amountCents: {
                      type: "integer",
                      example: 10000,
                    },
                    bestCard: {
                      nullable: true,
                      allOf: [
                        {
                          $ref: "#/components/schemas/PublicRankedCard",
                        },
                      ],
                    },
                    rankedCards: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/PublicRankedCard",
                      },
                    },
                  },
                },
              },
            },
          },
          "400": {
            $ref: "#/components/responses/ValidationError",
          },
          "429": {
            $ref: "#/components/responses/RateLimitExceeded",
          },
        },
      },
    },
    "/api/v1/public/stores/search": {
      get: {
        operationId: "searchPublicStores",
        summary: "Search stores and map them to a spend category",
        description:
          "Searches store names and aliases case-insensitively and returns up to 10 matching stores in alphabetical order.",
        parameters: [
          {
            name: "q",
            in: "query",
            required: true,
            description: "Store name or alias search query (1 to 100 chars)",
            schema: {
              type: "string",
              minLength: 1,
              maxLength: 100,
            },
          },
        ],
        responses: {
          "200": {
            description: "Matching stores",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["stores"],
                  properties: {
                    stores: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/StoreSearchResult",
                      },
                    },
                  },
                },
              },
            },
          },
          "400": {
            $ref: "#/components/responses/ValidationError",
          },
          "429": {
            $ref: "#/components/responses/RateLimitExceeded",
          },
        },
      },
    },
    "/api/v1/public/openapi.json": {
      get: {
        operationId: "getPublicOpenApiSpec",
        summary: "Get the OpenAPI 3.0 specification for the public API",
        description:
          "Returns the OpenAPI 3.0 JSON specification documenting all /api/v1/public endpoints.",
        responses: {
          "200": {
            description: "OpenAPI 3.0 JSON specification",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["openapi", "info", "paths"],
                  properties: {
                    openapi: {
                      type: "string",
                      example: "3.0.3",
                    },
                    info: {
                      type: "object",
                    },
                    paths: {
                      type: "object",
                    },
                  },
                },
              },
            },
          },
          "400": {
            $ref: "#/components/responses/ValidationError",
          },
          "429": {
            $ref: "#/components/responses/RateLimitExceeded",
          },
        },
      },
    },
  },
  components: {
    schemas: {
      CategoryName: {
        type: "string",
        enum: ["GROCERIES", "DINING", "GAS", "TRAVEL"],
      },
      CatalogRate: {
        type: "object",
        required: ["category", "rateX100", "capCents"],
        properties: {
          category: {
            $ref: "#/components/schemas/CategoryName",
          },
          rateX100: {
            type: "integer",
            example: 400,
          },
          capCents: {
            type: "integer",
            nullable: true,
            example: null,
          },
        },
      },
      RotatingCategoryRate: {
        type: "object",
        required: ["quarter", "category", "rateX100", "capCents"],
        properties: {
          quarter: {
            type: "string",
            example: "2026-Q4",
          },
          category: {
            $ref: "#/components/schemas/CategoryName",
          },
          rateX100: {
            type: "integer",
            example: 500,
          },
          capCents: {
            type: "integer",
            nullable: true,
            example: 150000,
          },
        },
      },
      CatalogCard: {
        type: "object",
        required: [
          "id",
          "name",
          "issuer",
          "artColor",
          "isDemo",
          "annualFeeCents",
          "baseRateX100",
          "program",
          "rates",
        ],
        properties: {
          id: {
            type: "string",
            format: "uuid",
          },
          name: {
            type: "string",
            example: "Mint Everyday",
          },
          issuer: {
            type: "string",
            example: "Demo Bank",
          },
          artColor: {
            type: "string",
            example: "#2F8C55",
          },
          isDemo: {
            type: "boolean",
            example: true,
          },
          annualFeeCents: {
            type: "integer",
            example: 0,
          },
          baseRateX100: {
            type: "integer",
            example: 150,
          },
          program: {
            type: "object",
            required: ["name", "centsPer100Points"],
            properties: {
              name: {
                type: "string",
                example: "Meadow Rewards",
              },
              centsPer100Points: {
                type: "integer",
                example: 100,
              },
            },
          },
          rates: {
            type: "array",
            items: {
              $ref: "#/components/schemas/CatalogRate",
            },
          },
          rotatingCategories: {
            type: "array",
            items: {
              $ref: "#/components/schemas/RotatingCategoryRate",
            },
          },
        },
      },
      PublicRankedCard: {
        type: "object",
        required: [
          "cardId",
          "name",
          "issuer",
          "artColor",
          "isDemo",
          "annualFeeCents",
          "programName",
          "centsPer100Points",
          "appliedRateX100",
          "baseRateX100",
          "usedBaseRate",
          "capCents",
          "isCapExceeded",
          "rewardCents",
          "activationNote",
          "rank",
          "isBestPick",
        ],
        properties: {
          cardId: {
            type: "string",
            format: "uuid",
          },
          name: {
            type: "string",
            example: "Mint Everyday",
          },
          issuer: {
            type: "string",
            example: "Demo Bank",
          },
          artColor: {
            type: "string",
            example: "#2F8C55",
          },
          isDemo: {
            type: "boolean",
            example: true,
          },
          annualFeeCents: {
            type: "integer",
            example: 0,
          },
          programName: {
            type: "string",
            example: "Meadow Rewards",
          },
          centsPer100Points: {
            type: "integer",
            example: 100,
          },
          appliedRateX100: {
            type: "integer",
            example: 400,
          },
          baseRateX100: {
            type: "integer",
            example: 150,
          },
          usedBaseRate: {
            type: "boolean",
            example: false,
          },
          capCents: {
            type: "integer",
            nullable: true,
            example: null,
          },
          isCapExceeded: {
            type: "boolean",
            example: false,
          },
          rewardCents: {
            type: "integer",
            example: 400,
          },
          activationNote: {
            type: "string",
            nullable: true,
            example: null,
          },
          rank: {
            type: "integer",
            example: 1,
          },
          isBestPick: {
            type: "boolean",
            example: true,
          },
        },
      },
      StoreSearchResult: {
        type: "object",
        required: ["id", "name", "category", "aliases"],
        properties: {
          id: {
            type: "string",
            format: "uuid",
          },
          name: {
            type: "string",
            example: "Safeway",
          },
          category: {
            $ref: "#/components/schemas/CategoryName",
          },
          aliases: {
            type: "array",
            items: {
              type: "string",
            },
          },
        },
      },
      ErrorResponse: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: {
                type: "string",
              },
              message: {
                type: "string",
              },
            },
          },
        },
      },
    },
    responses: {
      ValidationError: {
        description: "Invalid query parameters or card-number input rejected",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ErrorResponse",
            },
          },
        },
      },
      RateLimitExceeded: {
        description: "Public rate limit exceeded",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ErrorResponse",
            },
          },
        },
      },
    },
  },
} as const;
