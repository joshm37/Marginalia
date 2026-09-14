declare module "@citestyle/styles/*" {
  export type FormattedEntry = { text: string; html: string };
  export function bibliography(item: Record<string, unknown>, context?: Record<string, unknown>): FormattedEntry;
  export function bibliographySort(a: Record<string, unknown>, b: Record<string, unknown>): number;
}
