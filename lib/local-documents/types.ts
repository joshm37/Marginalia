import type { MetadataProvenance } from "@/lib/metadata/types";

export type LocalDocumentPhase =
  | "selecting"
  | "hashing"
  | "checking-duplicate"
  | "extracting"
  | "enriching"
  | "ready"
  | "saved"
  | "relinked"
  | "mismatch"
  | "error";

export type LocalPdfMetadata = {
  title: string;
  authors: string[];
  subject?: string;
  keywords: string[];
  creationDate?: string;
  pageCount: number;
  doi?: string;
  isbn?: string;
  provenance: MetadataProvenance;
};

export type LocalFileIdentity = {
  sha256: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  lastModified?: string;
};

export type LocalFileSelection = {
  file: File;
  handle?: FileSystemFileHandle;
};
