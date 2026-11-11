const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { verificarToken, verificarRol, revocarToken, JWT_SECRET } = require('./middleware/auth');
require('dotenv').config();

const db = require('./config/db');
const { estado, recalcularTotalPedido, obtenerNivelInsumo, ejecutarRespaldoAutomatico } = db;

const app = express();
const server = http.createServer(app);

// Cabeceras de Seguridad HTTP
app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

app.use(cors());
app.use(express.json({ limit: '256kb' }));

// Control de intentos fallidos de inicio de sesión (Protección Fuerza Bruta)
const intentosFallidos = new Map();
const MAX_INTENTOS_LOGIN = 5;
const TIEMPO_BLOQUEO_MS = 3 * 60 * 1000; // 3 minutos

function verificarBloqueoCuenta(idUsuario) {
    const reg = intentosFallidos.get(idUsuario);
    if (!reg) return { bloqueado: false };
    if (reg.bloqueadoHasta && Date.now() < reg.bloqueadoHasta) {
        const segRestantes = Math.ceil((reg.bloqueadoHasta - Date.now()) / 1000);
        return { bloqueado: true, segRestantes };
    }
    if (reg.bloqueadoHasta && Date.now() >= reg.bloqueadoHasta) {
        intentosFallidos.delete(idUsuario);
    }
    return { bloqueado: false };
}

function registrarIntentoFallido(idUsuario) {
    const actual = intentosFallidos.get(idUsuario) || { conteo: 0, bloqueadoHasta: null };
    actual.conteo += 1;
    if (actual.conteo >= MAX_INTENTOS_LOGIN) {
        actual.bloqueadoHasta = Date.now() + TIEMPO_BLOQUEO_MS;
        intentosFallidos.set(idUsuario, actual);
        return { bloqueado: true, intentosRestantes: 0 };
    }
    intentosFallidos.set(idUsuario, actual);
    return { bloqueado: false, intentosRestantes: MAX_INTENTOS_LOGIN - actual.conteo };
}

// Configuración de WebSockets (Socket.io)
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST", "PUT", "PATCH", "DELETE"] }
});

function serializarUsuarioPublico(u) {
    const partes = String(u.nombre || 'U').trim().split(/\s+/);
    const iniciales = partes.length >= 2
        ? (partes[0][0] + partes[1][0]).toUpperCase()
        : String(u.nombre || 'OR').slice(0, 2).toUpperCase();
    return {
        id_Usuario: u.id_Usuario || u.id_usuario,
        id_usuario: u.id_usuario || u.id_Usuario,
        nombre: u.nombre,
        usuario_login: u.usuario_login || u.nombre,
        rol: u.rol,
        activo: u.activo !== false,
        turno: u.turno || '9am - 5pm',
        iniciales
    };
}

function obtenerSnapshotEstado() {
    const inventarioSerializado = estado.inventario.map((ins) => {
        const nivelRaw = obtenerNivelInsumo(ins);
        const max = ins.cantidad_maxima || 15;
        const porcentaje = Math.min(100, Math.max(6, Math.round((ins.cantidad / max) * 100)));
        return {
            ...ins,
            nivel: nivelRaw === 'OK' ? 'OK' : nivelRaw,
            porcentaje,
            categoria: ins.categoria_insumo === 'principal' ? 'Insumos principales' : 'Bebidas e insumos secundarios'
        };
    });

    const alertasInventario = inventarioSerializado.filter((ins) => ins.nivel !== 'OK');

    // Sincronizar cada mesa con su pedido activo (excluyendo cerrados y cancelados)
    estado.mesas.forEach((m) => {
        const pedidoActivo = estado.pedidos.find(
            (p) => Number(p.numero_mesa || p.mesa) === m.numero && !['cerrado', 'cancelado'].includes(p.estado || p.Estado)
        );
        if (pedidoActivo) {
            m.total = recalcularTotalPedido(pedidoActivo);
            m.personas = pedidoActivo.personas || 2;
            m.mesera = pedidoActivo.nombre_mesera || 'Maria';
            const estPed = pedidoActivo.estado || pedidoActivo.Estado;
            m.estado = estPed === 'preparado' ? 'por_cobrar' : 'ocupada';
        } else {
            m.estado = 'libre';
            m.personas = 0;
            m.minutos = 0;
            m.total = 0;
        }
    });

    const ultimasTransacciones = [
        ...estado.pagos.slice(0, 8).map((p) => ({
            id: `pago-${p.id_pago}`,
            mesa: p.numero_mesa,
            platillos: p.resumen_platillos,
            mesera: p.mesera,
            metodo: p.metodo,
            total: p.monto,
            hora: p.hora,
            estado: 'Cobrado',
        })),
        ...estado.pedidos
            .filter((ped) => !['cerrado', 'cancelado'].includes(ped.estado || ped.Estado))
            .slice(0, 6)
            .map((ped) => {
                const detalles = ped.detalles || ped.platillos || [];
                const estPed = ped.estado || ped.Estado;
                return {
                    id: `ped-${ped.id_pedido || ped.Id_pedido}`,
                    mesa: `Mesa ${String(ped.numero_mesa || ped.mesa || 1).padStart(2, '0')}`,
                    platillos: detalles
                        .filter((d) => d.estado_item !== 'agotado_eliminado')
                        .map((d) => `${(d.nombre || d.Nombre || 'Platillo').split(' ')[0]} ×${d.cantidad || d.Cantidad || 1}`)
                        .join(', '),
                    mesera: ped.nombre_mesera || 'Maria',
                    metodo: estPed === 'preparado' ? 'Pendiente cobro' : '—',
                    total: recalcularTotalPedido(ped),
                    hora: ped.hora_recepcion || '9:40 am',
                    estado: estPed === 'preparado' ? 'En mesa' : 'En cocina',
                };
            }),
    ];

    return {
        usuarios: estado.usuarios.map(serializarUsuarioPublico),
        platillos: estado.platillos,
        inventario: inventarioSerializado,
        alertasActivasCount: alertasInventario.length,
        alertasInventario,
        mesas: estado.mesas,
        pedidos: estado.pedidos,
        pagos: estado.pagos,
        ultimasTransacciones,
        metricasDia: {
            ...estado.metricasDia,
            comparativaAyer: estado.metricasDia.porcentajeVsAyer || '↑ 12% vs ayer',
            mesasAtendidasHoy: estado.metricasDia.mesasAtendidas || 34
        },
        notificaciones: estado.notificaciones,
        logsAuditoria: estado.logsAuditoria,
        ultimoRespaldo: estado.ultimoRespaldo,
        motorBaseDatos: estado.motorBaseDatos,
    };
}

