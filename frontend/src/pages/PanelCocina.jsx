import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

export default function PanelCocina() {
  const [pedidos, setPedidos] = useState([]);

  useEffect(() => {
    socket.on('nuevo_pedido', (pedido) => {
      setPedidos((prevPedidos) => [...prevPedidos, pedido]);
    });

    return () => socket.off('nuevo_pedido');
  }, []);

  // Nueva función para actualizar la base de datos
  const marcarPreparado = async (id_pedido) => {
    try {
      const response = await fetch(`http://localhost:3000/api/pedidos/${id_pedido}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'preparado' })
      });

      if (response.ok) {
        // Quitamos el pedido de la pantalla de la cocina
        setPedidos(pedidos.filter(p => p.id_pedido !== id_pedido));
      }
    } catch (error) {
      console.error("Error al actualizar:", error);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Roboto, sans-serif' }}>
      <h1 style={{ color: '#D9534F' }}>Órdenes en Cocina</h1>
      <div style={{ display: 'grid', gap: '15px' }}>
        {pedidos.length === 0 ? (
          <p>No hay pedidos pendientes. La cocina está tranquila.</p>
        ) : (
          pedidos.map((pedido) => (
            <div key={pedido.id_pedido} style={{ border: '2px solid #D9534F', padding: '15px', borderRadius: '8px' }}>
              <h3>Mesa {pedido.mesa} (Orden #{pedido.id_pedido})</h3>
              <ul>
                {pedido.platillos.map((p, i) => (
                  <li key={i}>{p.cantidad}x {p.nombre}</li>
                ))}
              </ul>
              <button 
                onClick={() => marcarPreparado(pedido.id_pedido)}
                style={{ backgroundColor: '#5CB85C', color: 'white', padding: '8px', border: 'none', borderRadius: '5px', marginTop: '10px', cursor: 'pointer' }}
              >
                Marcar como Preparado
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}