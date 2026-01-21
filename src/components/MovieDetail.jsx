import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Select,
  MenuItem,
  CircularProgress
} from '@mui/material';
import VideoPlayer from './VideoPlayer';

/* ================= CONFIG ================= */
const TMDB_API_KEY = '13ef7c19ea1570a748cdceff664dbf42';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const PHIMAPI_BASE_URL = 'https://phimapi.com/tmdb';
const OPHIM_BASE_URL = 'https://ophim1.com/v1/api';

/* ================= OPHIM UTILS ================= */
function normalizeTitle(str = '') {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPartNumber(title = '') {
  const romanMap = {
    i: 1, ii: 2, iii: 3, iv: 4, v: 5,
    vi: 6, vii: 7, viii: 8, ix: 9, x: 10
  };

  const roman = title.match(/\b(i|ii|iii|iv|v|vi|vii|viii|ix|x)\b/i);
  if (roman) return romanMap[roman[1].toLowerCase()];

  const digit = title.match(/\b(\d+)\b/);
  if (digit) return parseInt(digit[1], 10);

  return 1;
}

function pickBestOphimItem(items, tmdbData) {
  if (!items?.length) return null;

  const tmdbId = tmdbData.id;
  const year = Number(
    (tmdbData.release_date || tmdbData.first_air_date || '').slice(0, 4)
  );

  const vnTitle = normalizeTitle(tmdbData.title || tmdbData.name || '');
  const enTitle = normalizeTitle(tmdbData.original_title || tmdbData.original_name || '');
  const expectedPart = extractPartNumber(vnTitle);

  // 1️⃣ TMDB ID
  const byTmdb = items.find(i => Number(i.tmdb?.id) === tmdbId);
  if (byTmdb) return byTmdb;

  // 2️⃣ Year + Part + Title
  const strict = items.find(i => {
    const itemVN = normalizeTitle(i.name);
    const itemEN = normalizeTitle(i.origin_name || '');
    const itemPart = extractPartNumber(itemVN);

    return (
      i.year === year &&
      itemPart === expectedPart &&
      (itemVN.includes(vnTitle) || itemEN.includes(enTitle))
    );
  });
  if (strict) return strict;

  // 3️⃣ Year + Title (fallback)
  return items.find(i => {
    const itemVN = normalizeTitle(i.name);
    return i.year === year && itemVN.includes(vnTitle);
  }) || null;
}

async function fetchOphimEpisodes(tmdbData) {
  try {
    const titleVN = tmdbData.title || tmdbData.name || '';
    const titleEN = tmdbData.original_title || tmdbData.original_name || '';
    const year = (tmdbData.release_date || tmdbData.first_air_date || '').slice(0, 4);
    let slug = null;

    const searchSteps = [
      `${tmdbData.id}`,
      `${titleVN} ${year}`,
      `${titleEN} ${year}`
    ];

    for (const keyword of searchSteps) {
      if (!keyword.trim()) continue;

      const res = await axios.get(
        `${OPHIM_BASE_URL}/tim-kiem?keyword=${encodeURIComponent(keyword)}`
      );

      if (res.data?.status === 'success') {
        const matched = pickBestOphimItem(res.data.data.items, tmdbData);
        if (matched) {
          slug = matched.slug;
          break;
        }
      }
    }

    if (!slug) return [];

    const detail = await axios.get(`${OPHIM_BASE_URL}/phim/${slug}`);
    if (detail.data?.status !== 'success') return [];

    return detail.data.data.item.episodes.flatMap(server =>
      server.server_data.map(ep => ({
        ...ep,
        serverName: server.server_name,
        source: 'ophim'
      }))
    );
  } catch (err) {
    console.warn('Ophim error:', err);
    return [];
  }
}

/* ================= COMPONENT ================= */
export default function MovieDetail() {
  const { type, id } = useParams();

  const [details, setDetails] = useState(null);
  const [phimapiEpisodes, setPhimapiEpisodes] = useState([]);
  const [ophimEpisodes, setOphimEpisodes] = useState([]);
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [videoSrc, setVideoSrc] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        /* ===== TMDB ===== */
        const tmdbRes = await axios.get(
          `${TMDB_BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&language=vi-VN`
        );
        setDetails(tmdbRes.data);

        /* ===== PHIMAPI ===== */
        try {
          const phimapiRes = await axios.get(`${PHIMAPI_BASE_URL}/${type}/${id}`);
          if (phimapiRes.data?.status) {
            const eps = phimapiRes.data.episodes.flatMap(server =>
              server.server_data.map(ep => ({
                ...ep,
                serverName: server.server_name,
                source: 'phimapi'
              }))
            );
            setPhimapiEpisodes(eps);
          }
        } catch {}

        /* ===== OPHIM ===== */
        const ophimEps = await fetchOphimEpisodes(tmdbRes.data);
        setOphimEpisodes(ophimEps);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [type, id]);

  const episodes = selectedTab === 0 ? phimapiEpisodes : ophimEpisodes;
  const sourceName = selectedTab === 0 ? 'PhimAPI' : 'Ophim';

  const handleSelectEpisode = (ep) => {
    setSelectedEpisode(ep);
    setVideoSrc(ep.link_m3u8 || ep.link_embed || '');
  };

  if (loading)
    return <CircularProgress sx={{ display: 'block', mx: 'auto', mt: 8 }} />;

  if (!details)
    return <Typography>Không tìm thấy phim</Typography>;

  return (
    <Box>
      {/* INFO */}
      <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <img
          src={`${IMAGE_BASE_URL}${details.poster_path}`}
          alt={details.title || details.name}
          style={{ width: 280, borderRadius: 8 }}
        />
        <Box>
          <Typography variant="h4">{details.title || details.name}</Typography>
          <Typography sx={{ mt: 1 }}>{details.overview}</Typography>
        </Box>
      </Box>

      {/* SOURCE */}
      <Tabs value={selectedTab} onChange={(_, v) => setSelectedTab(v)} sx={{ mt: 4 }}>
        <Tab label="PhimAPI" />
        <Tab label="Ophim" />
      </Tabs>

      {/* EPISODES */}
      {episodes.length > 0 ? (
        <Select
          fullWidth
          sx={{ mt: 2 }}
          value={selectedEpisode?.name || ''}
          onChange={(e) => {
            const ep = episodes.find(i => i.name === e.target.value);
            ep && handleSelectEpisode(ep);
          }}
        >
          {episodes.map((ep, i) => (
            <MenuItem key={i} value={ep.name}>
              {ep.name} ({ep.serverName})
            </MenuItem>
          ))}
        </Select>
      ) : (
        <Typography sx={{ mt: 2 }}>Không có tập phim</Typography>
      )}

      {/* PLAYER */}
      {videoSrc && (
        <Box sx={{ mt: 4 }}>
          <Typography>Đang phát từ {sourceName}</Typography>
          <VideoPlayer src={videoSrc} />
        </Box>
      )}
    </Box>
  );
}
