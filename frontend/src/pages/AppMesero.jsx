import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

// Conexión al WebSocket del backend
const socket = io('http://localhost:3000');

export default function AppMesero() {
  const [platillos, setPlatillos] = useState([]);
  const [comanda, setComanda] = useState([]);

  useEffect(() => {
    fetch('http://localhost:3000/api/platillos')
      .then(res => res.json())
      .then(data => setPlatillos(data))
      .catch(err => console.error("Error cargando platillos:", err));
  }, []);

// NUEVO: Escuchar notificaciones de la cocina
  useEffect(() => {
    socket.on('pedido_actualizado', (datos) => {
      if (datos.estado === 'preparado') {
        alert(`🔔 ¡La cocina ha terminado la Orden #${datos.id_pedido}! Lista para entregar.`);
      }
    });

    return () => socket.off('pedido_actualizado');
  }, []);

  // Función para agregar al carrito local
  const agregarAComanda = (platillo) => {
    setComanda([...comanda, { 
      Id_platillo: platillo.Id_platillo, 
      nombre: platillo.Nombre, 
      cantidad: 1, 
      precio: parseFloat(platillo.Precio),
      subtotal: parseFloat(platillo.Precio) * 1
    }]);
  };

  // Función para disparar el evento WebSocket
  const enviarPedido = async () => {
    if (comanda.length === 0) return alert("Agrega al menos un platillo a la comanda.");
    
    const totalPedido = comanda.reduce((sum, item) => sum + item.subtotal, 0);

    const datosPedido = {
      id_usuario: 1, // Por ahora forzamos el ID 1 (el administrador que creaste en Workbench)
      mesa: Math.floor(Math.random() * 10) + 1,
      total: totalPedido,
      platillos: comanda
    };

    try {
      const response = await fetch('http://localhost:3000/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosPedido)
      });

      if (response.ok) {
        setComanda([]);
        alert(`¡Pedido guardado en base de datos y enviado a cocina!`);
      }
    } catch (error) {
      console.error("Error al enviar el pedido:", error);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Roboto, sans-serif' }}>
      <h1 style={{ color: '#2B3A4A' }}>Menú de Platillos</h1>
      
      {/* Botón flotante para enviar la orden */}
      <button 
        onClick={enviarPedido}
        style={{ backgroundColor: '#D9534F', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', marginBottom: '20px', fontSize: '16px', cursor: 'pointer' }}
      >
        Enviar Pedido a Cocina ({comanda.length} platillos)
      </button>

      <div style={{ display: 'grid', gap: '15px' }}>
        {platillos.length === 0 ? (
          <p>Cargando menú...</p>
        ) : (
          platillos.map(platillo => (
            <div key={platillo.Id_platillo} style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '8px' }}>
              <h3>{platillo.Nombre}</h3>
              <p>{platillo.Descripcion}</p>
              <p><strong>${platillo.Precio}</strong></p>
              <button 
                onClick={() => agregarAComanda(platillo)}
                style={{ backgroundColor: '#2B3A4A', color: 'white', padding: '8px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
              >
                Agregar a comanda
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}