function emitirActualizacionTiempoReal(evento = 'estado:actualizado', payloadExtra = {}) {
    const snapshot = obtenerSnapshotEstado();
    io.emit('estado:actualizado', snapshot);
    if (evento !== 'estado:actualizado') {
        io.emit(evento, { ...payloadExtra, timestamp: new Date().toISOString() });
    }
}

function registrarLog(usuario, accion, detalle) {
    const horaActual = new Date().toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
    estado.logsAuditoria.unshift({
        id_log: estado.logsAuditoria.length + 1,
        usuario,
        accion,
        detalle,
        hora: horaActual,
    });
}

function agregarNotificacion(rol_destino, titulo, mensaje, tipo = 'info', extra = {}) {
    const horaActual = new Date().toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
    const notif = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        rol_destino,
        titulo,
        mensaje,
        hora: horaActual,
        tipo,
        ...extra,
    };
    estado.notificaciones.unshift(notif);
    io.emit('notificacion:emergente', notif);
    return notif;
}

io.on('connection', (socket) => {
    socket.emit('estado:actualizado', obtenerSnapshotEstado());

    socket.on('enviar_pedido', (pedido) => {
        io.emit('nuevo_pedido', pedido);
        emitirActualizacionTiempoReal();
    });
});

// ============================================================================
// ENDPOINTS DE AUTENTICACIÓN Y SEGURIDAD
// ============================================================================

app.get('/api/auth/perfiles', (_req, res) => {
    return res.json({
        usuarios: estado.usuarios.filter((u) => u.activo !== false).map(serializarUsuarioPublico),
        resumenPublico: {
            mesasLibres: estado.mesas.filter((m) => m.estado === 'libre').length,
            totalMesas: estado.mesas.length,
            servidorActivo: true,
        },
    });
});

