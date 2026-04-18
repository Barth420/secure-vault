// ============================================================
// API Service — Axios instance with JWT interceptor
// ============================================================
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: false,
});

// ── Attach JWT to every request ───────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sc_access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Handle token expiry — refresh automatically ───────────
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    if (
      err.response?.status === 401 &&
      err.response?.data?.code === 'TOKEN_EXPIRED' &&
      !original._retry
    ) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem('sc_refresh_token');
        const { data } = await axios.post('/api/auth/refresh', { refreshToken });
        localStorage.setItem('sc_access_token',  data.accessToken);
        localStorage.setItem('sc_refresh_token', data.refreshToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        // Refresh failed — clear session and redirect to login
        localStorage.clear();
        window.location.href = '/login';
      }
    }

    return Promise.reject(err);
  }
);

export default api;
