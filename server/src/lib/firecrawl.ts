import Firecrawl from "@mendable/firecrawl-js";
import { ValidationError } from "../types/app-error.js";

export async function scrapeWebsite(url: string) {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    throw new ValidationError("Firecrawl is not configured on the server");
  }

  const client = new Firecrawl({ apiKey });
  const result = await client.scrape(url, {
    formats: ["markdown"],
  });

  const markdown =
    typeof result.markdown === "string" ? result.markdown.trim() : "";

  if (!markdown) {
    throw new ValidationError("Could not extract content from this URL");
  }

  return {
    markdown,
    title:
      typeof result.metadata?.title === "string"
        ? result.metadata.title
        : undefined,
    sourceUrl:
      typeof result.metadata?.sourceURL === "string"
        ? result.metadata.sourceURL
        : url,
  };
}