async function manejarLogin(req, res) {
    const { nombre, usuario_login, id_usuario, contrasena, password } = req.body || {};
    const passRecibida = String(contrasena || password || '').trim();

    if (!passRecibida) {
        return res.status(400).json({ error: 'Ingrese su contraseña para iniciar sesión.' });
    }

    try {
        let usuario = null;

        if (id_usuario) {
            usuario = estado.usuarios.find(u => (u.id_Usuario || u.id_usuario) === Number(id_usuario));
        }

        if (!usuario && (nombre || usuario_login)) {
            const buscado = String(nombre || usuario_login).trim();
            const [usuariosDB] = await db.query('SELECT * FROM Usuarios WHERE nombre = ? AND activo = true', [buscado]);
            if (usuariosDB && usuariosDB.length > 0) {
                usuario = usuariosDB[0];
            } else {
                const normalizar = (str) => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
                const buscadoNorm = normalizar(buscado);
                usuario = estado.usuarios.find(u => {
                    const nomNorm = normalizar(u.nombre);
                    const logNorm = normalizar(u.usuario_login);
                    const rolNorm = normalizar(u.rol);
                    return (
                        nomNorm === buscadoNorm ||
                        logNorm === buscadoNorm ||
                        rolNorm === buscadoNorm ||
                        (u.id_usuario === 1 && ['jesus', 'j. david', 'david', 'admin', 'administrador'].includes(buscadoNorm)) ||
                        (u.id_usuario === 2 && ['maria', 'maria g.', 'maria garcia', 'mesera'].includes(buscadoNorm)) ||
                        (u.id_usuario === 3 && ['roberto', 'cocina', 'chef'].includes(buscadoNorm)) ||
                        (u.id_usuario === 4 && ['ana', 'ana l.'].includes(buscadoNorm))
                    );
                });
            }
        }

        if (!usuario) {
            registrarLog('Desconocido', 'LOGIN_FALLIDO', `Intento con usuario inexistente: ${nombre || usuario_login || ''}`);
            return res.status(401).json({ error: 'Credenciales inválidas. Verifique su usuario y contraseña.' });
        }

        if (usuario.activo === false) {
            registrarLog(usuario.nombre, 'LOGIN_BLOQUEADO', 'Intento de acceso con cuenta desactivada');
            return res.status(403).json({ error: 'Esta cuenta se encuentra desactivada. Contacte al administrador.' });
        }

        const idReal = usuario.id_Usuario || usuario.id_usuario || 1;
        const bloqueo = verificarBloqueoCuenta(idReal);
        if (bloqueo.bloqueado) {
            return res.status(429).json({
                error: `Cuenta bloqueada temporalmente por seguridad tras múltiples intentos fallidos. Intente en ${bloqueo.segRestantes} segundos.`
            });
        }

        const passCorrecta = await bcrypt.compare(passRecibida, usuario.contrasena);
        if (!passCorrecta) {
            const fallo = registrarIntentoFallido(idReal);
            registrarLog(usuario.nombre, 'PASSWORD_INCORRECTO', `Contraseña fallida (restantes: ${fallo.intentosRestantes})`);
            if (fallo.bloqueado) {
                return res.status(429).json({
                    error: 'Cuenta bloqueada por 3 minutos tras 5 intentos fallidos de contraseña.'
                });
            }
            return res.status(401).json({
                error: `Contraseña incorrecta. Intentos restantes antes de bloqueo: ${fallo.intentosRestantes}.`
            });
        }

        intentosFallidos.delete(idReal);
        const usuarioPublico = serializarUsuarioPublico(usuario);

        const token = jwt.sign(
            { id: idReal, id_usuario: idReal, nombre: usuario.nombre, rol: usuario.rol },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        registrarLog(usuario.nombre, 'LOGIN_EXITOSO', `Sesión autenticada con rol ${usuario.rol.toUpperCase()}`);

        return res.json({
            exito: true,
            mensaje: 'Autenticación verificada correctamente',
            token,
            rol: usuario.rol,
            usuario: usuarioPublico,
            expiraEn: new Date(Date.now() + 8 * 3600 * 1000).toISOString()
        });
    } catch (error) {
        console.error('Error en login:', error);
        return res.status(500).json({ error: 'Error interno en el servidor' });
    }
}

app.post('/api/login', manejarLogin);
app.post('/api/auth/login', manejarLogin);

app.get('/api/auth/sesion', verificarToken, (req, res) => {
    const u = estado.usuarios.find(item => (item.id_usuario || item.id_Usuario) === Number(req.usuario.id));
    if (!u || u.activo === false) {
        return res.status(401).json({ error: 'Usuario inactivo o no encontrado' });
    }
    return res.json({
        autenticado: true,
        usuario: serializarUsuarioPublico(u),
        rol: u.rol
    });
});

app.post('/api/auth/logout', verificarToken, (req, res) => {
    revocarToken(req.tokenActual);
    registrarLog(req.usuario.nombre || 'Usuario', 'LOGOUT', `Cierre de sesión seguro (${req.usuario.rol})`);
    res.json({ mensaje: 'Sesión cerrada y token revocado correctamente.' });
});

// ============================================================================
// ENDPOINTS DE ESTADO GENERAL
// ============================================================================

app.get('/api/status', verificarToken, verificarRol(['mesera', 'cocina', 'administrador']), async (_req, res) => {
    res.json({ mensaje: 'El servidor backend de Orderly está funcionando correctamente' });
});

app.get('/api/estado', verificarToken, (_req, res) => {
    res.json(obtenerSnapshotEstado());
});

// ============================================================================
// MÓDULO DE PLATILLOS Y DISPONIBILIDAD EN TIEMPO REAL
// ============================================================================

app.get('/api/platillos', verificarToken, verificarRol(['mesera', 'cocina', 'administrador']), async (req, res) => {
    try {
        if (req.query.todos === 'true') {
            const [rows] = await db.query('SELECT * FROM Platillos');
            return res.json(rows);
        }
        const [rows] = await db.query('SELECT * FROM Platillos WHERE Disponible = true');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al consultar los platillos' });
    }
});

app.post('/api/platillos', verificarToken, verificarRol(['administrador']), async (req, res) => {
    const { nombre, descripcion, categoria, precio, stock, unidad_stock } = req.body;
    if (!nombre || !precio) {
        return res.status(400).json({ error: 'Nombre y precio son requeridos' });
    }
    const nuevoId = estado.platillos.reduce((max, p) => Math.max(max, p.id_platillo || p.Id_platillo || 0), 0) + 1;
    const stockNum = Number(stock ?? 15);
    const nuevoPlatillo = {
        Id_platillo: nuevoId,
        id_platillo: nuevoId,
        Nombre: String(nombre).trim(),
        nombre: String(nombre).trim(),
        Descripcion: descripcion || 'Platillo tradicional de la casa',
        descripcion: descripcion || 'Platillo tradicional de la casa',
        Categoria: categoria || 'Plato fuerte',
        categoria: categoria || 'Plato fuerte',
        Precio: Number(precio),
        precio: Number(precio),
        Stock: stockNum,
        stock: stockNum,
        unidad_stock: unidad_stock || 'porciones',
        Disponible: stockNum > 0,
        disponible: stockNum > 0,
        tiempo_prep_min: 12,
        receta: []
    };
    estado.platillos.push(nuevoPlatillo);
    registrarLog(req.usuario.nombre || 'Admin', 'NUEVO_PLATILLO', `Platillo agregado: ${nombre} ($${precio})`);
    emitirActualizacionTiempoReal('platillo:creado', { platillo: nuevoPlatillo });
    res.status(201).json(nuevoPlatillo);
});

app.patch('/api/platillos/:id', verificarToken, verificarRol(['administrador']), (req, res) => {
    const idPlatillo = Number(req.params.id);
    const platillo = estado.platillos.find((p) => (p.id_platillo || p.Id_platillo) === idPlatillo);
    if (!platillo) return res.status(404).json({ error: 'Platillo no encontrado' });

    const { nombre, descripcion, categoria, precio, stock } = req.body;
    if (nombre) {
        platillo.nombre = String(nombre).trim();
        platillo.Nombre = platillo.nombre;
    }
    if (typeof descripcion === 'string') {
        platillo.descripcion = descripcion;
        platillo.Descripcion = descripcion;
    }
    if (categoria) {
        platillo.categoria = categoria;
        platillo.Categoria = categoria;
    }
    if (precio !== undefined && !isNaN(Number(precio)) && Number(precio) > 0) {
        platillo.precio = Number(precio);
        platillo.Precio = Number(precio);
    }
    if (stock !== undefined && !isNaN(Number(stock)) && Number(stock) >= 0) {
        platillo.stock = Number(stock);
        platillo.Stock = Number(stock);
        platillo.disponible = platillo.stock > 0;
        platillo.Disponible = platillo.disponible;
    }

    registrarLog(req.usuario.nombre || 'Admin', 'EDITAR_PLATILLO', `Platillo actualizado: ${platillo.nombre} ($${platillo.precio}, stock: ${platillo.stock})`);
    emitirActualizacionTiempoReal('platillo:actualizado', { platillo });
    return res.json(platillo);
});

async function cambiarDisponibilidadPlatillo(req, res) {
    const idPlatillo = Number(req.params.id);
    const platillo = estado.platillos.find((p) => (p.id_platillo || p.Id_platillo) === idPlatillo);
    if (!platillo) {
        return res.status(404).json({ error: 'Platillo no encontrado' });
    }

    const nuevoEstado = typeof req.body.disponible === 'boolean' ? req.body.disponible : !platillo.disponible;
    platillo.disponible = nuevoEstado;
    platillo.Disponible = nuevoEstado;

    if (nuevoEstado && platillo.stock === 0) {
        platillo.stock = 10;
        platillo.Stock = 10;
    } else if (!nuevoEstado) {
        platillo.stock = 0;
        platillo.Stock = 0;
        estado.pedidos.forEach((ped) => {
            if ((ped.estado || ped.Estado) === 'pendiente') {
                (ped.detalles || []).forEach((det) => {
                    if ((det.id_platillo || det.Id_platillo) === idPlatillo) {
                        det.estado_item = 'agotado_eliminado';
                    }
                });
                recalcularTotalPedido(ped);
            }
        });
    }

    const msg = nuevoEstado
        ? `${platillo.nombre} habilitado nuevamente en el menú (${platillo.stock} ${platillo.unidad_stock}).`
        : `${platillo.nombre} marcado como AGOTADO por cocina. Eliminado de comandas activas.`;

    agregarNotificacion('mesera', `Disponibilidad: ${platillo.nombre}`, msg, nuevoEstado ? 'info' : 'critico');
    registrarLog(req.usuario.nombre || 'Cocina', 'SWITCH_DISPONIBILIDAD', msg);
    emitirActualizacionTiempoReal('platillo:disponibilidad', { platillo });

    return res.json({ platillo, mensaje: msg });
}

app.patch('/api/platillos/:id/disponibilidad', verificarToken, verificarRol(['cocina', 'administrador']), cambiarDisponibilidadPlatillo);
app.put('/api/platillos/:id/disponibilidad', verificarToken, verificarRol(['cocina', 'administrador']), cambiarDisponibilidadPlatillo);

// ============================================================================
// MÓDULO DE COMANDAS ELECTRÓNICAS Y CANCELACIÓN DE ÓRDENES
// ============================================================================

app.get('/api/pedidos/pendientes', verificarToken, verificarRol(['cocina', 'administrador', 'mesera']), async (_req, res) => {
    try {
        const pendientes = estado.pedidos
            .filter(p => (p.Estado || p.estado) === 'pendiente')
            .map(p => ({
                ...p,
                id_pedido: p.id_pedido || p.Id_pedido,
                mesa: p.numero_mesa || p.mesa || 1,
                platillos: (p.detalles || p.platillos || []).map(d => ({
                    ...d,
                    Id_platillo: d.Id_platillo || d.id_platillo,
                    Nombre: d.Nombre || d.nombre,
                    cantidad: d.cantidad || d.Cantidad,
                    subtotal: d.subtotal || d.Subtotal
                }))
            }));
        res.json(pendientes);
    } catch (error) {
        res.status(500).json({ error: 'Error al cargar pedidos pendientes' });
    }
});

app.post('/api/pedidos', verificarToken, verificarRol(['mesera', 'administrador']), async (req, res) => {
    try {
        const numeroMesa = Number(req.body.numero_mesa || req.body.mesa || 1);
        const personas = Number(req.body.personas || 2);
        const nombreMesera = req.body.nombre_mesera || req.usuario?.nombre || 'Maria';
        const notaCocina = req.body.nota_cocina || '';
        const idUsuario = Number(req.body.id_usuario || req.usuario?.id || 2);

        const listaItems = Array.isArray(req.body.items) && req.body.items.length > 0
            ? req.body.items
            : (Array.isArray(req.body.platillos) ? req.body.platillos : []);

        if (listaItems.length === 0) {
            return res.status(400).json({ error: 'Seleccione al menos un platillo para enviar la comanda.' });
        }

        const detalles = [];
        for (let idx = 0; idx < listaItems.length; idx++) {
            const item = listaItems[idx];
            const idPlat = Number(item.id_platillo || item.Id_platillo);
            const cant = Number(item.cantidad || item.Cantidad || 1);
            const plat = estado.platillos.find((p) => (p.id_platillo || p.Id_platillo) === idPlat);

            if (plat) {
                plat.stock = Math.max(0, plat.stock - cant);
                plat.Stock = plat.stock;
                if (plat.stock === 0) {
                    plat.disponible = false;
                    plat.Disponible = false;
                }

                if (Array.isArray(plat.receta)) {
                    plat.receta.forEach((ing) => {
                        const insumo = estado.inventario.find((i) => i.id_insumo === ing.id_insumo);
                        if (insumo) {
                            insumo.cantidad = Number(Math.max(0, insumo.cantidad - ing.cantidad_requerida * cant).toFixed(2));
                        }
                    });
                }

                const vendidoEntry = estado.metricasDia.platillosVendidosHoy.find((v) => v.id_platillo === idPlat);
                if (vendidoEntry) {
                    vendidoEntry.cantidad += cant;
                }
            }

            const precioUnit = plat ? plat.precio : Number(item.Precio || item.precio || 95);
            const nombrePlat = plat ? plat.nombre : (item.Nombre || item.nombre || `Platillo #${idPlat}`);
            const sub = Number((precioUnit * cant).toFixed(2));

            detalles.push({
                id_detalle: Date.now() + idx + Math.floor(Math.random() * 1000),
                Id_platillo: idPlat,
                id_platillo: idPlat,
                Nombre: nombrePlat,
                nombre: nombrePlat,
                precio: precioUnit,
                precio_unitario: precioUnit,
                cantidad: cant,
                Cantidad: cant,
                subtotal: sub,
                Subtotal: sub,
                notas_item: item.notas_item || item.nota || '',
                estado_item: 'activo'
            });
        }

        const totalCalculado = detalles.reduce((acc, d) => acc + d.subtotal, 0);

        if (estado.mysqlDisponible) {
            try {
                const [resPed] = await db.query(
                    'INSERT INTO Pedidos (Id_usuario, Total, Estado) VALUES (?, ?, ?)',
                    [idUsuario, totalCalculado, 'pendiente']
                );
                const idInsertado = resPed.insertId;
                for (const det of detalles) {
                    await db.query(
                        'INSERT INTO Detalle_Pedido (Id_pedido, Id_platillo, Cantidad, Subtotal) VALUES (?, ?, ?, ?)',
                        [idInsertado, det.id_platillo, det.cantidad, det.subtotal]
                    );
                }
            } catch {
                // Continuar en motor resiliente
            }
        }

        let pedidoActivo = estado.pedidos.find(
            (p) => Number(p.numero_mesa || p.mesa) === numeroMesa && !['cerrado', 'cancelado'].includes(p.estado || p.Estado)
        );

        const horaActual = new Date().toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });

        if (pedidoActivo && req.body.items) {
            pedidoActivo.detalles.push(...detalles);
            if (notaCocina) pedidoActivo.nota_cocina = notaCocina;
            pedidoActivo.estado = 'pendiente';
            pedidoActivo.Estado = 'pendiente';
            recalcularTotalPedido(pedidoActivo);
        } else {
            const nuevoId = estado.pedidos.reduce((max, p) => Math.max(max, p.id_pedido || p.Id_pedido || 100), 100) + 1;
            pedidoActivo = {
                Id_pedido: nuevoId,
                id_pedido: nuevoId,
                numero_mesa: numeroMesa,
                mesa: numeroMesa,
                personas,
                Id_usuario: idUsuario,
                id_usuario: idUsuario,
                nombre_mesera: nombreMesera,
                Estado: 'pendiente',
                estado: 'pendiente',
                Total: totalCalculado,
                total: totalCalculado,
                nota_cocina: notaCocina,
                hora_recepcion: horaActual,
                minutos_espera: 1,
                detalles
            };
            estado.pedidos.unshift(pedidoActivo);
        }

        const mesaObj = estado.mesas.find((m) => m.numero === numeroMesa);
        if (mesaObj) {
            mesaObj.estado = 'ocupada';
            mesaObj.personas = personas;
            mesaObj.minutos = 1;
            mesaObj.total = pedidoActivo.total;
            mesaObj.mesera = nombreMesera;
        }

        io.emit('nuevo_pedido', {
            ...pedidoActivo,
            id_pedido: pedidoActivo.id_pedido,
            mesa: numeroMesa,
            platillos: pedidoActivo.detalles
        });

        agregarNotificacion(
            'cocina',
            `Nueva comanda — Mesa ${String(numeroMesa).padStart(2, '0')}`,
            `Recibida de ${nombreMesera}: ${detalles.map((d) => `${d.nombre} ×${d.cantidad}`).join(', ')}${notaCocina ? ` · Nota: ${notaCocina}` : ''}`,
            'info',
            { numero_mesa: numeroMesa, remitente: nombreMesera, id_pedido: pedidoActivo.id_pedido }
        );

        registrarLog(nombreMesera, 'ENVIO_COMANDA', `Comanda #${pedidoActivo.id_pedido} enviada a cocina para Mesa ${String(numeroMesa).padStart(2, '0')} ($${pedidoActivo.total})`);
        emitirActualizacionTiempoReal('comanda:nueva', { pedido: pedidoActivo });

        return res.status(201).json({
            mensaje: 'Pedido guardado y enviado',
            id_pedido: pedidoActivo.id_pedido,
            ...pedidoActivo
        });
    } catch (error) {
        return res.status(500).json({ error: 'Error interno al procesar la comanda' });
    }
});

