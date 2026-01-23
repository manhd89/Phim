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

  // 1. Ưu tiên tuyệt đối nếu có TMDB ID khớp nhau
  if (ophim.tmdb?.id?.toString() === tmdb.id?.toString()) return true;

  // 2. Kiểm tra tên
  const tmdbTitle = normalize(tmdb.title || tmdb.name || "");
  const tmdbOri = normalize(tmdb.original_title || tmdb.original_name || "");
  const ophimTitle = normalize(ophim.name || "");
  const ophimOri = normalize(ophim.origin_name || "");

  const titleMatch = 
    [tmdbTitle, tmdbOri].some(t => t && (ophimTitle.includes(t) || ophimOri.includes(t))) ||
    [ophimTitle, ophimOri].some(o => o && (tmdbTitle.includes(o) || tmdbOri.includes(o)));

  // 3. Kiểm tra năm (cho phép sai số 1 năm)
  const tmdbYear = Number((tmdb.release_date || tmdb.first_air_date || "").slice(0, 4));
  const ophimYear = Number(ophim.year);
  const yearMatch = !ophimYear || !tmdbYear || Math.abs(tmdbYear - ophimYear) <= 1;

  return titleMatch && yearMatch;
};

/* ================= PHIMAPI ================= */

export async function getPhimApiEpisodes(type, tmdbId) {
  try {
    const res = await axios.get(`${PHIMAPI_BASE}/${type}/${tmdbId}`, { timeout: 5000 });
    if (!res.data?.status) return [];

    return (res.data.episodes || []).flatMap(server =>
      (server.server_data || []).map(ep => ({
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
    // Thử tìm kiếm bằng Tên Tiếng Việt trước, nếu không có dùng Tên Gốc
    const keywords = [tmdb.title || tmdb.name, tmdb.original_title].filter(Boolean);
    let items = [];

    for (const kw of keywords) {
      const search = await axios.get(`${OPHIM_SEARCH}?keyword=${encodeURIComponent(kw)}`, { timeout: 5000 });
      const foundItems = search.data?.data?.items || [];
      if (foundItems.length > 0) {
        items = foundItems;
        // Nếu tìm theo keyword đầu tiên đã thấy phim có TMDB ID khớp thì dừng luôn
        if (items.some(i => i.tmdb?.id?.toString() === tmdb.id.toString())) break;
      }
    }

    if (items.length === 0) return [];

    // Tìm item khớp nhất trong danh sách kết quả
    const matched = items.find(i => i.tmdb?.id?.toString() === tmdb.id.toString()) || 
                    items.find(i => isSameMovie(tmdb, i));

    if (!matched) return [];

    const detail = await axios.get(`${OPHIM_DETAIL}/${matched.slug}`);
    const item = detail.data?.data?.item;

    if (!item || !isSameMovie(tmdb, item)) return [];

    return (item.episodes || []).flatMap(server =>
      (server.server_data || []).map(ep => ({
        name: ep.name,
        link_m3u8: ep.link_m3u8,
        link_embed: ep.link_embed,
        server: server.server_name,
        source: "ophim",
      }))
    );
  } catch (err) {
    console.error("Ophim Error:", err.message);
    return [];
  }
}

/* ================= COMBINED ================= */

/**
 * @param {Object} params
 * @param {string} params.type - 'movie' hoặc 'tv'
 * @param {Object} params.tmdb - Đối tượng data trả về từ TMDB API
 */
export async function getMovieStreams({ type, tmdb }) {
  // Chạy song song cả 2 nguồn để tối ưu tốc độ
  const [phimapi, ophim] = await Promise.all([
    getPhimApiEpisodes(type === 'movie' ? 'movie' : 'tv', tmdb.id),
    getOphimEpisodes(tmdb)
  ]);

  return {
    phimapi,
    ophim,
    all: [...phimapi, ...ophim],
  };
}
