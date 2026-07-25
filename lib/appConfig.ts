import { APP_NAME } from "@/lib/constants.ts";

export function getAppName(): string {
  return Deno.env.get("APP_NAME")?.trim() || APP_NAME;
}

export {
  APP_DESCRIPTION,
  APP_NAME,
  APP_TAGLINE,
  APP_VERSION,
  AUTHOR,
  DEFAULT_TIMEZONE,
  LINKS,
  MONITOR,
  SUPPORT,
  THEME,
} from "@/lib/constants.ts";
