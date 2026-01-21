import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import Hls from "hls.js";

const TMDB_API_KEY = "13ef7c19ea1570a748cdceff664dbf42";
const TMDB_BASE = "https://api.themoviedb.org/3";
const OPHIM_SEARCH = "https://ophim1.com/v1/api/tim-kiem";
const OPHIM_DETAIL = "https://ophim1.com/v1/api/phim";

const IMG = "https://image.tmdb.org/t/p/w500";

export default function MovieDetail() {
  const { type, id } = useParams();

  const [tmdb, setTmdb] = useState(null);
  const [ophim, setOphim] = useState(null);
  const [stream, setStream] = useState(null);
  const [safeMode, setSafeMode] = useState(false);

  /* =========================
     UTILS
  ========================== */

  const normalize = (s = "") =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

  const similarity = (a, b) => {
    if (!a || !b) return 0;
    const A = normalize(a);
    const B = normalize(b);
    if (A.includes(B) || B.includes(A)) return 1;
    return 0;
  };

  const isWrongTmdb = (tmdb, ophim) => {
    if (!tmdb || !ophim) return true;

    const titleScore =
      similarity(tmdb.title || tmdb.name, ophim.name) ||
      similarity(tmdb.original_title || tmdb.original_name, ophim.origin_name);

    const yearOk =
      !ophim.year ||
      Math.abs(
        Number(ophim.year) -
          Number((tmdb.release_date || tmdb.first_air_date || "").slice(0, 4))
      ) <= 1;

    return !(titleScore && yearOk);
  };

  /* =========================
     LOAD TMDB
  ========================== */

  const loadTmdb = async (tmdbId, tmdbType) => {
    const res = await axios.get(
      `${TMDB_BASE}/${tmdbType}/${tmdbId}?api_key=${TMDB_API_KEY}&language=vi-VN`
    );
    return res.data;
  };

  const remapTmdb = async (ophimItem) => {
    const q = encodeURIComponent(
      `${ophimItem.origin_name || ophimItem.name} ${ophimItem.year || ""}`
    );

    const res = await axios.get(
      `${TMDB_BASE}/search/multi?api_key=${TMDB_API_KEY}&query=${q}&language=vi-VN`
    );

    return res.data.results.find(
      (r) => r.media_type === (ophimItem.type === "series" ? "tv" : "movie")
    );
  };

  /* =========================
     LOAD OPHIM
  ========================== */

  const loadOphim = async (title) => {
    const search = await axios.get(`${OPHIM_SEARCH}?keyword=${encodeURIComponent(title)}`);
    const item = search.data?.data?.items?.[0];
    if (!item) return null;

    const detail = await axios.get(`${OPHIM_DETAIL}/${item.slug}`);
    return detail.data.data.item;
  };

  /* =========================
     MAIN
  ========================== */

  useEffect(() => {
    (async () => {
      try {
        // 1. TMDB ban đầu
        const tmdbData = await loadTmdb(id, type);
        setTmdb(tmdbData);

        // 2. Ophim theo title TMDB
        const ophimData = await loadOphim(
          tmdbData.title || tmdbData.name
        );
        setOphim(ophimData);

        // 3. Verify TMDB
        if (ophimData && isWrongTmdb(tmdbData, ophimData)) {
          const remap = await remapTmdb(ophimData);

          if (remap) {
            const fixed = await loadTmdb(remap.id, remap.media_type);
            setTmdb(fixed);
          } else {
            setSafeMode(true);
          }
        }

        // 4. Lấy m3u8
        const server = ophimData?.episodes?.[0]?.server_data?.[0];
        if (server?.link_m3u8) setStream(server.link_m3u8);
      } catch (e) {
        console.error(e);
        setSafeMode(true);
      }
    })();
  }, [id, type]);

  /* =========================
     PLAYER
  ========================== */

  useEffect(() => {
    if (!stream) return;
    const video = document.getElementById("player");

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(stream);
      hls.attachMedia(video);
      return () => hls.destroy();
    } else {
      video.src = stream;
    }
  }, [stream]);

  /* =========================
     RENDER
  ========================== */

  if (!ophim) return <p>Đang tải...</p>;

  return (
    <div style={{ maxWidth: 900, margin: "auto" }}>
      {!safeMode && tmdb && (
        <>
          <h1>{tmdb.title || tmdb.name}</h1>
          <img src={IMG + tmdb.poster_path} width={200} />
          <p>{tmdb.overview}</p>
        </>
      )}

      {safeMode && (
        <p style={{ color: "orange" }}>
          ⚠️ Thông tin phim có thể không chính xác
        </p>
      )}

      <video
        id="player"
        controls
        width="100%"
        style={{ marginTop: 20 }}
      />
    </div>
  );
}
