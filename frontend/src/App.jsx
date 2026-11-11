import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './components/Login';
import VistaMesero from './components/VistaMesero';
import VistaCocina from './components/VistaCocina';
import VistaAdmin from './components/VistaAdmin';
import api, { obtenerSesionActiva, limpiarSesionActiva } from './services/api';

function RutaProtegida({ children, rolesPermitidos }) {
    const location = useLocation();
    const sesion = obtenerSesionActiva();
    const [verificado, setVerificado] = useState(true);

    useEffect(() => {
        if (!sesion?.token) return;
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
