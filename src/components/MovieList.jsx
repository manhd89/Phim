import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Grid, Card, CardMedia,
  CardContent, Typography
} from '@mui/material';
import { Link } from 'react-router-dom';

const TMDB_API_KEY = '13ef7c19ea1570a748cdceff664dbf42';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

export default function MovieList() {
  const [movies, setMovies] = useState([]);
  const [tvShows, setTvShows] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        /* ===== PHIM LẺ ===== */
        const movieRes = await axios.get(
          `${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&language=vi-VN`
        );
        setMovies(movieRes.data.results.slice(0, 12));

        /* ===== PHIM BỘ ===== */
        const tvRes = await axios.get(
          `${TMDB_BASE_URL}/tv/popular?api_key=${TMDB_API_KEY}&language=vi-VN`
        );
        setTvShows(tvRes.data.results.slice(0, 12));
      } catch (error) {
        console.error('Fetch popular error:', error);
      }
    };

    fetchData();
  }, []);

  return (
    <div>
      <Typography variant="h5" gutterBottom>
        Phim lẻ phổ biến
      </Typography>

      <Grid container spacing={3}>
        {movies.map(movie => (
          <Grid item xs={6} sm={4} md={3} lg={2} key={movie.id}>
            <Link to={`/movie/${movie.id}`} style={{ textDecoration: 'none' }}>
              <Card>
                <CardMedia
                  component="img"
                  image={`${IMAGE_BASE_URL}${movie.poster_path}`}
                  alt={movie.title}
                  sx={{ aspectRatio: '2/3' }}
                />
                <CardContent>
                  <Typography variant="body2" noWrap>
                    {movie.title}
                  </Typography>
                </CardContent>
              </Card>
            </Link>
          </Grid>
        ))}
      </Grid>

      <Typography variant="h5" gutterBottom sx={{ mt: 6 }}>
        Phim bộ phổ biến
      </Typography>

      <Grid container spacing={3}>
        {tvShows.map(tv => (
          <Grid item xs={6} sm={4} md={3} lg={2} key={tv.id}>
            <Link to={`/tv/${tv.id}`} style={{ textDecoration: 'none' }}>
              <Card>
                <CardMedia
                  component="img"
                  image={`${IMAGE_BASE_URL}${tv.poster_path}`}
                  alt={tv.name}
                  sx={{ aspectRatio: '2/3' }}
                />
                <CardContent>
                  <Typography variant="body2" noWrap>
                    {tv.name}
                  </Typography>
                </CardContent>
              </Card>
            </Link>
          </Grid>
        ))}
      </Grid>
    </div>
  );
}
