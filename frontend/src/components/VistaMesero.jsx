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

const MAX_PERSONAS_MESA = 12;

const MOTIVOS_CANCELACION = [
    'Solicitud directa del cliente',
    'Tiempo de espera excedido',
    'Error al capturar la orden',
    'Platillo o ingrediente no disponible',
    'Cambio de opinión de los comensales',
];

const METODOS_PAGO_OPCIONES = [
    'Efectivo',
    'Tarjeta de crédito',
    'Tarjeta de débito',
    'Transferencia',
    'Monedero digital',
];

export default function VistaMesero() {
    const navigate = useNavigate();
    const sesion = obtenerSesionActiva();
    const usuarioActual = sesion?.usuario || { id_usuario: 2, nombre: 'Maria', rol: 'mesera', turno: '9am - 5pm', iniciales: 'MA' };

    const [estado, setEstado] = useState(null);
    const [vistaMesera, setVistaMesera] = useState('mapa_mesas');
    const [menuAbierto, setMenuAbierto] = useState(false);
    const [filtroMapaMesas, setFiltroMapaMesas] = useState('todas');
    const [toast, setToast] = useState(null);
    const [notificacionesEmergentes, setNotificacionesEmergentes] = useState([]);
    const [permisoPush, setPermisoPush] = useState(() => obtenerEstadoPermisoPush());

    async function activarPushMesera() {
        const res = await solicitarPermisoNotificacionesPush();
        setPermisoPush(res);
        if (res === 'granted') {
            dispararNotificacionPushNavegador({
                titulo: 'Notificaciones Push de Salón Activadas',
                mensaje: 'Recibirás avisos inmediatos cuando tus comandas estén listas, un platillo se agote o haya alertas críticas.',
                severidad: 'ok',
            });
            mostrarToast('Notificaciones Push de Salón activadas.', 'ok');
        } else {
            mostrarToast('Alertas emergentes y sonido activos en este dispositivo.', 'alerta');
        }
    }

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
    const [platilloExtraSeleccionado, setPlatilloExtraSeleccionado] = useState('');
    const [cantidadExtraSeleccionada, setCantidadExtraSeleccionada] = useState(1);

    // Estado para Modal de Cancelación de Orden
    const [modalCancelarAbierto, setModalCancelarAbierto] = useState(false);
    const [motivoCancelacionSel, setMotivoCancelacionSel] = useState(MOTIVOS_CANCELACION[0]);
    const [motivoCancelacionExtra, setMotivoCancelacionExtra] = useState('');
    const [cancelandoOrden, setCancelandoOrden] = useState(false);

    // Estado para Modal de Cobro y Separación de Cuenta (Dinámico por número de comensales)
    const [modalCobroAbierto, setModalCobroAbierto] = useState(false);
    const [modoDivision, setModoDivision] = useState('completa');
    const [metodoPagoPrincipal, setMetodoPagoPrincipal] = useState('Efectivo');
    const [metodoPagoSecundario, setMetodoPagoSecundario] = useState('Tarjeta de crédito');
    const [porcentajesComensales, setPorcentajesComensales] = useState([50, 50]);
    const [montosComensales, setMontosComensales] = useState([150, 150]);
    const [metodosComensales, setMetodosComensales] = useState(['Efectivo', 'Tarjeta de crédito']);
    const [platillosSeleccionadosPago1, setPlatillosSeleccionadosPago1] = useState({});

    function cambiarVista(nuevaVista) {
        setVistaMesera(nuevaVista);
        setMenuAbierto(false);
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
        dispararNotificacionPushNavegador({
            titulo: notif.titulo,
            mensaje: notif.mensaje,
            tag: `mesera-push-${notif.id || Date.now()}`,
            severidad: notif.tipo || notif.severidad || 'ok',
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

        socket.on('alerta:push_critica', (alerta) => {
            if (!alerta.rol_destino || alerta.rol_destino === 'mesera' || alerta.rol_destino === 'todos') {
                lanzarNotificacionEmergente({
                    ...alerta,
                    tipo: alerta.severidad || 'critico',
                });
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

    // Inicializar arreglos dinámicos de división según el número real de personas en la mesa
    const inicializarDivisionDinamica = (numPersonas, totalCuenta) => {
        const n = Math.min(MAX_PERSONAS_MESA, Math.max(1, Number(numPersonas || 2)));
        const pctBase = Math.floor((100 / n) * 100) / 100;
        const arrPct = Array.from({ length: n }, (_, idx) =>
            idx === n - 1 ? Number((100 - pctBase * (n - 1)).toFixed(2)) : pctBase
        );
        const montoBase = Math.floor((totalCuenta / n) * 100) / 100;
        const arrMontos = Array.from({ length: n }, (_, idx) =>
            idx === n - 1 ? Number((totalCuenta - montoBase * (n - 1)).toFixed(2)) : montoBase
        );
        const arrMetodos = Array.from({ length: n }, (_, idx) => (idx === 0 ? 'Efectivo' : 'Tarjeta de crédito'));
        setPorcentajesComensales(arrPct);
        setMontosComensales(arrMontos);
        setMetodosComensales(arrMetodos);
    };

    useEffect(() => {
        if (pedidoMesaActiva) {
            setNotaAlergiaActiva(pedidoMesaActiva.nota_cocina || '');
            setNuevoNumPersonas(pedidoMesaActiva.personas || 2);
            inicializarDivisionDinamica(pedidoMesaActiva.personas || 2, Number(pedidoMesaActiva.total || 0));
        }
    }, [pedidoMesaActiva?.id_pedido, pedidoMesaActiva?.numero_mesa, pedidoMesaActiva?.personas, pedidoMesaActiva?.total]);

    function agregarAlCarrito(platillo) {
        const idPlat = platillo.id_platillo || platillo.Id_platillo;
        const nombrePlat = platillo.nombre || platillo.Nombre;
        const precioPlat = Number(platillo.precio || platillo.Precio);
        const disp = platillo.disponible ?? platillo.Disponible;
        const stockActual = Number(platillo.stock ?? platillo.Stock ?? 0);

        if (!disp || stockActual <= 0) {
            mostrarToast(`El platillo "${nombrePlat}" está agotado y no puede agregarse.`, 'critico');
            return;
        }

        const itemEnCarrito = carritoComanda.find((item) => item.id_platillo === idPlat);
        const cantidadActualEnCarrito = itemEnCarrito ? itemEnCarrito.cantidad : 0;

        if (cantidadActualEnCarrito + 1 > stockActual) {
            mostrarToast(
                `Stock límite alcanzado para "${nombrePlat}": solo quedan ${stockActual} disponibles en cocina.`,
                'alerta'
            );
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
        if (delta > 0) {
            const platCatalogo = estado?.platillos?.find((p) => (p.id_platillo || p.Id_platillo) === idPlatillo);
            const stockDisp = Number(platCatalogo?.stock ?? platCatalogo?.Stock ?? 0);
            const itemActual = carritoComanda.find((i) => i.id_platillo === idPlatillo);
            if (itemActual && itemActual.cantidad + delta > stockDisp) {
                mostrarToast(
                    `No se puede incrementar "${itemActual.nombre}": la cantidad solicitada supera el stock disponible (${stockDisp}).`,
                    'alerta'
                );
                return;
            }
        }

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

    // Detectar si algún platillo del carrito quedó sin stock suficiente antes de enviar a cocina
    const conflictoStockCarrito = useMemo(() => {
        if (!estado?.platillos || carritoComanda.length === 0) return null;
        for (const item of carritoComanda) {
            const plat = estado.platillos.find((p) => (p.id_platillo || p.Id_platillo) === item.id_platillo);
            const disp = plat ? (plat.disponible ?? plat.Disponible) : false;
            const stockActual = Number(plat?.stock ?? plat?.Stock ?? 0);
            if (!plat || !disp || stockActual < item.cantidad) {
                return `El platillo "${item.nombre}" requiere ${item.cantidad} unidades, pero solo hay ${stockActual} en stock.`;
            }
        }
        return null;
    }, [estado?.platillos, carritoComanda]);

    async function enviarNuevaComandaACocina() {
        if (carritoComanda.length === 0) {
            mostrarToast('Seleccione al menos un platillo para registrar la comanda.', 'alerta');
            return;
        }
        const numP = Number(personasNueva);
        if (isNaN(numP) || numP < 1 || numP > MAX_PERSONAS_MESA) {
            mostrarToast(`El número de personas por mesa debe estar entre 1 y ${MAX_PERSONAS_MESA}.`, 'critico');
            return;
        }
        if (conflictoStockCarrito) {
            mostrarToast(`Envío bloqueado: ${conflictoStockCarrito}`, 'critico');
            return;
        }

        const total = carritoComanda.reduce((acc, c) => acc + c.precio * c.cantidad, 0);
        try {
            await api.post('/pedidos', {
                id_usuario: usuarioActual.id_usuario || 2,
                numero_mesa: Number(mesaSeleccionadaNueva),
                mesa: Number(mesaSeleccionadaNueva),
                personas: numP,
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

    async function modificarCantidadDetalleActivo(idPedido, det, delta) {
        if (delta > 0) {
            const platCatalogo = estado?.platillos?.find(
                (p) => (p.id_platillo || p.Id_platillo) === Number(det.id_platillo || det.Id_platillo)
            );
            const stockDisp = Number(platCatalogo?.stock ?? platCatalogo?.Stock ?? 0);
            if (!platCatalogo || !(platCatalogo.disponible ?? platCatalogo.Disponible) || stockDisp < delta) {
                mostrarToast(
                    `No se puede agregar más "${det.nombre || det.Nombre}": stock disponible actual es ${stockDisp}.`,
                    'critico'
                );
                return;
            }
        }
        try {
            await api.patch(`/pedidos/${idPedido}`, {
                id_detalle: det.id_detalle,
                delta_cantidad: delta,
            });
            cargarEstado();
        } catch (err) {
            mostrarToast(err.response?.data?.error || 'No se pudo actualizar la cantidad.', 'critico');
        }
    }

    async function agregarPlatilloDirectoAComandaActiva() {
        if (!pedidoMesaActiva || !platilloExtraSeleccionado) {
            mostrarToast('Seleccione un platillo disponible para agregar a la comanda.', 'alerta');
            return;
        }
        const idPlat = Number(platilloExtraSeleccionado);
        const cant = Number(cantidadExtraSeleccionada || 1);
        const platCatalogo = estado?.platillos?.find((p) => (p.id_platillo || p.Id_platillo) === idPlat);
        const stockDisp = Number(platCatalogo?.stock ?? platCatalogo?.Stock ?? 0);

        if (!platCatalogo || !(platCatalogo.disponible ?? platCatalogo.Disponible) || cant > stockDisp) {
            mostrarToast(
                `Stock insuficiente para "${platCatalogo?.nombre || 'Platillo'}": solicita ${cant} y solo quedan ${stockDisp} disponibles.`,
                'critico'
            );
            return;
        }

        try {
            await api.patch(`/pedidos/${pedidoMesaActiva.id_pedido}`, {
                agregar_platillo: {
                    id_platillo: idPlat,
                    cantidad: cant,
                },
            });
            mostrarToast(`Se agregaron ${cant}× "${platCatalogo.nombre}" a la comanda y se descontó del inventario.`, 'ok');
            setPlatilloExtraSeleccionado('');
            setCantidadExtraSeleccionada(1);
            cargarEstado();
        } catch (err) {
            mostrarToast(err.response?.data?.error || 'Error al agregar platillo a la comanda.', 'critico');
        }
    }

    async function eliminarPlatilloDeComandaActiva(idPedido, idDetalle, nombrePlatillo) {
        try {
            const res = await api.patch(`/pedidos/${idPedido}`, {
                id_detalle: idDetalle,
                eliminar_detalle: true,
            });
            if (res.data?.canceladoAutomaticamente) {
                mostrarToast('Se eliminó el último platillo, el stock regresó al inventario y la mesa quedó libre.', 'alerta');
                cambiarVista('mapa_mesas');
            } else {
                mostrarToast(`"${nombrePlatillo}" eliminado de la comanda y devuelto al inventario.`, 'ok');
            }
            cargarEstado();
        } catch (err) {
            mostrarToast(err.response?.data?.error || 'No se pudo eliminar el platillo de la comanda.', 'critico');
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
        const num = Number(nuevoNumPersonas);
        if (isNaN(num) || num < 1 || num > MAX_PERSONAS_MESA) {
            mostrarToast(`El número de personas por mesa debe estar entre 1 y máximo ${MAX_PERSONAS_MESA}.`, 'critico');
            return;
        }
        try {
            await api.patch(`/mesas/${pedidoMesaActiva.numero_mesa}`, {
                personas: num,
            });
            setMostrarCambioPersonas(false);
            mostrarToast(
                `Mesa ${String(pedidoMesaActiva.numero_mesa).padStart(2, '0')} actualizada a ${num} personas.`,
                'ok'
            );
            cargarEstado();
        } catch (err) {
            mostrarToast(err.response?.data?.error || 'Error al actualizar número de personas.', 'critico');
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

    // Cálculos de validación en tiempo real para el Modal de Cobro
    const totalCuentaActiva = Number(pedidoMesaActiva?.total || 0);
    const sumaPorcentajesActual = useMemo(
        () => Number(porcentajesComensales.reduce((acc, val) => acc + Number(val || 0), 0).toFixed(2)),
        [porcentajesComensales]
    );
    const sumaMontosActual = useMemo(
        () => Number(montosComensales.reduce((acc, val) => acc + Number(val || 0), 0).toFixed(2)),
        [montosComensales]
    );

    const errorValidacionCobro = useMemo(() => {
        if (!pedidoMesaActiva) return null;
        if (modoDivision === 'porcentaje') {
            if (sumaPorcentajesActual > 100) {
                return `La suma de los porcentajes (${sumaPorcentajesActual}%) supera el 100% permitido.`;
            }
            if (Math.abs(sumaPorcentajesActual - 100) > 0.05) {
                return `La suma de los porcentajes debe ser exactamente 100% (actual: ${sumaPorcentajesActual}%).`;
            }
            if (porcentajesComensales.some((p) => Number(p) <= 0)) {
                return 'Cada comensal incluido en la división debe tener un porcentaje mayor a 0%.';
            }
        }
        if (modoDivision === 'monto') {
            if (sumaMontosActual > totalCuentaActiva + 0.01) {
                return `La suma de los montos ingresados ($${sumaMontosActual.toFixed(2)}) no puede superar el total de la cuenta ($${totalCuentaActiva.toFixed(2)}).`;
            }
            if (Math.abs(sumaMontosActual - totalCuentaActiva) > 0.05) {
                return `Faltan $${(totalCuentaActiva - sumaMontosActual).toFixed(2)} por asignar para cubrir el total de $${totalCuentaActiva.toFixed(2)}.`;
            }
            if (montosComensales.some((m) => Number(m) <= 0)) {
                return 'Cada pago dividido debe tener un monto mayor a $0.00.';
            }
        }
        return null;
    }, [pedidoMesaActiva, modoDivision, sumaPorcentajesActual, sumaMontosActual, totalCuentaActiva, porcentajesComensales, montosComensales]);

    async function procesarCobroCuenta() {
        if (!pedidoMesaActiva) return;
        if (errorValidacionCobro) {
            mostrarToast(errorValidacionCobro, 'critico');
            return;
        }

        const mesaACobrar = pedidoMesaActiva.numero_mesa;
        const totalCuenta = Number(pedidoMesaActiva.total || 0);
        let pagosDivididos = [];

        if (modoDivision === 'completa') {
            pagosDivididos = [{ metodo: metodoPagoPrincipal, monto: totalCuenta, concepto: 'Cuenta completa' }];
        } else if (modoDivision === 'porcentaje') {
            let acumulado = 0;
            pagosDivididos = porcentajesComensales.map((pct, idx) => {
                const esUltimo = idx === porcentajesComensales.length - 1;
                const montoCalc = esUltimo
                    ? Number((totalCuenta - acumulado).toFixed(2))
                    : Number(((totalCuenta * Number(pct)) / 100).toFixed(2));
                acumulado += montoCalc;
                return {
                    metodo: metodosComensales[idx] || metodoPagoPrincipal,
                    monto: montoCalc,
                    porcentaje: Number(pct),
                    concepto: `Comensal ${idx + 1} (${pct}%)`,
                };
            });
        } else if (modoDivision === 'monto') {
            pagosDivididos = montosComensales.map((m, idx) => ({
                metodo: metodosComensales[idx] || metodoPagoPrincipal,
                monto: Number(Number(m).toFixed(2)),
                concepto: `Comensal ${idx + 1} (Monto asignado)`,
            }));
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
        navigate('/login', { replace: true, state: { sesionCerrada: true } });
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
    const platillosDisponiblesParaAgregar = (estado.platillos || []).filter(
        (p) => (p.disponible ?? p.Disponible) && Number(p.stock ?? p.Stock ?? 0) > 0
    );

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
                                Cerrar
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
                            <div className="user-meta-role">Mesera · {usuarioActual.turno || '09:00 - 17:00'}</div>
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
                            <button
                                type="button"
                                className={`pill-badge ${permisoPush === 'granted' ? 'green' : 'amber'}`}
                                style={{ border: '1px solid #cbd5e1', cursor: 'pointer' }}
                                onClick={activarPushMesera}
                                title="Activar notificaciones Push del sistema para alertas de comandas e insumos"
                            >
                                {permisoPush === 'granted' ? 'Push activo' : 'Activar alertas Push'}
                            </button>
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
                                    <span className="pill-badge gray">{pedidoMesaActiva.personas || 2} personas (máx. {MAX_PERSONAS_MESA})</span>
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
                                                const stockActual = Number(pl.stock ?? pl.Stock ?? 0);
                                                const disp = (pl.disponible ?? pl.Disponible) && stockActual > 0;
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
                                                                    ? 'Sin stock disponible en cocina'
                                                                    : `${pl.descripcion || pl.Descripcion} · (Stock: ${stockActual})`}
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
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
                                                max={MAX_PERSONAS_MESA}
                                                value={personasNueva}
                                                onChange={(e) => {
                                                    const val = Math.min(MAX_PERSONAS_MESA, Math.max(1, Number(e.target.value || 1)));
                                                    setPersonasNueva(val);
                                                }}
                                                style={{ width: 62, padding: '5px 6px', borderRadius: 6, border: '1px solid #d1d5db' }}
                                                title={`Número de personas (1 a ${MAX_PERSONAS_MESA})`}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 11.5, color: '#6b7280', marginBottom: 10 }}>
                                        Capacidad máxima permitida por mesa: <strong>{MAX_PERSONAS_MESA} comensales</strong>.
                                    </div>

                                    {conflictoStockCarrito && (
                                        <div className="alert-banner" style={{ marginBottom: 12 }}>
                                            <span><strong>Stock insuficiente:</strong> {conflictoStockCarrito}</span>
                                        </div>
                                    )}

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
                                        carritoComanda.map((item) => {
                                            const platCat = estado.platillos.find((p) => (p.id_platillo || p.Id_platillo) === item.id_platillo);
                                            const stockMax = Number(platCat?.stock ?? platCat?.Stock ?? 0);
                                            return (
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
                                                        <div>
                                                            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{item.nombre}</div>
                                                            <div style={{ fontSize: 11, color: '#6b7280' }}>
                                                                Disponible en cocina: {stockMax}
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            <div className="qty-stepper">
                                                                <button type="button" onClick={() => cambiarCantidadCarrito(item.id_platillo, -1)}>−</button>
                                                                <span>{item.cantidad}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => cambiarCantidadCarrito(item.id_platillo, 1)}
                                                                    disabled={item.cantidad >= stockMax}
                                                                    style={{ opacity: item.cantidad >= stockMax ? 0.4 : 1 }}
                                                                >
                                                                    +
                                                                </button>
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
                                            );
                                        })
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
                                        style={{
                                            width: '100%',
                                            marginBottom: 10,
                                            opacity: conflictoStockCarrito ? 0.5 : 1,
                                            cursor: conflictoStockCarrito ? 'not-allowed' : 'pointer',
                                        }}
                                        disabled={!!conflictoStockCarrito}
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
                                        const platCatalogo = estado.platillos.find(
                                            (p) => (p.id_platillo || p.Id_platillo) === Number(det.id_platillo || det.Id_platillo)
                                        );
                                        const stockRestante = Number(platCatalogo?.stock ?? platCatalogo?.Stock ?? 0);
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
                                                        {esAgotado
                                                            ? 'Agotado en cocina — excluido del total y ganancias'
                                                            : `${det.notas_item || `$${det.precio} c/u`} · (Stock libre: ${stockRestante})`}
                                                    </div>
                                                </div>

                                                {esAgotado ? (
                                                    <span className="pill-badge red">Sin stock ($0)</span>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div className="qty-stepper">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    modificarCantidadDetalleActivo(pedidoMesaActiva.id_pedido, det, -1)
                                                                }
                                                            >
                                                                −
                                                            </button>
                                                            <span>{det.cantidad}</span>
                                                            <button
                                                                type="button"
                                                                disabled={stockRestante <= 0}
                                                                style={{ opacity: stockRestante <= 0 ? 0.4 : 1 }}
                                                                onClick={() =>
                                                                    modificarCantidadDetalleActivo(pedidoMesaActiva.id_pedido, det, 1)
                                                                }
                                                                title={stockRestante <= 0 ? 'Sin stock adicional disponible' : 'Agregar 1 unidad'}
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
                                                            title="Cancelar este platillo y regresar stock al inventario"
                                                            onClick={() =>
                                                                eliminarPlatilloDeComandaActiva(
                                                                    pedidoMesaActiva.id_pedido,
                                                                    det.id_detalle,
                                                                    nombreItem
                                                                )
                                                            }
                                                        >
                                                            Quitar
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* Selector directo con validación estricta de stock para anexar platillo a la comanda activa */}
                                    <div
                                        style={{
                                            background: '#f8fafc',
                                            border: '1px dashed #cbd5e1',
                                            borderRadius: 8,
                                            padding: 12,
                                            marginTop: 8,
                                        }}
                                    >
                                        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                                            Agregar platillo adicional a esta comanda (valida stock e insumos en vivo):
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            <select
                                                value={platilloExtraSeleccionado}
                                                onChange={(e) => {
                                                    setPlatilloExtraSeleccionado(e.target.value);
                                                    setCantidadExtraSeleccionada(1);
                                                }}
                                                className="form-input-clean"
                                                style={{ flex: 2, minWidth: 180, padding: '8px 10px' }}
                                            >
                                                <option value="">Seleccionar platillo con stock...</option>
                                                {platillosDisponiblesParaAgregar.map((pl) => {
                                                    const idP = pl.id_platillo || pl.Id_platillo;
                                                    return (
                                                        <option key={idP} value={idP}>
                                                            {pl.nombre} — ${pl.precio} (Stock: {pl.stock})
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                            <input
                                                type="number"
                                                min="1"
                                                max={
                                                    platilloExtraSeleccionado
                                                        ? Number(
                                                              platillosDisponiblesParaAgregar.find(
                                                                  (p) => (p.id_platillo || p.Id_platillo) === Number(platilloExtraSeleccionado)
                                                              )?.stock || 1
                                                          )
                                                        : 15
                                                }
                                                value={cantidadExtraSeleccionada}
                                                onChange={(e) => setCantidadExtraSeleccionada(Math.max(1, Number(e.target.value || 1)))}
                                                style={{ width: 68, padding: '8px', borderRadius: 8, border: '1px solid #d1d5db' }}
                                                title="Cantidad a agregar"
                                            />
                                            <button
                                                type="button"
                                                className="primary-dark-btn"
                                                style={{ padding: '8px 14px', fontSize: 12.5 }}
                                                onClick={agregarPlatilloDirectoAComandaActiva}
                                            >
                                                + Anexar
                                            </button>
                                        </div>
                                    </div>

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
                                                onClick={() => {
                                                    inicializarDivisionDinamica(
                                                        pedidoMesaActiva.personas || 2,
                                                        Number(pedidoMesaActiva.total || 0)
                                                    );
                                                    setModalCobroAbierto(true);
                                                }}
                                            >
                                                Cobrar y cerrar mesa →
                                            </button>

                                            <button
                                                type="button"
                                                className="secondary-outline-btn"
                                                onClick={() => setMostrarCambioPersonas(!mostrarCambioPersonas)}
                                            >
                                                Cambiar número de personas (1 - {MAX_PERSONAS_MESA})
                                            </button>
                                            {mostrarCambioPersonas && (
                                                <div style={{ display: 'flex', gap: 8, padding: 8, background: '#f8fafc', borderRadius: 8 }}>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max={MAX_PERSONAS_MESA}
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

                                            <button
                                                type="button"
                                                className="danger-outline-btn"
                                                style={{ marginTop: 4 }}
                                                onClick={() => setModalCancelarAbierto(true)}
                                            >
                                                Cancelar orden y liberar mesa
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
                                                  <strong>{p.numero_mesa}</strong> — {p.resumen_platillos} ({p.metodo} · {p.concepto_division})
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

            {/* MODAL DE CANCELACIÓN DE ORDEN */}
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
                            Esta acción cancelará la comanda <strong>#{pedidoMesaActiva.id_pedido}</strong> (${Number(pedidoMesaActiva.total).toFixed(2)}), reintegrará el stock e insumos si aún no se prepara, liberará la{' '}
                            <strong>Mesa {String(pedidoMesaActiva.numero_mesa).padStart(2, '0')}</strong> y notificará al monitor de Cocina.
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

            {/* MODAL DE COBRO Y SEPARACIÓN DE CUENTAS DINÁMICO */}
            {modalCobroAbierto && pedidoMesaActiva && (
                <div className="modal-overlay">
                    <div className="modal-card" style={{ maxWidth: 600 }}>
                        <div className="panel-card-header">
                            <span className="panel-card-title" style={{ marginBottom: 0 }}>
                                Cobrar — Mesa {String(pedidoMesaActiva.numero_mesa).padStart(2, '0')} · {porcentajesComensales.length} comensales (Total: $
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
                                { id: 'porcentaje', label: `Por porcentaje (${porcentajesComensales.length} personas)` },
                                { id: 'monto', label: `Por monto ($)` },
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

                        {errorValidacionCobro && (
                            <div className="alert-banner" style={{ marginBottom: 12 }}>
                                <span><strong>Validación de cobro:</strong> {errorValidacionCobro}</span>
                            </div>
                        )}

                        {modoDivision === 'completa' && (
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ fontSize: 12.5, fontWeight: 600 }}>Método de pago de la cuenta completa:</label>
                                <select
                                    value={metodoPagoPrincipal}
                                    onChange={(e) => setMetodoPagoPrincipal(e.target.value)}
                                    className="form-input-clean"
                                    style={{ marginTop: 4 }}
                                >
                                    {METODOS_PAGO_OPCIONES.map((op) => (
                                        <option key={op} value={op}>{op}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {modoDivision === 'platillo' && (
                            <>
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
                                        Marca los platillos que pagará la Cuenta 1:
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
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                                    <div>
                                        <label style={{ fontSize: 12.5, fontWeight: 600 }}>Método Cuenta 1:</label>
                                        <select
                                            value={metodoPagoPrincipal}
                                            onChange={(e) => setMetodoPagoPrincipal(e.target.value)}
                                            className="form-input-clean"
                                            style={{ marginTop: 4 }}
                                        >
                                            {METODOS_PAGO_OPCIONES.map((op) => (
                                                <option key={op} value={op}>{op}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: 12.5, fontWeight: 600 }}>Método Cuenta 2 (Restante):</label>
                                        <select
                                            value={metodoPagoSecundario}
                                            onChange={(e) => setMetodoPagoSecundario(e.target.value)}
                                            className="form-input-clean"
                                            style={{ marginTop: 4 }}
                                        >
                                            {METODOS_PAGO_OPCIONES.map((op) => (
                                                <option key={op} value={op}>{op}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </>
                        )}

                        {modoDivision === 'porcentaje' && (
                            <div style={{ marginBottom: 14 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                                        División dinámica entre {porcentajesComensales.length} comensales registrados (Suma: {sumaPorcentajesActual}%)
                                    </span>
                                    <button
                                        type="button"
                                        className="secondary-outline-btn"
                                        style={{ padding: '4px 10px', fontSize: 11.5 }}
                                        onClick={() => inicializarDivisionDinamica(pedidoMesaActiva.personas || 2, totalCuentaActiva)}
                                    >
                                        Partes iguales
                                    </button>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto', paddingRight: 4 }}>
                                    {porcentajesComensales.map((pct, idx) => {
                                        const montoEquiv = ((totalCuentaActiva * Number(pct || 0)) / 100).toFixed(2);
                                        return (
                                            <div
                                                key={idx}
                                                style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: '105px 95px 90px 1fr',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    background: '#f8fafc',
                                                    padding: '8px 10px',
                                                    borderRadius: 8,
                                                    fontSize: 12.5,
                                                }}
                                            >
                                                <strong>Comensal {idx + 1}</strong>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        step="1"
                                                        value={pct}
                                                        onChange={(e) => {
                                                            const nuevoVal = Math.max(0, Number(e.target.value || 0));
                                                            setPorcentajesComensales((prev) =>
                                                                prev.map((item, i) => (i === idx ? nuevoVal : item))
                                                            );
                                                        }}
                                                        style={{ width: 62, padding: '5px 6px', borderRadius: 6, border: '1px solid #d1d5db' }}
                                                    />
                                                    <span>%</span>
                                                </div>
                                                <span style={{ fontWeight: 700, color: '#15803d' }}>${montoEquiv}</span>
                                                <select
                                                    value={metodosComensales[idx] || 'Efectivo'}
                                                    onChange={(e) =>
                                                        setMetodosComensales((prev) =>
                                                            prev.map((m, i) => (i === idx ? e.target.value : m))
                                                        )
                                                    }
                                                    style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12 }}
                                                >
                                                    {METODOS_PAGO_OPCIONES.map((op) => (
                                                        <option key={op} value={op}>{op}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {modoDivision === 'monto' && (
                            <div style={{ marginBottom: 14 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                                        Suma ingresada: ${sumaMontosActual.toFixed(2)} / Total: ${totalCuentaActiva.toFixed(2)}
                                    </span>
                                    <button
                                        type="button"
                                        className="secondary-outline-btn"
                                        style={{ padding: '4px 10px', fontSize: 11.5 }}
                                        onClick={() => inicializarDivisionDinamica(pedidoMesaActiva.personas || 2, totalCuentaActiva)}
                                    >
                                        Distribuir equitativo
                                    </button>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto', paddingRight: 4 }}>
                                    {montosComensales.map((mVal, idx) => (
                                        <div
                                            key={idx}
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: '110px 125px 1fr',
                                                alignItems: 'center',
                                                gap: 8,
                                                background: '#f8fafc',
                                                padding: '8px 10px',
                                                borderRadius: 8,
                                                fontSize: 12.5,
                                            }}
                                        >
                                            <strong>Comensal {idx + 1}</strong>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <span>$</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={totalCuentaActiva}
                                                    step="0.5"
                                                    value={mVal}
                                                    onChange={(e) => {
                                                        const nuevoMonto = Math.max(0, Number(e.target.value || 0));
                                                        setMontosComensales((prev) =>
                                                            prev.map((item, i) => (i === idx ? nuevoMonto : item))
                                                        );
                                                    }}
                                                    style={{ width: 92, padding: '5px 6px', borderRadius: 6, border: '1px solid #d1d5db' }}
                                                />
                                            </div>
                                            <select
                                                value={metodosComensales[idx] || 'Efectivo'}
                                                onChange={(e) =>
                                                    setMetodosComensales((prev) =>
                                                        prev.map((m, i) => (i === idx ? e.target.value : m))
                                                    )
                                                }
                                                style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12 }}
                                            >
                                                {METODOS_PAGO_OPCIONES.map((op) => (
                                                    <option key={op} value={op}>{op}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                type="button"
                                className="secondary-outline-btn"
                                style={{ flex: 1 }}
                                onClick={() => setModalCobroAbierto(false)}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="primary-dark-btn"
                                style={{
                                    flex: 2,
                                    opacity: errorValidacionCobro ? 0.5 : 1,
                                    cursor: errorValidacionCobro ? 'not-allowed' : 'pointer',
                                }}
                                disabled={!!errorValidacionCobro}
                                onClick={procesarCobroCuenta}
                            >
                                Confirmar pago y liberar Mesa {String(pedidoMesaActiva.numero_mesa).padStart(2, '0')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
