import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Downloader from './pages/Downloader';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/app" element={<Downloader />} />
          <Route path="/docs" element={<Navigate to="https://zipit.docs" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
