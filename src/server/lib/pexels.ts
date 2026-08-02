/**
 * Pexels is used at seed time only — never on a request path. Catalog photos
 * are fetched once, re-hosted on Cloudinary, and the mapping is cached so
 * re-seeding does not spend API quota or depend on the service being up.
 */

export type SourcedPhoto = {
  url: string;
  photographer: string;
  photographerUrl: string;
  pexelsUrl: string;
  width: number;
  height: number;
};

const ENDPOINT = "https://api.pexels.com/v1/search";

export async function searchPhotos(
  query: string,
  count: number,
): Promise<SourcedPhoto[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error("PEXELS_API_KEY is not set");

  const url = `${ENDPOINT}?query=${encodeURIComponent(query)}&per_page=${count}&orientation=square&size=medium`;

  const res = await fetch(url, { headers: { Authorization: key } });
  if (!res.ok) {
    throw new Error(`Pexels ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const body = (await res.json()) as {
    photos: Array<{
      src: { large: string };
      photographer: string;
      photographer_url: string;
      url: string;
      width: number;
      height: number;
    }>;
  };

  return body.photos.map((p) => ({
    url: p.src.large,
    photographer: p.photographer,
    photographerUrl: p.photographer_url,
    pexelsUrl: p.url,
    width: p.width,
    height: p.height,
  }));
}
