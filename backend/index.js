const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcrypt'); 
const jwt = require('jsonwebtoken');
const { verificarToken, verificarRol } = require('./middleware/auth');
require('dotenv').config();

// 1. Importamos la conexión a tu base de datos MySQL
const db = require('./config/db'); 

const app = express();
const server = http.createServer(app);

// Middlewares
app.use(cors()); 
app.use(express.json()); 

// Configuración de WebSockets
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on('connection', (socket) => {
    console.log('Cliente conectado al WebSocket:', socket.id);

    // NUEVO: Escuchar cuando un mesero envía un pedido
    socket.on('enviar_pedido', (pedido) => {
        console.log('Nuevo pedido recibido del mesero:', pedido);
        // Retransmitir el pedido a todos los clientes (cocina)
        io.emit('nuevo_pedido', pedido);
    });

    socket.on('disconnect', () => console.log('Cliente desconectado:', socket.id));
});

// Endpoint de prueba que ya tenías
app.get('/api/status', verificarToken, verificarRol(['mesera', 'administrador']), async (req, res) => {
    res.json({ mensaje: 'El servidor backend de Orderly está funcionando correctamente' });
});

// 2. NUEVO ENDPOINT: Consultar la tabla de Platillos
app.get('/api/platillos', verificarToken, verificarRol(['mesera', 'administrador']), async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM Platillos WHERE Disponible = true');
        res.json(rows);
    } catch (error) {
        console.error("Error en la consulta:", error);
        res.status(500).json({ error: 'Error al consultar los platillos' });
    }
});

// 3. NUEVO ENDPOINT: Guardar pedido en MySQL y avisar a cocina
app.post('/api/pedidos', verificarToken, verificarRol(['mesera', 'administrador']), async (req, res) => {
    // Extraemos los datos que nos enviará React
    const { id_usuario, total, platillos, mesa } = req.body;

    try {
        // A. Insertamos el registro principal en la tabla Pedidos
        const [resultPedido] = await db.query(
            'INSERT INTO Pedidos (Id_usuario, Total, Estado) VALUES (?, ?, ?)',
            [id_usuario, total, 'pendiente']
        );
        const idNuevoPedido = resultPedido.insertId;

        // B. Insertamos cada platillo en la tabla Detalle_Pedido
        for (let item of platillos) {
            await db.query(
                'INSERT INTO Detalle_Pedido (Id_pedido, Id_platillo, Cantidad, Subtotal) VALUES (?, ?, ?, ?)',
                [idNuevoPedido, item.Id_platillo, item.cantidad, item.subtotal]
            );
        }

        // C. Disparamos el evento WebSocket a la cocina con el ID real de la base de datos
        const pedidoParaCocina = { id_pedido: idNuevoPedido, mesa, platillos };
        io.emit('nuevo_pedido', pedidoParaCocina);

        res.status(201).json({ mensaje: 'Pedido guardado y enviado', id_pedido: idNuevoPedido });
    } catch (error) {
        console.error("Error guardando el pedido:", error);
        res.status(500).json({ error: 'Error interno al procesar la comanda' });
    }
});

// 4. NUEVO ENDPOINT: Actualizar estado del pedido
app.put('/api/pedidos/:id/estado', verificarToken, verificarRol(['cocina', 'administrador']), async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body; // Recibirá 'preparado'

    try {
        // Actualizamos la tabla en MySQL
        const [result] = await db.query('UPDATE Pedidos SET Estado = ? WHERE Id_pedido = ?', [estado, id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }
        
        res.json({ mensaje: `Pedido ${id} marcado como ${estado}` });
    } catch (error) {
        console.error("Error al actualizar el estado:", error);
        res.status(500).json({ error: 'Error interno en la base de datos' });
    }
});

app.post('/api/login', async (req, res) => {
    const { nombre, contrasena } = req.body;
    try {
        const [usuarios] = await db.query('SELECT * FROM Usuarios WHERE nombre = ? AND activo = true', [nombre]);
        if (usuarios.length === 0) return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });

        const usuario = usuarios[0];
        const passCorrecta = await bcrypt.compare(contrasena, usuario.contrasena);

        if (!passCorrecta) return res.status(401).json({ error: 'Credenciales incorrectas' });

        const token = jwt.sign({ id: usuario.id_Usuario, rol: usuario.rol }, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.json({ exito: true, token, rol: usuario.rol });
    } catch (error) {
        res.status(500).json({ error: 'Error interno' });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
});