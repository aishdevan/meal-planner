/** Best-effort Open Graph metadata fetch. Instagram blocks anonymous
 *  scraping for many posts, so failures are expected and non-fatal —
 *  the pasted-caption fallback covers those. */
export type OgData = {
  title: string | null;
  description: string | null;
  image: string | null;
};

function metaContent(html: string, property: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1]);
  }
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export async function fetchOgData(url: string): Promise<OgData> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        Accept: "text/html",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { title: null, description: null, image: null };
    const html = (await res.text()).slice(0, 500_000);
    return {
      title:
        metaContent(html, "og:title") ??
        html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ??
        null,
      description:
        metaContent(html, "og:description") ??
        metaContent(html, "description"),
      image: metaContent(html, "og:image"),
    };
  } catch {
    return { title: null, description: null, image: null };
  }
}
