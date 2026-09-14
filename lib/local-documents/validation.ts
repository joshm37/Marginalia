export const DEFAULT_MAX_LOCAL_PDF_BYTES = 512 * 1024 * 1024;

export function configuredMaxLocalPdfBytes() {
  const configured = Number(process.env.NEXT_PUBLIC_MAX_LOCAL_PDF_MB);
  return Number.isFinite(configured) && configured > 0
    ? configured * 1024 * 1024
    : DEFAULT_MAX_LOCAL_PDF_BYTES;
}

export function validateLocalPdf(
  file: Pick<File, "name" | "size" | "type">,
  maximumBytes = configuredMaxLocalPdfBytes(),
) {
  const isPdf =
    file.type.toLowerCase() === "application/pdf" ||
    (!file.type && file.name.toLowerCase().endsWith(".pdf"));
  if (!isPdf) throw new Error("Choose a PDF document to continue.");
  if (!file.size) throw new Error("This PDF is empty or unreadable.");
  if (file.size > maximumBytes)
    throw new Error(
      `This PDF is larger than the ${Math.round(maximumBytes / 1024 / 1024)} MB local-processing limit. The file was not uploaded.`,
    );
}
