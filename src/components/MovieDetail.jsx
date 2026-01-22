import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import Hls from "hls.js";

import { getMovieStreams } from "../services/movieSource";

const TMDB_KEY = "13ef7c19ea1570a748cdceff664dbf42";
const TMDB_BASE = "https://api.themoviedb.org/3";
const IMAGE = "https://image.tmdb.org/t/p/w500";

export default function MovieDetail() {
  const { type, id } = useParams();

  const [tmdb, setTmdb] = useState(null);

  const [phimapiEps, setPhimapiEps] = useState([]);
  const [ophimEps, setOphimEps] = useState([]);

  const [source, setSource] = useState(null);
  const [currentEp, setCurrentEp] = useState(null);
  const [m3u8, setM3u8] = useState(null);

  const [loading, setLoading] = useState(true);

  /* ================= LOAD DATA ================= */

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);

      try {
        /* 1️⃣ TMDB */
        const tmdbRes = await axios.get(
          `${TMDB_BASE}/${type}/${id}?api_key=${TMDB_KEY}&language=vi-VN`
        );
        if (!mounted) return;

        setTmdb(tmdbRes.data);

        /* 2️⃣ Streams từ module */
        const streams = await getMovieStreams({
          type,
          tmdb: tmdbRes.data,
        });

        if (!mounted) return;

        setPhimapiEps(streams.phimapi);
        setOphimEps(streams.ophim);

        /* 3️⃣ Ưu tiên PhimAPI */
        if (streams.phimapi.length > 0) {
          setSource("phimapi");
          setCurrentEp(streams.phimapi[0]);
          setM3u8(streams.phimapi[0].link_m3u8);
        } else if (streams.ophim.length > 0) {
          setSource("ophim");
          setCurrentEp(streams.ophim[0]);
          setM3u8(streams.ophim[0].link_m3u8);
        }
      } catch (err) {
        console.error("MovieDetail error:", err);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id, type]);

  /* ================= PLAYER ================= */

  useEffect(() => {
    if (!m3u8) return;

    const video = document.getElementById("video");
    if (!video) return;

    let hls;

    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(m3u8);
      hls.attachMedia(video);
    } else {
      video.src = m3u8;
    }

    return () => {
      if (hls) hls.destroy();
    };
  }, [m3u8]);

  /* ================= UI ================= */

  if (loading) return <p>Đang tải phim...</p>;
  if (!tmdb) return <p>Không tìm thấy phim</p>;

  const episodes = source === "phimapi" ? phimapiEps : ophimEps;

  return (
    <div style={{ maxWidth: 1000, margin: "auto", padding: 20 }}>
      {/* INFO */}
      <div style={{ display: "flex", gap: 20 }}>
        <img
          src={IMAGE + tmdb.poster_path}
          alt={tmdb.title || tmdb.name}
          width={220}
          style={{ borderRadius: 8 }}
        />

        <div>
          <h1>{tmdb.title || tmdb.name}</h1>
          <p>{tmdb.overview}</p>
          <p>
            Năm:{" "}
            {(tmdb.release_date || tmdb.first_air_date || "").slice(0, 4)}
          </p>
          <p>Đánh giá: {tmdb.vote_average}</p>
        </div>
      </div>

      {/* SOURCE SWITCH */}
      <div style={{ marginTop: 20 }}>
        {phimapiEps.length > 0 && (
          <button
            onClick={() => {
              setSource("phimapi");
              setCurrentEp(phimapiEps[0]);
              setM3u8(phimapiEps[0].link_m3u8);
            }}
            style={{
              marginRight: 10,
              fontWeight: source === "phimapi" ? "bold" : "normal",
            }}
          >
            PhimAPI
          </button>
        )}

        {ophimEps.length > 0 && (
          <button
            onClick={() => {
              setSource("ophim");
              setCurrentEp(ophimEps[0]);
              setM3u8(ophimEps[0].link_m3u8);
            }}
            style={{
              fontWeight: source === "ophim" ? "bold" : "normal",
            }}
          >
            Ophim
          </button>
        )}
      </div>

      {/* EPISODES */}
      <div style={{ marginTop: 15 }}>
        {episodes.map((ep, idx) => (
          <button
            key={idx}
            onClick={() => {
              setCurrentEp(ep);
              setM3u8(ep.link_m3u8 || ep.link_embed);
            }}
            style={{
              marginRight: 8,
              marginBottom: 8,
              background:
                currentEp === ep ? "#1976d2" : "#eee",
              color: currentEp === ep ? "#fff" : "#000",
            }}
          >
            {ep.name} – {ep.server}
          </button>
        ))}
      </div>

      {/* PLAYER */}
      <video
        id="video"
        controls
        style={{
          width: "100%",
          marginTop: 20,
          borderRadius: 8,
          background: "#000",
        }}
      />
    </div>
  );
}
