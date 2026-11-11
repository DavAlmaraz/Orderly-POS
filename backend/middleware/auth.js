const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

// Clave secreta criptográfica (256-bit) para firmas JWT e integridad de respaldos
const JWT_SECRET = process.env.JWT_SECRET || 'Orderly_POS_JWT_Secret_2026_HighEntropy_Key_940';

// Lista negra en memoria para tokens revocados al cerrar sesión (Logout seguro)
const tokensRevocados = new Set();

function revocarToken(token) {
    if (token) {
        tokensRevocados.add(token);
    }
}

function esTokenValidoSinMiddleware(token) {
    if (!token || tokensRevocados.has(token)) return null;
    try {
        return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
        return null;
    }
}

// Sanitización profunda contra inyección XSS y caracteres de control peligrosos en entradas
function sanitizarValor(valor, clave = '') {
    // No alterar contraseñas para permitir símbolos especiales legítimos
    if (['contrasena', 'password', 'nuevaContrasena', 'db_password'].includes(clave)) {
        return typeof valor === 'string' ? valor : valor;
    }
    if (typeof valor === 'string') {
        return valor
            .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
            .replace(/javascript\s*:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .replace(/[<>]/g, (ch) => (ch === '<' ? '‹' : '›'))
            .replace(/\0/g, '');
    }
    if (Array.isArray(valor)) {
        return valor.map((item) => sanitizarValor(item, clave));
    }
    if (valor && typeof valor === 'object') {
        const limpio = {};
        for (const [k, v] of Object.entries(valor)) {
            if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
            limpio[k] = sanitizarValor(v, k);
        }
        return limpio;
    }
    return valor;
}

const sanitizarPayload = (req, _res, next) => {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizarValor(req.body);
    }
    if (req.query && typeof req.query === 'object') {
        req.query = sanitizarValor(req.query);
    }
    next();
};

// Limitador de peticiones por IP (Protección contra ataques DoS / Fuerza Bruta)
const registroTraficoIP = new Map();
const VENTANA_RATE_LIMIT_MS = 60 * 1000;
const MAX_PETICIONES_POR_MINUTO = 240;

const limitarTasaPeticiones = (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || 'local';
    const ahora = Date.now();
    const registro = registroTraficoIP.get(ip) || { conteo: 0, inicioVentana: ahora };

    if (ahora - registro.inicioVentana > VENTANA_RATE_LIMIT_MS) {
        registro.conteo = 1;
        registro.inicioVentana = ahora;
    } else {
        registro.conteo += 1;
    }
    registroTraficoIP.set(ip, registro);

    if (registro.conteo > MAX_PETICIONES_POR_MINUTO) {
        return res.status(429).json({
            error: 'Demasiadas solicitudes desde esta dirección IP. Por seguridad, espere unos segundos.'
        });
    }
    next();
};

// Validación de fortaleza de contraseñas para cuentas nuevas o cambios de contraseña
function validarFortalezaPassword(password) {
    const str = String(password || '').trim();
    if (str.length < 6) {
        return {
            valida: false,
            error: 'Por seguridad, la contraseña debe tener al menos 6 caracteres combinando letras y números.'
        };
    }
    const tieneLetra = /[a-zA-Z]/.test(str);
    const tieneNumeroOSimbolo = /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(str);
    if (!tieneLetra || !tieneNumeroOSimbolo) {
        return {
            valida: false,
            error: 'La contraseña debe incluir al menos una letra y un número o símbolo para evitar vulneraciones.'
        };
    }
    return { valida: true };
}

// Generar firma HMAC-SHA256 de integridad para respaldos de información del negocio
function firmarIntegridadDatos(objetoDatos) {
    const payload = JSON.stringify(objetoDatos);
    return crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
}

// Middleware 1: Verificar que el usuario tenga un Token válido (Autenticación JWT HS256)
const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado. Token de autenticación requerido.' });
    }

    if (tokensRevocados.has(token)) {
        return res.status(401).json({ error: 'Esta sesión ya fue cerrada. Inicie sesión nuevamente.' });
    }

    try {
        const verificado = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        req.usuario = verificado;
        req.tokenActual = token;
        next();
    } catch {
        return res.status(401).json({ error: 'Sesión expirada o token inválido. Inicie sesión nuevamente.' });
    }
};

// Middleware 2: Verificar que el usuario tenga el Rol necesario (Autorización RBAC)
const verificarRol = (rolesPermitidos) => {
    return (req, res, next) => {
        if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
            return res.status(403).json({
                error: `Permisos insuficientes. Esta operación requiere rol: ${rolesPermitidos.join(' o ')}.`
            });
        }
        next();
    };
};

module.exports = {
    verificarToken,
    verificarRol,
    revocarToken,
    esTokenValidoSinMiddleware,
    sanitizarPayload,
    limitarTasaPeticiones,
    validarFortalezaPassword,
    firmarIntegridadDatos,
    JWT_SECRET
};
