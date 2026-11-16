export function generateOpenApiSpec(): Record<string, unknown> {
  return {
    openapi: "3.0.3",
    info: { title: "SwipeWise API", version: "1.0.0" },
    paths: {},
  };
}
