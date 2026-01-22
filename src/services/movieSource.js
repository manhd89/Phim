import axios from "axios";

/* ================= CONFIG ================= */

const PHIMAPI_BASE = "https://phimapi.com/tmdb";
const OPHIM_SEARCH = "https://ophim1.com/v1/api/tim-kiem";
const OPHIM_DETAIL = "https://ophim1.com/v1/api/phim";

/* ================= UTILS ================= */

const normalize = (s = "") =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const isSameMovie = (tmdb, ophim) => {
  if (!tmdb || !ophim) return false;

  const tmdbTitle = normalize(tmdb.title || tmdb.name);
  const ophimTitle = normalize(ophim.name || ophim.origin_name);

  const titleMatch =
    tmdbTitle.includes(ophimTitle) ||
    ophimTitle.includes(tmdbTitle);

  const tmdbYear = Number(
    (tmdb.release_date || tmdb.first_air_date || "").slice(0, 4)
  );

  const yearMatch =
    !ophim.year || Math.abs(tmdbYear - ophim.year) <= 1;

  return titleMatch && yearMatch;
};

/* ================= PHIMAPI ================= */

export async function getPhimApiEpisodes(type, tmdbId) {
  try {
    const res = await axios.get(`${PHIMAPI_BASE}/${type}/${tmdbId}`);
    if (!res.data?.status) return [];

    return res.data.episodes.flatMap(server =>
      server.server_data.map(ep => ({
        name: ep.name,
        link_m3u8: ep.link_m3u8,
        link_embed: ep.link_embed,
        server: server.server_name,
        source: "phimapi",
      }))
    );
  } catch {
    return [];
  }
}

/* ================= OPHIM ================= */

export async function getOphimEpisodes(tmdb) {
  try {
    const keyword = tmdb.title || tmdb.name;
    const search = await axios.get(
      `${OPHIM_SEARCH}?keyword=${encodeURIComponent(keyword)}`
    );

    const items = search.data?.data?.items || [];

    // Ưu tiên TMDB ID nếu có
    let matched =
      items.find(i => i.tmdb?.id?.toString() === tmdb.id.toString()) ||
      items[0];

    if (!matched) return [];

    const detail = await axios.get(`${OPHIM_DETAIL}/${matched.slug}`);
    const ophimItem = detail.data.data.item;

    if (!isSameMovie(tmdb, ophimItem)) {
      console.warn("⚠ Ophim mismatch:", ophimItem.slug);
      return [];
    }

    return ophimItem.episodes.flatMap(server =>
      server.server_data.map(ep => ({
        name: ep.name,
        link_m3u8: ep.link_m3u8,
        link_embed: ep.link_embed,
        server: server.server_name,
        source: "ophim",
      }))
    );
  } catch {
    return [];
  }
}

/* ================= COMBINED ================= */

export async function getMovieStreams({ type, tmdb }) {
  const result = {
    phimapi: [],
    ophim: [],
    all: [],
  };

  result.phimapi = await getPhimApiEpisodes(type, tmdb.id);
  result.ophim = await getOphimEpisodes(tmdb);

  result.all = [...result.phimapi, ...result.ophim];

  return result;
}
