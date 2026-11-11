const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'Orderly_Super_Secreta_2026';

// Lista negra de tokens revocados (Logout)
const tokensRevocados = new Set();

function revocarToken(token) {
    if (token) tokensRevocados.add(token);
}

function extraerTokenDeRequest(req) {
    const authHeader = req.headers['authorization'] || req.headers['x-orderly-token'];
    if (!authHeader) return null;
    return authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1].trim() : authHeader.trim();
}

const verificarToken = (req, res, next) => {
    const token = extraerTokenDeRequest(req);
    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado. Token de autenticación no proporcionado.' });
    }

    if (tokensRevocados.has(token)) {
        return res.status(401).json({ error: 'Sesión finalizada. Por favor inicie sesión nuevamente.' });
    }

    try {
        const decodificado = jwt.verify(token, JWT_SECRET);

        // Verificar en tiempo real que el usuario siga activo en el sistema
        const usuarioActual = db.estado.usuarios.find(
            (u) => (u.id_usuario || u.id_Usuario) === Number(decodificado.id || decodificado.id_usuario)
        );
        if (usuarioActual && usuarioActual.activo === false) {
            return res.status(403).json({ error: 'Su cuenta ha sido desactivada por el administrador.' });
        }

        req.usuario = decodificado;
        req.tokenActual = token;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido o expirado. Inicie sesión nuevamente.' });
    }
};

const verificarRol = (rolesPermitidos) => {
    return (req, res, next) => {
        if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
            return res.status(403).json({
                error: `Acceso restringido. Se requiere rol: ${rolesPermitidos.join(' o ')}.`
            });
        }
        next();
    };
};

module.exports = { verificarToken, verificarRol, revocarToken, extraerTokenDeRequest, JWT_SECRET };
