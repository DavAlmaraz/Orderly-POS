import axios from 'axios';

export const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
export const API_BASE_URL = `${SOCKET_URL}/api`;
export const STORAGE_KEY_SESION = 'orderly_pos_sesion';

export function obtenerSesionActiva() {
    try {
        const rawSession = sessionStorage.getItem(STORAGE_KEY_SESION);
        if (rawSession) return JSON.parse(rawSession);

        const tokenLocal = sessionStorage.getItem('token') || localStorage.getItem('token');
        const rolLocal = sessionStorage.getItem('rol') || localStorage.getItem('rol');
        const nombreLocal = sessionStorage.getItem('nombre') || localStorage.getItem('nombre');
        if (tokenLocal && rolLocal) {
            return {
                token: tokenLocal,
                usuario: {
                    id_usuario: rolLocal === 'administrador' ? 1 : rolLocal === 'cocina' ? 3 : 2,
                    nombre: nombreLocal || (rolLocal === 'administrador' ? 'J. David' : rolLocal === 'cocina' ? 'Roberto' : 'Maria'),
                    rol: rolLocal,
                    turno: '9am - 5pm',
                    iniciales: (nombreLocal || rolLocal).slice(0, 2).toUpperCase()
                }
            };
        }
    } catch {
        return null;
    }
    return null;
}

export function guardarSesionActiva({ token, rol, usuario }) {
    const usr = usuario || {
        id_usuario: rol === 'administrador' ? 1 : rol === 'cocina' ? 3 : 2,
        nombre: rol === 'administrador' ? 'J. David' : rol === 'cocina' ? 'Roberto' : 'Maria',
        rol,
        turno: '9am - 5pm',
        iniciales: (rol || 'OR').slice(0, 2).toUpperCase()
    };
    const sesionObj = { token, rol: usr.rol, usuario: usr };
    // Guardamos en sessionStorage (independiente por pestaña para probar Mesera, Cocina y Admin al mismo tiempo sin error 403)
    sessionStorage.setItem(STORAGE_KEY_SESION, JSON.stringify(sesionObj));
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('rol', usr.rol);
    sessionStorage.setItem('nombre', usr.nombre);
    // También guardamos en localStorage para compatibilidad
    localStorage.setItem('token', token);
    localStorage.setItem('rol', usr.rol);
    localStorage.setItem('nombre', usr.nombre);
    return sesionObj;
}

export function limpiarSesionActiva() {
    sessionStorage.removeItem(STORAGE_KEY_SESION);
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('rol');
    sessionStorage.removeItem('nombre');
    localStorage.removeItem('token');
    localStorage.removeItem('rol');
    localStorage.removeItem('nombre');
}

const api = axios.create({
    baseURL: API_BASE_URL,
});

// Interceptor para inyectar el token JWT automáticamente (priorizando sessionStorage de la pestaña actual)
api.interceptors.request.use((config) => {
    const sesion = obtenerSesionActiva();
    const token = sesion?.token || sessionStorage.getItem('token') || localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

export default api;
