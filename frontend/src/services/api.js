import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:3000/api'
});

// Interceptor para agregar automáticamente el Token JWT en cada petición
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

export default api;