import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api, {
    SOCKET_URL,
    obtenerSesionActiva,
    limpiarSesionActiva,
    obtenerEstadoPermisoPush,
    solicitarPermisoNotificacionesPush,
    dispararNotificacionPushNavegador,
} from '../services/api';

const PROVEEDORES_DIRECTORIO = [
    {
        id: 'prov-carnes',
        empresa: 'Carnes y Aves San Juan',
        contacto: 'Sr. Roberto Méndez',
        telefono: '55 4120 8890',
        horario: 'Lunes a Sábado · 6:00 am – 3:00 pm',
        insumos: ['Pollo', 'Res', 'Costilla de cerdo'],
    },
    {
        id: 'prov-verduras',
        empresa: 'Hortalizas y Verduras El Huerto',
        contacto: 'Sra. Elena Ríos',
        telefono: '55 3891 2204',
        horario: 'Todos los días · 5:30 am – 2:00 pm',
        insumos: ['Chile verde', 'Tomate verde', 'Cebolla blanca', 'Aguacate'],
    },
    {
        id: 'prov-lacteos',
        empresa: 'Lácteos y Quesos Del Valle',
        contacto: 'Ing. Marcos Luna',
        telefono: '55 6712 4510',
        horario: 'Lunes a Sábado · 7:00 am – 4:00 pm',
        insumos: ['Crema', 'Queso Oaxaca'],
    },
    {
        id: 'prov-abarrotes',
        empresa: 'Abarrotes y Molino La Central',
        contacto: 'Lic. Patricia Vega',
        telefono: '55 5510 9341',
        horario: 'Lunes a Viernes · 8:00 am – 6:00 pm',
        insumos: ['Mole', 'Tortillas', 'Horchata', 'Jamaica', 'Aceite'],
    },
];