// Cancelar una orden completa y liberar la mesa inmediatamente
async function cancelarOrdenActiva(req, res) {
    const idPed = Number(req.params.id);
    const pedido = estado.pedidos.find((p) => (p.id_pedido || p.Id_pedido) === idPed);
    if (!pedido) {
        return res.status(404).json({ error: 'Comanda no encontrada' });
    }

    const motivo = (req.body && req.body.motivo) ? String(req.body.motivo).trim() : 'Solicitud del cliente';
    const numMesa = Number(pedido.numero_mesa || pedido.mesa);
    const estabaPendiente = (pedido.estado || pedido.Estado) === 'pendiente';

    // Si aún no se preparaba, reintegrar stock de platillos
    if (estabaPendiente && Array.isArray(pedido.detalles)) {
        pedido.detalles.forEach((det) => {
            if (det.estado_item !== 'agotado_eliminado') {
                const plat = estado.platillos.find((p) => (p.id_platillo || p.Id_platillo) === Number(det.id_platillo || det.Id_platillo));
                if (plat) {
                    plat.stock = Number(plat.stock || 0) + Number(det.cantidad || 1);
                    plat.Stock = plat.stock;
                    if (plat.stock > 0) {
                        plat.disponible = true;
                        plat.Disponible = true;
                    }
                }
            }
        });
    }

    // Cerrar/cancelar todas las órdenes activas de esa mesa para que quede 100% libre
    estado.pedidos.forEach((p) => {
        if (Number(p.numero_mesa || p.mesa) === numMesa && !['cerrado', 'cancelado'].includes(p.estado || p.Estado)) {
            p.estado = 'cancelado';
            p.Estado = 'cancelado';
            p.motivo_cancelacion = motivo;
        }
    });

    const mesaObj = estado.mesas.find((m) => m.numero === numMesa);
    if (mesaObj) {
        mesaObj.estado = 'libre';
        mesaObj.personas = 0;
        mesaObj.minutos = 0;
        mesaObj.total = 0;
    }

    const autor = req.usuario?.nombre || 'Mesera';
    agregarNotificacion(
        'cocina',
        `Orden CANCELADA — Mesa ${String(numMesa).padStart(2, '0')}`,
        `${autor} canceló la comanda #${idPed} de la Mesa ${String(numMesa).padStart(2, '0')}. Motivo: ${motivo}. No preparar.`,
        'critico',
        { numero_mesa: numMesa, id_pedido: idPed }
    );

    registrarLog(autor, 'CANCELAR_ORDEN', `Comanda #${idPed} (Mesa ${String(numMesa).padStart(2, '0')}) cancelada. Motivo: ${motivo}`);
    emitirActualizacionTiempoReal('pedido_cancelado', { id_pedido: idPed, numero_mesa: numMesa, motivo });

    return res.json({
        mensaje: `Comanda #${idPed} cancelada y Mesa ${String(numMesa).padStart(2, '0')} liberada correctamente.`,
        id_pedido: idPed,
        numero_mesa: numMesa
    });
}

