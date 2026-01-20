import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
  Typography, Select, MenuItem, Tabs, Tab,
  Box, CircularProgress
} from '@mui/material';
import VideoPlayer from './VideoPlayer';

const TMDB_API_KEY = '13ef7c19ea1570a748cdceff664dbf42';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const PHIMAPI_BASE_URL = 'https://phimapi.com/tmdb';
const OPHIM_BASE_URL = 'https://ophim1.com/v1/api';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

export default function MovieDetail() {
  const { type, id } = useParams();

  const [details, setDetails] = useState(null);
  const [phimapiEpisodes, setPhimapiEpisodes] = useState([]);
  const [ophimEpisodes, setOphimEpisodes] = useState([]);
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [m3u8Link, setM3u8Link] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        /* ================= TMDB ================= */
        const tmdbRes = await axios.get(
          `${TMDB_BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&language=vi-VN`
        );
        setDetails(tmdbRes.data);

        /* ================= PHIMAPI ================= */
        try {
          const phimapiRes = await axios.get(`${PHIMAPI_BASE_URL}/${type}/${id}`);
          if (phimapiRes.data?.status) {
            const allEp = phimapiRes.data.episodes.flatMap(server =>
              server.server_data.map(ep => ({
                ...ep,
                serverName: server.server_name
              }))
            );
            setPhimapiEpisodes(allEp);
          }
        } catch (e) {
          console.warn('PhimAPI lỗi:', e);
        }

        /* ================= OPHIM ================= */
        try {
          let slug = null;

          // 1️⃣ tìm theo TMDB ID
          const searchById = await axios.get(
            `${OPHIM_BASE_URL}/tim-kiem?keyword=${id}`
          );

          if (searchById.data?.status === 'success') {
            const matched = searchById.data.data.items?.find(
              item => item.tmdb?.id === Number(id)
            );
            if (matched) slug = matched.slug;
          }

          // 2️⃣ fallback: tên + năm
          if (!slug) {
            const title = tmdbRes.data.title || tmdbRes.data.name || '';
            const year = (tmdbRes.data.release_date || tmdbRes.data.first_air_date || '').slice(0, 4);

            if (title && year) {
              const searchByTitle = await axios.get(
                `${OPHIM_BASE_URL}/tim-kiem?keyword=${encodeURIComponent(`${title} ${year}`)}`
              );

              if (searchByTitle.data?.status === 'success') {
                slug = searchByTitle.data.data.items?.[0]?.slug || null;
              }
            }
          }

          if (slug) {
            const detailRes = await axios.get(`${OPHIM_BASE_URL}/phim/${slug}`);
            if (detailRes.data?.status === 'success') {
              const allEp = detailRes.data.data.item.episodes.flatMap(server =>
                server.server_data.map(ep => ({
                  ...ep,
                  serverName: server.server_name
                }))
              );
              setOphimEpisodes(allEp);
            }
          }
        } catch (e) {
          console.warn('Ophim lỗi:', e);
        }
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [type, id]);

  const handleSelectEpisode = (ep) => {
    setSelectedEpisode(ep);
    setM3u8Link(ep.link_m3u8 || ep.link_embed || '');
  };

  const episodes = selectedTab === 0 ? phimapiEpisodes : ophimEpisodes;
  const sourceName = selectedTab === 0 ? 'PhimAPI (KKPhim)' : 'Ophim';

  if (loading)
    return <CircularProgress sx={{ display: 'block', mx: 'auto', mt: 10 }} />;

  if (!details)
    return <Typography>Không tìm thấy phim</Typography>;

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 4, flexDirection: { xs: 'column', md: 'row' } }}>
        <img
          src={`${IMAGE_BASE_URL}${details.poster_path}`}
          alt={details.title || details.name}
          style={{ width: 300, borderRadius: 8 }}
        />
        <Box>
          <Typography variant="h4">{details.title || details.name}</Typography>
          <Typography>{details.overview}</Typography>
        </Box>
      </Box>

      <Tabs value={selectedTab} onChange={(_, v) => setSelectedTab(v)} sx={{ mt: 4 }}>
        <Tab label="PhimAPI" />
        <Tab label="Ophim" />
      </Tabs>

      {episodes.length > 0 && (
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
      )}

      {m3u8Link && (
        <Box sx={{ mt: 4 }}>
          <Typography>Đang phát từ {sourceName}</Typography>
          <VideoPlayer src={m3u8Link} />
        </Box>
      )}
    </Box>
  );
}