export default function VistaAdmin() {
    const navigate = useNavigate();
    const sesion = obtenerSesionActiva();
    const usuarioActual = sesion?.usuario || { id_usuario: 1, nombre: 'J. David', rol: 'administrador', turno: '8am - 6pm', iniciales: 'JD' };

    const [estado, setEstado] = useState(null);
    const [vistaAdmin, setVistaAdmin] = useState('dashboard');
    const [menuAbierto, setMenuAbierto] = useState(false);
    const [toast, setToast] = useState(null);

    // Filtros interactivos para reducir ruido visual
    const [filtroTransacciones, setFiltroTransacciones] = useState('Todas');
    const [filtroComandasAdmin, setFiltroComandasAdmin] = useState('activas');
    const [filtroDesempenoRol, setFiltroDesempenoRol] = useState('todos');
    const [mesaInspeccionada, setMesaInspeccionada] = useState(null);
    const [platilloEditando, setPlatilloEditando] = useState(null);

    // Notificaciones Push y Alertas Críticas en tiempo real
    const [permisoPush, setPermisoPush] = useState(() => obtenerEstadoPermisoPush());
    const [alertasPushFlotantes, setAlertasPushFlotantes] = useState([]);
    const [qrRed, setQrRed] = useState(null);

    // Configuración MySQL Server 9.4.0 & MySQL Workbench 8.0
    const [formMySQL, setFormMySQL] = useState({
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: '',
        database: 'OrderlyDB',
    });
    const [probandoMySQL, setProbandoMySQL] = useState(false);

    // Modal de Proveedores
    const [modalProveedoresAbierto, setModalProveedoresAbierto] = useState(false);
    const [insumoFiltroProveedor, setInsumoFiltroProveedor] = useState('');
    const [pedidosProveedores, setPedidosProveedores] = useState([]);

    // Formularios de Administración
    const [nuevoPlatillo, setNuevoPlatillo] = useState({
        nombre: '',
        descripcion: '',
        categoria: 'Plato fuerte',
        precio: '',
        stock: 15,
        receta: [],
    });
    const [insumoRecetaSeleccionado, setInsumoRecetaSeleccionado] = useState(5);
    const [cantidadRecetaSeleccionada, setCantidadRecetaSeleccionada] = useState(0.15);

    const [insumoRecetaEdicion, setInsumoRecetaEdicion] = useState(5);
    const [cantidadRecetaEdicion, setCantidadRecetaEdicion] = useState(0.15);

    const [modalTurnoAbierto, setModalTurnoAbierto] = useState(false);
    const [formTurnoActivo, setFormTurnoActivo] = useState({
        modalidad: 'Turno completo',
        hora_inicio: '08:00',
        hora_fin: '22:00',
        id_responsable: 1,
        notas: 'Operación normal de salón y cocina',
    });
    const [usuarioTurnoEditando, setUsuarioTurnoEditando] = useState(null);

    const [nuevoUsuario, setNuevoUsuario] = useState({
        nombre: '',
        rol: 'mesera',
        turno: '9am - 5pm',
        tipo_turno: 'Turno completo',
        contrasena: '',
    });
    const [cambioPassUsuario, setCambioPassUsuario] = useState({
        id_usuario: 2,
        nuevaContrasena: '',
    });
    const [ajusteInsumo, setAjusteInsumo] = useState({
        id_insumo: 5,
        cantidad: 5,
        tipo_movimiento: 'entrada',
        motivo: 'Reabastecimiento de proveedor',
    });

    function cambiarVista(nuevaVista) {
        setVistaAdmin(nuevaVista);
        setMenuAbierto(false);
    }

    function mostrarToast(mensaje, tipo = 'ok') {
        setToast({ mensaje, tipo });
        setTimeout(() => {
            setToast((prev) => (prev && prev.mensaje === mensaje ? null : prev));
        }, 3800);
    }

    function mostrarAlertaPushEnPantalla(alerta) {
        if (!alerta) return;
        const idPopup = alerta.id || Date.now() + Math.random();
        const item = {
            ...alerta,
            id: idPopup,
            severidad: alerta.severidad || alerta.tipo || 'critico',
        };
        dispararNotificacionPushNavegador({
            titulo: item.titulo,
            mensaje: item.mensaje,
            tag: `admin-push-${idPopup}`,
            severidad: item.severidad,
        });
        setAlertasPushFlotantes((prev) => {
            if (prev.some((p) => p.titulo === item.titulo && p.mensaje === item.mensaje)) return prev;
            return [item, ...prev].slice(0, 4);
        });
        setTimeout(() => {
            setAlertasPushFlotantes((prev) => prev.filter((p) => p.id !== idPopup));
        }, 12000);
    }

    async function activarNotificacionesPush() {
        const res = await solicitarPermisoNotificacionesPush();
        setPermisoPush(res);
        if (res === 'granted') {
            dispararNotificacionPushNavegador({
                titulo: 'Notificaciones Push Activadas',
                mensaje: 'Recibirás alertas inmediatas de insumos bajos/críticos, platillos agotados y comandas urgentes.',
                severidad: 'ok',
            });
            mostrarToast('Notificaciones Push del navegador activadas correctamente.', 'ok');
        } else {
            mostrarToast('Alertas Push en pantalla y sonido activadas en este dispositivo.', 'alerta');
        }
    }

    async function cargarQrRed() {
        try {
            const res = await api.get('/sistema/red-qr');
            setQrRed(res.data);
        } catch {
            setQrRed(null);
        }
    }

    async function guardarYConectarMySQL(e) {
        e.preventDefault();
        setProbandoMySQL(true);
        try {
            const res = await api.post('/sistema/mysql-config', formMySQL);
            mostrarToast(res.data?.mensaje || 'Configuración MySQL aplicada.', res.data?.conectado ? 'ok' : 'alerta');
            cargarEstadoAdmin();
        } catch (err) {
            mostrarToast(err.response?.data?.error || 'Error al configurar MySQL', 'critico');
        } finally {
            setProbandoMySQL(false);
        }
    }

    const cargarEstadoAdmin = async () => {
        try {
            const res = await api.get('/estado');
            setEstado(res.data);
            if (res.data?.conexionMySQL) {
                setFormMySQL((prev) => ({
                    ...prev,
                    host: res.data.conexionMySQL.host || 'localhost',
                    port: res.data.conexionMySQL.port || 3306,
                    user: res.data.conexionMySQL.user || 'root',
                    database: res.data.conexionMySQL.database || 'OrderlyDB',
                }));
            }
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
        cargarEstadoAdmin();

        const socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            auth: { token: sesion.token },
        });

        socket.on('estado:actualizado', (snapshot) => {
            setEstado(snapshot);
        });

        socket.on('alerta:push_critica', (alerta) => {
            mostrarAlertaPushEnPantalla(alerta);
        });

        socket.on('pedido_cancelado', (data) => {
            mostrarToast(`Orden #${data.id_pedido} (Mesa ${String(data.numero_mesa).padStart(2, '0')}) cancelada: ${data.motivo}`, 'alerta');
            cargarEstadoAdmin();
        });

        return () => socket.disconnect();
    }, []);

    function abrirModalProveedores(nombreInsumo = '') {
        setInsumoFiltroProveedor(nombreInsumo);
        setModalProveedoresAbierto(true);
    }

    function registrarLlamadaProveedor(proveedor) {
        const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        setPedidosProveedores((prev) => [
            {
                id: Date.now(),
                empresa: proveedor.empresa,
                contacto: proveedor.contacto,
                telefono: proveedor.telefono,
                insumos: proveedor.insumos.join(', '),
                hora,
                estado: 'Proveedor contactado · En espera de entrega',
            },
            ...prev,
        ]);
        mostrarToast(`Llamando a ${proveedor.empresa} (${proveedor.telefono}) — Solicitud registrada.`, 'ok');
    }

    async function toggleDisponibilidadPlatillo(idPlatillo, disponibleActual) {
        try {
            const res = await api.patch(`/platillos/${idPlatillo}/disponibilidad`, {
                disponible: !disponibleActual,
            });
            mostrarToast(res.data.mensaje, !disponibleActual ? 'ok' : 'alerta');
            cargarEstadoAdmin();
        } catch (err) {
            mostrarToast(err.response?.data?.error || 'Error al actualizar disponibilidad', 'critico');
        }
    }

    async function guardarEdicionPlatillo(e) {
        e.preventDefault();
        if (!platilloEditando) return;
        try {
            await api.patch(`/platillos/${platilloEditando.id_platillo}`, {
                nombre: platilloEditando.nombre,
                descripcion: platilloEditando.descripcion,
                categoria: platilloEditando.categoria,
                precio: Number(platilloEditando.precio),
                stock: Number(platilloEditando.stock),
                receta: Array.isArray(platilloEditando.receta) ? platilloEditando.receta : [],
            });
            mostrarToast(`Platillo "${platilloEditando.nombre}" y su receta actualizados correctamente.`, 'ok');
            setPlatilloEditando(null);
            cargarEstadoAdmin();
        } catch (err) {
            mostrarToast(err.response?.data?.error || 'Error al actualizar platillo', 'critico');
        }
    }

    function agregarInsumoARecetaNuevoPlatillo() {
        const idIns = Number(insumoRecetaSeleccionado);
        const cant = Number(cantidadRecetaSeleccionada);
        if (!idIns || isNaN(cant) || cant <= 0) {
            mostrarToast('Ingresa una cantidad requerida mayor a 0 para la receta.', 'alerta');
            return;
        }
        setNuevoPlatillo((prev) => {
            const lista = Array.isArray(prev.receta) ? [...prev.receta] : [];
            const idx = lista.findIndex((r) => Number(r.id_insumo) === idIns);
            if (idx >= 0) {
                lista[idx] = { id_insumo: idIns, cantidad_requerida: Number((lista[idx].cantidad_requerida + cant).toFixed(3)) };
            } else {
                lista.push({ id_insumo: idIns, cantidad_requerida: Number(cant.toFixed(3)) });
            }
            return { ...prev, receta: lista };
        });
    }

    function quitarInsumoDeRecetaNuevoPlatillo(idInsumo) {
        setNuevoPlatillo((prev) => ({
            ...prev,
            receta: (prev.receta || []).filter((r) => Number(r.id_insumo) !== Number(idInsumo)),
        }));
    }

    function agregarInsumoARecetaEdicion() {
        if (!platilloEditando) return;
        const idIns = Number(insumoRecetaEdicion);
        const cant = Number(cantidadRecetaEdicion);
        if (!idIns || isNaN(cant) || cant <= 0) {
            mostrarToast('Ingresa una cantidad válida mayor a 0.', 'alerta');
            return;
        }
        setPlatilloEditando((prev) => {
            const lista = Array.isArray(prev.receta) ? [...prev.receta] : [];
            const idx = lista.findIndex((r) => Number(r.id_insumo) === idIns);
            if (idx >= 0) {
                lista[idx] = { id_insumo: idIns, cantidad_requerida: Number((lista[idx].cantidad_requerida + cant).toFixed(3)) };
            } else {
                lista.push({ id_insumo: idIns, cantidad_requerida: Number(cant.toFixed(3)) });
            }
            return { ...prev, receta: lista };
        });
    }

    function quitarInsumoDeRecetaEdicion(idInsumo) {
        if (!platilloEditando) return;
        setPlatilloEditando((prev) => ({
            ...prev,
            receta: (prev.receta || []).filter((r) => Number(r.id_insumo) !== Number(idInsumo)),
        }));
    }

    function abrirModalEditarTurnoActivo() {
        const ta = estado?.turnoActivo || {
            modalidad: 'Turno completo',
            hora_inicio: '08:00',
            hora_fin: '22:00',
            id_responsable: 1,
            notas: 'Operación normal de salón y cocina',
        };
        setFormTurnoActivo({
            modalidad: ta.modalidad || 'Turno completo',
            hora_inicio: ta.hora_inicio || '08:00',
            hora_fin: ta.hora_fin || '22:00',
            id_responsable: Number(ta.id_responsable || 1),
            notas: ta.notas || '',
        });
        setModalTurnoAbierto(true);
    }

    async function guardarTurnoActivo(e) {
        e.preventDefault();
        try {
            const res = await api.patch('/turno-activo', formTurnoActivo);
            mostrarToast(res.data?.mensaje || 'Turno activo actualizado correctamente.', 'ok');
            setModalTurnoAbierto(false);
            cargarEstadoAdmin();
        } catch (err) {
            mostrarToast(err.response?.data?.error || 'Error al actualizar el turno activo', 'critico');
        }
    }

    async function guardarTurnoColaborador(e) {
        e.preventDefault();
        if (!usuarioTurnoEditando) return;
        try {
            const res = await api.patch(`/usuarios/${usuarioTurnoEditando.id_usuario}/turno`, {
                tipo_turno: usuarioTurnoEditando.tipo_turno,
                hora_inicio: usuarioTurnoEditando.hora_inicio,
                hora_fin: usuarioTurnoEditando.hora_fin,
                turno: usuarioTurnoEditando.turno,
                rol: usuarioTurnoEditando.rol,
            });
            mostrarToast(res.data?.mensaje || 'Turno del colaborador actualizado.', 'ok');
            setUsuarioTurnoEditando(null);
            cargarEstadoAdmin();
        } catch (err) {
            mostrarToast(err.response?.data?.error || 'Error al actualizar turno del colaborador', 'critico');
        }
    }

    async function cancelarComandaDesdeAdmin(pedido) {
        try {
            const res = await api.post(`/pedidos/${pedido.id_pedido}/cancelar`, {
                motivo: `Cancelación autorizada por Administración (${usuarioActual.nombre})`,
            });
            setMesaInspeccionada(null);
            mostrarToast(res.data?.mensaje || `Comanda #${pedido.id_pedido} cancelada y mesa liberada.`, 'ok');
            cargarEstadoAdmin();
        } catch (err) {
            mostrarToast(err.response?.data?.error || 'No se pudo cancelar la comanda', 'critico');
        }
    }

    async function crearPlatilloCatalogo(e) {
        e.preventDefault();
        if (!nuevoPlatillo.nombre || !nuevoPlatillo.precio) return;
        try {
            await api.post('/platillos', {
                ...nuevoPlatillo,
                precio: Number(nuevoPlatillo.precio),
                stock: Number(nuevoPlatillo.stock ?? 15),
                receta: Array.isArray(nuevoPlatillo.receta) ? nuevoPlatillo.receta : [],
            });
            setNuevoPlatillo({
                nombre: '',
                descripcion: '',
                categoria: 'Plato fuerte',
                precio: '',
                stock: 15,
                receta: [],
            });
            mostrarToast('Platillo y su receta registrados en el catálogo.', 'ok');
            cargarEstadoAdmin();
        } catch (err) {
            mostrarToast(err.response?.data?.error || 'Error al crear platillo', 'critico');
        }
    }

    async function guardarAjusteInventario(e) {
        e.preventDefault();
        try {
            await api.patch(`/inventario/${ajusteInsumo.id_insumo}`, {
                cantidad: Number(ajusteInsumo.cantidad),
                tipo_movimiento: ajusteInsumo.tipo_movimiento,
                motivo: ajusteInsumo.motivo,
            });
            mostrarToast('Movimiento registrado en inventario.', 'ok');
            cargarEstadoAdmin();
        } catch (err) {
            mostrarToast(err.response?.data?.error || 'Error al ajustar inventario', 'critico');
        }
    }

    async function crearUsuarioSistema(e) {
        e.preventDefault();
        if (!nuevoUsuario.nombre || !nuevoUsuario.contrasena) return;
        try {
            await api.post('/usuarios', nuevoUsuario);
            setNuevoUsuario({ nombre: '', rol: 'mesera', turno: '9am - 5pm', contrasena: '' });
            mostrarToast('Colaborador registrado correctamente.', 'ok');
            cargarEstadoAdmin();
        } catch (err) {
            mostrarToast(err.response?.data?.error || 'Error al crear usuario', 'critico');
        }
    }

    async function alternarEstadoUsuario(idUsuario) {
        try {
            await api.patch(`/usuarios/${idUsuario}/estado`);
            mostrarToast('Estado del colaborador actualizado.', 'ok');
            cargarEstadoAdmin();
        } catch (err) {
            mostrarToast(err.response?.data?.error || 'Error al actualizar estado del usuario', 'critico');
        }
    }

    async function actualizarPasswordUsuario(e) {
        e.preventDefault();
        if (!cambioPassUsuario.nuevaContrasena) return;
        try {
            await api.patch(`/usuarios/${cambioPassUsuario.id_usuario}/password`, {
                nuevaContrasena: cambioPassUsuario.nuevaContrasena,
            });
            setCambioPassUsuario({ ...cambioPassUsuario, nuevaContrasena: '' });
            mostrarToast('Contraseña actualizada correctamente.', 'ok');
        } catch (err) {
            mostrarToast(err.response?.data?.error || 'Error al cambiar contraseña', 'critico');
        }
    }

    async function dispararRespaldoManual() {
        try {
            const res = await api.post('/sistema/respaldo');
            mostrarToast(`Respaldo generado: ${res.data.archivo} (${res.data.hora})`, 'ok');
            cargarEstadoAdmin();
        } catch {
            mostrarToast('Error al generar respaldo.', 'critico');
        }
    }

    const handleCerrarSesion = async () => {
        try {
            await api.post('/auth/logout');
        } catch {
            // Ignorar si expiró
        }
        limpiarSesionActiva();
        navigate('/login', { replace: true, state: { sesionCerrada: true } });
    };

    const transaccionesFiltradas = useMemo(() => {
        if (!estado?.ultimasTransacciones) return [];
        if (filtroTransacciones === 'Todas') return estado.ultimasTransacciones;
        return estado.ultimasTransacciones.filter((t) => t.estado === filtroTransacciones);
    }, [estado, filtroTransacciones]);

    const comandasFiltradasAdmin = useMemo(() => {
        if (!estado?.pedidos) return [];
        if (filtroComandasAdmin === 'todas') return estado.pedidos;
        if (filtroComandasAdmin === 'activas') {
            return estado.pedidos.filter((p) => p.estado !== 'cerrado' && p.estado !== 'cancelado');
        }
        return estado.pedidos.filter((p) => p.estado === filtroComandasAdmin);
    }, [estado, filtroComandasAdmin]);

    if (!estado) {
        return (
            <div style={{ padding: 48, textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
                <h2>Cargando Panel de Administración — Orderly POS...</h2>
            </div>
        );
    }

    const pedidoMesaInspeccionada = mesaInspeccionada
        ? estado.pedidos.find(
              (p) => Number(p.numero_mesa) === Number(mesaInspeccionada.numero) && p.estado !== 'cerrado' && p.estado !== 'cancelado'
          )
        : null;

    return (
        <div translate="no">
            {alertasPushFlotantes.length > 0 && (
                <div className="emergente-overlay-stack">
                    {alertasPushFlotantes.map((alerta) => (
                        <div
                            key={alerta.id}
                            className={`emergente-popup-card ${
                                alerta.severidad === 'critico' ? 'tipo-critico' : 'tipo-alerta'
                            }`}
                        >
                            <div className="emergente-popup-header">
                                <span className="emergente-popup-tag">NOTIFICACIÓN PUSH CRÍTICA</span>
                                <span style={{ fontSize: 11.5, color: '#6b7280', fontWeight: 600 }}>{alerta.hora}</span>
                            </div>
                            <div className="emergente-popup-title">{alerta.titulo}</div>
                            <div className="emergente-popup-msg">{alerta.mensaje}</div>
                            <div className="emergente-popup-actions">
                                <button
                                    type="button"
                                    className="primary-dark-btn"
                                    style={{ padding: '5px 11px', fontSize: 12 }}
                                    onClick={() => {
                                        cambiarVista('inventario');
                                        setAlertasPushFlotantes((prev) => prev.filter((p) => p.id !== alerta.id));
                                    }}
                                >
                                    Revisar inventario →
                                </button>
                                <button
                                    type="button"
                                    className="secondary-outline-btn"
                                    style={{ padding: '5px 11px', fontSize: 12 }}
                                    onClick={() => setAlertasPushFlotantes((prev) => prev.filter((p) => p.id !== alerta.id))}
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

                <aside className={`sidebar theme-admin ${menuAbierto ? '' : 'closed'}`}>
                    <div>
                        <div className="sidebar-brand">
                            <div>
                                <div className="brand-logo-box">
                                    <div className="brand-logo-circle" />
                                </div>
                                <div className="brand-title">Orderly</div>
                                <div className="brand-subtitle">Administrador</div>
                            </div>
                            <button
                                type="button"
                                className="sidebar-close-mobile"
                                onClick={() => setMenuAbierto(false)}
                                aria-label="Cerrar menú"
                            >
                                Cerrar
                            </button>
                        </div>

                        <nav className="sidebar-nav">
                            <div className="nav-section-label">OPERACIÓN</div>
                            <button
                                className={`nav-item ${vistaAdmin === 'dashboard' ? 'active' : ''}`}
                                onClick={() => cambiarVista('dashboard')}
                            >
                                <span>Resumen del día</span>
                            </button>
                            <button
                                className={`nav-item ${vistaAdmin === 'mesas' ? 'active' : ''}`}
                                onClick={() => cambiarVista('mesas')}
                            >
                                <span>Mesas en tiempo real</span>
                            </button>
                            <button
                                className={`nav-item ${vistaAdmin === 'comandas' ? 'active' : ''}`}
                                onClick={() => cambiarVista('comandas')}
                            >
                                <span>Comandas activas</span>
                            </button>

                            <div className="nav-section-label">GESTIÓN</div>
                            <button
                                className={`nav-item ${vistaAdmin === 'catalogo' ? 'active' : ''}`}
                                onClick={() => cambiarVista('catalogo')}
                            >
                                <span>Platillos y menú</span>
                            </button>
                            <button
                                className={`nav-item ${vistaAdmin === 'inventario' ? 'active' : ''}`}
                                onClick={() => cambiarVista('inventario')}
                            >
                                <span>Inventario</span>
                                <span className="nav-badge">{estado.alertasActivasCount}</span>
                            </button>
                            <button
                                className={`nav-item ${vistaAdmin === 'usuarios' ? 'active' : ''}`}
                                onClick={() => cambiarVista('usuarios')}
                            >
                                <span>Usuarios y roles</span>
                            </button>

                            <div className="nav-section-label">FINANZAS</div>
                            <button
                                className={`nav-item ${vistaAdmin === 'reportes' ? 'active' : ''}`}
                                onClick={() => cambiarVista('reportes')}
                            >
                                <span>Reportes de ventas</span>
                            </button>
                            <button
                                className={`nav-item ${vistaAdmin === 'cierre_caja' ? 'active' : ''}`}
                                onClick={() => cambiarVista('cierre_caja')}
                            >
                                <span>Cierre de caja</span>
                            </button>

                            <div className="nav-section-label">CUENTA</div>
                            <button
                                className={`nav-item ${vistaAdmin === 'configuracion' ? 'active' : ''}`}
                                onClick={() => {
                                    cambiarVista('configuracion');
                                    cargarQrRed();
                                }}
                            >
                                <span>Configuración / Respaldos</span>
                            </button>
                            <button className="nav-item" onClick={handleCerrarSesion}>
                                <span>Cerrar sesión</span>
                            </button>
                        </nav>
                    </div>

                    <div className="sidebar-footer">
                        <div className="user-avatar">{usuarioActual.iniciales || 'JD'}</div>
                        <div>
                            <div className="user-meta-name">{usuarioActual.nombre}</div>
                            <div className="user-meta-role">Administrador</div>
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
                                {vistaAdmin === 'dashboard' && 'Dashboard — Resumen del día'}
                                {vistaAdmin === 'mesas' && 'Mesas en tiempo real (10 mesas)'}
                                {vistaAdmin === 'comandas' && 'Comandas registradas'}
                                {vistaAdmin === 'catalogo' && 'Catálogo de platillos y precios'}
                                {vistaAdmin === 'inventario' && 'Inventario de insumos y proveedores'}
                                {vistaAdmin === 'usuarios' && 'Usuarios, contraseñas y turnos'}
                                {vistaAdmin === 'reportes' && 'Reportes de ventas'}
                                {vistaAdmin === 'cierre_caja' && 'Cierre de caja por método de pago'}
                                {vistaAdmin === 'configuracion' && 'Respaldos y bitácora de actividad'}
                            </h1>
                        </div>
                        <div className="top-header-badges">
                            <button
                                type="button"
                                className={`pill-badge ${permisoPush === 'granted' ? 'green' : 'amber'}`}
                                style={{ border: '1px solid #cbd5e1', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                                onClick={activarNotificacionesPush}
                                title="Activar notificaciones Push del sistema para alertas de insumos bajos y comandas críticas"
                            >
                                <span>{permisoPush === 'granted' ? 'Push activo' : 'Activar alertas Push'}</span>
                            </button>
                            <button
                                type="button"
                                className="pill-badge green"
                                style={{ border: '1px solid #bbf7d0', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                onClick={abrirModalEditarTurnoActivo}
                                title="Clic para editar horario, modalidad o responsable del turno activo"
                            >
                                <span>
                                    Turno activo · {estado.turnoActivo?.modalidad || 'Turno completo'} ({estado.turnoActivo?.horario_texto || '8am - 10pm'}) · Resp: {estado.turnoActivo?.nombre_responsable || 'J. David'}
                                </span>
                                <span style={{ textDecoration: 'underline', fontWeight: 700, marginLeft: 4 }}>Editar</span>
                            </button>
                            {estado.alertasActivasCount > 0 && (
                                <button
                                    type="button"
                                    className="pill-badge red"
                                    style={{ border: 'none', cursor: 'pointer' }}
                                    onClick={() => cambiarVista('inventario')}
                                >
                                    {estado.alertasActivasCount} alertas de inventario
                                </button>
                            )}
                        </div>
                    </header>

                    <div className="content-container">
                        {vistaAdmin === 'dashboard' && (
                            <>
                                {estado.alertasActivasCount > 0 && (
                                    <div className="alert-banner">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <span className="alert-dot" />
                                            <span>
                                                <strong>Stock bajo:</strong>{' '}
                                                {estado.inventario
                                                    .filter((i) => i.nivel !== 'OK')
                                                    .map((i) => `${i.nombre} (${i.cantidad} ${i.unidad})`)
                                                    .join(', ')}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            <button
                                                type="button"
                                                className="secondary-outline-btn"
                                                style={{ padding: '6px 12px', fontSize: 12, borderColor: '#fca5a5', color: '#991b1b' }}
                                                onClick={() => abrirModalProveedores('')}
                                            >
                                                Llamar a proveedores
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Tarjetas KPI Interactivas (Clic navega a cada módulo) */}
                                <div className="kpi-grid">
                                    <div
                                        className="kpi-card interactive"
                                        onClick={() => cambiarVista('reportes')}
                                        title="Clic para abrir el desglose financiero"
                                    >
                                        <div className="kpi-label">
                                            <span>Ventas del día</span>
                                            <span style={{ fontSize: 11, color: '#9ca3af' }}>Ver →</span>
                                        </div>
                                        <div className="kpi-value">
                                            ${estado.metricasDia.ventasHoy.toLocaleString('en-US')}
                                        </div>
                                        <div className="kpi-trend green">{estado.metricasDia.porcentajeVsAyer || '↑ 12% vs ayer'}</div>
                                    </div>

                                    <div
                                        className="kpi-card interactive"
                                        onClick={() => cambiarVista('mesas')}
                                        title="Clic para inspeccionar las 10 mesas en tiempo real"
                                    >
                                        <div className="kpi-label">
                                            <span>Mesas atendidas</span>
                                            <span style={{ fontSize: 11, color: '#9ca3af' }}>Ver →</span>
                                        </div>
                                        <div className="kpi-value">{estado.metricasDia.mesasAtendidas}</div>
                                        <div className="kpi-trend">{estado.metricasDia.mesasVsAyer || '↑ 6 vs ayer'}</div>
                                    </div>

                                    <div
                                        className="kpi-card interactive"
                                        onClick={() => cambiarVista('comandas')}
                                        title="Clic para gestionar las comandas activas"
                                    >
                                        <div className="kpi-label">
                                            <span>Tiempo promedio</span>
                                            <span style={{ fontSize: 11, color: '#9ca3af' }}>Ver →</span>
                                        </div>
                                        <div className="kpi-value">{estado.metricasDia.tiempoPromedioMin || 48} min</div>
                                        <div className="kpi-trend">{estado.metricasDia.tiempoVsAyer || '↓ 8 min mejor'}</div>
                                    </div>

                                    <div
                                        className="kpi-card interactive"
                                        onClick={() => cambiarVista('inventario')}
                                        title="Clic para revisar insumos bajo mínimo"
                                    >
                                        <div className="kpi-label">
                                            <span>Alertas activas</span>
                                            <span style={{ fontSize: 11, color: '#9ca3af' }}>Ver →</span>
                                        </div>
                                        <div className="kpi-value red">{estado.alertasActivasCount}</div>
                                        <div className="kpi-trend red">Insumos bajo mínimo</div>
                                    </div>
                                </div>

                                <div className="charts-row">
                                    <div className="panel-card">
                                        <div className="panel-card-title">Ventas por hora — hoy</div>
                                        <div className="hourly-chart">
                                            {estado.metricasDia.ventasPorHora.map((vh) => {
                                                const altura = Math.min(100, Math.round((vh.monto / 2000) * 100));
                                                return (
                                                    <div
                                                        className="hourly-col"
                                                        key={vh.hora}
                                                        onClick={() => cambiarVista('reportes')}
                                                        title={`Hora ${vh.hora}: $${vh.monto.toLocaleString('en-US')}`}
                                                    >
                                                        <span className="hourly-amount">
                                                            ${vh.monto.toLocaleString('en-US')}
                                                        </span>
                                                        <div className="hourly-bar-track">
                                                            <div className="hourly-bar-fill" style={{ height: `${altura}%` }} />
                                                        </div>
                                                        <span className="hourly-label">{vh.hora}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="panel-card">
                                        <div className="panel-card-header">
                                            <span className="panel-card-title" style={{ marginBottom: 0 }}>
                                                Platillos más vendidos hoy
                                            </span>
                                            <button
                                                type="button"
                                                className="secondary-outline-btn"
                                                style={{ padding: '4px 10px', fontSize: 11.5 }}
                                                onClick={() => cambiarVista('catalogo')}
                                            >
                                                Editar menú →
                                            </button>
                                        </div>
                                        <div className="horizontal-bar-list">
                                            {estado.metricasDia.platillosVendidosHoy.map((pv, i) => {
                                                const colores = ['#1e293b', '#16a34a', '#d97706', '#64748b', '#94a3b8'];
                                                const pct = Math.min(100, Math.round((pv.cantidad / 45) * 100));
                                                return (
                                                    <div className="hbar-row" key={pv.id_platillo}>
                                                        <span style={{ color: '#4b5563' }}>{pv.nombre}</span>
                                                        <div className="hbar-track">
                                                            <div
                                                                className="hbar-fill"
                                                                style={{ width: `${pct}%`, background: colores[i % colores.length] }}
                                                            />
                                                        </div>
                                                        <span style={{ fontWeight: 700, textAlign: 'right' }}>{pv.cantidad}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="panel-card">
                                    <div className="panel-card-header">
                                        <span className="panel-card-title" style={{ marginBottom: 0 }}>
                                            Últimas transacciones
                                        </span>
                                        <div className="category-tabs" style={{ margin: 0 }}>
                                            {['Todas', 'Cobrado', 'En mesa', 'En cocina'].map((est) => (
                                                <button
                                                    key={est}
                                                    type="button"
                                                    className={`cat-tab ${filtroTransacciones === est ? 'active' : ''}`}
                                                    onClick={() => setFiltroTransacciones(est)}
                                                >
                                                    {est}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="table-responsive">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Mesa</th>
                                                    <th>Platillos</th>
                                                    <th>Mesera</th>
                                                    <th>Método pago</th>
                                                    <th>Total</th>
                                                    <th>Hora</th>
                                                    <th>Estado</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {transaccionesFiltradas.map((t) => (
                                                    <tr key={t.id}>
                                                        <td style={{ fontWeight: 700 }}>{t.mesa}</td>
                                                        <td>{t.platillos}</td>
                                                        <td>{t.mesera}</td>
                                                        <td>
                                                            {t.metodo !== '—' ? (
                                                                <span
                                                                    className={`pill-badge ${
                                                                        t.metodo.toLowerCase().includes('efectivo')
                                                                            ? 'green'
                                                                            : t.metodo.toLowerCase().includes('crédito')
                                                                            ? 'gray'
                                                                            : 'amber'
                                                                    }`}
                                                                >
                                                                    {t.metodo}
                                                                </span>
                                                            ) : (
                                                                '—'
                                                            )}
                                                        </td>
                                                        <td style={{ fontWeight: 700 }}>${Number(t.total).toFixed(2)}</td>
                                                        <td style={{ color: '#6b7280' }}>{t.hora}</td>
                                                        <td>
                                                            <span
                                                                className={`pill-badge ${
                                                                    t.estado === 'Cobrado' ? 'green' : t.estado === 'En mesa' ? 'amber' : 'red'
                                                                }`}
                                                            >
                                                                {t.estado}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* NUEVO APARTADO: DESEMPEÑO DEL PERSONAL EN RESUMEN DEL DÍA */}
                                <div className="panel-card" style={{ marginTop: 18 }}>
                                    <div className="panel-card-header">
                                        <div>
                                            <div className="panel-card-title" style={{ marginBottom: 2 }}>
                                                Desempeño del personal en turno
                                            </div>
                                            <div style={{ fontSize: 12.5, color: '#64748b' }}>
                                                Evaluación operativa en tiempo real de productividad, mesas atendidas, tiempos de servicio y ventas por colaborador
                                            </div>
                                        </div>
                                        <div className="category-tabs" style={{ margin: 0 }}>
                                            {[
                                                { id: 'todos', label: 'Todo el personal' },
                                                { id: 'mesera', label: 'Salón / Meseras' },
                                                { id: 'cocina', label: 'Cocina (KDS)' },
                                                { id: 'administrador', label: 'Administración' },
                                            ].map((f) => (
                                                <button
                                                    key={f.id}
                                                    type="button"
                                                    className={`cat-tab ${filtroDesempenoRol === f.id ? 'active' : ''}`}
                                                    onClick={() => setFiltroDesempenoRol(f.id)}
                                                >
                                                    {f.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="staff-performance-grid" style={{ marginBottom: 16 }}>
                                        {(estado.desempenoPersonal || [])
                                            .filter((col) => filtroDesempenoRol === 'todos' || col.rol === filtroDesempenoRol)
                                            .map((col) => (
                                                <div key={col.id_usuario} className="staff-perf-card">
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            <div
                                                                style={{
                                                                    width: 38,
                                                                    height: 38,
                                                                    borderRadius: '50%',
                                                                    background:
                                                                        col.rol === 'administrador'
                                                                            ? '#6B3A07'
                                                                            : col.rol === 'cocina'
                                                                            ? '#1F5C35'
                                                                            : '#2B3A4A',
                                                                    color: '#ffffff',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    fontWeight: 700,
                                                                    fontSize: 13,
                                                                    flexShrink: 0,
                                                                }}
                                                            >
                                                                {col.iniciales}
                                                            </div>
                                                            <div>
                                                                <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{col.nombre}</div>
                                                                <div style={{ fontSize: 11.5, color: '#64748b' }}>
                                                                    {col.area} · {col.tipo_turno} ({col.turno})
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <span className={`pill-badge ${col.eficienciaPct >= 94 ? 'green' : 'amber'}`}>
                                                            {col.calificacion} · {col.eficienciaPct}%
                                                        </span>
                                                    </div>

                                                    <div
                                                        style={{
                                                            display: 'grid',
                                                            gridTemplateColumns: 'repeat(3, 1fr)',
                                                            gap: 8,
                                                            marginTop: 12,
                                                            background: '#f8fafc',
                                                            padding: '8px 10px',
                                                            borderRadius: 8,
                                                            border: '1px solid #e2e8f0',
                                                        }}
                                                    >
                                                        <div>
                                                            <div style={{ fontSize: 10.5, color: '#64748b', textTransform: 'uppercase' }}>
                                                                {col.rol === 'cocina' ? 'Comandas listas' : 'Mesas atendidas'}
                                                            </div>
                                                            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
                                                                {col.mesasAtendidasHoy}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: 10.5, color: '#64748b', textTransform: 'uppercase' }}>
                                                                {col.rol === 'mesera' ? 'Ventas cobradas' : 'Volumen turno'}
                                                            </div>
                                                            <div style={{ fontWeight: 700, fontSize: 15, color: '#15803d' }}>
                                                                ${Number(col.ventasGeneradas || 0).toLocaleString('en-US')}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: 10.5, color: '#64748b', textTransform: 'uppercase' }}>
                                                                Tiempo prom.
                                                            </div>
                                                            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
                                                                {col.tiempoPromedioMin} min
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div style={{ marginTop: 10 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                                                            <span style={{ color: '#475569' }}>{col.detalleActividad}</span>
                                                            <strong style={{ color: '#0f172a' }}>Eficiencia {col.eficienciaPct}%</strong>
                                                        </div>
                                                        <div className="hbar-track" style={{ height: 7 }}>
                                                            <div
                                                                className="hbar-fill"
                                                                style={{
                                                                    width: `${col.eficienciaPct}%`,
                                                                    background: col.eficienciaPct >= 94 ? '#16a34a' : '#d97706',
                                                                }}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                                                        <span style={{ fontSize: 11.5, color: '#64748b' }}>
                                                            Ticket prom.: <strong>${col.ticketPromedio}</strong> · Activas: <strong>{col.comandasActivas}</strong>
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className="secondary-outline-btn"
                                                            style={{ padding: '4px 10px', fontSize: 11.5 }}
                                                            onClick={() =>
                                                                setUsuarioTurnoEditando({
                                                                    id_usuario: col.id_usuario,
                                                                    nombre: col.nombre,
                                                                    rol: col.rol,
                                                                    tipo_turno: col.tipo_turno || 'Turno completo',
                                                                    hora_inicio: col.hora_inicio || '09:00',
                                                                    hora_fin: col.hora_fin || '17:00',
                                                                    turno: col.turno || '09:00 - 17:00',
                                                                })
                                                            }
                                                        >
                                                            Ajustar turno
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {vistaAdmin === 'mesas' && (
                            <div className="panel-card">
                                <div className="panel-card-header">
                                    <span className="panel-card-title" style={{ marginBottom: 0 }}>
                                        Estado actual de las 10 mesas — Toque cualquier mesa ocupada para inspeccionar su comanda
                                    </span>
                                </div>
                                <div className="tables-map-grid">
                                    {estado.mesas.map((m) => (
                                        <div
                                            key={m.numero}
                                            className={`mesa-tile ${m.estado}`}
                                            onClick={() => setMesaInspeccionada(m)}
                                        >
                                            <div className="mesa-number">{String(m.numero).padStart(2, '0')}</div>
                                            <div className="mesa-status-text">
                                                {m.estado === 'libre' && 'Libre'}
                                                {m.estado === 'ocupada' && `Ocupada · ${m.personas} pers. · $${m.total}`}
                                                {m.estado === 'por_cobrar' && `Por cobrar · $${m.total}`}
                                            </div>
                                            <div style={{ fontSize: 11, marginTop: 4, opacity: 0.85 }}>Mesera: {m.mesera}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {vistaAdmin === 'comandas' && (
                            <div className="panel-card">
                                <div className="panel-card-header">
                                    <span className="panel-card-title" style={{ marginBottom: 0 }}>
                                        Control de comandas
                                    </span>
                                    <div className="category-tabs" style={{ margin: 0 }}>
                                        {[
                                            { id: 'activas', label: 'Activas en curso' },
                                            { id: 'pendiente', label: 'En cocina' },
                                            { id: 'preparado', label: 'Por cobrar' },
                                            { id: 'cancelado', label: 'Canceladas' },
                                            { id: 'todas', label: 'Todas' },
                                        ].map((f) => (
                                            <button
                                                key={f.id}
                                                type="button"
                                                className={`cat-tab ${filtroComandasAdmin === f.id ? 'active' : ''}`}
                                                onClick={() => setFiltroComandasAdmin(f.id)}
                                            >
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="table-responsive">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>ID</th>
                                                <th>Mesa</th>
                                                <th>Mesera</th>
                                                <th>Detalle de platillos</th>
                                                <th>Notas / Motivo</th>
                                                <th>Total</th>
                                                <th>Estado</th>
                                                <th>Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {comandasFiltradasAdmin.map((p) => {
                                                const puedeCancelar = p.estado !== 'cerrado' && p.estado !== 'cancelado';
                                                return (
                                                    <tr key={p.id_pedido}>
                                                        <td style={{ fontWeight: 700 }}>#{p.id_pedido}</td>
                                                        <td>Mesa {String(p.numero_mesa).padStart(2, '0')}</td>
                                                        <td>{p.nombre_mesera}</td>
                                                        <td>{(p.detalles || []).map((d) => `${d.nombre || d.Nombre} ×${d.cantidad}`).join(', ')}</td>
                                                        <td>{p.motivo_cancelacion || p.nota_cocina || '—'}</td>
                                                        <td style={{ fontWeight: 700 }}>${Number(p.total).toFixed(2)}</td>
                                                        <td>
                                                            <span
                                                                className={`pill-badge ${
                                                                    p.estado === 'pendiente'
                                                                        ? 'red'
                                                                        : p.estado === 'preparado'
                                                                        ? 'amber'
                                                                        : p.estado === 'cancelado'
                                                                        ? 'gray'
                                                                        : 'green'
                                                                }`}
                                                            >
                                                                {(p.estado || 'pendiente').toUpperCase()}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            {puedeCancelar ? (
                                                                <button
                                                                    type="button"
                                                                    className="danger-outline-btn"
                                                                    style={{ padding: '4px 10px', fontSize: 11.5 }}
                                                                    onClick={() => cancelarComandaDesdeAdmin(p)}
                                                                >
                                                                    Cancelar orden
                                                                </button>
                                                            ) : (
                                                                <span style={{ fontSize: 12, color: '#9ca3af' }}>—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {vistaAdmin === 'catalogo' && (
                            <div className="split-workspace">
                                <div className="panel-card">
                                    <div className="panel-card-title">Catálogo de platillos, recetas y bebidas</div>
                                    <div className="table-responsive">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Platillo y Receta</th>
                                                    <th>Categoría</th>
                                                    <th>Precio</th>
                                                    <th>Stock</th>
                                                    <th>Activo</th>
                                                    <th>Editar</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {estado.platillos.map((pl) => {
                                                    const idP = pl.id_platillo || pl.Id_platillo;
                                                    const disp = pl.disponible ?? pl.Disponible;
                                                    const recetaItems = Array.isArray(pl.receta) ? pl.receta : [];
                                                    return (
                                                        <tr key={idP}>
                                                            <td>
                                                                <div style={{ fontWeight: 600 }}>{pl.nombre || pl.Nombre}</div>
                                                                <div style={{ fontSize: 12, color: '#6b7280' }}>{pl.descripcion || pl.Descripcion}</div>
                                                                {recetaItems.length > 0 && (
                                                                    <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                                        {recetaItems.map((rec) => {
                                                                            const insObj = estado.inventario.find(
                                                                                (i) => Number(i.id_insumo) === Number(rec.id_insumo)
                                                                            );
                                                                            return (
                                                                                <span
                                                                                    key={rec.id_insumo}
                                                                                    style={{
                                                                                        fontSize: 10.5,
                                                                                        background: '#f1f5f9',
                                                                                        color: '#334155',
                                                                                        border: '1px solid #cbd5e1',
                                                                                        borderRadius: 6,
                                                                                        padding: '1px 6px',
                                                                                        fontWeight: 600,
                                                                                    }}
                                                                                >
                                                                                    {insObj ? insObj.nombre : `Insumo #${rec.id_insumo}`}: {rec.cantidad_requerida}{' '}
                                                                                    {insObj?.unidad || 'u'}
                                                                                </span>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td>{pl.categoria || pl.Categoria}</td>
                                                            <td style={{ fontWeight: 700 }}>${Number(pl.precio || pl.Precio).toFixed(2)}</td>
                                                            <td>
                                                                {pl.stock ?? pl.Stock} {pl.unidad_stock || 'porciones'}
                                                            </td>
                                                            <td>
                                                                <button
                                                                    type="button"
                                                                    className={`toggle-switch ${disp ? 'on' : ''}`}
                                                                    onClick={() => toggleDisponibilidadPlatillo(idP, disp)}
                                                                    title="Alternar disponibilidad"
                                                                >
                                                                    <span className="toggle-knob" />
                                                                </button>
                                                            </td>
                                                            <td>
                                                                <button
                                                                    type="button"
                                                                    className="secondary-outline-btn"
                                                                    style={{ padding: '4px 10px', fontSize: 11.5 }}
                                                                    onClick={() =>
                                                                        setPlatilloEditando({
                                                                            id_platillo: idP,
                                                                            nombre: pl.nombre || pl.Nombre,
                                                                            descripcion: pl.descripcion || pl.Descripcion || '',
                                                                            categoria: pl.categoria || pl.Categoria || 'Plato fuerte',
                                                                            precio: pl.precio || pl.Precio,
                                                                            stock: pl.stock ?? pl.Stock ?? 10,
                                                                            receta: Array.isArray(pl.receta) ? [...pl.receta] : [],
                                                                        })
                                                                    }
                                                                >
                                                                    Editar
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="panel-card">
                                    <div className="panel-card-title">Agregar nuevo platillo al menú</div>
                                    <form onSubmit={crearPlatilloCatalogo} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <input
                                            type="text"
                                            placeholder="Nombre del platillo"
                                            value={nuevoPlatillo.nombre}
                                            onChange={(e) => setNuevoPlatillo({ ...nuevoPlatillo, nombre: e.target.value })}
                                            className="form-input-clean"
                                            required
                                        />
                                        <input
                                            type="text"
                                            placeholder="Descripción e ingredientes principales"
                                            value={nuevoPlatillo.descripcion}
                                            onChange={(e) => setNuevoPlatillo({ ...nuevoPlatillo, descripcion: e.target.value })}
                                            className="form-input-clean"
                                        />
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                            <select
                                                value={nuevoPlatillo.categoria}
                                                onChange={(e) => setNuevoPlatillo({ ...nuevoPlatillo, categoria: e.target.value })}
                                                className="form-input-clean"
                                            >
                                                <option value="Entradas">Entradas</option>
                                                <option value="Plato fuerte">Plato fuerte</option>
                                                <option value="Bebidas">Bebidas</option>
                                                <option value="Postres">Postres</option>
                                            </select>
                                            <input
                                                type="number"
                                                min={0}
                                                placeholder="Stock inicial (porciones)"
                                                value={nuevoPlatillo.stock}
                                                onChange={(e) => setNuevoPlatillo({ ...nuevoPlatillo, stock: e.target.value })}
                                                className="form-input-clean"
                                                required
                                            />
                                        </div>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min={1}
                                            placeholder="Precio en MXN ($)"
                                            value={nuevoPlatillo.precio}
                                            onChange={(e) => setNuevoPlatillo({ ...nuevoPlatillo, precio: e.target.value })}
                                            className="form-input-clean"
                                            required
                                        />

                                        {/* SECCIÓN DE RECETA (INSUMOS DE MATERIA PRIMA REQUERIDOS POR PORCIÓN) */}
                                        <div
                                            style={{
                                                background: '#f8fafc',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: 10,
                                                padding: 12,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: 8,
                                            }}
                                        >
                                            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>
                                                Receta del platillo (Deducción automática de insumos)
                                            </div>
                                            <div style={{ fontSize: 11.5, color: '#64748b' }}>
                                                Selecciona qué materia prima consume 1 porción de este platillo al venderse:
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr auto', gap: 6, alignItems: 'center' }}>
                                                <select
                                                    value={insumoRecetaSeleccionado}
                                                    onChange={(e) => setInsumoRecetaSeleccionado(Number(e.target.value))}
                                                    className="form-input-clean"
                                                    style={{ padding: '7px 8px', fontSize: 12 }}
                                                >
                                                    {estado.inventario.map((ins) => (
                                                        <option key={ins.id_insumo} value={ins.id_insumo}>
                                                            {ins.nombre} ({ins.unidad})
                                                        </option>
                                                    ))}
                                                </select>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0.01"
                                                    value={cantidadRecetaSeleccionada}
                                                    onChange={(e) => setCantidadRecetaSeleccionada(e.target.value)}
                                                    className="form-input-clean"
                                                    placeholder="Cant."
                                                    style={{ padding: '7px 8px', fontSize: 12 }}
                                                />
                                                <button
                                                    type="button"
                                                    className="secondary-outline-btn"
                                                    style={{ padding: '7px 10px', fontSize: 12, whiteSpace: 'nowrap' }}
                                                    onClick={agregarInsumoARecetaNuevoPlatillo}
                                                >
                                                    + Insumo
                                                </button>
                                            </div>

                                            {(nuevoPlatillo.receta || []).length === 0 ? (
                                                <div style={{ fontSize: 11.5, color: '#94a3b8', fontStyle: 'italic' }}>
                                                    Sin insumos vinculados todavía. Agrega al menos un insumo para conectar con el inventario.
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                                                    {nuevoPlatillo.receta.map((item) => {
                                                        const insObj = estado.inventario.find(
                                                            (i) => Number(i.id_insumo) === Number(item.id_insumo)
                                                        );
                                                        return (
                                                            <div
                                                                key={item.id_insumo}
                                                                style={{
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    alignItems: 'center',
                                                                    background: '#ffffff',
                                                                    border: '1px solid #cbd5e1',
                                                                    borderRadius: 6,
                                                                    padding: '4px 8px',
                                                                    fontSize: 12,
                                                                }}
                                                            >
                                                                <span>
                                                                    <strong>{insObj?.nombre || `Insumo #${item.id_insumo}`}</strong> —{' '}
                                                                    {item.cantidad_requerida} {insObj?.unidad || 'u'} por platillo
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => quitarInsumoDeRecetaNuevoPlatillo(item.id_insumo)}
                                                                    style={{
                                                                        border: 'none',
                                                                        background: 'transparent',
                                                                        color: '#dc2626',
                                                                        fontWeight: 700,
                                                                        cursor: 'pointer',
                                                                        fontSize: 12,
                                                                    }}
                                                                >
                                                                    Quitar
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        <button type="submit" className="primary-dark-btn">
                                            Guardar platillo y receta en catálogo
                                        </button>
                                    </form>
                                </div>
                            </div>
                        )}

                        {vistaAdmin === 'inventario' && (
                            <div className="split-workspace">
                                <div className="panel-card">
                                    <div className="panel-card-header">
                                        <span className="panel-card-title" style={{ marginBottom: 0 }}>
                                            Inventario de insumos en tiempo real
                                        </span>
                                        <button
                                            type="button"
                                            className="primary-dark-btn"
                                            style={{ padding: '7px 14px', fontSize: 12.5 }}
                                            onClick={() => abrirModalProveedores('')}
                                        >
                                            Directorio de proveedores
                                        </button>
                                    </div>

                                    {estado.inventario.map((ins) => (
                                        <div className="inv-item-row" key={ins.id_insumo}>
                                            <span style={{ fontWeight: 500 }}>{ins.nombre}</span>
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
                                            <span style={{ fontSize: 12.5, color: '#4b5563', textAlign: 'right' }}>
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
                                            {ins.nivel !== 'OK' ? (
                                                <button
                                                    type="button"
                                                    className="secondary-outline-btn"
                                                    style={{ padding: '4px 10px', fontSize: 11.5 }}
                                                    onClick={() => abrirModalProveedores(ins.nombre)}
                                                >
                                                    Pedir
                                                </button>
                                            ) : (
                                                <span />
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="panel-card">
                                    <div className="panel-card-title">Registrar merma o recepción de pedido</div>
                                    <form onSubmit={guardarAjusteInventario} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <label style={{ fontSize: 12.5, fontWeight: 600 }}>Insumo:</label>
                                        <select
                                            value={ajusteInsumo.id_insumo}
                                            onChange={(e) => setAjusteInsumo({ ...ajusteInsumo, id_insumo: Number(e.target.value) })}
                                            className="form-input-clean"
                                        >
                                            {estado.inventario.map((i) => (
                                                <option key={i.id_insumo} value={i.id_insumo}>
                                                    {i.nombre} (Actual: {i.cantidad} {i.unidad})
                                                </option>
                                            ))}
                                        </select>

                                        <label style={{ fontSize: 12.5, fontWeight: 600 }}>Tipo de registro:</label>
                                        <select
                                            value={ajusteInsumo.tipo_movimiento}
                                            onChange={(e) => setAjusteInsumo({ ...ajusteInsumo, tipo_movimiento: e.target.value })}
                                            className="form-input-clean"
                                        >
                                            <option value="merma">Registrar merma / desperdicio (Descontar)</option>
                                            <option value="entrada">Recepción de proveedor (Actualizar stock)</option>
                                        </select>

                                        <label style={{ fontSize: 12.5, fontWeight: 600 }}>Cantidad:</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={ajusteInsumo.cantidad}
                                            onChange={(e) => setAjusteInsumo({ ...ajusteInsumo, cantidad: e.target.value })}
                                            className="form-input-clean"
                                            required
                                        />

                                        <label style={{ fontSize: 12.5, fontWeight: 600 }}>Observaciones:</label>
                                        <input
                                            type="text"
                                            value={ajusteInsumo.motivo}
                                            onChange={(e) => setAjusteInsumo({ ...ajusteInsumo, motivo: e.target.value })}
                                            className="form-input-clean"
                                        />

                                        <button type="submit" className="primary-dark-btn">
                                            Guardar registro
                                        </button>
                                    </form>
                                </div>
                            </div>
                        )}

                        {vistaAdmin === 'usuarios' && (
                            <div className="split-workspace">
                                <div>
                                    {/* TARJETA DESTACADA DE TURNO ACTIVO GENERAL */}
                                    <div
                                        className="panel-card"
                                        style={{
                                            marginBottom: 16,
                                            borderLeft: '4px solid #16a34a',
                                            background: '#f8fafc',
                                        }}
                                    >
                                        <div className="panel-card-header" style={{ marginBottom: 8 }}>
                                            <div>
                                                <div className="panel-card-title" style={{ marginBottom: 2 }}>
                                                    Turno activo del restaurante en curso
                                                </div>
                                                <div style={{ fontSize: 12.5, color: '#475569' }}>
                                                    Modalidad: <strong>{estado.turnoActivo?.modalidad || 'Turno completo'}</strong> · Horario:{' '}
                                                    <strong>{estado.turnoActivo?.horario_texto || '8am - 10pm'}</strong> · Responsable asignado:{' '}
                                                    <strong>{estado.turnoActivo?.nombre_responsable || 'J. David'}</strong>
                                                </div>
                                                {estado.turnoActivo?.notas && (
                                                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                                                        Notas del turno: {estado.turnoActivo.notas}
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                className="primary-dark-btn"
                                                style={{ padding: '8px 14px', fontSize: 12.5 }}
                                                onClick={abrirModalEditarTurnoActivo}
                                            >
                                                Editar turno activo
                                            </button>
                                        </div>
                                    </div>

                                    <div className="panel-card">
                                        <div className="panel-card-title">Personal registrado y asignación de turnos</div>
                                        <div className="table-responsive">
                                            <table className="data-table">
                                                <thead>
                                                    <tr>
                                                        <th>ID</th>
                                                        <th>Nombre</th>
                                                        <th>Rol</th>
                                                        <th>Modalidad / Horario</th>
                                                        <th>Estado</th>
                                                        <th>Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {estado.usuarios.map((u) => (
                                                        <tr key={u.id_usuario}>
                                                            <td>#{u.id_usuario}</td>
                                                            <td style={{ fontWeight: 600 }}>{u.nombre}</td>
                                                            <td>
                                                                <span
                                                                    className={`pill-badge ${
                                                                        u.rol === 'administrador' ? 'amber' : u.rol === 'cocina' ? 'green' : 'gray'
                                                                    }`}
                                                                >
                                                                    {u.rol}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <div style={{ fontWeight: 600, fontSize: 12.5 }}>
                                                                    {u.tipo_turno || 'Turno completo'}
                                                                </div>
                                                                <div style={{ fontSize: 11.5, color: '#64748b' }}>{u.turno}</div>
                                                            </td>
                                                            <td>
                                                                <span className={`pill-badge ${u.activo ? 'green' : 'red'}`}>
                                                                    {u.activo ? 'Activo' : 'Inactivo'}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                                    <button
                                                                        type="button"
                                                                        className="secondary-outline-btn"
                                                                        style={{ padding: '4px 10px', fontSize: 11.5 }}
                                                                        onClick={() =>
                                                                            setUsuarioTurnoEditando({
                                                                                id_usuario: u.id_usuario,
                                                                                nombre: u.nombre,
                                                                                rol: u.rol,
                                                                                tipo_turno: u.tipo_turno || 'Turno completo',
                                                                                hora_inicio: u.hora_inicio || '09:00',
                                                                                hora_fin: u.hora_fin || '17:00',
                                                                                turno: u.turno || '9am - 5pm',
                                                                            })
                                                                        }
                                                                    >
                                                                        Editar turno
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="secondary-outline-btn"
                                                                        style={{ padding: '4px 10px', fontSize: 11.5 }}
                                                                        onClick={() => alternarEstadoUsuario(u.id_usuario)}
                                                                    >
                                                                        {u.activo ? 'Desactivar' : 'Activar'}
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div className="panel-card" style={{ marginBottom: 16 }}>
                                        <div className="panel-card-title">Alta de nuevo colaborador</div>
                                        <form onSubmit={crearUsuarioSistema} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            <input
                                                type="text"
                                                placeholder="Nombre completo"
                                                value={nuevoUsuario.nombre}
                                                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, nombre: e.target.value })}
                                                className="form-input-clean"
                                                required
                                            />
                                            <select
                                                value={nuevoUsuario.rol}
                                                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, rol: e.target.value })}
                                                className="form-input-clean"
                                            >
                                                <option value="mesera">Mesera / Salón</option>
                                                <option value="cocina">Cocina / Chef</option>
                                                <option value="administrador">Administrador</option>
                                            </select>
                                            <input
                                                type="text"
                                                placeholder="Horario de turno (ej. 9am - 5pm)"
                                                value={nuevoUsuario.turno}
                                                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, turno: e.target.value })}
                                                className="form-input-clean"
                                            />
                                            <input
                                                type="password"
                                                placeholder="Contraseña de acceso"
                                                value={nuevoUsuario.contrasena}
                                                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, contrasena: e.target.value })}
                                                className="form-input-clean"
                                                required
                                            />
                                            <button type="submit" className="primary-dark-btn">
                                                Crear cuenta de usuario
                                            </button>
                                        </form>
                                    </div>

                                    <div className="panel-card">
                                        <div className="panel-card-title">Cambiar contraseña de colaborador</div>
                                        <form onSubmit={actualizarPasswordUsuario} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            <select
                                                value={cambioPassUsuario.id_usuario}
                                                onChange={(e) => setCambioPassUsuario({ ...cambioPassUsuario, id_usuario: Number(e.target.value) })}
                                                className="form-input-clean"
                                            >
                                                {estado.usuarios.map((u) => (
                                                    <option key={u.id_usuario} value={u.id_usuario}>
                                                        {u.nombre} ({u.rol})
                                                    </option>
                                                ))}
                                            </select>
                                            <input
                                                type="password"
                                                placeholder="Nueva contraseña"
                                                value={cambioPassUsuario.nuevaContrasena}
                                                onChange={(e) => setCambioPassUsuario({ ...cambioPassUsuario, nuevaContrasena: e.target.value })}
                                                className="form-input-clean"
                                                required
                                            />
                                            <button type="submit" className="secondary-outline-btn">
                                                Actualizar contraseña
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        )}

                        {(vistaAdmin === 'reportes' || vistaAdmin === 'cierre_caja') && (
                            <div className="panel-card">
                                <div className="panel-card-title">
                                    Reporte Financiero y Corte de Caja por Método de Pago
                                </div>
                                <div className="kpi-grid" style={{ marginTop: 12 }}>
                                    <div className="kpi-card">
                                        <div className="kpi-label">Ventas Totales Registradas</div>
                                        <div className="kpi-value">${estado.metricasDia.ventasHoy.toLocaleString('en-US')}</div>
                                        <div className="kpi-trend">Corte del turno actual</div>
                                    </div>
                                    <div className="kpi-card">
                                        <div className="kpi-label">Pagos en Efectivo</div>
                                        <div className="kpi-value">
                                            $
                                            {estado.pagos
                                                .filter((p) => p.metodo.toLowerCase().includes('efectivo'))
                                                .reduce((acc, p) => acc + p.monto, 0)
                                                .toFixed(2)}
                                        </div>
                                        <div className="kpi-trend">En caja física</div>
                                    </div>
                                    <div className="kpi-card">
                                        <div className="kpi-label">Tarjetas (Crédito / Débito)</div>
                                        <div className="kpi-value">
                                            $
                                            {estado.pagos
                                                .filter((p) => p.metodo.toLowerCase().includes('crédito') || p.metodo.toLowerCase().includes('débito'))
                                                .reduce((acc, p) => acc + p.monto, 0)
                                                .toFixed(2)}
                                        </div>
                                        <div className="kpi-trend">Terminal bancaria</div>
                                    </div>
                                    <div className="kpi-card">
                                        <div className="kpi-label">Transferencias y Monederos</div>
                                        <div className="kpi-value">
                                            $
                                            {estado.pagos
                                                .filter(
                                                    (p) =>
                                                        p.metodo.toLowerCase().includes('transferencia') ||
                                                        p.metodo.toLowerCase().includes('monedero')
                                                )
                                                .reduce((acc, p) => acc + p.monto, 0)
                                                .toFixed(2)}
                                        </div>
                                        <div className="kpi-trend">SPEI / Digital</div>
                                    </div>
                                </div>

                                <div className="table-responsive">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Folio</th>
                                                <th>Mesa</th>
                                                <th>Concepto / División</th>
                                                <th>Mesera</th>
                                                <th>Método</th>
                                                <th>Monto</th>
                                                <th>Hora</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {estado.pagos.map((p) => (
                                                <tr key={p.id_pago}>
                                                    <td>#{p.id_pago}</td>
                                                    <td style={{ fontWeight: 700 }}>{p.numero_mesa}</td>
                                                    <td>{p.concepto_division}</td>
                                                    <td>{p.mesera}</td>
                                                    <td>
                                                        <span className="pill-badge green">{p.metodo}</span>
                                                    </td>
                                                    <td style={{ fontWeight: 700 }}>${Number(p.monto).toFixed(2)}</td>
                                                    <td>{p.hora}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {vistaAdmin === 'configuracion' && (
                            <div className="split-workspace">
                                <div>
                                    <div className="panel-card" style={{ marginBottom: 16 }}>
                                        <div className="panel-card-header">
                                            <div>
                                                <div className="panel-card-title" style={{ marginBottom: 2 }}>
                                                    Conexión Local — MySQL Workbench 8.0 & MySQL Server 9.4.0
                                                </div>
                                                <div style={{ fontSize: 12.5, color: '#64748b' }}>
                                                    Autenticación nativa <code>caching_sha2_password</code> · Esquema ACID <code>OrderlyDB</code>
                                                </div>
                                            </div>
                                            <span className={`pill-badge ${estado.conexionMySQL?.conectado ? 'green' : 'amber'}`}>
                                                {estado.conexionMySQL?.conectado
                                                    ? `MySQL ${estado.conexionMySQL?.versionServidor || '9.4.0'} Conectado`
                                                    : 'Modo Resiliente ACID Activo'}
                                            </span>
                                        </div>

                                        <form onSubmit={guardarYConectarMySQL} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                                                <div>
                                                    <label className="form-field-label">Host local (MySQL Workbench 8.0):</label>
                                                    <input
                                                        type="text"
                                                        value={formMySQL.host}
                                                        onChange={(e) => setFormMySQL({ ...formMySQL, host: e.target.value })}
                                                        className="form-input-clean"
                                                        placeholder="localhost o 127.0.0.1"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label className="form-field-label">Puerto TCP:</label>
                                                    <input
                                                        type="number"
                                                        value={formMySQL.port}
                                                        onChange={(e) => setFormMySQL({ ...formMySQL, port: Number(e.target.value) })}
                                                        className="form-input-clean"
                                                        placeholder="3306"
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                                <div>
                                                    <label className="form-field-label">Usuario MySQL Server 9.4.0:</label>
                                                    <input
                                                        type="text"
                                                        value={formMySQL.user}
                                                        onChange={(e) => setFormMySQL({ ...formMySQL, user: e.target.value })}
                                                        className="form-input-clean"
                                                        placeholder="root"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label className="form-field-label">Base de datos:</label>
                                                    <input
                                                        type="text"
                                                        value={formMySQL.database}
                                                        onChange={(e) => setFormMySQL({ ...formMySQL, database: e.target.value })}
                                                        className="form-input-clean"
                                                        placeholder="OrderlyDB"
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="form-field-label">Contraseña de tu instancia local MySQL:</label>
                                                <input
                                                    type="password"
                                                    value={formMySQL.password}
                                                    onChange={(e) => setFormMySQL({ ...formMySQL, password: e.target.value })}
                                                    className="form-input-clean"
                                                    placeholder="Ingresa la contraseña root de tu MySQL Workbench 8.0"
                                                />
                                            </div>

                                            <button type="submit" className="primary-dark-btn" disabled={probandoMySQL}>
                                                {probandoMySQL
                                                    ? 'Conectando y migrando tablas en MySQL 9.4.0...'
                                                    : 'Probar conexión, guardar en .env y migrar OrderlyDB'}
                                            </button>
                                        </form>
                                    </div>

                                    <div className="panel-card">
                                        <div className="panel-card-title">Respaldo firmado y recuperación de base de datos</div>
                                        <p style={{ fontSize: 13.5, color: '#4b5563', marginBottom: 14 }}>
                                            El sistema genera respaldos automáticos diarios firmados con HMAC-SHA256 y sin exponer contraseñas para resguardar las ventas, comandas e inventario del restaurante.
                                        </p>
                                        <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
                                            <div>
                                                <strong>Motor activo:</strong> {estado.motorBaseDatos}
                                            </div>
                                            <div style={{ marginTop: 6 }}>
                                                <strong>Último respaldo generado:</strong> {estado.ultimoRespaldo?.archivo} (
                                                {estado.ultimoRespaldo?.fecha} a las {estado.ultimoRespaldo?.hora})
                                            </div>
                                            {estado.ultimoRespaldo?.firmaIntegridad && (
                                                <div style={{ marginTop: 6, color: '#15803d', fontWeight: 600 }}>
                                                    Firma de integridad: {estado.ultimoRespaldo.firmaIntegridad}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                            <button type="button" className="primary-dark-btn" onClick={dispararRespaldoManual}>
                                                Generar respaldo firmado ahora
                                            </button>
                                        </div>
                                    </div>

                                    <div className="panel-card">
                                        <div className="panel-card-title">Acceso móvil nativo y código QR en red local</div>
                                        <p style={{ fontSize: 13.5, color: '#4b5563', marginBottom: 14 }}>
                                            Escanee este código desde tabletas de salón o teléfonos conectados al mismo Wi-Fi. En el navegador móvil toque Instalar aplicación para operar en pantalla completa.
                                        </p>
                                        {qrRed?.qrSvg ? (
                                            <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
                                                <div
                                                    style={{
                                                        padding: 10,
                                                        background: '#ffffff',
                                                        border: '1px solid #e5e7eb',
                                                        borderRadius: 8,
                                                    }}
                                                    dangerouslySetInnerHTML={{ __html: qrRed.qrSvg }}
                                                />
                                                <div style={{ flex: 1, minWidth: 200 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>
                                                        Dirección directa de acceso:
                                                    </div>
                                                    <div
                                                        style={{
                                                            background: '#f8fafc',
                                                            border: '1px solid #e2e8f0',
                                                            borderRadius: 6,
                                                            padding: '8px 10px',
                                                            fontFamily: 'monospace',
                                                            fontSize: 12.5,
                                                            marginBottom: 10,
                                                            wordBreak: 'break-all',
                                                        }}
                                                    >
                                                        {qrRed.urlPrincipal}
                                                    </div>
                                                    <button type="button" className="secondary-outline-btn" onClick={cargarQrRed}>
                                                        Actualizar IP de red
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button type="button" className="secondary-outline-btn" onClick={cargarQrRed}>
                                                Generar código QR de acceso local
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="panel-card">
                                    <div className="panel-card-title">Bitácora de auditoría y seguridad del sistema</div>
                                    {estado.logsAuditoria.slice(0, 14).map((log) => (
                                        <div
                                            key={log.id_log}
                                            style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 12.5 }}
                                        >
                                            <strong>[{log.hora}] {log.usuario}</strong> — {log.detalle}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {/* MODAL INTERACTIVO DE INSPECCIÓN DE MESA */}
            {mesaInspeccionada && (
                <div className="modal-overlay">
                    <div className="modal-card" style={{ maxWidth: 480 }}>
                        <div className="panel-card-header">
                            <span className="panel-card-title" style={{ marginBottom: 0 }}>
                                Mesa {String(mesaInspeccionada.numero).padStart(2, '0')} — Estado: {mesaInspeccionada.estado.toUpperCase()}
                            </span>
                            <button
                                type="button"
                                onClick={() => setMesaInspeccionada(null)}
                                style={{ border: 'none', background: 'transparent', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}
                            >
                                Cerrar
                            </button>
                        </div>

                        {!pedidoMesaInspeccionada ? (
                            <p style={{ fontSize: 13.5, color: '#6b7280', marginBottom: 16 }}>
                                Esta mesa se encuentra libre y disponible para asignar comensales desde el módulo de salón.
                            </p>
                        ) : (
                            <div>
                                <div style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
                                    <strong>Comanda #{pedidoMesaInspeccionada.id_pedido}</strong> · Mesera: {pedidoMesaInspeccionada.nombre_mesera} ·{' '}
                                    {pedidoMesaInspeccionada.personas || 2} personas
                                </div>
                                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 14 }}>
                                    {(pedidoMesaInspeccionada.detalles || []).map((d) => (
                                        <div
                                            key={d.id_detalle}
                                            style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}
                                        >
                                            <span>
                                                {d.nombre || d.Nombre} ×{d.cantidad}
                                            </span>
                                            <strong>${Number(d.subtotal).toFixed(2)}</strong>
                                        </div>
                                    ))}
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            borderTop: '1px solid #e2e8f0',
                                            marginTop: 8,
                                            paddingTop: 8,
                                            fontWeight: 700,
                                        }}
                                    >
                                        <span>Total</span>
                                        <span>${Number(pedidoMesaInspeccionada.total).toFixed(2)}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button
                                        type="button"
                                        className="secondary-outline-btn"
                                        style={{ flex: 1 }}
                                        onClick={() => setMesaInspeccionada(null)}
                                    >
                                        Cerrar
                                    </button>
                                    <button
                                        type="button"
                                        className="danger-solid-btn"
                                        style={{ flex: 1.4 }}
                                        onClick={() => cancelarComandaDesdeAdmin(pedidoMesaInspeccionada)}
                                    >
                                        Cancelar orden y liberar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL INTERACTIVO PARA EDITAR PLATILLO */}
            {platilloEditando && (
                <div className="modal-overlay">
                    <div className="modal-card" style={{ maxWidth: 520 }}>
                        <div className="panel-card-header">
                            <span className="panel-card-title" style={{ marginBottom: 0 }}>
                                Editar Platillo y Receta — {platilloEditando.nombre}
                            </span>
                            <button
                                type="button"
                                onClick={() => setPlatilloEditando(null)}
                                style={{ border: 'none', background: 'transparent', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}
                            >
                                Cerrar
                            </button>
                        </div>

                        <form onSubmit={guardarEdicionPlatillo} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div>
                                <label className="form-field-label">Nombre:</label>
                                <input
                                    type="text"
                                    value={platilloEditando.nombre}
                                    onChange={(e) => setPlatilloEditando({ ...platilloEditando, nombre: e.target.value })}
                                    className="form-input-clean"
                                    required
                                />
                            </div>
                            <div>
                                <label className="form-field-label">Descripción:</label>
                                <input
                                    type="text"
                                    value={platilloEditando.descripcion}
                                    onChange={(e) => setPlatilloEditando({ ...platilloEditando, descripcion: e.target.value })}
                                    className="form-input-clean"
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div>
                                    <label className="form-field-label">Precio ($ MXN):</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={platilloEditando.precio}
                                        onChange={(e) => setPlatilloEditando({ ...platilloEditando, precio: e.target.value })}
                                        className="form-input-clean"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="form-field-label">Stock (porciones):</label>
                                    <input
                                        type="number"
                                        value={platilloEditando.stock}
                                        onChange={(e) => setPlatilloEditando({ ...platilloEditando, stock: e.target.value })}
                                        className="form-input-clean"
                                        required
                                    />
                                </div>
                            </div>

                            {/* EDITOR DE RECETA DEL PLATILLO */}
                            <div
                                style={{
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 10,
                                    padding: 12,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 8,
                                }}
                            >
                                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>
                                    Receta del platillo (Insumos por porción)
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr auto', gap: 6, alignItems: 'center' }}>
                                    <select
                                        value={insumoRecetaEdicion}
                                        onChange={(e) => setInsumoRecetaEdicion(Number(e.target.value))}
                                        className="form-input-clean"
                                        style={{ padding: '7px 8px', fontSize: 12 }}
                                    >
                                        {estado.inventario.map((ins) => (
                                            <option key={ins.id_insumo} value={ins.id_insumo}>
                                                {ins.nombre} ({ins.unidad})
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={cantidadRecetaEdicion}
                                        onChange={(e) => setCantidadRecetaEdicion(e.target.value)}
                                        className="form-input-clean"
                                        style={{ padding: '7px 8px', fontSize: 12 }}
                                    />
                                    <button
                                        type="button"
                                        className="secondary-outline-btn"
                                        style={{ padding: '7px 10px', fontSize: 12 }}
                                        onClick={agregarInsumoARecetaEdicion}
                                    >
                                        + Insumo
                                    </button>
                                </div>

                                {(platilloEditando.receta || []).length === 0 ? (
                                    <div style={{ fontSize: 11.5, color: '#94a3b8' }}>Sin insumos asignados a la receta.</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        {(platilloEditando.receta || []).map((item) => {
                                            const insObj = estado.inventario.find(
                                                (i) => Number(i.id_insumo) === Number(item.id_insumo)
                                            );
                                            return (
                                                <div
                                                    key={item.id_insumo}
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        background: '#ffffff',
                                                        border: '1px solid #cbd5e1',
                                                        borderRadius: 6,
                                                        padding: '4px 8px',
                                                        fontSize: 12,
                                                    }}
                                                >
                                                    <span>
                                                        <strong>{insObj?.nombre || `Insumo #${item.id_insumo}`}</strong> — {item.cantidad_requerida}{' '}
                                                        {insObj?.unidad || 'u'}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => quitarInsumoDeRecetaEdicion(item.id_insumo)}
                                                        style={{
                                                            border: 'none',
                                                            background: 'transparent',
                                                            color: '#dc2626',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            fontSize: 12,
                                                        }}
                                                    >
                                                        Quitar
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                                <button
                                    type="button"
                                    className="secondary-outline-btn"
                                    style={{ flex: 1 }}
                                    onClick={() => setPlatilloEditando(null)}
                                >
                                    Cancelar
                                </button>
                                <button type="submit" className="primary-dark-btn" style={{ flex: 1.5 }}>
                                    Guardar cambios
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL PARA EDITAR TURNO ACTIVO GENERAL DEL RESTAURANTE */}
            {modalTurnoAbierto && (
                <div className="modal-overlay">
                    <div className="modal-card" style={{ maxWidth: 480 }}>
                        <div className="panel-card-header">
                            <span className="panel-card-title" style={{ marginBottom: 0 }}>
                                Editar Turno Activo en Curso
                            </span>
                            <button
                                type="button"
                                onClick={() => setModalTurnoAbierto(false)}
                                style={{ border: 'none', background: 'transparent', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}
                            >
                                Cerrar
                            </button>
                        </div>

                        <form onSubmit={guardarTurnoActivo} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div>
                                <label className="form-field-label">Modalidad del turno (ej. Turno completo o Medio turno):</label>
                                <select
                                    value={formTurnoActivo.modalidad}
                                    onChange={(e) => {
                                        const mod = e.target.value;
                                        let hIni = formTurnoActivo.hora_inicio;
                                        let hFin = formTurnoActivo.hora_fin;
                                        if (mod === 'Medio turno') {
                                            hIni = '08:00';
                                            hFin = '14:00';
                                        } else if (mod === 'Turno matutino') {
                                            hIni = '08:00';
                                            hFin = '16:00';
                                        } else if (mod === 'Turno vespertino') {
                                            hIni = '14:00';
                                            hFin = '22:00';
                                        } else if (mod === 'Turno completo') {
                                            hIni = '08:00';
                                            hFin = '22:00';
                                        }
                                        setFormTurnoActivo({
                                            ...formTurnoActivo,
                                            modalidad: mod,
                                            hora_inicio: hIni,
                                            hora_fin: hFin,
                                        });
                                    }}
                                    className="form-input-clean"
                                >
                                    <option value="Turno completo">Turno completo (Jornada estándar)</option>
                                    <option value="Medio turno">Medio turno (Jornada reducida)</option>
                                    <option value="Turno matutino">Turno matutino</option>
                                    <option value="Turno vespertino">Turno vespertino</option>
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div>
                                    <label className="form-field-label">Hora de inicio:</label>
                                    <input
                                        type="time"
                                        value={formTurnoActivo.hora_inicio}
                                        onChange={(e) => setFormTurnoActivo({ ...formTurnoActivo, hora_inicio: e.target.value })}
                                        className="form-input-clean"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="form-field-label">Hora de fin:</label>
                                    <input
                                        type="time"
                                        value={formTurnoActivo.hora_fin}
                                        onChange={(e) => setFormTurnoActivo({ ...formTurnoActivo, hora_fin: e.target.value })}
                                        className="form-input-clean"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="form-field-label">Usuario responsable asignado al turno:</label>
                                <select
                                    value={formTurnoActivo.id_responsable}
                                    onChange={(e) => setFormTurnoActivo({ ...formTurnoActivo, id_responsable: Number(e.target.value) })}
                                    className="form-input-clean"
                                >
                                    {estado.usuarios
                                        .filter((u) => u.activo)
                                        .map((u) => (
                                            <option key={u.id_usuario} value={u.id_usuario}>
                                                {u.nombre} ({u.rol} · {u.turno})
                                            </option>
                                        ))}
                                </select>
                            </div>

                            <div>
                                <label className="form-field-label">Notas operativas del turno:</label>
                                <input
                                    type="text"
                                    value={formTurnoActivo.notas}
                                    onChange={(e) => setFormTurnoActivo({ ...formTurnoActivo, notas: e.target.value })}
                                    placeholder="Ej. Ajuste a medio turno por evento especial"
                                    className="form-input-clean"
                                />
                            </div>

                            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                                <button
                                    type="button"
                                    className="secondary-outline-btn"
                                    style={{ flex: 1 }}
                                    onClick={() => setModalTurnoAbierto(false)}
                                >
                                    Cancelar
                                </button>
                                <button type="submit" className="primary-dark-btn" style={{ flex: 1.5 }}>
                                    Guardar cambios del turno
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL PARA EDITAR TURNO DE UN COLABORADOR ESPECÍFICO */}
            {usuarioTurnoEditando && (
                <div className="modal-overlay">
                    <div className="modal-card" style={{ maxWidth: 460 }}>
                        <div className="panel-card-header">
                            <span className="panel-card-title" style={{ marginBottom: 0 }}>
                                Editar Turno — {usuarioTurnoEditando.nombre}
                            </span>
                            <button
                                type="button"
                                onClick={() => setUsuarioTurnoEditando(null)}
                                style={{ border: 'none', background: 'transparent', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}
                            >
                                Cerrar
                            </button>
                        </div>

                        <form onSubmit={guardarTurnoColaborador} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div>
                                <label className="form-field-label">Modalidad de jornada:</label>
                                <select
                                    value={usuarioTurnoEditando.tipo_turno}
                                    onChange={(e) => {
                                        const mod = e.target.value;
                                        let hIni = usuarioTurnoEditando.hora_inicio;
                                        let hFin = usuarioTurnoEditando.hora_fin;
                                        if (mod === 'Medio turno') {
                                            hIni = '09:00';
                                            hFin = '13:00';
                                        } else if (mod === 'Turno completo') {
                                            hIni = '09:00';
                                            hFin = '17:00';
                                        }
                                        setUsuarioTurnoEditando({
                                            ...usuarioTurnoEditando,
                                            tipo_turno: mod,
                                            hora_inicio: hIni,
                                            hora_fin: hFin,
                                        });
                                    }}
                                    className="form-input-clean"
                                >
                                    <option value="Turno completo">Turno completo</option>
                                    <option value="Medio turno">Medio turno</option>
                                    <option value="Turno matutino">Turno matutino</option>
                                    <option value="Turno vespertino">Turno vespertino</option>
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div>
                                    <label className="form-field-label">Hora de entrada:</label>
                                    <input
                                        type="time"
                                        value={usuarioTurnoEditando.hora_inicio}
                                        onChange={(e) =>
                                            setUsuarioTurnoEditando({
                                                ...usuarioTurnoEditando,
                                                hora_inicio: e.target.value,
                                                turno: '',
                                            })
                                        }
                                        className="form-input-clean"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="form-field-label">Hora de salida:</label>
                                    <input
                                        type="time"
                                        value={usuarioTurnoEditando.hora_fin}
                                        onChange={(e) =>
                                            setUsuarioTurnoEditando({
                                                ...usuarioTurnoEditando,
                                                hora_fin: e.target.value,
                                                turno: '',
                                            })
                                        }
                                        className="form-input-clean"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="form-field-label">Rol asignado:</label>
                                <select
                                    value={usuarioTurnoEditando.rol}
                                    onChange={(e) => setUsuarioTurnoEditando({ ...usuarioTurnoEditando, rol: e.target.value })}
                                    className="form-input-clean"
                                >
                                    <option value="mesera">Mesera / Salón</option>
                                    <option value="cocina">Cocina / Chef</option>
                                    <option value="administrador">Administrador</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                                <button
                                    type="button"
                                    className="secondary-outline-btn"
                                    style={{ flex: 1 }}
                                    onClick={() => setUsuarioTurnoEditando(null)}
                                >
                                    Cancelar
                                </button>
                                <button type="submit" className="primary-dark-btn" style={{ flex: 1.5 }}>
                                    Guardar turno del colaborador
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL DE DIRECTORIO DE PROVEEDORES */}
            {modalProveedoresAbierto && (
                <div className="modal-overlay">
                    <div className="modal-card" style={{ maxWidth: 620 }}>
                        <div className="panel-card-header">
                            <span className="panel-card-title" style={{ marginBottom: 0 }}>
                                Directorio de Proveedores — Orderly POS
                            </span>
                            <button
                                type="button"
                                onClick={() => setModalProveedoresAbierto(false)}
                                style={{ border: 'none', background: 'transparent', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}
                            >
                                Cerrar
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                            {PROVEEDORES_DIRECTORIO.filter(
                                (prov) =>
                                    !insumoFiltroProveedor ||
                                    prov.insumos.some((ins) => ins.toLowerCase().includes(insumoFiltroProveedor.toLowerCase()))
                            ).map((prov) => (
                                <div
                                    key={prov.id}
                                    style={{
                                        border: '1px solid #e5e7eb',
                                        borderRadius: 10,
                                        padding: '12px 16px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        flexWrap: 'wrap',
                                        gap: 12,
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 14 }}>{prov.empresa}</div>
                                        <div style={{ fontSize: 12.5, color: '#374151', marginTop: 2 }}>
                                            Contacto: <strong>{prov.contacto}</strong> · Teléfono: <strong>{prov.telefono}</strong>
                                        </div>
                                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                                            Insumos: {prov.insumos.join(', ')}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="primary-dark-btn"
                                        style={{ padding: '8px 14px', fontSize: 12.5 }}
                                        onClick={() => registrarLlamadaProveedor(prov)}
                                    >
                                        Solicitar pedido
                                    </button>
                                </div>
                            ))}
                        </div>

                        {pedidosProveedores.length > 0 && (
                            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
                                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>
                                    Solicitudes registradas hoy:
                                </div>
                                {pedidosProveedores.slice(0, 4).map((ped) => (
                                    <div
                                        key={ped.id}
                                        style={{
                                            fontSize: 12,
                                            padding: '6px 0',
                                            borderBottom: '1px solid #f3f4f6',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            flexWrap: 'wrap',
                                            gap: 6,
                                        }}
                                    >
                                        <span>
                                            <strong>{ped.empresa}</strong> ({ped.telefono})
                                        </span>
                                        <span style={{ color: '#15803d', fontWeight: 600 }}>
                                            {ped.hora} · {ped.estado}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