app.delete('/api/pedidos/:id', verificarToken, verificarRol(['mesera', 'administrador', 'cocina']), cancelarOrdenActiva);
app.post('/api/pedidos/:id/cancelar', verificarToken, verificarRol(['mesera', 'administrador', 'cocina']), cancelarOrdenActiva);

// Modificar cantidades, eliminar platillo individual o actualizar nota de una comanda activa
app.patch('/api/pedidos/:id', verificarToken, verificarRol(['mesera', 'administrador', 'cocina']), (req, res) => {
    const idPed = Number(req.params.id);
    const pedido = estado.pedidos.find((p) => (p.id_pedido || p.Id_pedido) === idPed);
    if (!pedido) return res.status(404).json({ error: 'Comanda no encontrada' });

    const { nota_cocina, personas, nombre_mesera, id_detalle, delta_cantidad, eliminar_detalle } = req.body;
    if (typeof nota_cocina === 'string') {
        pedido.nota_cocina = nota_cocina;
        agregarNotificacion(
            'cocina',
            `Nota actualizada — Mesa ${String(pedido.numero_mesa).padStart(2, '0')}`,
            `${req.usuario.nombre || 'Salón'}: "${nota_cocina || 'Sin observaciones'}"`,
            'alerta',
            { numero_mesa: pedido.numero_mesa, id_pedido: pedido.id_pedido }
        );
    }
    if (personas) pedido.personas = Number(personas);
    if (nombre_mesera) pedido.nombre_mesera = nombre_mesera;

    if (id_detalle && eliminar_detalle) {
        const detElim = (pedido.detalles || []).find((d) => d.id_detalle === Number(id_detalle));
        pedido.detalles = (pedido.detalles || []).filter((d) => d.id_detalle !== Number(id_detalle));
        if (detElim) {
            agregarNotificacion(
                'cocina',
                `Platillo cancelado — Mesa ${String(pedido.numero_mesa).padStart(2, '0')}`,
                `Se canceló "${detElim.nombre}" de la Mesa ${String(pedido.numero_mesa).padStart(2, '0')}.`,
                'alerta',
                { numero_mesa: pedido.numero_mesa, id_pedido: pedido.id_pedido }
            );
        }
    } else if (id_detalle && typeof delta_cantidad === 'number') {
        const det = (pedido.detalles || []).find((d) => d.id_detalle === Number(id_detalle));
        if (det) {
            det.cantidad = Math.max(0, det.cantidad + delta_cantidad);
            det.Cantidad = det.cantidad;
            det.subtotal = Number((det.cantidad * det.precio).toFixed(2));
            det.Subtotal = det.subtotal;
            if (det.cantidad === 0) {
                pedido.detalles = pedido.detalles.filter((d) => d.id_detalle !== Number(id_detalle));
            }
        }
    }

    // Si se eliminaron todos los platillos activos de la orden, cancelar la comanda y liberar la mesa automáticamente
    const activosRestantes = (pedido.detalles || []).filter((d) => d.estado_item !== 'agotado_eliminado');
    if (activosRestantes.length === 0) {
        pedido.estado = 'cancelado';
        pedido.Estado = 'cancelado';
        pedido.Total = 0;
        pedido.total = 0;
        const mesaObj = estado.mesas.find((m) => m.numero === Number(pedido.numero_mesa));
        if (mesaObj) {
            mesaObj.estado = 'libre';
            mesaObj.personas = 0;
            mesaObj.total = 0;
        }
        registrarLog(req.usuario.nombre || 'Mesera', 'CANCELAR_ORDEN_VACIA', `Mesa ${String(pedido.numero_mesa).padStart(2, '0')} liberada al quedar sin platillos`);
        emitirActualizacionTiempoReal('pedido_cancelado', { id_pedido: idPed, numero_mesa: pedido.numero_mesa });
        return res.json({ ...pedido, mesa_liberada: true });
    }

    recalcularTotalPedido(pedido);
    emitirActualizacionTiempoReal('comanda:actualizada', { pedido });
    return res.json(pedido);
});

