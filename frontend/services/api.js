import axios from 'axios';

// Your current WiFi IP — confirmed from ipconfig
const BASE_URL = 'http://192.168.1.42:3001/api';
export const SERVER_URL = 'http://192.168.1.42:3001';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Sessions
export const getSessions = () => api.get('/sessions');
export const getSession = (id) => api.get(`/sessions/${id}`);
export const createSession = (data) => api.post('/sessions', data);
export const updateSession = (id, data) => api.put(`/sessions/${id}`, data);
export const deleteSession = (id) => api.delete(`/sessions/${id}`);

// Balls
export const getBallsForSession = (sessionId) => api.get(`/balls/session/${sessionId}`);
export const logBall = (data) => api.post('/balls', data);
export const updateBall = (id, data) => api.put(`/balls/${id}`, data);
export const deleteBall = (id) => api.delete(`/balls/${id}`);

// Analytics
export const getAnalytics = (sessionId) => api.get(`/analytics/session/${sessionId}`);

// Fields
export const getField = (sessionId) => api.get(`/fields/session/${sessionId}`);
export const saveField = (data) => api.post('/fields', data);

// Scoring
export const calculateScore = (data) => api.post('/scoring/calculate', data);
export const getSessionScoring = (sessionId) => api.get(`/scoring/session/${sessionId}`);

// Videos
export const uploadVideo = (formData, onProgress) =>
  axios.post(`${BASE_URL}/videos/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
    onUploadProgress: onProgress,
  });
export const getVideosForSession = (sessionId) => api.get(`/videos/session/${sessionId}`);
export const deleteVideo = (id) => api.delete(`/videos/${id}`);

// Clips
export const saveClip = (data) => api.post('/clips', data);
export const getClipsForVideo = (videoId) => api.get(`/clips/video/${videoId}`);
export const getClipForBall = (ballId) => api.get(`/clips/ball/${ballId}`);
export const deleteClip = (id) => api.delete(`/clips/${id}`);

// Reviews
export const submitLBWReview = (data) => api.post('/reviews', data);
export const getReviewsForSession = (sessionId) => api.get(`/reviews/session/${sessionId}`);

export default api;