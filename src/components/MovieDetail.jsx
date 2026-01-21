import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import Hls from "hls.js";

const TMDB_KEY = "13ef7c19ea1570a748cdceff664dbf42";
const TMDB = "https://api.themoviedb.org/3";
const IMAGE = "https://image.tmdb.org/t/p/w500";

const PHIMAPI = "https://phimapi.com/tmdb";
const OPHIM_SEARCH = "https://ophim1.com/v1/api/tim-kiem";
const OPHIM_DETAIL = "https://ophim1.com/v1/api/phim";

export default function MovieDetail() {
  const { type, id } = useParams();

  const [tmdb, setTmdb] = useState(null);

  const [phimapiEps, setPhimapiEps] = useState([]);
  const [ophimEps, setOphimEps] = useState([]);

  const [source, setSource] = useState("phimapi");
  const [m3u8, setM3u8] = useState(null);

  /* ================= UTILS ================= */

  const normalize = (s = "") =>
    s.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

  /* ================= LOAD DATA ================= */

  useEffect(() => {
    (async () => {
      /* 1️⃣ TMDB */
      const tmdbRes = await axios.get(
        `${TMDB}/${type}/${id}?api_key=${TMDB_KEY}&language=vi-VN`
      );
      const tmdbData = tmdbRes.data;
      setTmdb(tmdbData);

      /* 2️⃣ PHIMAPI (ƯU TIÊN) */
      try {
        const phimapiRes = await axios.get(`${PHIMAPI}/${type}/${id}`);
        if (phimapiRes.data?.status) {
          const eps = phimapiRes.data.episodes.flatMap(s =>
            s.server_data.map(e => ({
              ...e,
              server: s.server_name,
              source: "phimapi",
            }))
          );
          setPhimapiEps(eps);
          if (eps[0]?.link_m3u8) setM3u8(eps[0].link_m3u8);
        }
      } catch {}

      /* 3️⃣ OPHIM (FALLBACK) */
      try {
        const keyword = tmdbData.title || tmdbData.name;
        const search = await axios.get(
          `${OPHIM_SEARCH}?keyword=${encodeURIComponent(keyword)}`
        );

        const item = search.data?.data?.items?.find(i => {
          if (!i.tmdb?.id) return false;
          return i.tmdb.id.toString() === id.toString();
        });

        if (!item) return;

        const detail = await axios.get(`${OPHIM_DETAIL}/${item.slug}`);
        const eps = detail.data.data.item.episodes.flatMap(s =>
          s.server_data.map(e => ({
            ...e,
            server: s.server_name,
            source: "ophim",
          }))
        );

        setOphimEps(eps);
      } catch {}
    })();
  }, [id, type]);

  /* ================= PLAYER ================= */

  useEffect(() => {
    if (!m3u8) return;
    const video = document.getElementById("video");

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(m3u8);
      hls.attachMedia(video);
      return () => hls.destroy();
    } else {
      video.src = m3u8;
    }
  }, [m3u8]);

  /* ================= UI ================= */

  const episodes = source === "phimapi" ? phimapiEps : ophimEps;

  return (
    <div style={{ maxWidth: 900, margin: "auto" }}>
      {tmdb && (
        <>
          <h2>{tmdb.title || tmdb.name}</h2>
          <img src={IMAGE + tmdb.poster_path} width={220} />
          <p>{tmdb.overview}</p>
        </>
      )}

      <div style={{ margin: "20px 0" }}>
        <button onClick={() => setSource("phimapi")}>
          PhimAPI
        </button>
        <button onClick={() => setSource("ophim")}>
          Ophim
        </button>
      </div>

      {episodes.map((ep, i) => (
        <button
          key={i}
          onClick={() =>
            setM3u8(ep.link_m3u8 || ep.link_embed)
          }
        >
          {ep.name} – {ep.server}
        </button>
      ))}

      <video
        id="video"
        controls
        style={{ width: "100%", marginTop: 20 }}
      />
    </div>
  );
}
