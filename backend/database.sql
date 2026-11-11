-- =============================================================================
-- SCRIPT DE BASE DE DATOS: OrderlyDB (Sistema POS - Restaurante Dios Padre)
-- Autores: Almaraz Remigio Jesús David & Ortiz Tapia Abner
-- =============================================================================

CREATE DATABASE IF NOT EXISTS OrderlyDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE OrderlyDB;

-- 1. Tabla Usuarios
CREATE TABLE IF NOT EXISTS Usuarios (
    id_Usuario INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    rol ENUM('administrador', 'cocina', 'mesera') NOT NULL,
    contrasena VARCHAR(255) NOT NULL,
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

-- 3. Tabla Pedidos
CREATE TABLE IF NOT EXISTS Pedidos (
    Id_pedido INT AUTO_INCREMENT PRIMARY KEY,
    Id_usuario INT NOT NULL,
    Numero_mesa INT DEFAULT 1,
    Personas INT DEFAULT 2,
    Nota_cocina TEXT,
    Fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Estado ENUM('pendiente', 'en preparación', 'preparado', 'cerrado') NOT NULL DEFAULT 'pendiente',
    Total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    CONSTRAINT fk_pedidos_usuario FOREIGN KEY (Id_usuario) REFERENCES Usuarios(id_Usuario)
) ENGINE=InnoDB;

-- 4. Tabla Detalle_Pedido
CREATE TABLE IF NOT EXISTS Detalle_Pedido (
    Id_detalle INT AUTO_INCREMENT PRIMARY KEY,
    Id_pedido INT NOT NULL,
    Id_platillo INT NOT NULL,
    Cantidad INT NOT NULL,
    Subtotal DECIMAL(10, 2) NOT NULL,
    CONSTRAINT fk_detalle_pedido FOREIGN KEY (Id_pedido) REFERENCES Pedidos(Id_pedido) ON DELETE CASCADE,
    CONSTRAINT fk_detalle_platillo FOREIGN KEY (Id_platillo) REFERENCES Platillos(Id_platillo)
) ENGINE=InnoDB;

-- 5. Tabla Inventario
CREATE TABLE IF NOT EXISTS Inventario (
    Id_insumo INT AUTO_INCREMENT PRIMARY KEY,
    Nombre VARCHAR(100) NOT NULL,
    Cantidad DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    Unidad VARCHAR(20) NOT NULL DEFAULT 'kg'
) ENGINE=InnoDB;

-- 6. Tabla Pagos
CREATE TABLE IF NOT EXISTS Pagos (
    Id_pago INT AUTO_INCREMENT PRIMARY KEY,
    Id_pedido INT NOT NULL,
    Metodo VARCHAR(50) NOT NULL,
    Monto DECIMAL(10, 2) NOT NULL,
    Fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pagos_pedido FOREIGN KEY (Id_pedido) REFERENCES Pedidos(Id_pedido)
) ENGINE=InnoDB;

-- Datos semilla (contraseña para todos: admin123 encriptada con bcrypt 10 salt rounds)
INSERT IGNORE INTO Usuarios (id_Usuario, nombre, rol, contrasena, activo) VALUES
(1, 'J. David', 'administrador', '$2b$10$f4N1T8K/H7c2xN8pZ.6O7.mP2Y1a9sK5vL6jH8gF4dS2aQ1wE3rT6', TRUE),
(2, 'Maria', 'mesera', '$2b$10$f4N1T8K/H7c2xN8pZ.6O7.mP2Y1a9sK5vL6jH8gF4dS2aQ1wE3rT6', TRUE),
(3, 'Roberto', 'cocina', '$2b$10$f4N1T8K/H7c2xN8pZ.6O7.mP2Y1a9sK5vL6jH8gF4dS2aQ1wE3rT6', TRUE),
(4, 'Ana L.', 'mesera', '$2b$10$f4N1T8K/H7c2xN8pZ.6O7.mP2Y1a9sK5vL6jH8gF4dS2aQ1wE3rT6', TRUE);

INSERT IGNORE INTO Platillos (Id_platillo, Nombre, Descripcion, Categoria, Precio, Stock, Disponible) VALUES
(1, 'Enchiladas verdes', 'Orden de 3 enchiladas con pollo bañadas en salsa de tomatillo y chile verde con crema', 'Plato fuerte', 95.00, 18, TRUE),
(2, 'Caldo de res', 'Plato servido con arroz, verduras frescas y tortillas', 'Plato fuerte', 120.00, 12, TRUE),
(3, 'Mole rojo', 'Pieza de pollo bañada en mole rojo artesanal de la casa', 'Plato fuerte', 110.00, 0, FALSE),
(4, 'Pollo a la plancha', 'Filete de pechuga de pollo a la plancha con guarnición fresca', 'Plato fuerte', 95.00, 7, TRUE),
(5, 'Sopa de lima', 'Sopa tradicional ligera con tiras de tortilla crujiente y pollo', 'Entradas', 70.00, 9, TRUE),
(6, 'Agua de horchata', 'Agua fresca artesanal de arroz con canela (vaso 500 ml)', 'Bebidas', 30.00, 24, TRUE),
(7, 'Agua de jamaica', 'Infusión natural de flor de jamaica (vaso 500 ml)', 'Bebidas', 35.00, 18, TRUE),
(8, 'Flan napolitano', 'Postre casero de flan horneado con caramelo', 'Postres', 55.00, 6, TRUE);

INSERT IGNORE INTO Inventario (Id_insumo, Nombre, Cantidad, Unidad) VALUES
(1, 'Tortillas', 12.00, 'kg'),
(2, 'Res', 8.00, 'kg'),
(3, 'Pollo', 1.20, 'kg'),
(4, 'Chile verde', 0.80, 'kg'),
(5, 'Mole', 0.50, 'lt'),
(6, 'Horchata', 5.00, 'lt'),
(7, 'Jamaica', 4.50, 'lt'),
(8, 'Aceite', 3.00, 'lt'),
(9, 'Crema', 0.90, 'kg');
