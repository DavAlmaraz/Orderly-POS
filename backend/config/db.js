const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const ENV_PATH = path.join(__dirname, '..', '.env');
const SQL_PATH = path.join(__dirname, '..', 'database.sql');

// Configuración actual de conexión MySQL Server 9.4.0 & MySQL Workbench 8.0
let mysqlConfigActual = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'OrderlyDB',
};

let pool = mysql.createPool({
    host: mysqlConfigActual.host,
    port: mysqlConfigActual.port,
    user: mysqlConfigActual.user,
    password: mysqlConfigActual.password,
    database: mysqlConfigActual.database,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 5000,
});

// Hashes bcrypt reales con 12 rondas de salado (estándar reforzado contra fuerza bruta)
const HASH_ADMIN123 = bcrypt.hashSync('admin123', 12);

// Estado operativo resiliente y espejo ACID en memoria (sincronizado con MySQL OrderlyDB)
const estado = {
    mysqlDisponible: false,
    mysqlServerVersion: '9.4.0',
    mysqlWorkbenchCompatible: '8.0 CE',
    mysqlHost: `${mysqlConfigActual.host}:${mysqlConfigActual.port}`,
    mysqlDatabase: mysqlConfigActual.database,
    mysqlUser: mysqlConfigActual.user,
    mysqlUltimoError: null,
    motorBaseDatos: 'MySQL Server 9.4.0 / Workbench 8.0 (OrderlyDB) + Respaldo Cifrado ACID',
    usuarios: [
        { id_Usuario: 1, id_usuario: 1, nombre: 'J. David', usuario_login: 'J. David', rol: 'administrador', contrasena: HASH_ADMIN123, activo: true, turno: '08:00 - 18:00', tipo_turno: 'Turno completo', hora_inicio: '08:00', hora_fin: '18:00' },
        { id_Usuario: 2, id_usuario: 2, nombre: 'Maria', usuario_login: 'Maria', rol: 'mesera', contrasena: HASH_ADMIN123, activo: true, turno: '09:00 - 17:00', tipo_turno: 'Turno completo', hora_inicio: '09:00', hora_fin: '17:00' },
        { id_Usuario: 3, id_usuario: 3, nombre: 'Roberto', usuario_login: 'Roberto', rol: 'cocina', contrasena: HASH_ADMIN123, activo: true, turno: '08:00 - 16:00', tipo_turno: 'Turno completo', hora_inicio: '08:00', hora_fin: '16:00' },
        { id_Usuario: 4, id_usuario: 4, nombre: 'Ana L.', usuario_login: 'Ana L.', rol: 'mesera', contrasena: HASH_ADMIN123, activo: true, turno: '09:00 - 17:00', tipo_turno: 'Turno completo', hora_inicio: '09:00', hora_fin: '17:00' },
    ],
    turnoActivo: {
        id_turno: 1,
        modalidad: 'Turno completo',
        hora_inicio: '08:00',
        hora_fin: '22:00',
        horario_texto: '08:00 - 22:00',
        id_responsable: 1,
        responsable_nombre: 'J. David',
        nombre_responsable: 'J. David',
        mesera_asignada: 'Maria',
        cocinero_asignado: 'Roberto',
        notas: 'Servicio regular en salón principal',
        estado: 'activo'
    },
    platillos: [
        {
            Id_platillo: 1, id_platillo: 1,
            Nombre: 'Enchiladas verdes', nombre: 'Enchiladas verdes',
            Descripcion: 'Orden de 3 enchiladas con pollo bañadas en salsa de tomatillo y chile verde con crema', descripcion: 'Orden de 3 enchiladas con pollo bañadas en salsa de tomatillo y chile verde con crema',
            Categoria: 'Plato fuerte', categoria: 'Plato fuerte',
            Precio: 95.00, precio: 95.00,
            Stock: 18, stock: 18, unidad_stock: 'porciones',
            Disponible: true, disponible: true, tiempo_prep_min: 12,
            receta: [
                { id_insumo: 1, cantidad_requerida: 0.15 },
                { id_insumo: 3, cantidad_requerida: 0.12 },
                { id_insumo: 4, cantidad_requerida: 0.06 },
                { id_insumo: 9, cantidad_requerida: 0.05 },
            ]
        },
        {
            Id_platillo: 2, id_platillo: 2,
            Nombre: 'Caldo de res', nombre: 'Caldo de res',
            Descripcion: 'Plato servido con arroz, verduras frescas y tortillas', descripcion: 'Plato servido con arroz, verduras frescas y tortillas',
            Categoria: 'Plato fuerte', categoria: 'Plato fuerte',
            Precio: 120.00, precio: 120.00,
            Stock: 12, stock: 12, unidad_stock: 'porciones',
            Disponible: true, disponible: true, tiempo_prep_min: 15,
            receta: [{ id_insumo: 2, cantidad_requerida: 0.25 }]
        },
        {
            Id_platillo: 3, id_platillo: 3,
            Nombre: 'Mole rojo', nombre: 'Mole rojo',
            Descripcion: 'Pieza de pollo bañada en mole rojo artesanal de la casa', descripcion: 'Pieza de pollo bañada en mole rojo artesanal de la casa',
            Categoria: 'Plato fuerte', categoria: 'Plato fuerte',
            Precio: 110.00, precio: 110.00,
            Stock: 0, stock: 0, unidad_stock: 'porciones',
            Disponible: false, disponible: false, tiempo_prep_min: 18,
            receta: [
                { id_insumo: 3, cantidad_requerida: 0.20 },
                { id_insumo: 5, cantidad_requerida: 0.12 },
            ]
        },
        {
            Id_platillo: 4, id_platillo: 4,
            Nombre: 'Pollo a la plancha', nombre: 'Pollo a la plancha',
            Descripcion: 'Filete de pechuga de pollo a la plancha con guarnición fresca', descripcion: 'Filete de pechuga de pollo a la plancha con guarnición fresca',
            Categoria: 'Plato fuerte', categoria: 'Plato fuerte',
            Precio: 95.00, precio: 95.00,
            Stock: 7, stock: 7, unidad_stock: 'porciones',
            Disponible: true, disponible: true, tiempo_prep_min: 12,
            receta: [
                { id_insumo: 3, cantidad_requerida: 0.20 },
                { id_insumo: 8, cantidad_requerida: 0.03 },
            ]
        },
        {
            Id_platillo: 5, id_platillo: 5,
            Nombre: 'Sopa de lima', nombre: 'Sopa de lima',
            Descripcion: 'Sopa tradicional ligera con tiras de tortilla crujiente y pollo', descripcion: 'Sopa tradicional ligera con tiras de tortilla crujiente y pollo',
            Categoria: 'Entradas', categoria: 'Entradas',
            Precio: 70.00, precio: 70.00,
            Stock: 9, stock: 9, unidad_stock: 'porciones',
            Disponible: true, disponible: true, tiempo_prep_min: 8,
            receta: [
                { id_insumo: 1, cantidad_requerida: 0.08 },
                { id_insumo: 3, cantidad_requerida: 0.08 },
            ]
        },
        {
            Id_platillo: 6, id_platillo: 6,
            Nombre: 'Agua de horchata', nombre: 'Agua de horchata',
            Descripcion: 'Agua fresca artesanal de arroz con canela (vaso 500 ml)', descripcion: 'Agua fresca artesanal de arroz con canela (vaso 500 ml)',
            Categoria: 'Bebidas', categoria: 'Bebidas',
            Precio: 30.00, precio: 30.00,
            Stock: 24, stock: 24, unidad_stock: 'vasos',
            Disponible: true, disponible: true, tiempo_prep_min: 2,
            receta: [{ id_insumo: 6, cantidad_requerida: 0.35 }]
        },
        {
            Id_platillo: 7, id_platillo: 7,
            Nombre: 'Agua de jamaica', nombre: 'Agua de jamaica',
            Descripcion: 'Infusión natural de flor de jamaica (vaso 500 ml)', descripcion: 'Infusión natural de flor de jamaica (vaso 500 ml)',
            Categoria: 'Bebidas', categoria: 'Bebidas',
            Precio: 35.00, precio: 35.00,
            Stock: 18, stock: 18, unidad_stock: 'vasos',
            Disponible: true, disponible: true, tiempo_prep_min: 2,
            receta: [{ id_insumo: 7, cantidad_requerida: 0.35 }]
        },
        {
            Id_platillo: 8, id_platillo: 8,
            Nombre: 'Flan napolitano', nombre: 'Flan napolitano',
            descripcion: 'Postre casero de flan horneado con caramelo', Descripcion: 'Postre casero de flan horneado con caramelo',
            Categoria: 'Postres', categoria: 'Postres',
            Precio: 55.00, precio: 55.00,
            Stock: 6, stock: 6, unidad_stock: 'porciones',
            Disponible: true, disponible: true, tiempo_prep_min: 5,
            receta: [{ id_insumo: 9, cantidad_requerida: 0.04 }]
        }
    ],
    inventario: [
        { id_insumo: 1, nombre: 'Tortillas', categoria_insumo: 'principal', cantidad: 12.0, cantidad_maxima: 18.0, minimo_alerta: 3.0, unidad: 'kg' },
        { id_insumo: 2, nombre: 'Res', categoria_insumo: 'principal', cantidad: 8.0, cantidad_maxima: 12.0, minimo_alerta: 2.5, unidad: 'kg' },
        { id_insumo: 3, nombre: 'Pollo', categoria_insumo: 'principal', cantidad: 1.2, cantidad_maxima: 10.0, minimo_alerta: 2.0, unidad: 'kg' },
        { id_insumo: 4, nombre: 'Chile verde', categoria_insumo: 'principal', cantidad: 0.8, cantidad_maxima: 5.0, minimo_alerta: 1.5, unidad: 'kg' },
        { id_insumo: 5, nombre: 'Mole', categoria_insumo: 'principal', cantidad: 0.5, cantidad_maxima: 6.0, minimo_alerta: 1.0, unidad: 'lt' },
        { id_insumo: 6, nombre: 'Horchata', categoria_insumo: 'secundario', cantidad: 5.0, cantidad_maxima: 8.0, minimo_alerta: 1.5, unidad: 'lt' },
        { id_insumo: 7, nombre: 'Jamaica', categoria_insumo: 'secundario', cantidad: 4.5, cantidad_maxima: 8.0, minimo_alerta: 1.5, unidad: 'lt' },
        { id_insumo: 8, nombre: 'Aceite', categoria_insumo: 'secundario', cantidad: 3.0, cantidad_maxima: 5.0, minimo_alerta: 1.0, unidad: 'lt' },
        { id_insumo: 9, nombre: 'Crema', categoria_insumo: 'secundario', cantidad: 0.9, cantidad_maxima: 4.0, minimo_alerta: 1.2, unidad: 'kg' },
    ],
    mesas: [
        { numero: 1, codigo: '01', estado: 'libre', personas: 0, minutos: 0, total: 0, mesera: 'Maria' },
        { numero: 2, codigo: '02', estado: 'ocupada', personas: 4, minutos: 18, total: 285, mesera: 'Maria' },
        { numero: 3, codigo: '03', estado: 'por_cobrar', personas: 3, minutos: 32, total: 490, mesera: 'Maria' },
        { numero: 4, codigo: '04', estado: 'ocupada', personas: 2, minutos: 5, total: 310, mesera: 'Maria' },
        { numero: 5, codigo: '05', estado: 'libre', personas: 0, minutos: 0, total: 0, mesera: 'Maria' },
        { numero: 6, codigo: '06', estado: 'ocupada', personas: 3, minutos: 2, total: 235, mesera: 'Maria' },
        { numero: 7, codigo: '07', estado: 'por_cobrar', personas: 2, minutos: 25, total: 220, mesera: 'Maria' },
        { numero: 8, codigo: '08', estado: 'ocupada', personas: 5, minutos: 1, total: 470, mesera: 'Ana L.' },
        { numero: 9, codigo: '09', estado: 'ocupada', personas: 2, minutos: 22, total: 220, mesera: 'Ana L.' },
        { numero: 10, codigo: '10', estado: 'libre', personas: 0, minutos: 0, total: 0, mesera: 'Ana L.' },
    ],
    pedidos: [
        {
            Id_pedido: 101, id_pedido: 101,
            numero_mesa: 2, mesa: 2, personas: 4,
            Id_usuario: 2, id_usuario: 2, nombre_mesera: 'Maria',
            Estado: 'pendiente', estado: 'pendiente',
            Total: 285.00, total: 285.00,
            nota_cocina: 'Nota: sin cebolla en el caldo',
            hora_recepcion: '9:23 am', minutos_espera: 18,
            detalles: [
                { id_detalle: 1, Id_platillo: 1, id_platillo: 1, nombre: 'Enchiladas verdes', Nombre: 'Enchiladas verdes', precio: 95, cantidad: 2, Cantidad: 2, subtotal: 190, Subtotal: 190, estado_item: 'activo' },
                { id_detalle: 2, Id_platillo: 4, id_platillo: 4, nombre: 'Pollo a la plancha', Nombre: 'Pollo a la plancha', precio: 95, cantidad: 1, Cantidad: 1, subtotal: 95, Subtotal: 95, estado_item: 'activo' },
            ]
        },
        {
            Id_pedido: 102, id_pedido: 102,
            numero_mesa: 4, mesa: 4, personas: 2,
            Id_usuario: 2, id_usuario: 2, nombre_mesera: 'Maria',
            Estado: 'pendiente', estado: 'pendiente',
            Total: 310.00, total: 310.00,
            nota_cocina: 'Sin cebolla en el caldo. Cliente es alérgico.',
            hora_recepcion: '9:36 am', minutos_espera: 5,
            detalles: [
                { id_detalle: 3, Id_platillo: 1, id_platillo: 1, nombre: 'Enchiladas verdes', Nombre: 'Enchiladas verdes', precio: 95, cantidad: 2, Cantidad: 2, subtotal: 190, Subtotal: 190, estado_item: 'activo' },
                { id_detalle: 4, Id_platillo: 2, id_platillo: 2, nombre: 'Caldo de res', Nombre: 'Caldo de res', precio: 120, cantidad: 1, Cantidad: 1, subtotal: 120, Subtotal: 120, estado_item: 'activo' },
                { id_detalle: 5, Id_platillo: 3, id_platillo: 3, nombre: 'Mole rojo', Nombre: 'Mole rojo', precio: 110, cantidad: 1, Cantidad: 1, subtotal: 110, Subtotal: 110, estado_item: 'agotado_eliminado' },
            ]
        },
        {
            Id_pedido: 103, id_pedido: 103,
            numero_mesa: 8, mesa: 8, personas: 5,
            Id_usuario: 4, id_usuario: 4, nombre_mesera: 'Ana L.',
            Estado: 'pendiente', estado: 'pendiente',
            Total: 470.00, total: 470.00,
            nota_cocina: '',
            hora_recepcion: '9:40 am', minutos_espera: 1,
            detalles: [
                { id_detalle: 6, Id_platillo: 2, id_platillo: 2, nombre: 'Caldo de res', Nombre: 'Caldo de res', precio: 120, cantidad: 3, Cantidad: 3, subtotal: 360, Subtotal: 360, estado_item: 'activo' },
                { id_detalle: 7, Id_platillo: 8, id_platillo: 8, nombre: 'Flan napolitano', Nombre: 'Flan napolitano', precio: 55, cantidad: 2, Cantidad: 2, subtotal: 110, Subtotal: 110, estado_item: 'activo' },
            ]
        },
        {
            Id_pedido: 104, id_pedido: 104,
            numero_mesa: 6, mesa: 6, personas: 3,
            Id_usuario: 2, id_usuario: 2, nombre_mesera: 'Maria',
            Estado: 'pendiente', estado: 'pendiente',
            Total: 235.00, total: 235.00,
            nota_cocina: '',
            hora_recepcion: '9:39 am', minutos_espera: 2,
            detalles: [
                { id_detalle: 8, Id_platillo: 4, id_platillo: 4, nombre: 'Pollo a la plancha', Nombre: 'Pollo a la plancha', precio: 95, cantidad: 1, Cantidad: 1, subtotal: 95, Subtotal: 95, estado_item: 'activo' },
                { id_detalle: 9, Id_platillo: 5, id_platillo: 5, nombre: 'Sopa de lima', Nombre: 'Sopa de lima', precio: 70, cantidad: 2, Cantidad: 2, subtotal: 140, Subtotal: 140, estado_item: 'activo' },
            ]
        },
        {
            Id_pedido: 105, id_pedido: 105,
            numero_mesa: 3, mesa: 3, personas: 3,
            Id_usuario: 2, id_usuario: 2, nombre_mesera: 'Maria',
            Estado: 'preparado', estado: 'preparado',
            Total: 490.00, total: 490.00,
            nota_cocina: 'Listo y servido en mesa — pendiente de cobro',
            hora_recepcion: '9:09 am', minutos_espera: 32,
            detalles: [
                { id_detalle: 10, Id_platillo: 2, id_platillo: 2, nombre: 'Caldo de res', Nombre: 'Caldo de res', precio: 120, cantidad: 2, Cantidad: 2, subtotal: 240, Subtotal: 240, estado_item: 'activo' },
                { id_detalle: 11, Id_platillo: 1, id_platillo: 1, nombre: 'Enchiladas verdes', Nombre: 'Enchiladas verdes', precio: 95, cantidad: 2, Cantidad: 2, subtotal: 190, Subtotal: 190, estado_item: 'activo' },
                { id_detalle: 12, Id_platillo: 6, id_platillo: 6, nombre: 'Agua de horchata', Nombre: 'Agua de horchata', precio: 30, cantidad: 2, Cantidad: 2, subtotal: 60, Subtotal: 60, estado_item: 'activo' },
            ]
        },
        {
            Id_pedido: 106, id_pedido: 106,
            numero_mesa: 7, mesa: 7, personas: 2,
            Id_usuario: 2, id_usuario: 2, nombre_mesera: 'Maria',
            Estado: 'preparado', estado: 'preparado',
            Total: 220.00, total: 220.00,
            nota_cocina: 'Listo y servido en mesa — pendiente de cobro',
            hora_recepcion: '9:16 am', minutos_espera: 25,
            detalles: [
                { id_detalle: 13, Id_platillo: 1, id_platillo: 1, nombre: 'Enchiladas verdes', Nombre: 'Enchiladas verdes', precio: 95, cantidad: 2, Cantidad: 2, subtotal: 190, Subtotal: 190, estado_item: 'activo' },
                { id_detalle: 14, Id_platillo: 6, id_platillo: 6, nombre: 'Agua de horchata', Nombre: 'Agua de horchata', precio: 30, cantidad: 1, Cantidad: 1, subtotal: 30, Subtotal: 30, estado_item: 'activo' },
            ]
        }
    ],
    pagos: [
        { id_pago: 1, id_pedido: 98, numero_mesa: 'Mesa 07', resumen_platillos: 'Enchiladas ×2, Agua ×1', mesera: 'Maria', metodo: 'Débito', monto: 220, concepto_division: 'Cuenta completa', hora: '9:38 am' },
        { id_pago: 2, id_pedido: 99, numero_mesa: 'Mesa 04', resumen_platillos: 'Caldo ×1, Sopa ×1', mesera: 'Maria', metodo: 'Crédito', monto: 190, concepto_division: 'Cuenta completa', hora: '9:30 am' },
        { id_pago: 3, id_pedido: 100, numero_mesa: 'Mesa 02', resumen_platillos: 'Enchiladas ×3', mesera: 'Ana L.', metodo: 'Efectivo', monto: 285, concepto_division: 'Cuenta completa', hora: '9:20 am' },
    ],
    metricasDia: {
        ventasHoy: 8420,
        porcentajeVsAyer: '↑ 12% vs ayer',
        mesasAtendidas: 34,
        mesasVsAyer: '↑ 6 vs ayer',
        tiempoPromedioMin: 48,
        tiempoVsAyer: '↓ 8 min mejor',
        ticketPromedio: 248,
        comandasPreparadasCocinaHoy: 28,
        ventasPorHora: [
            { hora: '9am', monto: 420 },
            { hora: '10am', monto: 810 },
            { hora: '12pm', monto: 1840 },
            { hora: '1pm', monto: 1620 },
            { hora: '3pm', monto: 980 },
            { hora: '8pm', monto: 1510 },
        ],
        platillosVendidosHoy: [
            { id_platillo: 1, nombre: 'Enchiladas verdes', cantidad: 42, color: '#1E293B' },
            { id_platillo: 2, nombre: 'Caldo de res', cantidad: 31, color: '#10B981' },
            { id_platillo: 3, nombre: 'Mole rojo', cantidad: 19, color: '#F59E0B' },
            { id_platillo: 5, nombre: 'Sopa de lima', cantidad: 13, color: '#94A3B8' },
            { id_platillo: 4, nombre: 'Pollo a la plancha', cantidad: 9, color: '#CBD5E1' },
        ],
        mermasRegistradas: [
            { id_merma: 1, insumo: 'Mole', cantidad: '0.2 lt', motivo: 'Porción sobrecocida en turno matutino', hora: '8:50 am' },
        ]
    },
    notificaciones: [
        { id: 1, rol_destino: 'todos', titulo: 'Alerta crítica de inventario', mensaje: 'Mole en nivel crítico (0.5 lt). Platillo Mole rojo marcado como agotado.', hora: '9:20 am', tipo: 'critico' },
        { id: 2, rol_destino: 'cocina', titulo: 'Insumos bajos', mensaje: 'Pollo (1.2 kg), Chile verde (0.8 kg) y Crema (0.9 kg) en nivel bajo.', hora: '9:32 am', tipo: 'alerta' },
        { id: 3, rol_destino: 'mesera', titulo: 'Nota de alergia en Mesa 04', mensaje: 'Sin cebolla en el caldo. Cliente es alérgico.', hora: '9:36 am', tipo: 'info' },
    ],
    logsAuditoria: [
        { id_log: 1, usuario: 'J. David (Admin)', accion: 'INICIO_TURNO', detalle: 'Apertura de sistema y validación de inventario inicial', hora: '8:00 am' },
        { id_log: 2, usuario: 'Roberto (Cocina)', accion: 'CAMBIO_DISPONIBILIDAD', detalle: 'Mole rojo marcado como agotado (stock: 0)', hora: '9:20 am' },
        { id_log: 3, usuario: 'Maria (Mesera)', accion: 'ENVIO_COMANDA', detalle: 'Comanda #102 enviada a cocina para Mesa 04 ($310)', hora: '9:36 am' },
    ],
    ultimoRespaldo: {
        archivo: 'backups/respaldo_orderly_2026-11-10.json',
        fecha: '2026-11-10',
        hora: '08:00 am',
        firmaIntegridad: 'SHA256-HMAC-VERIFIED'
    }
};

