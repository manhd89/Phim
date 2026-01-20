import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MovieList from './components/MovieList';
import MovieDetail from './components/MovieDetail';
import SearchBar from './components/SearchBar';
import { Container } from '@mui/material';

function App() {
  return (
    <Router>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <SearchBar />
        <Routes>
          <Route path="/" element={<MovieList />} />
          <Route path="/:type/:id" element={<MovieDetail />} />
        </Routes>
      </Container>
    </Router>
  );
}

export default App;
