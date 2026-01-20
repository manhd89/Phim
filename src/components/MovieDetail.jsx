import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Typography, Select, MenuItem, Tabs, Tab, Box, CircularProgress } from '@mui/material';
import VideoPlayer from './VideoPlayer';

const TMDB_API_KEY = 'YOUR_TMDB_API_KEY';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const PHIMAPI_BASE_URL = 'https://phimapi.com/tmdb';
const OPHIM_BASE_URL = 'https://ophim1.com/v1/api'; // Hoặc https://ophim17.cc/v1/api nếu cần
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
        // TMDB details
        const tmdbRes = await axios.get(
          `\( {TMDB_BASE_URL}/ \){type}/\( {id}?api_key= \){TMDB_API_KEY}&language=vi-VN`
        );
        setDetails(tmdbRes.data);

        // PhimAPI
        try {
          const phimapiRes = await axios.get(`\( {PHIMAPI_BASE_URL}/ \){type}/${id}`);
          if (phimapiRes.data.status) {
            const allEp = phimapiRes.data.episodes.flatMap(server =>
              server.server_data.map(ep => ({ ...ep, serverName: server.server_name }))
            );
            setPhimapiEpisodes(allEp);
          }
        } catch (err) {
          console.warn('PhimAPI not available:', err);
        }

        // Ophim - Ưu tiên TMDB ID, fallback tên + năm
        let slug = null;
        try {
          // 1. Tìm bằng TMDB ID
          const searchId = await axios.get(`\( {OPHIM_BASE_URL}/tim-kiem?keyword= \){id}`);
          if (searchId.data.status === 'success' && searchId.data.data?.items?.length > 0) {
            const matched = searchId.data.data.items.find(item => item.tmdb?.id === id.toString());
            if (matched) slug = matched.slug;
          }

          // 2. Nếu chưa có, tìm bằng tên tiếng Việt + năm
          if (!slug && tmdbRes.data) {
            const vietTitle = tmdbRes.data.title || tmdbRes.data.name || '';
            const year = (tmdbRes.data.release_date || tmdbRes.data.first_air_date || '').slice(0, 4);
            if (vietTitle && year) {
              const searchTitle = await axios.get(
                `\( {OPHIM_BASE_URL}/tim-kiem?keyword= \){encodeURIComponent(vietTitle)} ${year}`
              );
              if (searchTitle.data.status === 'success' && searchTitle.data.data?.items?.length > 0) {
                const matched = searchTitle.data.data.items.find(item =>
                  item.year === parseInt(year) &&
                  (item.name.includes(vietTitle) || item.origin_name.includes(vietTitle))
                );
                slug = matched ? matched.slug : searchTitle.data.data.items[0].slug;
              }
            }
          }

          // 3. Fallback original title + year
          if (!slug && tmdbRes.data) {
            const origTitle = tmdbRes.data.original_title || tmdbRes.data.original_name || '';
            const year = (tmdbRes.data.release_date || tmdbRes.data.first_air_date || '').slice(0, 4);
            if (origTitle && year) {
              const fallback = await axios.get(
                `\( {OPHIM_BASE_URL}/tim-kiem?keyword= \){encodeURIComponent(origTitle)} ${year}`
              );
              if (fallback.data.status === 'success' && fallback.data.data?.items?.length > 0) {
                slug = fallback.data.data.items[0].slug;
              }
            }
          }

          if (slug) {
            const detailRes = await axios.get(`\( {OPHIM_BASE_URL}/phim/ \){slug}`);
            if (detailRes.data.status === 'success') {
              const allEp = detailRes.data.data.item.episodes.flatMap(server =>
                server.server_data.map(ep => ({ ...ep, serverName: server.server_name }))
              );
              setOphimEpisodes(allEp);
            }
          }
        } catch (err) {
          console.warn('Ophim fetch error:', err);
        }
      } catch (error) {
        console.error('Main fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [type, id]);

  const handleSelectEpisode = (episode) => {
    setSelectedEpisode(episode);
    setM3u8Link(episode.link_m3u8 || episode.link_embed || '');
  };

  const episodes = selectedTab === 0 ? phimapiEpisodes : ophimEpisodes;
  const sourceName = selectedTab === 0 ? 'PhimAPI (KKPhim)' : 'Ophim';

  if (loading) return <CircularProgress sx={{ display: 'block', mx: 'auto', mt: 10 }} />;

  if (!details) return <Typography>Không tìm thấy thông tin phim.</Typography>;

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 4, flexDirection: { xs: 'column', md: 'row' } }}>
        <img
          src={`\( {IMAGE_BASE_URL} \){details.poster_path}`}
          alt={details.title || details.name}
          style={{ width: '300px', borderRadius: '8px' }}
        />
        <Box>
          <Typography variant="h4" gutterBottom>
            {details.title || details.name}
          </Typography>
          <Typography variant="body1" paragraph>
            {details.overview || 'Không có mô tả.'}
          </Typography>
          <Typography variant="subtitle1">
            Năm: {details.release_date?.slice(0, 4) || details.first_air_date?.slice(0, 4) || 'N/A'}
          </Typography>
          <Typography variant="subtitle1">
            Thời lượng: {details.runtime ? `${details.runtime} phút` : 'N/A'}
          </Typography>
        </Box>
      </Box>

      <Tabs value={selectedTab} onChange={(_, v) => setSelectedTab(v)} centered sx={{ mt: 4 }}>
        <Tab label="Nguồn PhimAPI" />
        <Tab label="Nguồn Ophim" />
      </Tabs>

      {episodes.length > 0 ? (
        <>
          <Typography variant="h6" sx={{ mt: 3 }}>
            Chọn tập ({sourceName})
          </Typography>
          <Select
            value={selectedEpisode?.name || ''}
            onChange={(e) => {
              const ep = episodes.find(ep => ep.name === e.target.value);
              if (ep) handleSelectEpisode(ep);
            }}
            fullWidth
            sx={{ mt: 1 }}
          >
            {episodes.map((ep, idx) => (
              <MenuItem key={idx} value={ep.name}>
                {ep.name} ({ep.serverName || 'Server'})
              </MenuItem>
            ))}
          </Select>
        </>
      ) : (
        <Typography sx={{ mt: 3, textAlign: 'center' }}>
          Không tìm thấy tập phim từ nguồn này.
        </Typography>
      )}

      {m3u8Link && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6">Đang phát từ {sourceName}</Typography>
          <VideoPlayer src={m3u8Link} />
        </Box>
      )}
    </Box>
  );
        }
