import axios from 'axios';

export const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || (typeof window !== 'undefined'
    ? (window.location.port === '5173'
        ? `${window.location.protocol}//${window.location.hostname}:3000`
        : window.location.origin)
    : 'http://localhost:3000');
export const API_BASE_URL = `${SOCKET_URL}/api`;
export const STORAGE_KEY_SESION = 'orderly_pos_sesion';

export function obtenerSesionActiva() {
    try {
        const rawSession = sessionStorage.getItem(STORAGE_KEY_SESION);
        if (rawSession) {
            const parsed = JSON.parse(rawSession);
            if (parsed?.token && parsed?.usuario?.rol) return parsed;
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
    sessionStorage.setItem(STORAGE_KEY_SESION, JSON.stringify(sesionObj));
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('rol', usr.rol);
    sessionStorage.setItem('nombre', usr.nombre);
    // Eliminar cualquier rastro previo en localStorage para impedir sesiones persistentes entre pestañas o tras retroceder
    localStorage.removeItem(STORAGE_KEY_SESION);
    localStorage.removeItem('token');
    localStorage.removeItem('rol');
    localStorage.removeItem('nombre');
    return sesionObj;
}

export function limpiarSesionActiva() {
    sessionStorage.removeItem(STORAGE_KEY_SESION);
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('rol');
    sessionStorage.removeItem('nombre');
    localStorage.removeItem(STORAGE_KEY_SESION);
    localStorage.removeItem('token');
    localStorage.removeItem('rol');
    localStorage.removeItem('nombre');
}

// ============================================================================
// SERVICIO DE NOTIFICACIONES PUSH (WEB NOTIFICATION API + AUDIO ALERTA)
// ============================================================================

export function obtenerEstadoPermisoPush() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        return 'unsupported';
    }
    return window.Notification.permission; // 'granted' | 'denied' | 'default'
}

export async function solicitarPermisoNotificacionesPush() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        return 'unsupported';
    }
    if (window.Notification.permission === 'granted') {
        return 'granted';
    }
    try {
        const permiso = await window.Notification.requestPermission();
        return permiso;
    } catch {
        return window.Notification.permission;
    }
}

export function reproducirSonidoPushCritico(severidad = 'critico') {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = severidad === 'critico' ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(severidad === 'critico' ? 740 : 587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(severidad === 'critico' ? 987.77 : 880, ctx.currentTime + 0.14);
        gain.gain.setValueAtTime(0.11, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.48);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    } catch {
        // Silenciar si el navegador requiere interacción previa
    }
}

export function dispararNotificacionPushNavegador({ titulo, mensaje, tag = 'orderly-push', severidad = 'critico' }) {
    reproducirSonidoPushCritico(severidad);
    if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
        try {
            const notif = new window.Notification(titulo || 'Orderly POS — Alerta Crítica', {
                body: mensaje || '',
                icon: '/favicon.svg',
                tag: `${tag}-${Date.now()}`,
                requireInteraction: severidad === 'critico',
            });
            setTimeout(() => {
                try { notif.close(); } catch {}
            }, 10000);
            return true;
        } catch {
            return false;
        }
    }
    return false;
}

const api = axios.create({
    baseURL: API_BASE_URL,
});

// Interceptor para inyectar el token JWT automáticamente únicamente desde la sesión de pestaña
api.interceptors.request.use((config) => {
    const sesion = obtenerSesionActiva();
    const token = sesion?.token || sessionStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const url = error?.config?.url || '';
        if (error?.response?.status === 401 && !url.includes('/login') && !url.includes('/auth/logout')) {
            limpiarSesionActiva();
            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
                window.location.replace('/login');
            }
        }
        return Promise.reject(error);
    }
);

export default api;
