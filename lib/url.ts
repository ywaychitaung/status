/** URL helpers safe for client + server. */

export function withQuery(
  path: string,
  params: Record<string, string | null>,
): string {
  const url = new URL(path, "http://local");
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  const qs = url.searchParams.toString();
  return qs ? `${path}?${qs}` : path;
}
