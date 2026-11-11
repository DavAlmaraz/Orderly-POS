import React, { useState } from 'react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';

export default function Login() {
    const [nombre, setNombre] = useState('');
    const [contrasena, setContrasena] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const response = await api.post('/login', { nombre, contrasena });
            const { token, rol } = response.data;

            // Guardamos la sesión
            localStorage.setItem('token', token);
            localStorage.setItem('rol', rol);

            // Redirección basada en el rol definido en tu RBAC
            if (rol === 'mesera') navigate('/mesero');
            else if (rol === 'cocina') navigate('/cocina');
            else if (rol === 'administrador') navigate('/admin');

        } catch (err) {
            setError(err.response?.data?.error || 'Error al iniciar sesión');
        }
    };

    return (
        <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
            <h2>Orderly POS - Login</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <form onSubmit={handleLogin}>
                <div style={{ marginBottom: '10px' }}>
                    <label>Usuario:</label><br />
                    <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required style={{ width: '100%', padding: '8px' }} />
                </div>
                <div style={{ marginBottom: '10px' }}>
                    <label>Contraseña:</label><br />
                    <input type="password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} required style={{ width: '100%', padding: '8px' }} />
                </div>
                <button type="submit" style={{ width: '100%', padding: '10px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}>Entrar</button>
            </form>
        </div>
    );
}