import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import api from '../services/api';

// Conectamos el WebSocket al backend
const socket = io('http://localhost:3000');

export default function VistaCocina() {
    const [pedidos, setPedidos] = useState([]);

    useEffect(() => {
        // Escuchamos cuando entra un nuevo pedido desde el backend
        socket.on('nuevo_pedido', (pedidoRecibido) => {
            console.log("¡Nuevo pedido recibido!", pedidoRecibido);
            // Agregamos el pedido nuevo a la lista actual de la pantalla
            setPedidos((pedidosActuales) => [...pedidosActuales, pedidoRecibido]);
        });

        // Limpiamos la conexión si el usuario sale de la pantalla
        return () => {
            socket.off('nuevo_pedido');
        };
    }, []);

    const marcarComoPreparado = (id_pedido) => {
        // Consumimos el endpoint protegido por RBAC para cocina
        api.put(`/pedidos/${id_pedido}/estado`, { estado: 'preparado' })
            .then(() => {
                alert(`Pedido #${id_pedido} marcado como preparado`);
                // Quitamos el pedido de la pantalla
                setPedidos(pedidos.filter(p => p.id_pedido !== id_pedido));
            })
            .catch(err => {
                alert('Error al actualizar el estado');
                console.error(err);
            });
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
            <h2 style={{ color: '#d9534f' }}>👨‍🍳 Panel de Cocina - Pedidos en Vivo</h2>
            
            {pedidos.length === 0 ? (
                <p>No hay pedidos pendientes. ¡La cocina está tranquila!</p>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                    {pedidos.map((pedido, index) => (
                        <div key={index} style={{ border: '2px solid #d9534f', padding: '15px', borderRadius: '8px', background: '#fff3f3' }}>
                            <h3>Mesa {pedido.mesa}</h3>
                            <p><strong>ID Pedido:</strong> #{pedido.id_pedido}</p>
                            <ul>
                                {pedido.platillos.map((p, i) => (
                                    <li key={i}>{p.cantidad}x Platillo ID: {p.Id_platillo}</li>
                                ))}
                            </ul>
                            <button onClick={() => marcarComoPreparado(pedido.id_pedido)} style={{ background: '#d9534f', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', width: '100%' }}>
                                ✅ Marcar Preparado
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}