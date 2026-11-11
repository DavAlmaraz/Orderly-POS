import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api, { guardarSesionActiva, obtenerSesionActiva, limpiarSesionActiva } from '../services/api';

export default function Login() {
    const [nombre, setNombre] = useState('');
    const [contrasena, setContrasena] = useState('');
    const [mostrarPass, setMostrarPass] = useState(false);
    const [error, setError] = useState('');
    const [avisoSeguridad, setAvisoSeguridad] = useState('');
    const [cargando, setCargando] = useState(false);
    const [modalQrAbierto, setModalQrAbierto] = useState(false);
    const [infoQr, setInfoQr] = useState(null);
    const [cargandoQr, setCargandoQr] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    // Blindaje de historial y sesión: si el usuario vuelve al Login (ej. botón "Atrás" del navegador),
    // se invalida y revoca inmediatamente cualquier sesión activa para exigir nueva autenticación.
    useEffect(() => {
        const sesionPrevia = obtenerSesionActiva();
        if (sesionPrevia?.token) {
            const tokenARevocar = sesionPrevia.token;
            limpiarSesionActiva();
            setAvisoSeguridad('Sesión cerrada por seguridad al salir del área operativa. Inicie sesión nuevamente.');
            api.post('/auth/logout', {}, {
                headers: { Authorization: `Bearer ${tokenARevocar}` }
            }).catch(() => {});
        } else if (location.state?.sesionCerrada) {
            limpiarSesionActiva();
            setAvisoSeguridad('Sesión cerrada correctamente. Ingrese sus credenciales para volver a entrar.');
        }

        const manejarPageshow = (e) => {
            if (e.persisted) {
                limpiarSesionActiva();
                window.location.reload();
            }
        };
        window.addEventListener('pageshow', manejarPageshow);
        const abrirAccesoQr = async () => {
        setModalQrAbierto(true);
        setCargandoQr(true);
        try {
            const res = await api.get('/sistema/red-qr');
            setInfoQr(res.data);
        } catch {
            setInfoQr(null);
        } finally {
            setCargandoQr(false);
        }
    };

    return () => window.removeEventListener('pageshow', manejarPageshow);
    }, [location.key]);

    const manejarLogin = async (e) => {
        e.preventDefault();
        setError('');
        setAvisoSeguridad('');

        if (!nombre.trim() || !contrasena.trim()) {
            setError('Por favor ingrese su usuario y contraseña.');
            return;
        }

        setCargando(true);
        try {
            const respuesta = await api.post('/login', {
                nombre: nombre.trim(),
                contrasena
            });

            if (respuesta.data.exito || respuesta.data.token) {
                const rol = respuesta.data.rol || respuesta.data.usuario?.rol;
                guardarSesionActiva({
                    token: respuesta.data.token,
                    rol,
                    usuario: respuesta.data.usuario
                });

                if (rol === 'administrador') navigate('/admin', { replace: true });
                else if (rol === 'cocina') navigate('/cocina', { replace: true });
                else if (rol === 'mesera') navigate('/mesero', { replace: true });
                else navigate('/mesero', { replace: true });
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Usuario o contraseña incorrectos.');
        } finally {
            setCargando(false);
        }
    };

    const abrirAccesoQr = async () => {
        setModalQrAbierto(true);
        setCargandoQr(true);
        try {
            const res = await api.get('/sistema/red-qr');
            setInfoQr(res.data);
        } catch {
            setInfoQr(null);
        } finally {
            setCargandoQr(false);
        }
    };

    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                background: '#f1f5f9',
                padding: '24px',
            }}
        >
            <div
                style={{
                    width: '100%',
                    maxWidth: '420px',
                    background: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 10px 25px rgba(15, 23, 42, 0.06)',
                    overflow: 'hidden',
                }}
            >
                <div
                    style={{
                        background: '#2b3a4a',
                        padding: '28px 32px 24px',
                        color: '#ffffff',
                        textAlign: 'center',
                    }}
                >
                    <div
                        style={{
                            width: '44px',
                            height: '44px',
                            background: '#ffffff',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 12px',
                        }}
                    >
                        <div
                            style={{
                                width: '16px',
                                height: '16px',
                                border: '3.5px solid #2b3a4a',
                                borderRadius: '50%',
                            }}
                        />
                    </div>
                    <h1
                        style={{
                            fontFamily: 'Roboto, sans-serif',
                            fontSize: '22px',
                            fontWeight: 700,
                            letterSpacing: '-0.01em',
                            marginBottom: '4px',
                        }}
                    >
                        Orderly
                    </h1>
                    <p
                        style={{
                            fontSize: '13px',
                            color: 'rgba(255, 255, 255, 0.78)',
                            fontWeight: 400,
                        }}
                    >
                        Sistema de Gestión Restaurantera · Punto de Venta
                    </p>
                </div>

                <div style={{ padding: '28px 32px 32px' }}>
                    <h2
                        style={{
                            fontSize: '16px',
                            fontWeight: 700,
                            color: '#111827',
                            marginBottom: '6px',
                        }}
                    >
                        Iniciar sesión
                    </h2>
                    <p
                        style={{
                            fontSize: '13px',
                            color: '#6b7280',
                            marginBottom: '20px',
                        }}
                    >
                        Ingrese sus credenciales de colaborador para acceder a su área asignada.
                    </p>

                    {avisoSeguridad && (
                        <div
                            style={{
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                color: '#1e3a8a',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                fontSize: '13px',
                                marginBottom: '16px',
                            }}
                        >
                            {avisoSeguridad}
                        </div>
                    )}

                    {error && (
                        <div
                            style={{
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                color: '#991b1b',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                fontSize: '13px',
                                marginBottom: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                            }}
                        >
                            <span
                                style={{
                                    width: '7px',
                                    height: '7px',
                                    borderRadius: '50%',
                                    background: '#dc2626',
                                    flexShrink: 0,
                                }}
                            />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={manejarLogin}>
                        <div className="form-field-group" style={{ marginBottom: '16px' }}>
                            <label className="form-field-label" htmlFor="login-usuario">
                                Usuario
                            </label>
                            <input
                                id="login-usuario"
                                type="text"
                                className="form-input-clean"
                                value={nombre}
                                onChange={(e) => {
                                    setNombre(e.target.value);
                                    if (error) setError('');
                                }}
                                placeholder="Ingrese su usuario"
                                autoComplete="username"
                                autoFocus
                                required
                            />
                        </div>

                        <div className="form-field-group" style={{ marginBottom: '22px' }}>
                            <label className="form-field-label" htmlFor="login-contrasena">
                                Contraseña
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    id="login-contrasena"
                                    type={mostrarPass ? 'text' : 'password'}
                                    className="form-input-clean"
                                    value={contrasena}
                                    onChange={(e) => {
                                        setContrasena(e.target.value);
                                        if (error) setError('');
                                    }}
                                    placeholder="Ingrese su contraseña"
                                    autoComplete="current-password"
                                    required
                                />
                                <button
                                    type="button"
                                    className="secondary-outline-btn"
                                    style={{ whiteSpace: 'nowrap', padding: '0 14px' }}
                                    onClick={() => setMostrarPass(!mostrarPass)}
                                >
                                    {mostrarPass ? 'Ocultar' : 'Mostrar'}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="primary-dark-btn"
                            style={{ width: '100%', padding: '12px 16px', fontSize: '14px' }}
                            disabled={cargando}
                        >
                            {cargando ? 'Verificando acceso...' : 'Iniciar sesión'}
                        </button>
                    </form>

                    <div
                        style={{
                            marginTop: '18px',
                            paddingTop: '16px',
                            borderTop: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '10px',
                        }}
                    >
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                            Acceso en celular o tableta local
                        </span>
                        <button
                            type="button"
                            className="secondary-outline-btn"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                            onClick={abrirAccesoQr}
                        >
                            Ver código QR móvil
                        </button>
                    </div>
                </div>
            </div>

            {modalQrAbierto && (
                <div className="modal-overlay" onClick={() => setModalQrAbierto(false)}>
                    <div
                        className="modal-card"
                        style={{ maxWidth: '410px', textAlign: 'center' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="panel-card-header" style={{ marginBottom: 12 }}>
                            <span className="panel-card-title" style={{ marginBottom: 0 }}>
                                Acceso móvil en red local
                            </span>
                            <button
                                type="button"
                                className="secondary-outline-btn"
                                style={{ padding: '4px 10px', fontSize: '12px' }}
                                onClick={() => setModalQrAbierto(false)}
                            >
                                Cerrar
                            </button>
                        </div>
                        <div style={{ padding: '6px 4px 10px' }}>
                            {cargandoQr ? (
                                <p style={{ fontSize: '13px', color: '#64748b' }}>Generando código QR de red local...</p>
                            ) : infoQr?.qrSvg ? (
                                <>
                                    <p style={{ fontSize: '13px', color: '#475569', marginBottom: '14px' }}>
                                        Escanee con la cámara del teléfono conectado al mismo Wi-Fi. Desde el navegador móvil seleccione Instalar aplicación para abrirla como aplicación nativa.
                                    </p>
                                    <div
                                        style={{
                                            display: 'inline-block',
                                            padding: '12px',
                                            background: '#ffffff',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            marginBottom: '12px',
                                        }}
                                        dangerouslySetInnerHTML={{ __html: infoQr.qrSvg }}
                                    />
                                    <div
                                        style={{
                                            background: '#f8fafc',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '6px',
                                            padding: '8px 10px',
                                            fontSize: '12px',
                                            fontFamily: 'monospace',
                                            color: '#0f172a',
                                            wordBreak: 'break-all',
                                        }}
                                    >
                                        {infoQr.urlPrincipal}
                                    </div>
                                    {infoQr.urlsAlternativas?.length > 1 && (
                                        <p style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>
                                            Otras interfaces de red: {infoQr.urlsAlternativas.join(' · ')}
                                        </p>
                                    )}
                                </>
                            ) : (
                                <p style={{ fontSize: '13px', color: '#991b1b' }}>
                                    No se pudo obtener la dirección de red local del servidor.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div
                style={{
                    marginTop: '18px',
                    fontSize: '12px',
                    color: '#64748b',
                    textAlign: 'center',
                }}
            >
                Orderly POS · Sistema de Gestión Restaurantera
            </div>
        </div>
    );
}
