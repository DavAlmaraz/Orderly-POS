import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api, {
    SOCKET_URL,
    obtenerSesionActiva,
    limpiarSesionActiva,
    dispararNotificacionPushNavegador,
} from '../services/api';

export default function VistaCocina() {
    const navigate = useNavigate();
    const sesion = obtenerSesionActiva();
    const usuarioActual = sesion?.usuario || { id_usuario: 3, nombre: 'Roberto', rol: 'cocina', turno: '8am - 4pm', iniciales: 'RO' };

    const [estado, setEstado] = useState(null);
    const [vistaCocina, setVistaCocina] = useState('pendientes');
    const [menuAbierto, setMenuAbierto] = useState(() => (typeof window !== 'undefined' ? window.innerWidth > 768 : true));

    useEffect(() => {
        const onResize = () => {
            if (window.innerWidth <= 768) setMenuAbierto(false);
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    const [filtroComandas, setFiltroComandas] = useState('todas');
    const [platillosMarcadosAvance, setPlatillosMarcadosAvance] = useState({});
    const [toast, setToast] = useState(null);
    const [notificacionesEmergentes, setNotificacionesEmergentes] = useState([]);

    function cambiarVista(nuevaVista) {
        setVistaCocina(nuevaVista);
        if (window.innerWidth <= 768) {
            setMenuAbierto(false);
        }
    }

    function mostrarToast(mensaje, tipo = 'ok') {
        setToast({ mensaje, tipo });
        setTimeout(() => {
            setToast((prev) => (prev && prev.mensaje === mensaje ? null : prev));
        }, 3800);
    }

    function reproducirTonoAviso() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, ctx.currentTime);
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
        } catch {
            // Silenciar si el navegador bloquea audio sin interacción
        }
    }

    function lanzarNotificacionEmergente(notif) {
        if (!notif) return;
        reproducirTonoAviso();
        dispararNotificacionPushNavegador({
            titulo: notif.titulo,
            mensaje: notif.mensaje,
            tag: `cocina-push-${notif.id || Date.now()}`,
            severidad: notif.tipo || notif.severidad || 'alerta',
        });
        const idPopup = notif.id || Date.now() + Math.random();
        const item = { ...notif, id: idPopup };
        setNotificacionesEmergentes((prev) => {
            if (prev.some((p) => p.id === item.id || (p.titulo === item.titulo && p.mensaje === item.mensaje))) {
                return prev;
            }
            return [item, ...prev].slice(0, 4);
        });
        setTimeout(() => {
            setNotificacionesEmergentes((prev) => prev.filter((p) => p.id !== idPopup));
        }, 12000);
    }

    const cargarEstadoCocina = async () => {
        try {
            const res = await api.get('/estado');
            setEstado(res.data);
        } catch (err) {
            if (err.response?.status === 401) {
                limpiarSesionActiva();
                navigate('/login');
            }
        }
    };

    useEffect(() => {
        if (!sesion?.token) {
            navigate('/login');
            return;
        }

        cargarEstadoCocina();

        const socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            auth: { token: sesion.token },
        });

        socket.on('estado:actualizado', (snapshot) => {
            setEstado(snapshot);
        });

        socket.on('nuevo_pedido', (nuevoPedido) => {
            mostrarToast(`¡Nueva comanda recibida para Mesa ${String(nuevoPedido.mesa || nuevoPedido.numero_mesa || '').padStart(2, '0')}!`, 'ok');
            reproducirTonoAviso();
            cargarEstadoCocina();
        });

        socket.on('comanda:nueva', ({ pedido }) => {
            mostrarToast(`Nueva comanda en cocina — Mesa ${String(pedido.numero_mesa).padStart(2, '0')}`, 'ok');
            cargarEstadoCocina();
        });

        socket.on('pedido_cancelado', (data) => {
            mostrarToast(`Orden #${data.id_pedido} (Mesa ${String(data.numero_mesa).padStart(2, '0')}) fue cancelada: ${data.motivo}`, 'critico');
            cargarEstadoCocina();
        });

        socket.on('notificacion:emergente', (notif) => {
            if (!notif.rol_destino || notif.rol_destino === 'cocina' || notif.rol_destino === 'todos') {
                lanzarNotificacionEmergente(notif);
            }
        });

        socket.on('alerta:push_critica', (alerta) => {
            if (!alerta.rol_destino || alerta.rol_destino === 'cocina' || alerta.rol_destino === 'todos') {
                lanzarNotificacionEmergente({
                    ...alerta,
                    tipo: alerta.severidad || 'critico',
                });
            }
        });

        return () => socket.disconnect();
    }, []);

    const marcarComoListo = async (idPedido, nuevoEstado = 'preparado', tiempoExtendido = null) => {
        try {
            await api.put(`/pedidos/${idPedido}/estado`, {
                estado: nuevoEstado,
                tiempo_extendido: tiempoExtendido,
            });
            mostrarToast(
                tiempoExtendido
                    ? `Se notificó +${tiempoExtendido} min de preparación a salón.`
                    : `Pedido #${idPedido} marcado como "${nuevoEstado}".`,
                'ok'
            );
            cargarEstadoCocina();
        } catch (err) {
            mostrarToast(err.response?.data?.error || 'Error al actualizar el pedido', 'critico');
        }
    };

    const toggleDisponibilidadPlatillo = async (idPlatillo, disponibleActual) => {
        try {
            const res = await api.patch(`/platillos/${idPlatillo}/disponibilidad`, {
                disponible: !disponibleActual,
            });
            mostrarToast(res.data.mensaje, !disponibleActual ? 'ok' : 'alerta');
            cargarEstadoCocina();
        } catch (err) {
            mostrarToast(err.response?.data?.error || 'Error al cambiar disponibilidad', 'critico');
        }
    };

    const llamarMeseraABarra = async (ped) => {
        try {
            await api.post('/notificaciones/emergente', {
                rol_destino: 'mesera',
                titulo: `Pasar a barra — Mesa ${String(ped.numero_mesa || ped.mesa).padStart(2, '0')}`,
                mensaje: `Cocina (${usuarioActual.nombre}) solicita a ${ped.nombre_mesera || 'Mesera'} pasar a barra por avances de la Mesa ${String(ped.numero_mesa || ped.mesa).padStart(2, '0')}.`,
                tipo: 'ok',
                numero_mesa: ped.numero_mesa || ped.mesa,
            });
            mostrarToast(`Aviso enviado a ${ped.nombre_mesera || 'Salón'}.`, 'ok');
        } catch {
            mostrarToast('Error al enviar aviso.', 'critico');
        }
    };

    const togglePlatilloAvanceLocal = (idPedido, idDetalle) => {
        const key = `${idPedido}-${idDetalle}`;
        setPlatillosMarcadosAvance((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const handleCerrarSesion = async () => {
        try {
            await api.post('/auth/logout');
        } catch {
            // Ignorar si expiró
        }
        limpiarSesionActiva();
        navigate('/login', { replace: true, state: { sesionCerrada: true } });
    };

    const comandasPendientesCocina = useMemo(() => {
        if (!estado?.pedidos) return [];
        return estado.pedidos.filter((p) => (p.estado || p.Estado) === 'pendiente');
    }, [estado]);

    const comandasPendientesFiltradas = useMemo(() => {
        if (filtroComandas === 'urgentes') {
            return comandasPendientesCocina.filter((p) => (p.minutos_espera || 1) >= 10);
        }
        if (filtroComandas === 'recientes') {
            return comandasPendientesCocina.filter((p) => (p.minutos_espera || 1) < 10);
        }
        return comandasPendientesCocina;
    }, [comandasPendientesCocina, filtroComandas]);

    if (!estado) {
        return (
            <div style={{ padding: 48, textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
                <h2>Cargando Monitor de Cocina (KDS) — Orderly POS...</h2>
            </div>
        );
    }

    const comandasListasCocina = (estado.pedidos || []).filter((p) => (p.estado || p.Estado) === 'preparado');
    const insumosPrincipales = (estado.inventario || []).filter((i) => i.categoria_insumo === 'principal' || i.id_insumo <= 5);
    const insumosSecundarios = (estado.inventario || []).filter((i) => i.categoria_insumo === 'secundario' || i.id_insumo > 5);

    return (
        <div translate="no">
            {notificacionesEmergentes.length > 0 && (
                <div className="emergente-overlay-stack">
                    {notificacionesEmergentes.map((notif) => (
                        <div
                            key={notif.id}
                            className={`emergente-popup-card ${
                                notif.tipo === 'critico' ? 'tipo-critico' : notif.tipo === 'alerta' ? 'tipo-alerta' : 'tipo-ok'
                            }`}
                        >
                            <div className="emergente-popup-header">
                                <span className="emergente-popup-tag mesera">Aviso de salón</span>
                                <span style={{ fontSize: 11.5, color: '#6b7280', fontWeight: 600 }}>{notif.hora}</span>
                            </div>
                            <div className="emergente-popup-title">{notif.titulo}</div>
                            <div className="emergente-popup-msg">{notif.mensaje}</div>
                            <div className="emergente-popup-actions">
                                <button
                                    type="button"
                                    className="primary-dark-btn"
                                    style={{ padding: '5px 11px', fontSize: 12, background: '#1f5c35' }}
                                    onClick={() => {
                                        cambiarVista('pendientes');
                                        setNotificacionesEmergentes((prev) => prev.filter((p) => p.id !== notif.id));
                                    }}
                                >
                                    Ver comandas
                                </button>
                                <button
                                    type="button"
                                    className="secondary-outline-btn"
                                    style={{ padding: '5px 11px', fontSize: 12 }}
                                    onClick={() => setNotificacionesEmergentes((prev) => prev.filter((p) => p.id !== notif.id))}
                                >
                                    Entendido
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {toast && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: 22,
                        right: 22,
                        zIndex: 9999,
                        background: toast.tipo === 'critico' ? '#991b1b' : toast.tipo === 'alerta' ? '#92400e' : '#065f46',
                        color: '#ffffff',
                        padding: '12px 18px',
                        borderRadius: 10,
                        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                        fontSize: 13.5,
                        fontWeight: 600,
                    }}
                >
                    {toast.mensaje}
                </div>
            )}

            <div className="app-layout">
                <div
                    className={`sidebar-backdrop ${menuAbierto ? 'open' : ''}`}
                    onClick={() => setMenuAbierto(false)}
                />

                <aside className={`sidebar theme-cocina ${menuAbierto ? '' : 'closed'}`}>
                    <div>
                        <div className="sidebar-brand-row">
                            <div className="sidebar-brand-info">
                                <div className="brand-logo-box">
                                    <div className="brand-logo-circle" />
                                </div>
                                <div className="sidebar-brand-text">
                                    <div className="brand-title">Orderly</div>
                                    <div className="brand-subtitle">Cocina (KDS)</div>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="sidebar-toggle-btn"
                                onClick={() => setMenuAbierto((prev) => !prev)}
                                title={menuAbierto ? 'Compactar menú' : 'Extender menú'}
                                aria-label={menuAbierto ? 'Compactar menú' : 'Extender menú'}
                                aria-expanded={menuAbierto}
                            >
                                <span className="hamburger-line-white" />
                                <span className="hamburger-line-white" />
                                <span className="hamburger-line-white" />
                            </button>
                        </div>

                        <nav className="sidebar-nav">
                            <div className="nav-section-label">COMANDAS</div>
                            <button
                                className={`nav-item ${vistaCocina === 'pendientes' ? 'active' : ''}`}
                                onClick={() => cambiarVista('pendientes')}
                                title="Comandas pendientes"
                            >
                                <span className="nav-item-text">Comandas pendientes</span>
                                <span className="nav-badge">{comandasPendientesCocina.length}</span>
                            </button>
                            <button
                                className={`nav-item ${vistaCocina === 'listas' ? 'active' : ''}`}
                                onClick={() => cambiarVista('listas')}
                                title="Comandas listas"
                            >
                                <span className="nav-item-text">Comandas listas</span>
                            </button>

                            <div className="nav-section-label">MENÚ DEL DÍA</div>
                            <button
                                className={`nav-item ${vistaCocina === 'disponibles' ? 'active' : ''}`}
                                onClick={() => cambiarVista('disponibles')}
                                title="Platillos disponibles"
                            >
                                <span className="nav-item-text">Platillos disponibles</span>
                            </button>
                            <button
                                className={`nav-item ${vistaCocina === 'inventario_cocina' ? 'active' : ''}`}
                                onClick={() => cambiarVista('inventario_cocina')}
                                title="Inventario de cocina"
                            >
                                <span className="nav-item-text">Inventario de cocina</span>
                            </button>

                            <div className="nav-section-label">CUENTA</div>
                            <button
                                className={`nav-item ${vistaCocina === 'notificaciones' ? 'active' : ''}`}
                                onClick={() => cambiarVista('notificaciones')}
                                title="Notificaciones"
                            >
                                <span className="nav-item-text">Notificaciones</span>
                                <span className="nav-badge">{estado.notificaciones.length}</span>
                            </button>
                            <button
                                className="nav-item nav-item-logout"
                                onClick={handleCerrarSesion}
                                title="Cerrar sesión"
                            >
                                <span className="nav-item-text">Cerrar sesión</span>
                            </button>
                        </nav>
                    </div>

                    <div className="sidebar-footer" title={`${usuarioActual.nombre} · Cocinero en jefe`}>
                        <div className="user-avatar">{usuarioActual.iniciales || 'RO'}</div>
                        <div className="sidebar-user-text">
                            <div className="user-meta-name">{usuarioActual.nombre}</div>
                            <div className="user-meta-role">Cocinero en jefe · {usuarioActual.turno || '8am - 4pm'}</div>
                        </div>
                    </div>
                </aside>

                <main className="main-area">
                    <header className="top-header">
                        <div className="header-left-group">
                            {!menuAbierto && (
                                <button
                                    type="button"
                                    className="hamburger-btn mobile-menu-trigger"
                                    onClick={() => setMenuAbierto(true)}
                                    title="Desplegar menú"
                                    aria-label="Menú principal"
                                >
                                    <span className="hamburger-line" />
                                    <span className="hamburger-line" />
                                    <span className="hamburger-line" />
                                </button>
                            )}
                            <h1 className="top-header-title">
                                {vistaCocina === 'pendientes' && 'Comandas pendientes'}
                                {vistaCocina === 'listas' && 'Comandas listas para entregar'}
                                {vistaCocina === 'disponibles' && 'Platillos disponibles'}
                                {vistaCocina === 'inventario_cocina' && 'Inventario de cocina'}
                                {vistaCocina === 'notificaciones' && 'Notificaciones de cocina'}
                            </h1>
                        </div>

                        <div className="top-header-badges">
                            {vistaCocina === 'inventario_cocina' ? (
                                <>
                                    <span className="pill-badge red">
                                        {estado.inventario.filter((i) => i.nivel === 'crítico').length} crítico
                                    </span>
                                    <span className="pill-badge amber">
                                        {estado.inventario.filter((i) => i.nivel === 'bajo').length} bajos
                                    </span>
                                </>
                            ) : (
                                <>
                                    <span className="pill-badge red">{comandasPendientesCocina.length} en espera</span>
                                    <span className="pill-badge green">{24 + comandasListasCocina.length} completadas hoy</span>
                                </>
                            )}
                        </div>
                    </header>

                    <div className="content-container">
                        {vistaCocina === 'pendientes' && (
                            <>
                                <div className="panel-card-header" style={{ marginBottom: 14 }}>
                                    <div className="category-tabs" style={{ margin: 0 }}>
                                        {[
                                            { id: 'todas', label: `Todas (${comandasPendientesCocina.length})` },
                                            {
                                                id: 'urgentes',
                                                label: `Urgentes · 10+ min (${comandasPendientesCocina.filter((p) => (p.minutos_espera || 1) >= 10).length})`,
                                            },
                                            {
                                                id: 'recientes',
                                                label: `Recientes (${comandasPendientesCocina.filter((p) => (p.minutos_espera || 1) < 10).length})`,
                                            },
                                        ].map((f) => (
                                            <button
                                                key={f.id}
                                                type="button"
                                                className={`cat-tab ${filtroComandas === f.id ? 'active' : ''}`}
                                                onClick={() => setFiltroComandas(f.id)}
                                            >
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {comandasPendientesFiltradas.length === 0 ? (
                                    <div className="panel-card" style={{ textAlign: 'center', padding: 36, marginBottom: 20 }}>
                                        <div className="panel-card-title" style={{ marginBottom: 0 }}>Sin comandas pendientes</div>
                                    </div>
                                ) : (
                                    <div className="kitchen-orders-grid">
                                        {comandasPendientesFiltradas.map((ped) => {
                                            const idPed = ped.id_pedido || ped.Id_pedido;
                                            const numMesa = ped.numero_mesa || ped.mesa || 1;
                                            const minEspera = ped.minutos_espera || 1;
                                            const esUrgente = minEspera >= 10;
                                            const detalles = ped.detalles || ped.platillos || [];
                                            const tieneAgotado = detalles.some((d) => {
                                                const idP = d.id_platillo || d.Id_platillo;
                                                const pObj = estado.platillos.find((pl) => (pl.id_platillo || pl.Id_platillo) === idP);
                                                return pObj && !(pObj.disponible ?? pObj.Disponible);
                                            });

                                            return (
                                                <div className="kitchen-order-card" key={idPed}>
                                                    <div>
                                                        <div className="ko-header">
                                                            <span className="ko-title">Mesa {String(numMesa).padStart(2, '0')}</span>
                                                            <span
                                                                className={`pill-badge ${
                                                                    tieneAgotado ? 'gray' : esUrgente ? 'red' : 'amber'
                                                                }`}
                                                            >
                                                                {tieneAgotado
                                                                    ? 'Platillo agotado'
                                                                    : `Hace ${minEspera} min${esUrgente ? ' — urgente' : ''}`}
                                                            </span>
                                                        </div>

                                                        {ped.nota_cocina && <div className="ko-note-banner">{ped.nota_cocina}</div>}

                                                        <ul className="ko-items-list">
                                                            {detalles.map((det, idx) => {
                                                                const idDet = det.id_detalle || idx;
                                                                const idP = det.id_platillo || det.Id_platillo;
                                                                const platObj = estado.platillos.find((pl) => (pl.id_platillo || pl.Id_platillo) === idP);
                                                                const agotado = (platObj && !(platObj.disponible ?? platObj.Disponible)) || det.estado_item === 'agotado_eliminado';
                                                                const marcadoListo = !!platillosMarcadosAvance[`${idPed}-${idDet}`];

                                                                return (
                                                                    <li
                                                                        key={idDet}
                                                                        onClick={() => !agotado && togglePlatilloAvanceLocal(idPed, idDet)}
                                                                        title="Clic para marcar/desmarcar platillo preparado"
                                                                    >
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                            <span
                                                                                style={{
                                                                                    width: 16,
                                                                                    height: 16,
                                                                                    borderRadius: 4,
                                                                                    border: marcadoListo ? 'none' : '1.5px solid #cbd5e1',
                                                                                    background: agotado
                                                                                        ? '#ef4444'
                                                                                        : marcadoListo
                                                                                        ? '#16a34a'
                                                                                        : '#ffffff',
                                                                                    color: '#ffffff',
                                                                                    fontSize: 10,
                                                                                    display: 'inline-flex',
                                                                                    alignItems: 'center',
                                                                                    justifyContent: 'center',
                                                                                    fontWeight: 700,
                                                                                }}
                                                                            >
                                                                                {marcadoListo ? 'OK' : ''}
                                                                            </span>
                                                                            <span
                                                                                style={{
                                                                                    textDecoration: agotado || marcadoListo ? 'line-through' : 'none',
                                                                                    color: agotado ? '#ef4444' : marcadoListo ? '#15803d' : 'inherit',
                                                                                    fontWeight: marcadoListo ? 600 : 400,
                                                                                }}
                                                                            >
                                                                                {det.nombre || det.Nombre} × {det.cantidad || det.Cantidad}{' '}
                                                                                {agotado ? '(sin stock)' : ''}
                                                                            </span>
                                                                        </div>
                                                                        {det.notas_item && (
                                                                            <span style={{ fontSize: 11, color: '#b45309', fontWeight: 500 }}>
                                                                                {det.notas_item}
                                                                            </span>
                                                                        )}
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    </div>

                                                    <div>
                                                        {tieneAgotado ? (
                                                            <button
                                                                type="button"
                                                                className="ko-btn soft-red"
                                                                onClick={() => marcarComoListo(idPed, 'agotado')}
                                                            >
                                                                ! Notificar agotado
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                className={`ko-btn ${esUrgente ? 'primary-green' : 'soft-green'}`}
                                                                onClick={() => marcarComoListo(idPed, 'preparado')}
                                                            >
                                                                Marcar comanda lista
                                                            </button>
                                                        )}

                                                        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                                            <button
                                                                type="button"
                                                                className="secondary-outline-btn"
                                                                style={{ padding: '6px 8px', fontSize: 11.5 }}
                                                                onClick={() => marcarComoListo(idPed, null, 10)}
                                                            >
                                                                +10 min espera
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="secondary-outline-btn"
                                                                style={{ padding: '6px 8px', fontSize: 11.5, borderColor: '#86efac', color: '#166534' }}
                                                                onClick={() => llamarMeseraABarra(ped)}
                                                            >
                                                                Llamar mesera
                                                            </button>
                                                        </div>

                                                        <div className="ko-footer">
                                                            <span>Mesera: {ped.nombre_mesera || 'Maria'}</span>
                                                            <span>Recibida {ped.hora_recepcion || '9:39 am'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}

                        {/* Ilustración 3: Inventario de cocina */}
                        {vistaCocina === 'inventario_cocina' && (
                            <>
                                <div className="alert-banner">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span className="alert-dot" />
                                        <span>
                                            <strong>{estado.inventario.filter((i) => i.nivel !== 'OK').length} insumos por debajo del mínimo</strong>
                                        </span>
                                    </div>
                                </div>

                                <div className="inventory-two-cols">
                                    <div className="panel-card">
                                        <div className="panel-card-title">Insumos principales</div>
                                        {insumosPrincipales.map((ins) => (
                                            <div className="inv-item-row" key={ins.id_insumo}>
                                                <span>{ins.nombre}</span>
                                                <div className="hbar-track">
                                                    <div
                                                        className="hbar-fill"
                                                        style={{
                                                            width: `${ins.porcentaje}%`,
                                                            background:
                                                                ins.nivel === 'crítico'
                                                                    ? '#dc2626'
                                                                    : ins.nivel === 'bajo'
                                                                    ? '#d97706'
                                                                    : '#16a34a',
                                                        }}
                                                    />
                                                </div>
                                                <span style={{ color: '#6b7280', textAlign: 'right' }}>
                                                    {ins.cantidad} {ins.unidad}
                                                </span>
                                                <span
                                                    className={`pill-badge ${
                                                        ins.nivel === 'crítico' ? 'red' : ins.nivel === 'bajo' ? 'amber' : 'green'
                                                    }`}
                                                    style={{ textAlign: 'center' }}
                                                >
                                                    {ins.nivel}
                                                </span>
                                                <span />
                                            </div>
                                        ))}
                                    </div>

                                    <div className="panel-card">
                                        <div className="panel-card-title">Bebidas e insumos secundarios</div>
                                        {insumosSecundarios.map((ins) => (
                                            <div className="inv-item-row" key={ins.id_insumo}>
                                                <span>{ins.nombre}</span>
                                                <div className="hbar-track">
                                                    <div
                                                        className="hbar-fill"
                                                        style={{
                                                            width: `${ins.porcentaje}%`,
                                                            background:
                                                                ins.nivel === 'crítico'
                                                                    ? '#dc2626'
                                                                    : ins.nivel === 'bajo'
                                                                    ? '#d97706'
                                                                    : '#16a34a',
                                                        }}
                                                    />
                                                </div>
                                                <span style={{ color: '#6b7280', textAlign: 'right' }}>
                                                    {ins.cantidad} {ins.unidad}
                                                </span>
                                                <span
                                                    className={`pill-badge ${
                                                        ins.nivel === 'crítico' ? 'red' : ins.nivel === 'bajo' ? 'amber' : 'green'
                                                    }`}
                                                    style={{ textAlign: 'center' }}
                                                >
                                                    {ins.nivel}
                                                </span>
                                                <span />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="panel-card">
                                    <div className="panel-card-title">Platillos afectados por falta de insumos</div>
                                    <div className="table-responsive">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Platillo</th>
                                                    <th>Insumo faltante</th>
                                                    <th>Stock actual</th>
                                                    <th>Estado en menú</th>
                                                    <th>Acción</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td style={{ fontWeight: 700 }}>Mole rojo</td>
                                                    <td>Mole (0.5 lt)</td>
                                                    <td>0 porciones</td>
                                                    <td>
                                                        <span className="pill-badge red">Desactivado</span>
                                                    </td>
                                                    <td style={{ color: '#6b7280' }}>Oculto automáticamente en menú de meseras</td>
                                                </tr>
                                                <tr>
                                                    <td style={{ fontWeight: 700 }}>Enchiladas verdes</td>
                                                    <td>Chile verde (0.8 kg) · Crema (0.9 kg)</td>
                                                    <td>~3 porciones</td>
                                                    <td>
                                                        <span className="pill-badge amber">Por agotarse</span>
                                                    </td>
                                                    <td style={{ color: '#6b7280' }}>Alerta enviada al admin</td>
                                                </tr>
                                                <tr>
                                                    <td style={{ fontWeight: 700 }}>Pollo a la plancha</td>
                                                    <td>Pollo (1.2 kg)</td>
                                                    <td>~4 porciones</td>
                                                    <td>
                                                        <span className="pill-badge amber">Por agotarse</span>
                                                    </td>
                                                    <td style={{ color: '#6b7280' }}>Alerta enviada al admin</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}

                        {vistaCocina === 'listas' && (
                            <div className="panel-card">
                                <div className="panel-card-title">Comandas preparadas listas para entregar a mesa</div>
                                <div className="table-responsive">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Pedido</th>
                                                <th>Mesa</th>
                                                <th>Mesera</th>
                                                <th>Platillos</th>
                                                <th>Estado</th>
                                                <th>Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {comandasListasCocina.map((p) => (
                                                <tr key={p.id_pedido}>
                                                    <td>#{p.id_pedido}</td>
                                                    <td style={{ fontWeight: 700 }}>Mesa {String(p.numero_mesa).padStart(2, '0')}</td>
                                                    <td>{p.nombre_mesera}</td>
                                                    <td>{(p.detalles || []).map((d) => `${d.nombre || d.Nombre} ×${d.cantidad}`).join(', ')}</td>
                                                    <td>
                                                        <span className="pill-badge green">Lista para servir</span>
                                                    </td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="secondary-outline-btn"
                                                            style={{ padding: '4px 10px', fontSize: 12 }}
                                                            onClick={() => llamarMeseraABarra(p)}
                                                        >
                                                            Notificar a mesera
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {vistaCocina === 'disponibles' && (
                            <div className="panel-card">
                                <div className="panel-card-title">
                                    Disponibilidad del menú
                                </div>
                                <div className="availability-grid">
                                    {estado.platillos.map((pl) => {
                                        const idP = pl.id_platillo || pl.Id_platillo;
                                        const disp = pl.disponible ?? pl.Disponible;
                                        const recetaItems = Array.isArray(pl.receta) ? pl.receta : [];
                                        const nombresFaltantes = recetaItems
                                            .filter((rec) => {
                                                const insObj = (estado.inventario || []).find(
                                                    (i) => Number(i.id_insumo) === Number(rec.id_insumo)
                                                );
                                                return !insObj || Number(insObj.cantidad ?? insObj.stock ?? 0) < Number(rec.cantidad_requerida || 0);
                                            })
                                            .map((rec) => {
                                                const insObj = (estado.inventario || []).find(
                                                    (i) => Number(i.id_insumo) === Number(rec.id_insumo)
                                                );
                                                return insObj ? insObj.nombre : `Insumo #${rec.id_insumo}`;
                                            });
                                        const faltaInsumo = nombresFaltantes.length > 0;
                                        return (
                                            <div className="availability-pill-card" key={idP}>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                                                        {pl.nombre || pl.Nombre} (${pl.precio || pl.Precio})
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize: 12,
                                                            color: disp ? '#6b7280' : '#dc2626',
                                                            marginTop: 2,
                                                        }}
                                                    >
                                                        {disp
                                                            ? `${pl.stock ?? pl.Stock} ${pl.unidad_stock || 'porciones'} disponibles`
                                                            : faltaInsumo
                                                              ? `Sin insumos suficientes (${nombresFaltantes.join(', ')})`
                                                              : 'Agotado — oculto en menú'}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    className={`toggle-switch ${disp ? 'on' : ''}`}
                                                    onClick={() => toggleDisponibilidadPlatillo(idP, disp)}
                                                    style={!disp && faltaInsumo ? { opacity: 0.45 } : undefined}
                                                    title={
                                                        !disp && faltaInsumo
                                                            ? `Insumos insuficientes: ${nombresFaltantes.join(', ')}`
                                                            : 'Alternar disponibilidad'
                                                    }
                                                >
                                                    <span className="toggle-knob" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {vistaCocina === 'notificaciones' && (
                            <div className="panel-card">
                                <div className="panel-card-title">Historial de avisos de cocina</div>
                                {estado.notificaciones.map((n) => (
                                    <div
                                        key={n.id}
                                        style={{
                                            padding: '10px 0',
                                            borderBottom: '1px solid #f3f4f6',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            flexWrap: 'wrap',
                                            gap: 8,
                                        }}
                                    >
                                        <span>
                                            <strong>{n.titulo}:</strong> {n.mensaje}
                                        </span>
                                        <span style={{ color: '#6b7280', fontSize: 12 }}>{n.hora}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
