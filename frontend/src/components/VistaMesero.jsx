import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { io } from 'socket.io-client';

// Conectamos el WebSocket al backend
const socket = io('http://localhost:3000');

export default function VistaMesero() {
    const [platillos, setPlatillos] = useState([]);
    const [error, setError] = useState('');
    const [mensajeExito, setMensajeExito] = useState('');

    // 1. Cargar los platillos al abrir la vista (Usando el Token JWT automáticamente)
    useEffect(() => {
        api.get('/platillos')
            .then(response => {
                setPlatillos(response.data);
            })
            .catch(err => {
                setError('Error al cargar los platillos. ¿Tienes permisos o sesión activa?');
                console.error(err);
            });
    }, []);

    // 2. Función para simular el envío de un pedido de prueba
    const enviarPedidoPrueba = () => {
        const nuevoPedido = {
            id_usuario: 2, // ID de la mesera (Maria)
            total: 150.00,
            mesa: 4,
            platillos: [
                { Id_platillo: 1, cantidad: 2, subtotal: 150.00 }
            ]
        };

        api.post('/pedidos', nuevoPedido)
            .then(response => {
                setMensajeExito(`¡Pedido #${response.data.id_pedido} enviado con éxito!`);
                
                // Opcional: Avisar por WebSocket explícitamente si se requiere
                socket.emit('enviar_pedido', nuevoPedido);
            })
            .catch(err => {
                alert('Hubo un error al enviar el pedido');
                console.error(err);
            });
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
            <h2>Panel de Mesera - Orderly POS</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            {mensajeExito && <p style={{ color: 'green' }}>{mensajeExito}</p>}

            <h3>Menú Disponible (Protegido por RBAC)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '20px' }}>
                {platillos.map(p => (
                    <div key={p.Id_platillo} style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '8px' }}>
                        <h4>{p.Nombre}</h4>
                        <p>${p.Precio}</p>
                        <button onClick={enviarPedidoPrueba} style={{ background: '#28a745', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>
                            Pedir (Mesa 4)
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}