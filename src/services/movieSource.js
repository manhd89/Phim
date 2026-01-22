import axios from "axios";

/* =======================
   HELPERS
======================= */

const normalizeEpisodes = (episodes = []) => {
  /**
   * Chuẩn hoá về format:
   * {
   *   name: "Tập 1",
   *   server: "Server name",
   *   link_m3u8: "https://....m3u8"
   * }
   */
  const result = [];

  episodes.forEach((server) => {
    const serverName = server.server_name || server.name || "Server";

    (server.server_data || []).forEach((ep) => {
      if (ep.link_m3u8) {
        result.push({
          name: ep.name || ep.slug || "Full",
          server: serverName,
          link_m3u8: ep.link_m3u8,
        });
      }
    });
  });

  return result;
};

const searchSlugByName = async (name) => {
  try {
    const [pRes, oRes] = await Promise.all([
      axios.get(`https://phimapi.com/v1/api/tim-kiem?keyword=${encodeURIComponent(name)}`),
      axios.get(`https://ophim1.com/v1/api/tim-kiem?keyword=${encodeURIComponent(name)}`)
    ]);

    return {
      phimapi: pRes.data?.data?.items?.[0]?.slug || null,
      ophim: oRes.data?.data?.items?.[0]?.slug || null,
    };
  } catch {
    return { phimapi: null, ophim: null };
  }
};

/* =======================
   MAIN EXPORT
======================= */

/**
 * @param {Object} params
 * @param {"movie"|"tv"} params.type
 * @param {Object} params.tmdb - object lấy từ TMDB API
 */
export async function getMovieStreams({ type, tmdb }) {
  const title = tmdb.title || tmdb.name;
  let phimapiSlug = null;
  let ophimSlug = null;

  /* 1️⃣ ƯU TIÊN TMDB ID (PHIMAPI) */
  try {
    const res = await axios.get(
      `https://phimapi.com/tmdb/${type}/${tmdb.id}`
    );
    phimapiSlug = res.data?.movie?.slug || null;
  } catch {}

  /* 2️⃣ SEARCH THEO TÊN (FALLBACK) */
  if (!phimapiSlug) {
    const slugs = await searchSlugByName(title);
    phimapiSlug = slugs.phimapi;
    ophimSlug = slugs.ophim;
  }

  const phimapiEpisodes = [];
  const ophimEpisodes = [];

  /* =======================
     PHIMAPI
  ======================= */
  if (phimapiSlug) {
    try {
      const res = await axios.get(
        `https://phimapi.com/phim/${phimapiSlug}`
      );

      const eps = normalizeEpisodes(res.data?.episodes);
      phimapiEpisodes.push(...eps);
    } catch (e) {
      console.warn("PhimAPI error:", e);
    }
  }

  /* =======================
     OPHIM
  ======================= */
  if (ophimSlug) {
    try {
      const res = await axios.get(
        `https://ophim1.com/v1/api/phim/${ophimSlug}`
      );

      const eps = normalizeEpisodes(res.data?.data?.item?.episodes);
      ophimEpisodes.push(...eps);
    } catch (e) {
      console.warn("OPhim error:", e);
    }
  }

  return {
    phimapi: phimapiEpisodes,
    ophim: ophimEpisodes,
  };
}
