import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import VistaMesero from './components/VistaMesero';
import VistaCocina from './components/VistaCocina';


// Vistas provisionales (luego las desarrollaremos a detalle)


const VistaAdmin = () => <div style={{padding: '20px'}}><h2>Panel de Administrador - Gestión General</h2></div>;

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/mesero" element={<VistaMesero />} />
        <Route path="/cocina" element={<VistaCocina />} />
        <Route path="/admin" element={<VistaAdmin />} />
        {/* Si entra a la raíz, lo mandamos al login por defecto */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}