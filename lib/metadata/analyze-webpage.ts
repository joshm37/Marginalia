import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_HTML_BYTES = 1_000_000;

function isPrivateAddress(address: string) {
  if (address === "::1" || address === "0.0.0.0") return true;
  if (address.startsWith("10.") || address.startsWith("127.")) return true;
  if (address.startsWith("192.168.") || address.startsWith("169.254."))
    return true;
  const match = address.match(/^172\.(\d+)\./);
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return true;
  const normalized = address.toLowerCase();
  return (
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

async function validatePublicUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Only HTTP and HTTPS links can be analyzed");
  if (url.username || url.password)
    throw new Error("Links containing credentials cannot be analyzed");
  const addresses = isIP(url.hostname)
    ? [{ address: url.hostname }]
    : await lookup(url.hostname, { all: true });
  if (
    !addresses.length ||
    addresses.some(({ address }) => isPrivateAddress(address))
  )
    throw new Error("Private or local network links cannot be analyzed");
  return url;
}

async function fetchHtml(rawUrl: string) {
  let url = await validatePublicUrl(rawUrl);
  for (let redirect = 0; redirect < 5; redirect += 1) {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Marginalia Citation Manager/1.0",
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location)
        throw new Error("The website returned an invalid redirect");
      url = await validatePublicUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok)
      throw new Error(`The website returned ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml")
    )
      throw new Error("This link does not point to an HTML webpage");
    const reader = response.body?.getReader();
    if (!reader) return { html: "", finalUrl: url.toString() };
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_HTML_BYTES) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(
      chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0),
    );
    let offset = 0;
    chunks.forEach((chunk) => {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    });
    return { html: new TextDecoder().decode(bytes), finalUrl: url.toString() };
  }
  throw new Error("The website redirected too many times");
}

function decode(value = "") {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function metadata(html: string) {
  const values = new Map<string, string[]>();
  for (const match of html.matchAll(/<meta\s+[^>]*>/gi)) {
    const tag = match[0];
    const name = tag
      .match(/(?:name|property)\s*=\s*["']([^"']+)["']/i)?.[1]
      ?.toLowerCase();
    const content = tag.match(/content\s*=\s*["']([^"']*)["']/i)?.[1];
    if (name && content)
      values.set(name, [...(values.get(name) ?? []), decode(content)]);
  }
  return {
    first: (...names: string[]) =>
      names.flatMap((name) => values.get(name.toLowerCase()) ?? [])[0] ?? "",
    all: (...names: string[]) =>
      names.flatMap((name) => values.get(name.toLowerCase()) ?? []),
  };
}

function jsonLd(html: string) {
  const candidates: Record<string, unknown>[] = [];
  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const parsed = JSON.parse(match[1]);
      const roots = Array.isArray(parsed) ? parsed : [parsed];
      for (const root of roots) {
        const graph = root?.["@graph"];
        candidates.push(...(Array.isArray(graph) ? graph : [root]));
      }
    } catch {}
  }
  return (
    candidates.find((item) =>
      /Article|Report|NewsArticle|ScholarlyArticle|WebPage|Book/.test(
        String(item?.["@type"] ?? ""),
      ),
    ) ?? {}
  );
}

function normalizeDate(raw: unknown) {
  if (!raw) return "";
  const parsed = new Date(String(raw));
  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toISOString().slice(0, 10);
}

export async function analyzeWebpage(rawUrl: string) {
  const { html, finalUrl } = await fetchHtml(rawUrl);
  const meta = metadata(html);
  const structured = jsonLd(html);
  const authorValue = structured.author;
  const structuredAuthors = (
    Array.isArray(authorValue) ? authorValue : [authorValue]
  )
    .map((author) =>
      typeof author === "object" && author
        ? (author as { name?: string }).name
        : author,
    )
    .filter(Boolean)
    .map(String);
  const authors = [
    ...new Set(
      [
        ...meta.all("citation_author", "dc.creator"),
        ...structuredAuthors,
        ...meta.first("author").split(/;|\s+and\s+/i),
      ]
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
  const canonicalRaw = html.match(
    /<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]+href=["']([^"']+)["']/i,
  )?.[1];
  const canonicalUrl = canonicalRaw
    ? new URL(canonicalRaw, finalUrl).toString()
    : finalUrl;
  const title =
    meta.first("citation_title", "og:title", "twitter:title") ||
    String(structured.headline ?? structured.name ?? "") ||
    decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const publisher = structured.publisher;
  const organization =
    (typeof publisher === "object" && publisher
      ? String((publisher as { name?: string }).name ?? "")
      : "") || meta.first("citation_publisher", "og:site_name", "dc.publisher");
  const date = normalizeDate(
    structured.datePublished ||
      meta.first(
        "citation_publication_date",
        "citation_date",
        "article:published_time",
        "dc.date",
        "date",
      ),
  );
  const structuredType = String(structured["@type"] ?? "");
  const type = /Report/i.test(structuredType)
    ? "Report"
    : /Book/i.test(structuredType)
      ? "Book"
      : /Article|NewsArticle|ScholarlyArticle/i.test(structuredType)
        ? "Article"
        : "Website";
  return {
    title,
    authors,
    organization,
    date,
    url: canonicalUrl,
    type,
    description:
      meta.first("description", "og:description", "twitter:description") ||
      String(structured.description ?? ""),
  };
}