async function actualizarEstadoPedido(req, res) {
    const idPed = Number(req.params.id);
    const { estado: nuevoEstado, tiempo_extendido } = req.body;

    try {
        const pedido = estado.pedidos.find((p) => (p.id_pedido || p.Id_pedido) === idPed);
        if (!pedido) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }

        if (tiempo_extendido) {
            pedido.tiempo_extendido = Number(tiempo_extendido);
            agregarNotificacion(
                'mesera',
                `Tiempo extendido — Mesa ${String(pedido.numero_mesa).padStart(2, '0')}`,
                `Cocina informa +${tiempo_extendido} min adicionales de preparación para la Mesa ${String(pedido.numero_mesa).padStart(2, '0')}.`,
                'alerta',
                { numero_mesa: pedido.numero_mesa, id_pedido: pedido.id_pedido }
            );
        }

        if (nuevoEstado === 'agotado') {
            (pedido.detalles || []).forEach((d) => {
                d.estado_item = 'agotado_eliminado';
            });
            pedido.estado = 'preparado';
            pedido.Estado = 'preparado';
            recalcularTotalPedido(pedido);
            agregarNotificacion(
                'mesera',
                `Platillo agotado — Mesa ${String(pedido.numero_mesa).padStart(2, '0')}`,
                `Cocina notificó platillo sin stock en la Mesa ${String(pedido.numero_mesa).padStart(2, '0')}.`,
                'critico',
                { numero_mesa: pedido.numero_mesa, id_pedido: pedido.id_pedido }
            );
        } else if (nuevoEstado) {
            pedido.estado = nuevoEstado;
            pedido.Estado = nuevoEstado;
            if (estado.mysqlDisponible) {
                await db.query('UPDATE Pedidos SET Estado = ? WHERE Id_pedido = ?', [nuevoEstado, idPed]).catch(() => {});
            }
            const mesaObj = estado.mesas.find((m) => m.numero === Number(pedido.numero_mesa));
            if (mesaObj && nuevoEstado === 'preparado') {
                mesaObj.estado = 'por_cobrar';
            }
            agregarNotificacion(
                'mesera',
                `Comanda lista en barra — Mesa ${String(pedido.numero_mesa).padStart(2, '0')}`,
                `Los platillos de la Mesa ${String(pedido.numero_mesa).padStart(2, '0')} están listos para servir.`,
                'ok',
                { numero_mesa: pedido.numero_mesa, id_pedido: pedido.id_pedido }
            );
        }

        io.emit('pedido_actualizado', {
            id_pedido: idPed,
            mesa: pedido.numero_mesa,
            estado: pedido.estado,
            mensaje: `El pedido de la Mesa ${pedido.numero_mesa} está listo para recoger.`
        });

        registrarLog(req.usuario.nombre || 'Cocina', 'ESTADO_COMANDA', `Pedido #${idPed} (Mesa ${pedido.numero_mesa}) -> ${pedido.estado}`);
        emitirActualizacionTiempoReal('comanda:estado', { pedido });

        return res.json({ mensaje: `Pedido ${idPed} marcado como ${pedido.estado}`, pedido });
    } catch (error) {
        return res.status(500).json({ error: 'Error interno en la base de datos' });
    }
}

