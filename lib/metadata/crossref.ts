import "server-only";
import type { NormalizedCitationData } from "@/lib/citations/types";
import { CrossrefProvider } from "@/lib/metadata/providers/crossref-provider";

const provider = new CrossrefProvider();

export type CrossrefEnrichmentResult = {
  data: NormalizedCitationData | null;
  attempted: boolean;
  succeeded: boolean;
  cacheHit: boolean;
  failureReason?: string;
};

export async function enrichDoiWithCrossref(rawDoi?: string) {
  return (await enrichDoiWithCrossrefDetailed(rawDoi)).data;
}

export async function enrichDoiWithCrossrefDetailed(rawDoi?: string): Promise<CrossrefEnrichmentResult> {
  if (!provider.supports({ doi: rawDoi }))
    return { data: null, attempted: false, succeeded: false, cacheHit: false };
  const result = await provider.enrich({ doi: rawDoi });
  return {
    data: result.candidate?.data ?? null,
    attempted: true,
    succeeded: result.status === "SUCCESS",
    cacheHit: result.cacheHit,
    failureReason: result.failureReason,
  };
}

export function clearCrossrefCache() {
  provider.clearCache();
}
