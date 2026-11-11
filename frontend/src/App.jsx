import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Login from './components/Login';
import VistaMesero from './components/VistaMesero';
import VistaCocina from './components/VistaCocina';
import VistaAdmin from './components/VistaAdmin';
import api, { obtenerSesionActiva, limpiarSesionActiva } from './services/api';

function RutaProtegida({ children, rolesPermitidos }) {
    const location = useLocation();
    const navigate = useNavigate();
    const sesion = obtenerSesionActiva();
    const [verificado, setVerificado] = useState(Boolean(sesion?.token));

    useEffect(() => {
        // Insertar un estado de control en el historial para interceptar el botón "Volver" del navegador o Android.
        // Si el usuario presiona "Volver", se destruye la sesión y se le expulsa al login de forma definitiva.
        try {
            if (!window.history.state || !window.history.state.__orderlyGuard) {
                window.history.pushState({ __orderlyGuard: true, path: location.pathname }, '', location.pathname);
            }
        } catch {
            // Ignorar si el navegador restringe pushState
        }

        const expulsarAlLoginPorRetroceso = () => {
            const sesionActual = obtenerSesionActiva();
            const token = sesionActual?.token;
            limpiarSesionActiva();
            setVerificado(false);
            if (token) {
                api.post('/auth/logout', {}, {
                    headers: { Authorization: `Bearer ${token}` }
                }).catch(() => {});
            }
            navigate('/login', { replace: true, state: { sesionCerrada: true } });
        };

        const manejarPopState = () => {
            expulsarAlLoginPorRetroceso();
        };

        const manejarPageshow = (e) => {
            if (e.persisted || !obtenerSesionActiva()?.token) {
                limpiarSesionActiva();
                setVerificado(false);
                navigate('/login', { replace: true });
            }
        };

        const manejarStorage = () => {
            if (!obtenerSesionActiva()?.token) {
                setVerificado(false);
                navigate('/login', { replace: true });
            }
        };

        window.addEventListener('popstate', manejarPopState);
        window.addEventListener('pageshow', manejarPageshow);
        window.addEventListener('storage', manejarStorage);

        return () => {
            window.removeEventListener('popstate', manejarPopState);
            window.removeEventListener('pageshow', manejarPageshow);
            window.removeEventListener('storage', manejarStorage);
        };
    }, [location.pathname, navigate]);

    useEffect(() => {
        const current = obtenerSesionActiva();
        if (!current?.token) {
            setVerificado(false);
            return;
        }
        api.get('/auth/sesion')
            .then(() => setVerificado(true))
            .catch((err) => {
                if (err.response?.status === 401 || err.response?.status === 403) {
                    limpiarSesionActiva();
                    setVerificado(false);
                }
            });
    }, [location.pathname, sesion?.token]);

    if (!sesion?.token || !verificado) {
        return <Navigate to="/login" replace />;
    }

    const rolUsuario = sesion.usuario?.rol || sesion.rol;
    if (rolesPermitidos && !rolesPermitidos.includes(rolUsuario)) {
        const rutaAutorizada =
            rolUsuario === 'administrador'
                ? '/admin'
                : rolUsuario === 'cocina'
                ? '/cocina'
                : '/mesero';
        return <Navigate to={rutaAutorizada} replace />;
    }

    return children;
}

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                    path="/mesero"
                    element={
                        <RutaProtegida rolesPermitidos={['mesera', 'administrador']}>
                            <VistaMesero />
                        </RutaProtegida>
                    }
                />
                <Route
                    path="/cocina"
                    element={
                        <RutaProtegida rolesPermitidos={['cocina', 'administrador']}>
                            <VistaCocina />
                        </RutaProtegida>
                    }
                />
                <Route
                    path="/admin"
                    element={
                        <RutaProtegida rolesPermitidos={['administrador']}>
                            <VistaAdmin />
                        </RutaProtegida>
                    }
                />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </Router>
    );
}

export default App;
