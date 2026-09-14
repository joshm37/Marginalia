export type CitationOutput = { text: string; html: string };

export function normalizeCitationText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeCitationHtml(value: string) {
  return value
    .replace(/<\/?div[^>]*>/gi, "")
    .replace(/<span class="csl-left-margin">/gi, "<span>")
    .replace(/<span class="csl-right-inline">/gi, "<span>")
    .replace(/>\s+</g, "><")
    .trim();
}

export function hangingPlainText(value: string, width = 88, indent = "    ") {
  const words = normalizeCitationText(value).split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const prefix = lines.length ? indent : "";
    if (line && prefix.length + line.length + word.length + 1 > width) {
      lines.push(`${prefix}${line}`);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(`${lines.length ? indent : ""}${line}`);
  return lines.join("\n");
}

export function hangingRichTextHtml(value: string) {
  return `<p style="margin:0 0 12pt 0;padding-left:36pt;text-indent:-36pt">${normalizeCitationHtml(value)}</p>`;
}

export async function copyCitationRichText(output: CitationOutput) {
  const text = normalizeCitationText(output.text);
  const html = hangingRichTextHtml(output.html);
  if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/plain": new Blob([text], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" }),
      }),
    ]);
  } else await navigator.clipboard.writeText(text);
}
