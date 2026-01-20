import { useState } from 'react';
import { TextField, Button, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const TMDB_API_KEY = '13ef7c19ea1570a748cdceff664dbf42';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = async () => {
    if (!query.trim()) return;

    try {
      const res = await axios.get(
        `${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=vi-VN`
      );

      const firstResult = res.data?.results?.[0];
      if (!firstResult) return;

      const type = firstResult.media_type === 'tv' ? 'tv' : 'movie';
      navigate(`/${type}/${firstResult.id}`);
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  return (
    <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
      <TextField
        label="Tìm kiếm phim..."
        variant="outlined"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        fullWidth
        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
      />
      <Button variant="contained" onClick={handleSearch}>
        Tìm
      </Button>
    </Box>
  );
}
