import "server-only";
import { CrossrefProvider } from "./crossref-provider";
import { OpenAlexProvider } from "./openalex-provider";
import { OpenLibraryProvider } from "./open-library-provider";
import { PubMedProvider } from "./pubmed-provider";
import type { EnrichmentRun, IdentifierSet, MetadataEnrichmentProvider, MetadataProviderResult } from "./types";
import type { MetadataProvider } from "@/lib/metadata/types";

const defaults: MetadataEnrichmentProvider[] = [new CrossrefProvider(), new PubMedProvider(), new OpenLibraryProvider(), new OpenAlexProvider()];
function useful(result?: MetadataProviderResult) { const data = result?.candidate?.data; return Boolean(data?.title && data.authors.length && (data.containerTitle || data.publisher || data.issued)); }

export async function enrichMetadata(input: IdentifierSet, providers = defaults): Promise<EnrichmentRun> {
  const byId = new Map(providers.map((provider) => [provider.id, provider]));
  const primary = [input.doi && "CROSSREF", (input.pmid || input.pmcid) && "PUBMED", input.isbn?.length && "ISBN_PROVIDER"].filter(Boolean) as Array<"CROSSREF" | "PUBMED" | "ISBN_PROVIDER">;
  const selectedProviders: MetadataProvider[] = [...primary];
  const results = (await Promise.all(primary.map((id) => byId.get(id)?.enrich(input)))).filter((item): item is MetadataProviderResult => Boolean(item));
  const scholarlyPrimary = results.find((result) => result.provider === "CROSSREF" || result.provider === "PUBMED");
  const useOpenAlex = Boolean(input.openAlexId || ((input.doi || input.pmid || input.pmcid) && !useful(scholarlyPrimary)));
  const openAlex = byId.get("OPENALEX");
  if (useOpenAlex && openAlex?.supports(input)) { selectedProviders.push("OPENALEX"); results.push(await openAlex.enrich(input)); }
  return { selectedProviders, results, candidates: results.flatMap((result) => result.candidate ? [result.candidate] : []) };
}
export function clearProviderCaches(providers = defaults) { for (const provider of providers) provider.clearCache(); }
