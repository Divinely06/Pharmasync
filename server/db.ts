export const normalizeDatabaseUrl = (input: string) => {
  if (!input) return input;
  try {
    const url = new URL(input);
    if (url.searchParams.get("sslmode") === "require" && !url.searchParams.has("uselibpqcompat")) {
      url.searchParams.set("uselibpqcompat", "true");
      return url.toString();
    }
    return input;
  } catch {
    return input;
  }
};