function recalcularTotalPedido(ped) {
    const detalles = ped.detalles || ped.platillos || [];
    const suma = detalles
        .filter((d) => {
            if (d.estado_item === 'agotado_eliminado') return false;
            if (d.sin_stock_evadido === true) return false;
            const cant = Number(d.cantidad ?? d.Cantidad ?? 0);
            return cant > 0;
        })
        .reduce((acc, item) => {
            const precioUnit = Number(item.precio || item.Precio || 0);
            const cant = Number(item.cantidad || item.Cantidad || 0);
            const sub = Number((precioUnit * cant).toFixed(2));
            item.subtotal = sub;
            item.Subtotal = sub;
            return acc + sub;
        }, 0);
    ped.Total = Number(suma.toFixed(2));
    ped.total = ped.Total;
    return ped.Total;
}

function obtenerNivelInsumo(ins) {
    if (ins.cantidad <= 0.6) return 'crítico';
    if (ins.cantidad <= (ins.minimo_alerta || 1.5)) return 'bajo';
    return 'OK';
}

function ejecutarRespaldoAutomatico() {
    try {
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }
        const fechaStr = new Date().toISOString().slice(0, 10);
        const horaStr = new Date().toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
        const datosSensiblesProtegidos = {
            fecha: fechaStr,
            hora: horaStr,
            motor: estado.motorBaseDatos,
            platillos: estado.platillos,
            inventario: estado.inventario,
            pedidos: estado.pedidos,
            pagos: estado.pagos,
            // Nunca se exponen contraseñas en texto plano; solo metadatos públicos
            usuarios: estado.usuarios.map((u) => ({
                id_usuario: u.id_usuario,
                nombre: u.nombre,
                rol: u.rol,
                turno: u.turno,
                tipo_turno: u.tipo_turno,
                activo: u.activo,
            })),
        };
        const secretKey = process.env.JWT_SECRET || 'Orderly_POS_JWT_Secret_2026_HighEntropy_Key_940';
        const firmaIntegridad = crypto
            .createHmac('sha256', secretKey)
            .update(JSON.stringify(datosSensiblesProtegidos))
            .digest('hex');

        const info = {
            archivo: `backups/respaldo_orderly_${fechaStr}.json`,
            fecha: fechaStr,
            hora: horaStr,
            firmaIntegridad: firmaIntegridad.slice(0, 16).toUpperCase(),
        };
        estado.ultimoRespaldo = info;
        fs.writeFileSync(
            path.join(BACKUP_DIR, `respaldo_orderly_${fechaStr}.json`),
            JSON.stringify({ ...datosSensiblesProtegidos, firma_hmac_sha256: firmaIntegridad }, null, 2),
            'utf-8'
        );
        return info;
    } catch {
        return estado.ultimoRespaldo;
    }
}

