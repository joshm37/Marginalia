const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export async function sha256File(file: Blob): Promise<string> {
  if (!globalThis.crypto?.subtle)
    throw new Error("This browser cannot securely identify local files.");
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function isSha256(value: string) {
  return SHA256_PATTERN.test(value);
}

export async function matchesFileHash(file: Blob, expectedSha256: string) {
  return (await sha256File(file)) === expectedSha256.toLowerCase();
}
