const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });

    try {
        const token = authHeader.split(" ")[1]; 
        const decodificado = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = decodificado; 
        next();
    } catch (error) {
        res.status(401).json({ error: 'Token inválido o expirado' });
    }
};

const verificarRol = (rolesPermitidos) => {
    return (req, res, next) => {
        if (!rolesPermitidos.includes(req.usuario.rol)) {
            return res.status(403).json({ error: 'Acceso denegado. Privilegios insuficientes.' });
        }
        next();
    };
};

module.exports = { verificarToken, verificarRol };