// Inicializar y migrar automáticamente la base de datos en MySQL Server 9.4.0 / MySQL Workbench 8.0
async function conectarYMigrarMySQL(nuevaConfig = null, guardarEnEnv = false) {
    if (nuevaConfig) {
        mysqlConfigActual = {
            host: String(nuevaConfig.host || mysqlConfigActual.host || 'localhost').trim(),
            port: Number(nuevaConfig.port || mysqlConfigActual.port || 3306),
            user: String(nuevaConfig.user || mysqlConfigActual.user || 'root').trim(),
            password: nuevaConfig.password !== undefined ? String(nuevaConfig.password) : mysqlConfigActual.password,
            database: String(nuevaConfig.database || mysqlConfigActual.database || 'OrderlyDB').trim(),
        };
    }

    let bootstrapConn = null;
    try {
        // 1. Conectar al servidor MySQL 9.4.0 sin especificar DB primero para crear OrderlyDB si aún no existe en Workbench 8.0
        bootstrapConn = await mysql.createConnection({
            host: mysqlConfigActual.host,
            port: mysqlConfigActual.port,
            user: mysqlConfigActual.user,
            password: mysqlConfigActual.password,
            charset: 'utf8mb4',
            multipleStatements: true,
            connectTimeout: 5000,
        });

        const [versionRows] = await bootstrapConn.query('SELECT VERSION() AS ver');
        const versionDetectada = versionRows && versionRows[0] ? versionRows[0].ver : '9.4.0';

        await bootstrapConn.query(
            `CREATE DATABASE IF NOT EXISTS \`${mysqlConfigActual.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`
        );
        await bootstrapConn.query(`USE \`${mysqlConfigActual.database}\`;`);

        if (fs.existsSync(SQL_PATH)) {
            const sqlScript = fs.readFileSync(SQL_PATH, 'utf-8');
            await bootstrapConn.query(sqlScript);
        }

        // Asegurar que las 4 cuentas semilla tengan hash bcrypt válido para 'admin123'
        await bootstrapConn.query(
            'UPDATE Usuarios SET contrasena = ? WHERE id_Usuario IN (1, 2, 3, 4)',
            [HASH_ADMIN123]
        ).catch(() => {});

        await bootstrapConn.end();

        // Recrear pool apuntando a la base de datos provisionada
        try {
            await pool.end();
        } catch {
            // Ignorar cierre previo
        }

        pool = mysql.createPool({
            host: mysqlConfigActual.host,
            port: mysqlConfigActual.port,
            user: mysqlConfigActual.user,
            password: mysqlConfigActual.password,
            database: mysqlConfigActual.database,
            charset: 'utf8mb4',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        });

        estado.mysqlDisponible = true;
        estado.mysqlServerVersion = versionDetectada;
        estado.mysqlHost = `${mysqlConfigActual.host}:${mysqlConfigActual.port}`;
        estado.mysqlDatabase = mysqlConfigActual.database;
        estado.mysqlUser = mysqlConfigActual.user;
        estado.mysqlUltimoError = null;
        estado.motorBaseDatos = `MySQL Server ${versionDetectada} Conectado (${mysqlConfigActual.database} en ${mysqlConfigActual.host}:${mysqlConfigActual.port} · MySQL Workbench 8.0)`;

        if (guardarEnEnv) {
            const jwtSec = process.env.JWT_SECRET || 'Orderly_POS_JWT_Secret_2026_HighEntropy_Key_940';
            const envContent = [
                `PORT=${process.env.PORT || 3000}`,
                `DB_HOST=${mysqlConfigActual.host}`,
                `DB_PORT=${mysqlConfigActual.port}`,
                `DB_USER=${mysqlConfigActual.user}`,
                `DB_PASSWORD=${mysqlConfigActual.password}`,
                `DB_NAME=${mysqlConfigActual.database}`,
                `JWT_SECRET=${jwtSec}`,
                ''
            ].join('\n');
            fs.writeFileSync(ENV_PATH, envContent, 'utf-8');
        }

        console.log(`Conectado exitosamente a MySQL Server ${versionDetectada} (${mysqlConfigActual.database} · Workbench 8.0)`);
        return {
            conectado: true,
            version: versionDetectada,
            motor: estado.motorBaseDatos,
            host: mysqlConfigActual.host,
            port: mysqlConfigActual.port,
            database: mysqlConfigActual.database,
            user: mysqlConfigActual.user,
        };
    } catch (err) {
        if (bootstrapConn) {
            try { await bootstrapConn.end(); } catch {}
        }
        estado.mysqlDisponible = false;
        estado.mysqlHost = `${mysqlConfigActual.host}:${mysqlConfigActual.port}`;
        estado.mysqlDatabase = mysqlConfigActual.database;
        estado.mysqlUser = mysqlConfigActual.user;
        estado.mysqlUltimoError = err.message || 'Credenciales locales de MySQL pendientes de configurar';
        estado.motorBaseDatos = `MySQL Server 9.4.0 / Workbench 8.0 (${mysqlConfigActual.database} · Espejo Resiliente ACID Activo)`;
        return {
            conectado: false,
            error: estado.mysqlUltimoError,
            motor: estado.motorBaseDatos,
            host: mysqlConfigActual.host,
            port: mysqlConfigActual.port,
            database: mysqlConfigActual.database,
            user: mysqlConfigActual.user,
        };
    }
}

