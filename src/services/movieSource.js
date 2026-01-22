import axios from "axios";

/**
 * Chuẩn hóa keyword để tránh lệch kết quả
 */
export function normalizeKeyword(text = "") {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

/**
 * ==========================
 *  PHIMAPI – TMDB SOURCE
 * ==========================
 * Ưu tiên lấy link xem theo TMDB ID
 */
export async function getPhimapiSource({ type, tmdbId }) {
  try {
    const url = `https://phimapi.com/tmdb/${type}/${tmdbId}`;
    const res = await axios.get(url);

    if (!res.data?.status) return null;

    const episodes =
      res.data.movie?.episodes ||
      res.data.movie?.server_data ||
      [];

    // Lấy m3u8 đầu tiên
    for (const server of episodes) {
      for (const ep of server.server_data || []) {
        if (ep.link_m3u8) {
          return {
            source: "phimapi",
            server: server.server_name,
            m3u8: ep.link_m3u8,
          };
        }
      }
    }

    return null;
  } catch (e) {
    console.error("PhimAPI error:", e);
    return null;
  }
}

/**
 * ==========================
 *  OPHIM SEARCH SOURCE
 * ==========================
 * Fallback khi TMDB gắn sai
 */
export async function getOphimSourceByKeyword(keyword) {
  try {
    const url = `https://ophim1.com/v1/api/tim-kiem?keyword=${encodeURIComponent(
      keyword
    )}`;
    const res = await axios.get(url);

    const items = res.data?.data?.items || [];
    if (!items.length) return null;

    // Lọc chính xác theo keyword
    const normalizedKeyword = normalizeKeyword(keyword);

    const matched = items.find((item) =>
      normalizeKeyword(item.name).includes(normalizedKeyword)
    );

    if (!matched) return null;

    // Lấy chi tiết phim
    const detailRes = await axios.get(
      `https://ophim1.com/v1/api/phim/${matched.slug}`
    );

    const episodes =
      detailRes.data?.data?.episodes || [];

    for (const server of episodes) {
      for (const ep of server.server_data || []) {
        if (ep.link_m3u8) {
          return {
            source: "ophim",
            server: server.server_name,
            m3u8: ep.link_m3u8,
          };
        }
      }
    }

    return null;
  } catch (e) {
    console.error("Ophim error:", e);
    return null;
  }
}

/**
 * ==========================
 *  MAIN PUBLIC FUNCTION
 * ==========================
 * MovieDetail.jsx sẽ gọi hàm này
 */
export async function getMovieStreamingSource({
  type,
  tmdbId,
  title,
}) {
  // 1️⃣ Ưu tiên PHIMAPI theo TMDB
  if (tmdbId) {
    const phimapi = await getPhimapiSource({ type, tmdbId });
    if (phimapi) return phimapi;
  }

  // 2️⃣ Fallback OPHIM theo keyword
  if (title) {
    const ophim = await getOphimSourceByKeyword(title);
    if (ophim) return ophim;
  }

  return null;
}
