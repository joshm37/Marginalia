declare module "@citation-js/core" {
  export class Cite {
    constructor(data: unknown);
    format(kind: string, options?: Record<string, unknown>): unknown;
  }
  export const plugins: {
    config: {
      get(name: string): {
        styles: { add(name: string, style: string): void };
      };
    };
  };
}

declare module "@citation-js/plugin-csl";