app.put('/api/pedidos/:id/estado', verificarToken, verificarRol(['cocina', 'administrador']), actualizarEstadoPedido);
app.patch('/api/pedidos/:id/estado', verificarToken, verificarRol(['cocina', 'administrador']), actualizarEstadoPedido);

// ============================================================================
// MÓDULO DE INVENTARIO, PAGOS, MESAS, USUARIOS Y RESPALDOS
// ============================================================================

app.patch('/api/inventario/:id', verificarToken, verificarRol(['administrador', 'cocina']), (req, res) => {
    const insumo = estado.inventario.find((i) => i.id_insumo === Number(req.params.id));
    if (!insumo) return res.status(404).json({ error: 'Insumo no encontrado' });

    const { cantidad, tipo_movimiento = 'entrada', motivo = 'Ajuste de inventario' } = req.body;
    const cantNum = Number(cantidad);
    if (isNaN(cantNum) || cantNum < 0) {
        return res.status(400).json({ error: 'Cantidad inválida' });
    }

    if (tipo_movimiento === 'merma') {
        const descontado = Math.min(insumo.cantidad, cantNum);
        insumo.cantidad = Number((insumo.cantidad - descontado).toFixed(2));
        estado.metricasDia.mermasRegistradas.unshift({
            id_merma: estado.metricasDia.mermasRegistradas.length + 1,
            insumo: insumo.nombre,
            cantidad: `${descontado} ${insumo.unidad}`,
            motivo,
            hora: new Date().toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' }),
        });
    } else {
        insumo.cantidad = Number(cantNum.toFixed(2));
    }

    registrarLog(req.usuario.nombre || 'Admin', 'AJUSTE_INVENTARIO', `${insumo.nombre} actualizado a ${insumo.cantidad} ${insumo.unidad} (${motivo})`);
    emitirActualizacionTiempoReal('inventario:actualizado', { insumo });
    return res.json(insumo);
});

app.post('/api/pagos', verificarToken, verificarRol(['mesera', 'administrador']), (req, res) => {
    const { numero_mesa, id_pedido, pagos_divididos = [], mesera } = req.body;
    const nombreMesera = mesera || req.usuario.nombre || 'Maria';

    if (!numero_mesa || !Array.isArray(pagos_divididos) || pagos_divididos.length === 0) {
        return res.status(400).json({ error: 'Datos de pago incompletos.' });
    }

    const sumaPagos = pagos_divididos.reduce((acc, p) => acc + Number(p.monto || 0), 0);
    if (sumaPagos <= 0) {
        return res.status(400).json({ error: 'El monto total a pagar debe ser mayor a $0.00' });
    }

    const pedido = estado.pedidos.find((p) => (p.id_pedido || p.Id_pedido) === Number(id_pedido)) ||
        estado.pedidos.find((p) => Number(p.numero_mesa || p.mesa) === Number(numero_mesa) && !['cerrado', 'cancelado'].includes(p.estado || p.Estado));

    const horaActual = new Date().toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
    const resumenPlatillos = pedido
        ? (pedido.detalles || [])
            .filter((d) => d.estado_item !== 'agotado_eliminado')
            .map((d) => `${(d.nombre || d.Nombre).split(' ')[0]} ×${d.cantidad}`)
            .join(', ')
        : 'Consumo en mesa';

    const pagosRegistrados = pagos_divididos.map((pItem, idx) => {
        const nuevoPago = {
            id_pago: estado.pagos.length + idx + 1,
            id_pedido: pedido ? (pedido.id_pedido || pedido.Id_pedido) : 0,
            numero_mesa: `Mesa ${String(numero_mesa).padStart(2, '0')}`,
            resumen_platillos: resumenPlatillos,
            mesera: nombreMesera,
            metodo: pItem.metodo || 'Efectivo',
            monto: Number(pItem.monto),
            concepto_division: pItem.concepto || 'Cuenta completa',
            hora: horaActual,
        };
        estado.pagos.unshift(nuevoPago);
        return nuevoPago;
    });

    estado.pedidos.forEach((p) => {
        if (Number(p.numero_mesa || p.mesa) === Number(numero_mesa) && !['cerrado', 'cancelado'].includes(p.estado || p.Estado)) {
            p.estado = 'cerrado';
            p.Estado = 'cerrado';
        }
    });

    const mesaObj = estado.mesas.find((m) => m.numero === Number(numero_mesa));
    if (mesaObj) {
        mesaObj.estado = 'libre';
        mesaObj.personas = 0;
        mesaObj.minutos = 0;
        mesaObj.total = 0;
    }

    estado.metricasDia.ventasHoy = Number((estado.metricasDia.ventasHoy + sumaPagos).toFixed(2));
    estado.metricasDia.mesasAtendidas += 1;
    estado.metricasDia.ticketPromedio = Math.round(estado.metricasDia.ventasHoy / Math.max(1, estado.metricasDia.mesasAtendidas));

    registrarLog(nombreMesera, 'COBRO_CUENTA', `Mesa ${String(numero_mesa).padStart(2, '0')} cobrada por $${sumaPagos.toFixed(2)}`);
    emitirActualizacionTiempoReal('pago:registrado', { pagos: pagosRegistrados, numero_mesa: Number(numero_mesa) });

    return res.status(201).json({
        mensaje: 'Pago procesado correctamente y mesa liberada',
        totalCobrado: Number(sumaPagos.toFixed(2)),
        pagos: pagosRegistrados,
    });
});

