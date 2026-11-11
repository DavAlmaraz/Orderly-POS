import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api, { SOCKET_URL, obtenerSesionActiva, limpiarSesionActiva } from '../services/api';

const MOTIVOS_CANCELACION = [
    'Solicitud directa del cliente',
    'Tiempo de espera excedido',
    'Error al capturar la orden',
    'Platillo o ingrediente no disponible',
    'Cambio de opinión de los comensales',
];

export default function VistaMesero() {
    const navigate = useNavigate();
    const sesion = obtenerSesionActiva();
    const usuarioActual = sesion?.usuario || { id_usuario: 2, nombre: 'Maria', rol: 'mesera', turno: '9am - 5pm', iniciales: 'MA' };

    const [estado, setEstado] = useState(null);
    const [vistaMesera, setVistaMesera] = useState('mapa_mesas');
    const [menuAbierto, setMenuAbierto] = useState(() => window.innerWidth > 860);
    const [filtroMapaMesas, setFiltroMapaMesas] = useState('todas');
    const [toast, setToast] = useState(null);
    const [notificacionesEmergentes, setNotificacionesEmergentes] = useState([]);

    // Estado para Nueva Comanda (Ilustración 6)
    const [mesaSeleccionadaNueva, setMesaSeleccionadaNueva] = useState(1);
    const [personasNueva, setPersonasNueva] = useState(2);
    const [categoriaFiltro, setCategoriaFiltro] = useState('Todos');
    const [busquedaPlatillo, setBusquedaPlatillo] = useState('');
    const [carritoComanda, setCarritoComanda] = useState([]);
    const [notaGeneralNueva, setNotaGeneralNueva] = useState('');

    // Estado para Comanda Activa (Ilustración 5)
    const [mesaActivaDetalle, setMesaActivaDetalle] = useState(4);
    const [notaAlergiaActiva, setNotaAlergiaActiva] = useState('');
    const [mostrarCambioPersonas, setMostrarCambioPersonas] = useState(false);
    const [nuevoNumPersonas, setNuevoNumPersonas] = useState(2);
    const [mostrarTransferirMesa, setMostrarTransferirMesa] = useState(false);
    const [mesaDestinoTransferencia, setMesaDestinoTransferencia] = useState(1);

    // Estado para Modal de Cancelación de Orden
    const [modalCancelarAbierto, setModalCancelarAbierto] = useState(false);
    const [motivoCancelacionSel, setMotivoCancelacionSel] = useState(MOTIVOS_CANCELACION[0]);
    const [motivoCancelacionExtra, setMotivoCancelacionExtra] = useState('');
    const [cancelandoOrden, setCancelandoOrden] = useState(false);

    // Estado para Modal de Cobro y Separación de Cuenta
    const [modalCobroAbierto, setModalCobroAbierto] = useState(false);
    const [modoDivision, setModoDivision] = useState('completa');
    const [metodoPagoPrincipal, setMetodoPagoPrincipal] = useState('Efectivo');
    const [metodoPagoSecundario, setMetodoPagoSecundario] = useState('Tarjeta de crédito');
    const [porcentajePersona1, setPorcentajePersona1] = useState(50);
    const [montoPersona1, setMontoPersona1] = useState(150);
    const [platillosSeleccionadosPago1, setPlatillosSeleccionadosPago1] = useState({});

    function cambiarVista(nuevaVista) {
        setVistaMesera(nuevaVista);
        if (window.innerWidth <= 860) {
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
            // Silenciar si el navegador bloquea audio sin interacción previa
        }
    }

    function lanzarNotificacionEmergente(notif) {
        if (!notif) return;
        reproducirTonoAviso();
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

    const cargarEstado = async () => {
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
        cargarEstado();

        const socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            auth: { token: sesion.token },
        });

        socket.on('estado:actualizado', (snapshot) => {
            setEstado(snapshot);
        });

        socket.on('pedido_actualizado', (data) => {
            lanzarNotificacionEmergente({
                id: Date.now(),
                rol_destino: 'mesera',
                titulo: `¡Pedido Listo! — Mesa ${String(data.mesa || '').padStart(2, '0')}`,
                mensaje: data.mensaje || `El pedido #${data.id_pedido} está listo en barra para servir.`,
                hora: new Date().toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' }),
                tipo: 'ok',
                numero_mesa: data.mesa,
            });
            cargarEstado();
        });

        socket.on('pedido_cancelado', (data) => {
            mostrarToast(`Orden de Mesa ${String(data.numero_mesa || '').padStart(2, '0')} cancelada (${data.motivo}).`, 'alerta');
            cargarEstado();
        });

        socket.on('notificacion:emergente', (notif) => {
            if (!notif.rol_destino || notif.rol_destino === 'mesera' || notif.rol_destino === 'todos') {
                lanzarNotificacionEmergente(notif);
            }
        });

        socket.on('platillo:disponibilidad', ({ platillo }) => {
            mostrarToast(
                `${platillo.nombre} → ${platillo.disponible ? 'Disponible' : 'Agotado en cocina'}`,
                platillo.disponible ? 'ok' : 'critico'
            );
        });

        return () => socket.disconnect();
    }, []);

    const pedidosActivosSalón = useMemo(() => {
        if (!estado?.pedidos) return [];
        return estado.pedidos.filter((p) => {
            const est = (p.estado || p.Estado || '').toLowerCase();
            return est !== 'cerrado' && est !== 'cancelado';
        });
    }, [estado]);

    const pedidoMesaActiva = useMemo(() => {
        if (pedidosActivosSalón.length === 0) return null;
        const exacto = pedidosActivosSalón.find((p) => Number(p.numero_mesa || p.mesa) === Number(mesaActivaDetalle));
        if (exacto) return exacto;
        return pedidosActivosSalón[0] || null;
    }, [pedidosActivosSalón, mesaActivaDetalle]);

    useEffect(() => {
        if (pedidoMesaActiva) {
            setNotaAlergiaActiva(pedidoMesaActiva.nota_cocina || '');
            setNuevoNumPersonas(pedidoMesaActiva.personas || 2);
        }
    }, [pedidoMesaActiva?.id_pedido, pedidoMesaActiva?.numero_mesa]);

    function agregarAlCarrito(platillo) {
        const idPlat = platillo.id_platillo || platillo.Id_platillo;
        const nombrePlat = platillo.nombre || platillo.Nombre;
        const precioPlat = Number(platillo.precio || platillo.Precio);
        const disp = platillo.disponible ?? platillo.Disponible;

        if (!disp || platillo.stock <= 0) {
            mostrarToast(`El platillo "${nombrePlat}" está agotado.`, 'critico');
            return;
        }
        setCarritoComanda((prev) => {
            const existe = prev.find((item) => item.id_platillo === idPlat);
            if (existe) {
                return prev.map((item) =>
                    item.id_platillo === idPlat ? { ...item, cantidad: item.cantidad + 1 } : item
                );
            }
            return [
                ...prev,
                {
                    id_platillo: idPlat,
                    Id_platillo: idPlat,
                    nombre: nombrePlat,
                    Nombre: nombrePlat,
                    precio: precioPlat,
                    Precio: precioPlat,
                    cantidad: 1,
                    nota: '',
                },
            ];
        });
    }

    function cambiarCantidadCarrito(idPlatillo, delta) {
        setCarritoComanda((prev) =>
            prev
                .map((item) =>
                    item.id_platillo === idPlatillo ? { ...item, cantidad: Math.max(0, item.cantidad + delta) } : item
                )
                .filter((item) => item.cantidad > 0)
        );
    }

    function cambiarNotaItemCarrito(idPlatillo, nuevaNota) {
        setCarritoComanda((prev) =>
            prev.map((item) => (item.id_platillo === idPlatillo ? { ...item, nota: nuevaNota } : item))
        );
    }

    async function enviarNuevaComandaACocina() {
        if (carritoComanda.length === 0) {
            mostrarToast('Seleccione al menos un platillo para registrar la comanda.', 'alerta');
            return;
        }
        const total = carritoComanda.reduce((acc, c) => acc + c.precio * c.cantidad, 0);
        try {
            await api.post('/pedidos', {
                id_usuario: usuarioActual.id_usuario || 2,
                numero_mesa: Number(mesaSeleccionadaNueva),
                mesa: Number(mesaSeleccionadaNueva),
                personas: Number(personasNueva),
                nombre_mesera: usuarioActual.nombre,
                nota_cocina: notaGeneralNueva,
                total,
                platillos: carritoComanda.map((c) => ({
                    Id_platillo: c.id_platillo,
                    id_platillo: c.id_platillo,
                    Nombre: c.nombre,
                    nombre: c.nombre,
                    Precio: c.precio,
                    precio: c.precio,
                    cantidad: c.cantidad,
                    subtotal: c.precio * c.cantidad,
                    notas_item: c.nota,
                })),
                items: carritoComanda.map((c) => ({
                    id_platillo: c.id_platillo,
                    cantidad: c.cantidad,
                    notas_item: c.nota,
                })),
            });
            setCarritoComanda([]);
            setNotaGeneralNueva('');
            mostrarToast(`Comanda enviada a cocina — Mesa ${String(mesaSeleccionadaNueva).padStart(2, '0')}`, 'ok');
            setMesaActivaDetalle(Number(mesaSeleccionadaNueva));
            cambiarVista('comanda_activa');
            cargarEstado();
        } catch (err) {
            mostrarToast(err.response?.data?.error || 'Error al enviar comanda', 'critico');
        }
    }

    async function modificarCantidadDetalleActivo(idPedido, idDetalle, delta) {
        try {
            await api.patch(`/pedidos/${idPedido}`, {
                id_detalle: idDetalle,
                delta_cantidad: delta,
            });
            cargarEstado();
        } catch {
            mostrarToast('No se pudo actualizar la cantidad.', 'critico');
        }
    }

    async function eliminarPlatilloDeComandaActiva(idPedido, idDetalle, nombrePlatillo) {
        try {
            const res = await api.patch(`/pedidos/${idPedido}`, {
                id_detalle: idDetalle,
                eliminar_detalle: true,
            });
            if (res.data?.canceladoAutomaticamente) {
                mostrarToast('Se eliminó el último platillo y la mesa quedó libre.', 'alerta');
                cambiarVista('mapa_mesas');
            } else {
                mostrarToast(`"${nombrePlatillo}" eliminado de la comanda.`, 'ok');
            }
            cargarEstado();
        } catch {
            mostrarToast('No se pudo eliminar el platillo de la comanda.', 'critico');
        }
    }

    async function confirmarCancelacionOrden() {
        if (!pedidoMesaActiva || cancelandoOrden) return;
        setCancelandoOrden(true);
        const motivoFinal = motivoCancelacionExtra.trim()
            ? `${motivoCancelacionSel} (${motivoCancelacionExtra.trim()})`
            : motivoCancelacionSel;

        try {
            const res = await api.post(`/pedidos/${pedidoMesaActiva.id_pedido}/cancelar`, {
                motivo: motivoFinal,
            });
            setModalCancelarAbierto(false);
            setMotivoCancelacionExtra('');
            mostrarToast(res.data?.mensaje || `Orden cancelada y Mesa ${String(pedidoMesaActiva.numero_mesa).padStart(2, '0')} liberada.`, 'ok');
            cambiarVista('mapa_mesas');
            cargarEstado();
        } catch (err) {
            mostrarToast(err.response?.data?.error || 'Error al cancelar la orden', 'critico');
        } finally {
            setCancelandoOrden(false);
        }
    }

    async function guardarNotaComandaActiva(idPedido) {
        try {
            await api.patch(`/pedidos/${idPedido}`, {
                nota_cocina: notaAlergiaActiva,
            });
            mostrarToast('Nota de alergia/preparación sincronizada con cocina.', 'ok');
            cargarEstado();
        } catch {
            mostrarToast('Error al guardar la nota.', 'critico');
        }
    }

    async function enviarAvisoEmergenteACocina(numeroMesa) {
        try {
            await api.post('/notificaciones/emergente', {
                rol_destino: 'cocina',
                titulo: `Aviso de salón — Mesa ${String(numeroMesa).padStart(2, '0')}`,
                mensaje: `${usuarioActual.nombre} solicita prioridad o seguimiento en Mesa ${String(numeroMesa).padStart(2, '0')} (${notaAlergiaActiva || 'Comensales esperando'}).`,
                tipo: 'alerta',
                numero_mesa: numeroMesa,
            });
            mostrarToast('Aviso urgente enviado a la pantalla de Cocina.', 'ok');
        } catch {
            mostrarToast('Error al enviar aviso a cocina.', 'critico');
        }
    }

    async function guardarCambioPersonasMesa() {
        if (!pedidoMesaActiva) return;
        try {
            await api.patch(`/mesas/${pedidoMesaActiva.numero_mesa}`, {
                personas: Number(nuevoNumPersonas),
            });
            setMostrarCambioPersonas(false);
            mostrarToast(
                `Mesa ${String(pedidoMesaActiva.numero_mesa).padStart(2, '0')} actualizada a ${nuevoNumPersonas} personas.`,
                'ok'
            );
            cargarEstado();
        } catch {
            mostrarToast('Error al actualizar número de personas.', 'critico');
        }
    }

    async function ejecutarTransferenciaMesa() {
        if (!pedidoMesaActiva) return;
        try {
            await api.post('/mesas/transferir', {
                mesa_origen: pedidoMesaActiva.numero_mesa,
                mesa_destino: Number(mesaDestinoTransferencia),
            });
            setMostrarTransferirMesa(false);
            setMesaActivaDetalle(Number(mesaDestinoTransferencia));
            mostrarToast(
                `Comanda transferida a Mesa ${String(mesaDestinoTransferencia).padStart(2, '0')}.`,
                'ok'
            );
            cargarEstado();
        } catch (err) {
            mostrarToast(err.response?.data?.error || 'No se pudo transferir la mesa', 'critico');
        }
    }

    async function procesarCobroCuenta() {
        if (!pedidoMesaActiva) return;
        const mesaACobrar = pedidoMesaActiva.numero_mesa;
        const totalCuenta = Number(pedidoMesaActiva.total || 0);
        let pagosDivididos = [];

        if (modoDivision === 'completa') {
            pagosDivididos = [{ metodo: metodoPagoPrincipal, monto: totalCuenta, concepto: 'Cuenta completa' }];
        } else if (modoDivision === 'porcentaje') {
            const m1 = Number(((totalCuenta * porcentajePersona1) / 100).toFixed(2));
            const m2 = Number((totalCuenta - m1).toFixed(2));
            pagosDivididos = [
                { metodo: metodoPagoPrincipal, monto: m1, concepto: `División ${porcentajePersona1}%` },
                { metodo: metodoPagoSecundario, monto: m2, concepto: `División ${100 - porcentajePersona1}%` },
            ];
        } else if (modoDivision === 'monto') {
            const m1 = Math.min(totalCuenta, Math.max(1, Number(montoPersona1)));
            const m2 = Number((totalCuenta - m1).toFixed(2));
            pagosDivididos = [
                { metodo: metodoPagoPrincipal, monto: m1, concepto: 'Pago parcial 1' },
                ...(m2 > 0 ? [{ metodo: metodoPagoSecundario, monto: m2, concepto: 'Resto de cuenta' }] : []),
            ];
        } else if (modoDivision === 'platillo') {
            const detallesActivos = (pedidoMesaActiva.detalles || []).filter((d) => d.estado_item !== 'agotado_eliminado');
            const m1 = detallesActivos
                .filter((d) => platillosSeleccionadosPago1[d.id_detalle])
                .reduce((acc, d) => acc + d.subtotal, 0);
            const m2 = Number((totalCuenta - m1).toFixed(2));
            if (m1 <= 0) {
                pagosDivididos = [{ metodo: metodoPagoPrincipal, monto: totalCuenta, concepto: 'Todos los platillos' }];
            } else {
                pagosDivididos = [
                    { metodo: metodoPagoPrincipal, monto: m1, concepto: 'Platillos seleccionados (Cuenta 1)' },
                    ...(m2 > 0 ? [{ metodo: metodoPagoSecundario, monto: m2, concepto: 'Platillos restantes (Cuenta 2)' }] : []),
                ];
            }
        }

        try {
            const res = await api.post('/pagos', {
                numero_mesa: mesaACobrar,
                id_pedido: pedidoMesaActiva.id_pedido,
                mesera: usuarioActual.nombre,
                pagos_divididos: pagosDivididos,
            });
            setModalCobroAbierto(false);
            setPlatillosSeleccionadosPago1({});
            mostrarToast(
                `Mesa ${String(mesaACobrar).padStart(2, '0')} cobrada ($${res.data.totalCobrado.toFixed(2)}) y liberada.`,
                'ok'
            );
            cambiarVista('mapa_mesas');
            cargarEstado();
        } catch (err) {
            mostrarToast(err.response?.data?.error || 'Error al cobrar cuenta', 'critico');
        }
    }

    const handleCerrarSesion = async () => {
        try {
            await api.post('/auth/logout');
        } catch {
            // Ignorar si ya expiró
        }
        limpiarSesionActiva();
        navigate('/login');
    };

    if (!estado) {
        return (
            <div style={{ padding: 48, textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
                <h2>Cargando Módulo de Mesera — Orderly POS...</h2>
            </div>
        );
    }

    const mesasLibres = estado.mesas.filter((m) => m.estado === 'libre');
    const mesasFiltradasMapa = estado.mesas.filter((m) => {
        if (filtroMapaMesas === 'todas') return true;
        return m.estado === filtroMapaMesas;
    });

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
                                <span className="emergente-popup-tag cocina">AVISO DE COCINA → SALÓN</span>
                                <span style={{ fontSize: 11.5, color: '#6b7280', fontWeight: 600 }}>{notif.hora}</span>
                            </div>
                            <div className="emergente-popup-title">{notif.titulo}</div>
                            <div className="emergente-popup-msg">{notif.mensaje}</div>
                            <div className="emergente-popup-actions">
                                {notif.numero_mesa && (
                                    <button
                                        type="button"
                                        className="primary-dark-btn"
                                        style={{ padding: '5px 11px', fontSize: 12 }}
                                        onClick={() => {
                                            setMesaActivaDetalle(Number(notif.numero_mesa));
                                            cambiarVista('comanda_activa');
                                            setNotificacionesEmergentes((prev) => prev.filter((p) => p.id !== notif.id));
                                        }}
                                    >
                                        Ir a Mesa {String(notif.numero_mesa).padStart(2, '0')} →
                                    </button>
                                )}
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

                <aside className={`sidebar theme-mesera ${menuAbierto ? '' : 'closed'}`}>
                    <div>
                        <div className="sidebar-brand">
                            <div>
                                <div className="brand-logo-box">
                                    <div className="brand-logo-circle" />
                                </div>
                                <div className="brand-title">Orderly</div>
                                <div className="brand-subtitle">Mesera · Salón</div>
                            </div>
                            <button
                                type="button"
                                className="sidebar-close-mobile"
                                onClick={() => setMenuAbierto(false)}
                                aria-label="Cerrar menú"
                            >
                                ✕
                            </button>
                        </div>

                        <nav className="sidebar-nav">
                            <div className="nav-section-label">SALÓN</div>
                            <button
                                className={`nav-item ${vistaMesera === 'mapa_mesas' ? 'active' : ''}`}
                                onClick={() => cambiarVista('mapa_mesas')}
                            >
                                <span>Mapa de mesas</span>
                            </button>
                            <button
                                className={`nav-item ${vistaMesera === 'nueva_comanda' ? 'active' : ''}`}
                                onClick={() => cambiarVista('nueva_comanda')}
                            >
                                <span>Nueva comanda</span>
                            </button>
                            <button
                                className={`nav-item ${vistaMesera === 'comanda_activa' ? 'active' : ''}`}
                                onClick={() => cambiarVista('comanda_activa')}
                            >
                                <span>Mis comandas activas</span>
                                <span className="nav-badge">{pedidosActivosSalón.length}</span>
                            </button>

                            <div className="nav-section-label">CUENTA</div>
                            <button
                                className={`nav-item ${vistaMesera === 'notificaciones' ? 'active' : ''}`}
                                onClick={() => cambiarVista('notificaciones')}
                            >
                                <span>Notificaciones</span>
                                <span className="nav-badge">{estado.notificaciones.length}</span>
                            </button>
                            <button
                                className={`nav-item ${vistaMesera === 'historial' ? 'active' : ''}`}
                                onClick={() => cambiarVista('historial')}
                            >
                                <span>Mi historial</span>
                            </button>
                            <button className="nav-item" onClick={handleCerrarSesion}>
                                <span>Cerrar sesión</span>
                            </button>
                        </nav>
                    </div>

                    <div className="sidebar-footer">
                        <div className="user-avatar">{usuarioActual.iniciales || 'MA'}</div>
                        <div>
                            <div className="user-meta-name">{usuarioActual.nombre}</div>
                            <div className="user-meta-role">Mesera · {usuarioActual.turno || '9am - 5pm'}</div>
                        </div>
                    </div>
                </aside>

                <main className="main-area">
                    <header className="top-header">
                        <div className="header-left-group">
                            <button
                                type="button"
                                className="hamburger-btn"
                                onClick={() => setMenuAbierto((prev) => !prev)}
                                title={menuAbierto ? 'Ocultar menú lateral' : 'Mostrar menú lateral'}
                                aria-label="Menú principal"
                            >
                                <span className="hamburger-line" />
                                <span className="hamburger-line" />
                                <span className="hamburger-line" />
                            </button>
                            <h1 className="top-header-title">
                                {vistaMesera === 'mapa_mesas' && 'Mapa de mesas'}
                                {vistaMesera === 'nueva_comanda' && 'Nueva comanda'}
                                {vistaMesera === 'comanda_activa' &&
                                    `Comanda activa — Mesa ${String(pedidoMesaActiva?.numero_mesa || mesaActivaDetalle).padStart(2, '0')}`}
                                {vistaMesera === 'notificaciones' && 'Notificaciones de salón'}
                                {vistaMesera === 'historial' && 'Mi historial de mesas cobradas'}
                            </h1>
                        </div>

                        <div className="top-header-badges">
                            {vistaMesera === 'mapa_mesas' && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setFiltroMapaMesas(filtroMapaMesas === 'libre' ? 'todas' : 'libre')}
                                        className="pill-badge green"
                                        style={{
                                            border: filtroMapaMesas === 'libre' ? '1.5px solid #15803d' : 'none',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {estado.mesas.filter((m) => m.estado === 'libre').length} libres
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFiltroMapaMesas(filtroMapaMesas === 'ocupada' ? 'todas' : 'ocupada')}
                                        className="pill-badge red"
                                        style={{
                                            border: filtroMapaMesas === 'ocupada' ? '1.5px solid #dc2626' : 'none',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {estado.mesas.filter((m) => m.estado === 'ocupada').length} ocupadas
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFiltroMapaMesas(filtroMapaMesas === 'por_cobrar' ? 'todas' : 'por_cobrar')}
                                        className="pill-badge amber"
                                        style={{
                                            border: filtroMapaMesas === 'por_cobrar' ? '1.5px solid #b45309' : 'none',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {estado.mesas.filter((m) => m.estado === 'por_cobrar').length} por cobrar
                                    </button>
                                </>
                            )}
                            {vistaMesera === 'comanda_activa' && pedidoMesaActiva && (
                                <>
                                    <span
                                        className={`pill-badge ${
                                            pedidoMesaActiva.estado === 'preparado' ? 'amber' : 'red'
                                        }`}
                                    >
                                        {pedidoMesaActiva.estado === 'preparado'
                                            ? 'Por cobrar / Lista en mesa'
                                            : `En cocina · ${pedidoMesaActiva.minutos_espera || 1} min`}
                                    </span>
                                    <span className="pill-badge gray">{pedidoMesaActiva.personas || 2} personas</span>
                                </>
                            )}
                        </div>
                    </header>

                    <div className="content-container">
                        {vistaMesera === 'mapa_mesas' && (
                            <div className="panel-card">
                                <div className="panel-card-header">
                                    <div className="panel-card-title" style={{ marginBottom: 0 }}>
                                        Seleccione una mesa libre para abrir comanda o una ocupada para gestionar su cuenta
                                    </div>
                                    <div className="category-tabs" style={{ margin: 0 }}>
                                        {[
                                            { id: 'todas', label: 'Todas (10)' },
                                            { id: 'libre', label: 'Libres' },
                                            { id: 'ocupada', label: 'Ocupadas' },
                                            { id: 'por_cobrar', label: 'Por cobrar' },
                                        ].map((f) => (
                                            <button
                                                key={f.id}
                                                type="button"
                                                className={`cat-tab ${filtroMapaMesas === f.id ? 'active' : ''}`}
                                                onClick={() => setFiltroMapaMesas(f.id)}
                                            >
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="tables-map-grid">
                                    {mesasFiltradasMapa.map((m) => (
                                        <div
                                            key={m.numero}
                                            className={`mesa-tile ${m.estado}`}
                                            onClick={() => {
                                                if (m.estado === 'libre') {
                                                    setMesaSeleccionadaNueva(m.numero);
                                                    cambiarVista('nueva_comanda');
                                                } else {
                                                    setMesaActivaDetalle(m.numero);
                                                    cambiarVista('comanda_activa');
                                                }
                                            }}
                                        >
                                            <div className="mesa-number">{String(m.numero).padStart(2, '0')}</div>
                                            <div className="mesa-status-text">
                                                {m.estado === 'libre' && 'Libre · Abrir orden'}
                                                {m.estado === 'ocupada' && `${m.personas} personas · $${m.total}`}
                                                {m.estado === 'por_cobrar' && `Por cobrar · $${m.total}`}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {vistaMesera === 'nueva_comanda' && (
                            <div className="split-workspace">
                                <div className="panel-card">
                                    <div className="panel-card-title">Catálogo de platillos disponibles</div>
                                    <input
                                        type="text"
                                        placeholder="Buscar platillo o ingrediente..."
                                        value={busquedaPlatillo}
                                        onChange={(e) => setBusquedaPlatillo(e.target.value)}
                                        className="form-input-clean"
                                    />

                                    <div className="category-tabs">
                                        {['Todos', 'Entradas', 'Plato fuerte', 'Bebidas', 'Postres'].map((cat) => (
                                            <button
                                                key={cat}
                                                type="button"
                                                className={`cat-tab ${categoriaFiltro === cat ? 'active' : ''}`}
                                                onClick={() => setCategoriaFiltro(cat)}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>

                                    <div>
                                        {estado.platillos
                                            .filter((p) => categoriaFiltro === 'Todos' || (p.categoria || p.Categoria) === categoriaFiltro)
                                            .filter(
                                                (p) =>
                                                    (p.nombre || p.Nombre || '').toLowerCase().includes(busquedaPlatillo.toLowerCase()) ||
                                                    (p.descripcion || p.Descripcion || '').toLowerCase().includes(busquedaPlatillo.toLowerCase())
                                            )
                                            .map((pl) => {
                                                const idP = pl.id_platillo || pl.Id_platillo;
                                                const disp = pl.disponible ?? pl.Disponible;
                                                const enCarrito = carritoComanda.find((c) => c.id_platillo === idP);
                                                return (
                                                    <div
                                                        key={idP}
                                                        className={`menu-item-card ${!disp ? 'agotado' : ''}`}
                                                        onClick={() => disp && agregarAlCarrito(pl)}
                                                        style={{ cursor: disp ? 'pointer' : 'not-allowed' }}
                                                    >
                                                        <div>
                                                            <div style={{ fontWeight: 600, fontSize: 14 }}>
                                                                {pl.nombre || pl.Nombre}{' '}
                                                                {enCarrito && (
                                                                    <span className="pill-badge green" style={{ marginLeft: 6, padding: '2px 7px', fontSize: 11 }}>
                                                                        {enCarrito.cantidad} en orden
                                                                    </span>
                                                                )}
                                                                {!disp && '— AGOTADO'}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    fontSize: 12,
                                                                    color: !disp ? '#dc2626' : '#6b7280',
                                                                }}
                                                            >
                                                                {!disp
                                                                    ? 'Agotado en cocina'
                                                                    : pl.descripcion || pl.Descripcion}
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                            <span style={{ fontWeight: 700 }}>${pl.precio || pl.Precio}</span>
                                                            {disp && (
                                                                <button
                                                                    type="button"
                                                                    className="add-dish-btn"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        agregarAlCarrito(pl);
                                                                    }}
                                                                    title="Agregar a comanda"
                                                                >
                                                                    +
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>

                                <div className="panel-card">
                                    <div className="panel-card-header">
                                        <span className="panel-card-title" style={{ marginBottom: 0 }}>
                                            Comanda — Mesa {String(mesaSeleccionadaNueva).padStart(2, '0')} · {personasNueva} personas
                                        </span>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <select
                                                value={mesaSeleccionadaNueva}
                                                onChange={(e) => setMesaSeleccionadaNueva(Number(e.target.value))}
                                                style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12.5 }}
                                            >
                                                {estado.mesas.map((m) => (
                                                    <option key={m.numero} value={m.numero}>
                                                        Mesa {String(m.numero).padStart(2, '0')} ({m.estado})
                                                    </option>
                                                ))}
                                            </select>
                                            <input
                                                type="number"
                                                min="1"
                                                max="20"
                                                value={personasNueva}
                                                onChange={(e) => setPersonasNueva(Number(e.target.value))}
                                                style={{ width: 56, padding: '5px 6px', borderRadius: 6, border: '1px solid #d1d5db' }}
                                                title="Número de personas"
                                            />
                                        </div>
                                    </div>

                                    {carritoComanda.length === 0 ? (
                                        <div
                                            style={{
                                                padding: '28px 16px',
                                                textAlign: 'center',
                                                color: '#6b7280',
                                                fontSize: '13px',
                                                background: '#f8fafc',
                                                borderRadius: '8px',
                                                border: '1px dashed #cbd5e1',
                                                marginBottom: '14px',
                                            }}
                                        >
                                            Toque cualquier platillo del catálogo para agregarlo a la Mesa{' '}
                                            {String(mesaSeleccionadaNueva).padStart(2, '0')}.
                                        </div>
                                    ) : (
                                        carritoComanda.map((item) => (
                                            <div
                                                key={item.id_platillo}
                                                style={{
                                                    padding: '10px 0',
                                                    borderBottom: '1px solid #f3f4f6',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                    }}
                                                >
                                                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{item.nombre}</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <div className="qty-stepper">
                                                            <button type="button" onClick={() => cambiarCantidadCarrito(item.id_platillo, -1)}>−</button>
                                                            <span>{item.cantidad}</span>
                                                            <button type="button" onClick={() => cambiarCantidadCarrito(item.id_platillo, 1)}>+</button>
                                                        </div>
                                                        <span style={{ fontWeight: 700, width: 52, textAlign: 'right' }}>
                                                            ${item.precio * item.cantidad}
                                                        </span>
                                                    </div>
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="Observación del platillo (ej. sin cebolla)..."
                                                    value={item.nota || ''}
                                                    onChange={(e) => cambiarNotaItemCarrito(item.id_platillo, e.target.value)}
                                                    style={{
                                                        marginTop: 6,
                                                        width: '100%',
                                                        padding: '5px 8px',
                                                        fontSize: '12px',
                                                        borderRadius: '6px',
                                                        border: '1px solid #e5e7eb',
                                                        color: '#4b5563',
                                                    }}
                                                />
                                            </div>
                                        ))
                                    )}

                                    <div style={{ marginTop: 14 }}>
                                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                                            Observaciones generales para cocina
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Ej. Alergias o indicaciones especiales de la mesa..."
                                            value={notaGeneralNueva}
                                            onChange={(e) => setNotaGeneralNueva(e.target.value)}
                                            className="form-input-clean"
                                        />
                                    </div>

                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            fontWeight: 700,
                                            fontSize: 16,
                                            margin: '18px 0',
                                        }}
                                    >
                                        <span>Total estimado</span>
                                        <span>
                                            ${carritoComanda.reduce((acc, c) => acc + c.precio * c.cantidad, 0).toFixed(2)}
                                        </span>
                                    </div>

                                    <button
                                        type="button"
                                        className="primary-dark-btn"
                                        style={{ width: '100%', marginBottom: 10 }}
                                        onClick={enviarNuevaComandaACocina}
                                    >
                                        Enviar comanda a cocina →
                                    </button>
                                    <button
                                        type="button"
                                        className="secondary-outline-btn"
                                        style={{ width: '100%' }}
                                        onClick={() => setCarritoComanda([])}
                                    >
                                        Vaciar selección
                                    </button>
                                </div>
                            </div>
                        )}

                        {vistaMesera === 'comanda_activa' && !pedidoMesaActiva && (
                            <div className="panel-card" style={{ textAlign: 'center', padding: 40 }}>
                                <div className="panel-card-title">No hay comandas activas pendientes en salón</div>
                                <p style={{ color: '#6b7280', fontSize: 13.5, marginBottom: 16 }}>
                                    Todas las mesas han sido cobradas o están libres en este momento.
                                </p>
                                <button type="button" className="primary-dark-btn" onClick={() => cambiarVista('nueva_comanda')}>
                                    + Crear nueva comanda
                                </button>
                            </div>
                        )}

                        {vistaMesera === 'comanda_activa' && pedidoMesaActiva && (
                            <div className="split-workspace">
                                <div className="panel-card">
                                    <div className="panel-card-header">
                                        <span className="panel-card-title" style={{ marginBottom: 0 }}>
                                            Platillos en la comanda — Mesa {String(pedidoMesaActiva.numero_mesa).padStart(2, '0')}
                                        </span>
                                        <select
                                            value={pedidoMesaActiva.numero_mesa}
                                            onChange={(e) => setMesaActivaDetalle(Number(e.target.value))}
                                            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12.5 }}
                                        >
                                            {pedidosActivosSalón.map((p) => (
                                                <option key={p.id_pedido} value={p.numero_mesa}>
                                                    Mesa {String(p.numero_mesa).padStart(2, '0')} (${p.total})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {(pedidoMesaActiva.detalles || []).map((det) => {
                                        const esAgotado = det.estado_item === 'agotado_eliminado';
                                        const nombreItem = det.nombre || det.Nombre;
                                        return (
                                            <div
                                                key={det.id_detalle}
                                                style={{
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: 10,
                                                    padding: '12px 14px',
                                                    marginBottom: 10,
                                                    background: esAgotado ? '#fef2f2' : '#ffffff',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    gap: 10,
                                                }}
                                            >
                                                <div>
                                                    <div
                                                        style={{
                                                            fontWeight: 600,
                                                            fontSize: 13.5,
                                                            textDecoration: esAgotado ? 'line-through' : 'none',
                                                            color: esAgotado ? '#991b1b' : '#111827',
                                                        }}
                                                    >
                                                        {nombreItem}
                                                    </div>
                                                    <div style={{ fontSize: 12, color: esAgotado ? '#dc2626' : '#6b7280' }}>
                                                        {esAgotado ? 'Agotado en cocina — no se cobra' : (det.notas_item || `$${det.precio} c/u`)}
                                                    </div>
                                                </div>

                                                {esAgotado ? (
                                                    <span className="pill-badge red">Eliminado</span>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div className="qty-stepper">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    modificarCantidadDetalleActivo(pedidoMesaActiva.id_pedido, det.id_detalle, -1)
                                                                }
                                                            >
                                                                −
                                                            </button>
                                                            <span>{det.cantidad}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    modificarCantidadDetalleActivo(pedidoMesaActiva.id_pedido, det.id_detalle, 1)
                                                                }
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                        <span style={{ fontWeight: 700, width: 48, textAlign: 'right' }}>
                                                            ${det.subtotal}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className="remove-item-btn"
                                                            title="Cancelar este platillo de la orden"
                                                            onClick={() =>
                                                                eliminarPlatilloDeComandaActiva(
                                                                    pedidoMesaActiva.id_pedido,
                                                                    det.id_detalle,
                                                                    nombreItem
                                                                )
                                                            }
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMesaSeleccionadaNueva(pedidoMesaActiva.numero_mesa);
                                            cambiarVista('nueva_comanda');
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: 11,
                                            borderRadius: 8,
                                            border: '1px dashed #cbd5e1',
                                            background: '#f8fafc',
                                            color: '#475569',
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                            marginTop: 6,
                                        }}
                                    >
                                        + Agregar platillo disponible a esta comanda
                                    </button>

                                    <div style={{ marginTop: 16 }}>
                                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                                            Nota de alergia o preparación especial
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            <input
                                                type="text"
                                                value={notaAlergiaActiva}
                                                onChange={(e) => setNotaAlergiaActiva(e.target.value)}
                                                placeholder="Ej. Sin crema, alergia a cacahuate..."
                                                style={{
                                                    flex: 1,
                                                    minWidth: 180,
                                                    padding: '9px 12px',
                                                    borderRadius: 8,
                                                    border: '1px solid #fcd34d',
                                                    background: '#fffbeb',
                                                    color: '#92400e',
                                                    fontSize: 13,
                                                }}
                                            />
                                            <button
                                                type="button"
                                                className="secondary-outline-btn"
                                                onClick={() => guardarNotaComandaActiva(pedidoMesaActiva.id_pedido)}
                                            >
                                                Guardar
                                            </button>
                                            <button
                                                type="button"
                                                className="primary-dark-btn"
                                                style={{ padding: '9px 12px', fontSize: 12.5 }}
                                                onClick={() => enviarAvisoEmergenteACocina(pedidoMesaActiva.numero_mesa)}
                                            >
                                                Avisar a cocina
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div className="panel-card" style={{ marginBottom: 16 }}>
                                        <div className="panel-card-title">Resumen de cuenta</div>
                                        {(pedidoMesaActiva.detalles || [])
                                            .filter((d) => d.estado_item !== 'agotado_eliminado')
                                            .map((d) => (
                                                <div
                                                    key={d.id_detalle}
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        fontSize: 13.5,
                                                        padding: '6px 0',
                                                        color: '#374151',
                                                    }}
                                                >
                                                    <span>
                                                        {d.nombre || d.Nombre} × {d.cantidad}
                                                    </span>
                                                    <span style={{ fontWeight: 600 }}>${Number(d.subtotal).toFixed(2)}</span>
                                                </div>
                                            ))}
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                fontWeight: 700,
                                                fontSize: 16,
                                                borderTop: '1px solid #e5e7eb',
                                                marginTop: 12,
                                                paddingTop: 12,
                                            }}
                                        >
                                            <span>Total actualizado</span>
                                            <span>${Number(pedidoMesaActiva.total).toFixed(2)}</span>
                                        </div>
                                    </div>

                                    <div className="panel-card">
                                        <div className="panel-card-title">Acciones de la mesa</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            <button
                                                type="button"
                                                className="primary-dark-btn"
                                                onClick={() => setModalCobroAbierto(true)}
                                            >
                                                Cobrar y cerrar mesa →
                                            </button>

                                            <button
                                                type="button"
                                                className="secondary-outline-btn"
                                                onClick={() => setMostrarCambioPersonas(!mostrarCambioPersonas)}
                                            >
                                                Cambiar número de personas
                                            </button>
                                            {mostrarCambioPersonas && (
                                                <div style={{ display: 'flex', gap: 8, padding: 8, background: '#f8fafc', borderRadius: 8 }}>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="20"
                                                        value={nuevoNumPersonas}
                                                        onChange={(e) => setNuevoNumPersonas(e.target.value)}
                                                        style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
                                                    />
                                                    <button type="button" className="primary-dark-btn" onClick={guardarCambioPersonasMesa}>
                                                        Aplicar
                                                    </button>
                                                </div>
                                            )}

                                            <button
                                                type="button"
                                                className="secondary-outline-btn"
                                                onClick={() => {
                                                    if (mesasLibres.length > 0) setMesaDestinoTransferencia(mesasLibres[0].numero);
                                                    setMostrarTransferirMesa(!mostrarTransferirMesa);
                                                }}
                                            >
                                                Transferir a otra mesa
                                            </button>
                                            {mostrarTransferirMesa && (
                                                <div style={{ display: 'flex', gap: 8, padding: 8, background: '#f8fafc', borderRadius: 8 }}>
                                                    <select
                                                        value={mesaDestinoTransferencia}
                                                        onChange={(e) => setMesaDestinoTransferencia(Number(e.target.value))}
                                                        style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
                                                    >
                                                        {mesasLibres.map((ml) => (
                                                            <option key={ml.numero} value={ml.numero}>
                                                                Mesa {String(ml.numero).padStart(2, '0')} (Libre)
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <button type="button" className="primary-dark-btn" onClick={ejecutarTransferenciaMesa}>
                                                        Mover
                                                    </button>
                                                </div>
                                            )}

                                            {/* BOTÓN FORMAL DE CANCELACIÓN DE ORDEN */}
                                            <button
                                                type="button"
                                                className="danger-outline-btn"
                                                style={{ marginTop: 4 }}
                                                onClick={() => setModalCancelarAbierto(true)}
                                            >
                                                ✕ Cancelar orden y liberar mesa
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {(vistaMesera === 'notificaciones' || vistaMesera === 'historial') && (
                            <div className="panel-card">
                                <div className="panel-card-title">
                                    {vistaMesera === 'notificaciones'
                                        ? 'Notificaciones recibidas de cocina'
                                        : 'Historial de pagos y cierres realizados'}
                                </div>
                                {vistaMesera === 'historial'
                                    ? estado.pagos.map((p) => (
                                          <div
                                              key={p.id_pago}
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
                                                  <strong>{p.numero_mesa}</strong> — {p.resumen_platillos} ({p.metodo})
                                              </span>
                                              <strong>
                                                  ${Number(p.monto).toFixed(2)} · {p.hora}
                                              </strong>
                                          </div>
                                      ))
                                    : estado.notificaciones.map((n) => (
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

            {/* MODAL DE CANCELACIÓN DE ORDEN (SOLICITUD DEL CLIENTE / MESERA) */}
            {modalCancelarAbierto && pedidoMesaActiva && (
                <div className="modal-overlay">
                    <div className="modal-card" style={{ maxWidth: 480 }}>
                        <div className="panel-card-header">
                            <span className="panel-card-title" style={{ marginBottom: 0, color: '#991b1b' }}>
                                Cancelar Orden — Mesa {String(pedidoMesaActiva.numero_mesa).padStart(2, '0')}
                            </span>
                            <button
                                type="button"
                                onClick={() => setModalCancelarAbierto(false)}
                                style={{ border: 'none', background: 'transparent', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}
                            >
                                Cerrar
                            </button>
                        </div>

                        <p style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.5, marginBottom: 14 }}>
                            Esta acción cancelará la comanda <strong>#{pedidoMesaActiva.id_pedido}</strong> (${Number(pedidoMesaActiva.total).toFixed(2)}), liberará la{' '}
                            <strong>Mesa {String(pedidoMesaActiva.numero_mesa).padStart(2, '0')}</strong> y enviará un aviso automático al monitor de Cocina.
                        </p>

                        <div className="form-field-group">
                            <label className="form-field-label">Motivo de cancelación:</label>
                            <select
                                value={motivoCancelacionSel}
                                onChange={(e) => setMotivoCancelacionSel(e.target.value)}
                                className="form-input-clean"
                            >
                                {MOTIVOS_CANCELACION.map((m) => (
                                    <option key={m} value={m}>
                                        {m}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-field-group">
                            <label className="form-field-label">Observación adicional (opcional):</label>
                            <input
                                type="text"
                                placeholder="Detalles adicionales para bitácora y cocina..."
                                value={motivoCancelacionExtra}
                                onChange={(e) => setMotivoCancelacionExtra(e.target.value)}
                                className="form-input-clean"
                            />
                        </div>

                        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                            <button
                                type="button"
                                className="secondary-outline-btn"
                                style={{ flex: 1 }}
                                onClick={() => setModalCancelarAbierto(false)}
                            >
                                Volver
                            </button>
                            <button
                                type="button"
                                className="danger-solid-btn"
                                style={{ flex: 1.5 }}
                                disabled={cancelandoOrden}
                                onClick={confirmarCancelacionOrden}
                            >
                                {cancelandoOrden ? 'Cancelando...' : 'Confirmar cancelación'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE COBRO Y SEPARACIÓN DE CUENTAS */}
            {modalCobroAbierto && pedidoMesaActiva && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <div className="panel-card-header">
                            <span className="panel-card-title" style={{ marginBottom: 0 }}>
                                Cobrar y Cerrar — Mesa {String(pedidoMesaActiva.numero_mesa).padStart(2, '0')} (Total: $
                                {Number(pedidoMesaActiva.total).toFixed(2)})
                            </span>
                            <button
                                type="button"
                                onClick={() => setModalCobroAbierto(false)}
                                style={{ border: 'none', background: 'transparent', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}
                            >
                                Cerrar
                            </button>
                        </div>

                        <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>
                            Modalidad de cobro:
                        </div>
                        <div className="category-tabs" style={{ marginTop: 0 }}>
                            {[
                                { id: 'completa', label: 'Cuenta única' },
                                { id: 'platillo', label: 'Separar por platillo' },
                                { id: 'porcentaje', label: 'Separar por porcentaje (%)' },
                                { id: 'monto', label: 'Separar por monto ($)' },
                            ].map((m) => (
                                <button
                                    key={m.id}
                                    type="button"
                                    className={`cat-tab ${modoDivision === m.id ? 'active' : ''}`}
                                    onClick={() => setModoDivision(m.id)}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>

                        {modoDivision === 'platillo' && (
                            <div
                                style={{
                                    background: '#f8fafc',
                                    padding: 12,
                                    borderRadius: 8,
                                    marginBottom: 12,
                                    fontSize: 13,
                                }}
                            >
                                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                                    Marca los platillos que pagará el Comensal 1:
                                </div>
                                {(pedidoMesaActiva.detalles || [])
                                    .filter((d) => d.estado_item !== 'agotado_eliminado')
                                    .map((d) => (
                                        <label
                                            key={d.id_detalle}
                                            style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', cursor: 'pointer' }}
                                        >
                                            <span>
                                                <input
                                                    type="checkbox"
                                                    checked={!!platillosSeleccionadosPago1[d.id_detalle]}
                                                    onChange={(e) =>
                                                        setPlatillosSeleccionadosPago1({
                                                            ...platillosSeleccionadosPago1,
                                                            [d.id_detalle]: e.target.checked,
                                                        })
                                                    }
                                                    style={{ marginRight: 8 }}
                                                />
                                                {d.nombre || d.Nombre} ×{d.cantidad}
                                            </span>
                                            <strong>${d.subtotal}</strong>
                                        </label>
                                    ))}
                            </div>
                        )}

                        {modoDivision === 'porcentaje' && (
                            <div style={{ marginBottom: 12 }}>
                                <label style={{ fontSize: 13, fontWeight: 600 }}>
                                    Porcentaje Comensal 1: {porcentajePersona1}% ($
                                    {((pedidoMesaActiva.total * porcentajePersona1) / 100).toFixed(2)}) / Comensal 2:{' '}
                                    {100 - porcentajePersona1}% ($
                                    {((pedidoMesaActiva.total * (100 - porcentajePersona1)) / 100).toFixed(2)})
                                </label>
                                <input
                                    type="range"
                                    min="10"
                                    max="90"
                                    step="5"
                                    value={porcentajePersona1}
                                    onChange={(e) => setPorcentajePersona1(Number(e.target.value))}
                                    style={{ width: '100%', marginTop: 6 }}
                                />
                            </div>
                        )}

                        {modoDivision === 'monto' && (
                            <div style={{ marginBottom: 12 }}>
                                <label style={{ fontSize: 13, fontWeight: 600 }}>Monto a cubrir en Pago 1 ($):</label>
                                <input
                                    type="number"
                                    value={montoPersona1}
                                    onChange={(e) => setMontoPersona1(Number(e.target.value))}
                                    className="form-input-clean"
                                    style={{ marginTop: 4 }}
                                />
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
                            <div>
                                <label style={{ fontSize: 12.5, fontWeight: 600 }}>Método de pago 1:</label>
                                <select
                                    value={metodoPagoPrincipal}
                                    onChange={(e) => setMetodoPagoPrincipal(e.target.value)}
                                    className="form-input-clean"
                                    style={{ marginTop: 4 }}
                                >
                                    <option value="Efectivo">Efectivo</option>
                                    <option value="Tarjeta de crédito">Tarjeta de crédito</option>
                                    <option value="Tarjeta de débito">Tarjeta de débito</option>
                                    <option value="Transferencia">Transferencia bancaria</option>
                                    <option value="Monedero digital">Monedero digital</option>
                                </select>
                            </div>

                            {modoDivision !== 'completa' && (
                                <div>
                                    <label style={{ fontSize: 12.5, fontWeight: 600 }}>Método de pago 2 (Restante):</label>
                                    <select
                                        value={metodoPagoSecundario}
                                        onChange={(e) => setMetodoPagoSecundario(e.target.value)}
                                        className="form-input-clean"
                                        style={{ marginTop: 4 }}
                                    >
                                        <option value="Tarjeta de crédito">Tarjeta de crédito</option>
                                        <option value="Tarjeta de débito">Tarjeta de débito</option>
                                        <option value="Efectivo">Efectivo</option>
                                        <option value="Transferencia">Transferencia bancaria</option>
                                        <option value="Monedero digital">Monedero digital</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                type="button"
                                className="secondary-outline-btn"
                                style={{ flex: 1 }}
                                onClick={() => setModalCobroAbierto(false)}
                            >
                                Cancelar
                            </button>
                            <button type="button" className="primary-dark-btn" style={{ flex: 2 }} onClick={procesarCobroCuenta}>
                                Confirmar pago y liberar Mesa {String(pedidoMesaActiva.numero_mesa).padStart(2, '0')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
