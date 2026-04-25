export function getAppName(): string {
  return Deno.env.get("APP_NAME")?.trim() || "Status";
}