app.post('/api/mesas/transferir', verificarToken, verificarRol(['mesera', 'administrador']), (req, res) => {
    const numOrigen = Number(req.body.mesa_origen);
    const numDestino = Number(req.body.mesa_destino);
    if (!numOrigen || !numDestino || numOrigen === numDestino) {
        return res.status(400).json({ error: 'Seleccione una mesa destino válida diferente a la actual.' });
    }
    const pedidoEnDestino = estado.pedidos.find((p) => Number(p.numero_mesa || p.mesa) === numDestino && !['cerrado', 'cancelado'].includes(p.estado || p.Estado));
    if (pedidoEnDestino) {
        return res.status(409).json({ error: `La Mesa ${String(numDestino).padStart(2, '0')} ya está ocupada.` });
    }

    estado.pedidos.forEach((p) => {
        if (Number(p.numero_mesa || p.mesa) === numOrigen && !['cerrado', 'cancelado'].includes(p.estado || p.Estado)) {
            p.numero_mesa = numDestino;
            p.mesa = numDestino;
        }
    });

    registrarLog(req.usuario.nombre || 'Mesera', 'TRANSFERIR_MESA', `Comanda transferida de Mesa ${String(numOrigen).padStart(2, '0')} a Mesa ${String(numDestino).padStart(2, '0')}`);
    emitirActualizacionTiempoReal('mesa:transferida', { mesa_origen: numOrigen, mesa_destino: numDestino });
    return res.json({ mensaje: 'Mesa transferida correctamente', mesa_origen: numOrigen, mesa_destino: numDestino });
});

app.patch('/api/mesas/:numero', verificarToken, verificarRol(['mesera', 'administrador']), (req, res) => {
    const mesa = estado.mesas.find((m) => m.numero === Number(req.params.numero));
    if (!mesa) return res.status(404).json({ error: 'Mesa no encontrada' });

    const { estado: nuevoEstado, personas, mesera } = req.body;
    if (nuevoEstado) mesa.estado = nuevoEstado;
    if (typeof personas === 'number') {
        mesa.personas = personas;
        const ped = estado.pedidos.find((p) => Number(p.numero_mesa || p.mesa) === mesa.numero && !['cerrado', 'cancelado'].includes(p.estado || p.Estado));
        if (ped) ped.personas = personas;
    }
    if (mesera) mesa.mesera = mesera;

    emitirActualizacionTiempoReal('mesa:actualizada', { mesa });
    return res.json(mesa);
});

app.post('/api/usuarios', verificarToken, verificarRol(['administrador']), async (req, res) => {
    const { nombre, rol, turno, contrasena } = req.body;
    if (!nombre || !rol || !contrasena) {
        return res.status(400).json({ error: 'Nombre, rol y contraseña son obligatorios' });
    }
    if (String(contrasena).trim().length < 6) {
        return res.status(400).json({ error: 'Por seguridad, la contraseña debe tener al menos 6 caracteres.' });
    }
    const hash = await bcrypt.hash(String(contrasena).trim(), 10);
    const nuevoId = estado.usuarios.length + 1;
    const nuevo = {
        id_Usuario: nuevoId,
        id_usuario: nuevoId,
        nombre: String(nombre).trim(),
        usuario_login: String(nombre).trim().split(' ')[0],
        rol,
        contrasena: hash,
        activo: true,
        turno: turno || '9am - 5pm'
    };
    estado.usuarios.push(nuevo);
    registrarLog(req.usuario.nombre || 'Admin', 'CREAR_USUARIO', `Usuario creado: ${nombre} (${rol})`);
    emitirActualizacionTiempoReal('usuarios:actualizado');
    return res.status(201).json(serializarUsuarioPublico(nuevo));
});

app.patch('/api/usuarios/:id/estado', verificarToken, verificarRol(['administrador']), (req, res) => {
    const u = estado.usuarios.find((item) => (item.id_usuario || item.id_Usuario) === Number(req.params.id));
    if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
    u.activo = !u.activo;
    registrarLog(req.usuario.nombre || 'Admin', 'ESTADO_USUARIO', `Cuenta de ${u.nombre} cambiada a ${u.activo ? 'ACTIVA' : 'INACTIVA'}`);
    emitirActualizacionTiempoReal('usuarios:actualizado');
    return res.json(serializarUsuarioPublico(u));
});

app.patch('/api/usuarios/:id/password', verificarToken, verificarRol(['administrador']), async (req, res) => {
    const u = estado.usuarios.find((item) => (item.id_usuario || item.id_Usuario) === Number(req.params.id));
    if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
    const { nuevaContrasena } = req.body || {};
    if (!nuevaContrasena || String(nuevaContrasena).trim().length < 6) {
        return res.status(400).json({ error: 'Por seguridad, la nueva contraseña debe tener al menos 6 caracteres.' });
    }
    u.contrasena = await bcrypt.hash(String(nuevaContrasena).trim(), 10);
    intentosFallidos.delete(u.id_usuario || u.id_Usuario);
    registrarLog(req.usuario.nombre || 'Admin', 'CAMBIO_PASSWORD', `Contraseña actualizada para ${u.nombre}`);
    return res.json({ mensaje: `Contraseña de ${u.nombre} actualizada correctamente.` });
});

app.post('/api/notificaciones/emergente', verificarToken, (req, res) => {
    const { rol_destino = 'mesera', titulo, mensaje, tipo = 'info', numero_mesa = null } = req.body || {};
    if (!titulo || !mensaje) {
        return res.status(400).json({ error: 'Título y mensaje son requeridos.' });
    }
    const notif = agregarNotificacion(rol_destino, titulo, mensaje, tipo, {
        numero_mesa: numero_mesa ? Number(numero_mesa) : null,
        remitente: req.usuario.nombre || 'Sistema',
        rol_origen: req.usuario.rol,
    });
    emitirActualizacionTiempoReal('estado:actualizado');
    return res.status(201).json(notif);
});

app.post('/api/sistema/respaldo', verificarToken, verificarRol(['administrador']), (req, res) => {
    const resultado = ejecutarRespaldoAutomatico();
    registrarLog(req.usuario.nombre || 'Admin', 'RESPALDO_BD', `Respaldo manual generado en ${resultado.archivo}`);
    emitirActualizacionTiempoReal('sistema:respaldo', resultado);
    return res.json({
        mensaje: 'Respaldo de la base de datos completado con éxito',
        ...resultado,
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
});