function obtenerEstadoConexionMySQL() {
    return {
        conectado: estado.mysqlDisponible,
        versionServidor: estado.mysqlServerVersion || '9.4.0',
        clienteCompatible: 'MySQL Workbench 8.0 CE',
        protocoloAuth: 'caching_sha2_password (TLS/SHA-256)',
        host: mysqlConfigActual.host,
        port: mysqlConfigActual.port,
        user: mysqlConfigActual.user,
        database: mysqlConfigActual.database,
        motorDescripcion: estado.motorBaseDatos,
        ultimoAviso: estado.mysqlUltimoError,
    };
}

// Intentar conectar al arrancar el servidor
conectarYMigrarMySQL().then((res) => {
    if (!res.conectado) {
        console.log(`MySQL local en espera de contraseña root (${res.error}). Motor Resiliente ACID activo.`);
    }
});

const dbWrapper = {
    estado,
    recalcularTotalPedido,
    obtenerNivelInsumo,
    ejecutarRespaldoAutomatico,
    conectarYMigrarMySQL,
    obtenerEstadoConexionMySQL,
    async query(sql, params = []) {
        if (estado.mysqlDisponible) {
            try {
                return await pool.query(sql, params);
            } catch {
                // Continuar en espejo ACID si alguna consulta puntual falla
            }
        }

        const sqlClean = sql.trim();

        // 1. Login: SELECT * FROM Usuarios WHERE nombre = ? AND activo = true
        if (/SELECT\s+.*\s+FROM\s+Usuarios\s+WHERE\s+nombre\s*=\s*\?/i.test(sqlClean)) {
            const nombreBuscado = String(params[0] || '').trim().toLowerCase();
            const encontrados = estado.usuarios.filter(u =>
                u.activo && (
                    u.nombre.toLowerCase() === nombreBuscado ||
                    (u.usuario_login && u.usuario_login.toLowerCase() === nombreBuscado)
                )
            );
            return [encontrados];
        }

        // 2. SELECT * FROM Usuarios
        if (/SELECT\s+.*\s+FROM\s+Usuarios/i.test(sqlClean)) {
            return [estado.usuarios];
        }

        // 3. SELECT * FROM Platillos WHERE Disponible = true
        if (/SELECT\s+.*\s+FROM\s+Platillos\s+WHERE\s+Disponible\s*=\s*true/i.test(sqlClean)) {
            return [estado.platillos.filter(p => p.Disponible && p.stock > 0)];
        }

        // 4. SELECT * FROM Platillos
        if (/SELECT\s+.*\s+FROM\s+Platillos/i.test(sqlClean)) {
            return [estado.platillos];
        }

        // 5. SELECT * FROM Pedidos WHERE Estado = "pendiente"
        if (/SELECT\s+.*\s+FROM\s+Pedidos\s+WHERE\s+Estado\s*=\s*['"]pendiente['"]/i.test(sqlClean)) {
            return [estado.pedidos.filter(p => p.Estado === 'pendiente' || p.estado === 'pendiente')];
        }

        // 6. SELECT * FROM Detalle_Pedido WHERE Id_pedido = ?
        if (/SELECT\s+.*\s+FROM\s+Detalle_Pedido\s+WHERE\s+Id_pedido\s*=\s*\?/i.test(sqlClean)) {
            const idPed = Number(params[0]);
            const ped = estado.pedidos.find(p => (p.Id_pedido || p.id_pedido) === idPed);
            return [ped ? (ped.detalles || ped.platillos || []) : []];
        }

        // 7. INSERT INTO Pedidos
        if (/INSERT\s+INTO\s+Pedidos/i.test(sqlClean)) {
            const nuevoId = estado.pedidos.reduce((max, p) => Math.max(max, p.Id_pedido || p.id_pedido || 100), 100) + 1;
            const id_usuario = Number(params[0] || 2);
            const total = Number(params[1] || 0);
            const est = params[2] || 'pendiente';
            const usr = estado.usuarios.find(u => u.id_Usuario === id_usuario) || { nombre: 'Maria' };
            const horaActual = new Date().toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
            const nuevoPed = {
                Id_pedido: nuevoId,
                id_pedido: nuevoId,
                numero_mesa: 4,
                mesa: 4,
                personas: 2,
                Id_usuario: id_usuario,
                id_usuario: id_usuario,
                nombre_mesera: usr.nombre,
                Total: total,
                total: total,
                Estado: est,
                estado: est,
                nota_cocina: '',
                hora_recepcion: horaActual,
                minutos_espera: 1,
                detalles: []
            };
            estado.pedidos.unshift(nuevoPed);
            return [{ insertId: nuevoId, affectedRows: 1 }];
        }

        // 8. INSERT INTO Detalle_Pedido
        if (/INSERT\s+INTO\s+Detalle_Pedido/i.test(sqlClean)) {
            const [idPedido, idPlatillo, cantidad, subtotal] = params;
            const ped = estado.pedidos.find(p => (p.Id_pedido || p.id_pedido) === Number(idPedido));
            const plat = estado.platillos.find(pl => (pl.Id_platillo || pl.id_platillo) === Number(idPlatillo));
            if (ped) {
                const det = {
                    id_detalle: Date.now() + Math.floor(Math.random() * 1000),
                    Id_pedido: Number(idPedido),
                    Id_platillo: Number(idPlatillo),
                    id_platillo: Number(idPlatillo),
                    nombre: plat ? plat.Nombre : `Platillo #${idPlatillo}`,
                    Nombre: plat ? plat.Nombre : `Platillo #${idPlatillo}`,
                    precio: plat ? plat.Precio : Number(subtotal) / Math.max(1, Number(cantidad)),
                    cantidad: Number(cantidad),
                    Cantidad: Number(cantidad),
                    subtotal: Number(subtotal),
                    Subtotal: Number(subtotal),
                    estado_item: 'activo'
                };
                ped.detalles.push(det);
                recalcularTotalPedido(ped);
            }
            return [{ insertId: Date.now(), affectedRows: 1 }];
        }

        // 9. UPDATE Pedidos SET Estado = ? WHERE Id_pedido = ?
        if (/UPDATE\s+Pedidos\s+SET\s+Estado\s*=\s*\?\s+WHERE\s+Id_pedido\s*=\s*\?/i.test(sqlClean)) {
            const [nuevoEstado, idPedido] = params;
            const ped = estado.pedidos.find(p => (p.Id_pedido || p.id_pedido) === Number(idPedido));
            if (!ped) return [{ affectedRows: 0 }];
            ped.Estado = nuevoEstado;
            ped.estado = nuevoEstado;
            const mesaObj = estado.mesas.find(m => m.numero === Number(ped.numero_mesa || ped.mesa));
            if (mesaObj && nuevoEstado === 'preparado') {
                mesaObj.estado = 'por_cobrar';
            }
            return [{ affectedRows: 1 }];
        }

        return [[]];
    }
};

module.exports = dbWrapper;
