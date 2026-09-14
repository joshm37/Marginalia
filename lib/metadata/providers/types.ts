import type { NormalizedCitationData } from "@/lib/citations/types";
import type {
  MetadataConfidence,
  MetadataProvider,
} from "@/lib/metadata/types";

export type IdentifierSet = {
  doi?: string;
  pmid?: string;
  pmcid?: string;
  isbn?: string[];
  openAlexId?: string;
};

export type MetadataCandidate = {
  provider: MetadataProvider;
  confidence: MetadataConfidence;
  data: NormalizedCitationData;
  identifiers: IdentifierSet;
  providerMetadata?: Record<string, unknown>;
};

export type ProviderResultStatus =
  | "SUCCESS"
  | "NO_RECORD"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "MALFORMED"
  | "FAILED";

export type MetadataProviderResult = {
  provider: MetadataProvider;
  status: ProviderResultStatus;
  candidate: MetadataCandidate | null;
  cacheHit: boolean;
  failureReason?: string;
  retryAfter?: number;
};

export interface MetadataEnrichmentProvider {
  readonly id: MetadataProvider;
  supports(input: IdentifierSet): boolean;
  enrich(input: IdentifierSet): Promise<MetadataProviderResult>;
  clearCache(): void;
}

export type EnrichmentRun = {
  candidates: MetadataCandidate[];
  results: MetadataProviderResult[];
  selectedProviders: MetadataProvider[];
};
