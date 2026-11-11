-- =============================================================================
-- SCRIPT DE BASE DE DATOS: OrderlyDB (Sistema POS - Restaurante Dios Padre)
-- Autores: Almaraz Remigio Jesús David & Ortiz Tapia Abner
-- =============================================================================

CREATE DATABASE IF NOT EXISTS OrderlyDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE OrderlyDB;

-- 1. Tabla Usuarios (con soporte de turno activo y modalidad)
CREATE TABLE IF NOT EXISTS Usuarios (
    id_Usuario INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    rol ENUM('administrador', 'cocina', 'mesera') NOT NULL,
    contrasena VARCHAR(255) NOT NULL,
    turno VARCHAR(50) NOT NULL DEFAULT '9am - 5pm',
    tipo_turno ENUM('Turno completo', 'Medio turno', 'Turno vespertino', 'Cubreturno') NOT NULL DEFAULT 'Turno completo',
    activo BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;

-- 2. Tabla Platillos
CREATE TABLE IF NOT EXISTS Platillos (
    Id_platillo INT AUTO_INCREMENT PRIMARY KEY,
    Nombre VARCHAR(100) NOT NULL,
    Descripcion TEXT,
    Categoria VARCHAR(50) DEFAULT 'Plato fuerte',
    Precio DECIMAL(10, 2) NOT NULL,
    Stock INT NOT NULL DEFAULT 15,
    Disponible BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;

-- 3. Tabla Inventario (Materia Prima / Insumos)
CREATE TABLE IF NOT EXISTS Inventario (
    Id_insumo INT AUTO_INCREMENT PRIMARY KEY,
    Nombre VARCHAR(100) NOT NULL,
    Categoria_insumo ENUM('principal', 'secundario') NOT NULL DEFAULT 'principal',
    Cantidad DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    Cantidad_maxima DECIMAL(10, 2) NOT NULL DEFAULT 15.00,
    Minimo_alerta DECIMAL(10, 2) NOT NULL DEFAULT 1.50,
    Unidad VARCHAR(20) NOT NULL DEFAULT 'kg'
) ENGINE=InnoDB;

-- 4. Tabla Recetas_Platillo (Relación N:M entre Platillos e Insumos para deducción automática)
CREATE TABLE IF NOT EXISTS Recetas_Platillo (
    Id_receta INT AUTO_INCREMENT PRIMARY KEY,
    Id_platillo INT NOT NULL,
    Id_insumo INT NOT NULL,
    Cantidad_requerida DECIMAL(10, 3) NOT NULL DEFAULT 0.100,
    CONSTRAINT fk_receta_platillo FOREIGN KEY (Id_platillo) REFERENCES Platillos(Id_platillo) ON DELETE CASCADE,
    CONSTRAINT fk_receta_insumo FOREIGN KEY (Id_insumo) REFERENCES Inventario(Id_insumo) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. Tabla Turnos_Activos (Control de jornada operativa y asignaciones)
CREATE TABLE IF NOT EXISTS Turnos_Activos (
    Id_turno INT AUTO_INCREMENT PRIMARY KEY,
    Modalidad ENUM('Turno completo', 'Medio turno', 'Turno matutino', 'Turno vespertino') NOT NULL DEFAULT 'Turno completo',
    Hora_inicio VARCHAR(20) NOT NULL DEFAULT '08:00 am',
    Hora_fin VARCHAR(20) NOT NULL DEFAULT '10:00 pm',
    Id_responsable INT NOT NULL DEFAULT 1,
    Notas_turno VARCHAR(255) DEFAULT 'Servicio regular en salón principal',
    Estado ENUM('activo', 'cerrado') NOT NULL DEFAULT 'activo',
    Actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_turno_responsable FOREIGN KEY (Id_responsable) REFERENCES Usuarios(id_Usuario)
) ENGINE=InnoDB;

-- 6. Tabla Pedidos (con validación de máximo 12 personas por mesa)
CREATE TABLE IF NOT EXISTS Pedidos (
    Id_pedido INT AUTO_INCREMENT PRIMARY KEY,
    Id_usuario INT NOT NULL,
    Numero_mesa INT NOT NULL DEFAULT 1,
    Personas INT NOT NULL DEFAULT 2 CHECK (Personas BETWEEN 1 AND 12),
    Nota_cocina TEXT,
    Fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Estado ENUM('pendiente', 'en preparación', 'preparado', 'cerrado', 'cancelado') NOT NULL DEFAULT 'pendiente',
    Motivo_cancelacion VARCHAR(255) DEFAULT NULL,
    Total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    CONSTRAINT fk_pedidos_usuario FOREIGN KEY (Id_usuario) REFERENCES Usuarios(id_Usuario)
) ENGINE=InnoDB;

-- 7. Tabla Detalle_Pedido
CREATE TABLE IF NOT EXISTS Detalle_Pedido (
    Id_detalle INT AUTO_INCREMENT PRIMARY KEY,
    Id_pedido INT NOT NULL,
    Id_platillo INT NOT NULL,
    Cantidad INT NOT NULL CHECK (Cantidad > 0),
    Subtotal DECIMAL(10, 2) NOT NULL,
    Estado_item ENUM('activo', 'agotado_eliminado') NOT NULL DEFAULT 'activo',
    CONSTRAINT fk_detalle_pedido FOREIGN KEY (Id_pedido) REFERENCES Pedidos(Id_pedido) ON DELETE CASCADE,
    CONSTRAINT fk_detalle_platillo FOREIGN KEY (Id_platillo) REFERENCES Platillos(Id_platillo)
) ENGINE=InnoDB;

-- 8. Tabla Pagos
CREATE TABLE IF NOT EXISTS Pagos (
    Id_pago INT AUTO_INCREMENT PRIMARY KEY,
    Id_pedido INT NOT NULL,
    Metodo VARCHAR(50) NOT NULL,
    Monto DECIMAL(10, 2) NOT NULL CHECK (Monto > 0),
    Concepto_division VARCHAR(120) DEFAULT 'Cuenta completa',
    Fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pagos_pedido FOREIGN KEY (Id_pedido) REFERENCES Pedidos(Id_pedido)
) ENGINE=InnoDB;

-- Datos semilla (contraseña para todos: admin123 encriptada con bcrypt 10 salt rounds)
INSERT IGNORE INTO Usuarios (id_Usuario, nombre, rol, contrasena, turno, tipo_turno, activo) VALUES
(1, 'J. David', 'administrador', '$2b$10$f4N1T8K/H7c2xN8pZ.6O7.mP2Y1a9sK5vL6jH8gF4dS2aQ1wE3rT6', '08:00 - 18:00', 'Turno completo', TRUE),
(2, 'Maria', 'mesera', '$2b$10$f4N1T8K/H7c2xN8pZ.6O7.mP2Y1a9sK5vL6jH8gF4dS2aQ1wE3rT6', '09:00 - 17:00', 'Turno completo', TRUE),
(3, 'Roberto', 'cocina', '$2b$10$f4N1T8K/H7c2xN8pZ.6O7.mP2Y1a9sK5vL6jH8gF4dS2aQ1wE3rT6', '08:00 - 16:00', 'Turno completo', TRUE),
(4, 'Ana L.', 'mesera', '$2b$10$f4N1T8K/H7c2xN8pZ.6O7.mP2Y1a9sK5vL6jH8gF4dS2aQ1wE3rT6', '09:00 - 17:00', 'Turno completo', TRUE);

INSERT IGNORE INTO Platillos (Id_platillo, Nombre, Descripcion, Categoria, Precio, Stock, Disponible) VALUES
(1, 'Enchiladas verdes', 'Orden de 3 enchiladas con pollo bañadas en salsa de tomatillo y chile verde con crema', 'Plato fuerte', 95.00, 18, TRUE),
(2, 'Caldo de res', 'Plato servido con arroz, verduras frescas y tortillas', 'Plato fuerte', 120.00, 12, TRUE),
(3, 'Mole rojo', 'Pieza de pollo bañada en mole rojo artesanal de la casa', 'Plato fuerte', 110.00, 0, FALSE),
(4, 'Pollo a la plancha', 'Filete de pechuga de pollo a la plancha con guarnición fresca', 'Plato fuerte', 95.00, 7, TRUE),
(5, 'Sopa de lima', 'Sopa tradicional ligera con tiras de tortilla crujiente y pollo', 'Entradas', 70.00, 9, TRUE),
(6, 'Agua de horchata', 'Agua fresca artesanal de arroz con canela (vaso 500 ml)', 'Bebidas', 30.00, 24, TRUE),
(7, 'Agua de jamaica', 'Infusión natural de flor de jamaica (vaso 500 ml)', 'Bebidas', 35.00, 18, TRUE),
(8, 'Flan napolitano', 'Postre casero de flan horneado con caramelo', 'Postres', 55.00, 6, TRUE);

INSERT IGNORE INTO Inventario (Id_insumo, Nombre, Categoria_insumo, Cantidad, Cantidad_maxima, Minimo_alerta, Unidad) VALUES
(1, 'Tortillas', 'principal', 12.00, 18.00, 3.00, 'kg'),
(2, 'Res', 'principal', 8.00, 12.00, 2.50, 'kg'),
(3, 'Pollo', 'principal', 1.20, 10.00, 2.00, 'kg'),
(4, 'Chile verde', 'principal', 0.80, 5.00, 1.50, 'kg'),
(5, 'Mole', 'principal', 0.50, 6.00, 1.00, 'lt'),
(6, 'Horchata', 'secundario', 5.00, 8.00, 1.50, 'lt'),
(7, 'Jamaica', 'secundario', 4.50, 8.00, 1.50, 'lt'),
(8, 'Aceite', 'secundario', 3.00, 5.00, 1.00, 'lt'),
(9, 'Crema', 'secundario', 0.90, 4.00, 1.20, 'kg');

INSERT IGNORE INTO Recetas_Platillo (Id_platillo, Id_insumo, Cantidad_requerida) VALUES
(1, 1, 0.150), (1, 3, 0.120), (1, 4, 0.060), (1, 9, 0.050),
(2, 2, 0.250),
(3, 3, 0.200), (3, 5, 0.120),
(4, 3, 0.200), (4, 8, 0.030),
(5, 1, 0.080), (5, 3, 0.080),
(6, 6, 0.350),
(7, 7, 0.350),
(8, 9, 0.040);

INSERT IGNORE INTO Turnos_Activos (Id_turno, Modalidad, Hora_inicio, Hora_fin, Id_responsable, Notas_turno, Estado) VALUES
(1, 'Turno completo', '08:00', '22:00', 1, 'Servicio regular en salón principal', 'activo');
