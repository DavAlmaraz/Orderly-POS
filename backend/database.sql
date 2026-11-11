-- ============================================================================
-- ORDERLY POS — ESQUEMA OFICIAL DE BASE DE DATOS (MySQL Server 9.4.0 & Workbench 8.0)
-- Compatible con autenticación caching_sha2_password, UTF8MB4_0900_AI_CI e InnoDB ACID
-- ============================================================================

CREATE DATABASE IF NOT EXISTS OrderlyDB
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE OrderlyDB;

-- 1. Tabla de Usuarios y Roles (RBAC + Turnos + Hash bcrypt de 12 rondas)
CREATE TABLE IF NOT EXISTS Usuarios (
    id_Usuario INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    usuario_login VARCHAR(60) NULL,
    rol ENUM('mesera', 'cocina', 'administrador') NOT NULL,
    contrasena VARCHAR(255) NOT NULL,
    turno VARCHAR(50) DEFAULT '09:00 - 17:00',
    tipo_turno VARCHAR(50) DEFAULT 'Turno completo',
    hora_inicio VARCHAR(10) DEFAULT '09:00',
    hora_fin VARCHAR(10) DEFAULT '17:00',
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_usuarios_nombre (nombre),
    INDEX idx_usuarios_login (usuario_login),
    INDEX idx_usuarios_rol (rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 2. Tabla de Catálogo de Platillos y Bebidas
CREATE TABLE IF NOT EXISTS Platillos (
    Id_platillo INT AUTO_INCREMENT PRIMARY KEY,
    Nombre VARCHAR(100) NOT NULL,
    Descripcion VARCHAR(255) DEFAULT '',
    Categoria VARCHAR(50) DEFAULT 'Plato fuerte',
    Precio DECIMAL(10, 2) NOT NULL,
    Stock INT DEFAULT 20,
    Unidad_stock VARCHAR(30) DEFAULT 'porciones',
    Disponible BOOLEAN DEFAULT TRUE,
    Tiempo_prep_min INT DEFAULT 12,
    INDEX idx_platillos_categoria (Categoria),
    INDEX idx_platillos_disponible (Disponible)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 3. Tabla de Inventario de Insumos (Materia Prima)
CREATE TABLE IF NOT EXISTS Inventario (
    Id_insumo INT AUTO_INCREMENT PRIMARY KEY,
    Nombre VARCHAR(100) NOT NULL,
    Categoria_insumo VARCHAR(50) DEFAULT 'principal',
    Cantidad DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    Cantidad_maxima DECIMAL(10, 2) NOT NULL DEFAULT 15.00,
    Unidad VARCHAR(30) DEFAULT 'kg',
    Minimo_alerta DECIMAL(10, 2) DEFAULT 2.00,
    Actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_inventario_nivel (Cantidad, Minimo_alerta)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 4. Tabla de Recetas por Platillo (Enlace Platillo -> Materia Prima de Inventario)
CREATE TABLE IF NOT EXISTS Recetas_Platillo (
    Id_receta INT AUTO_INCREMENT PRIMARY KEY,
    Id_platillo INT NOT NULL,
    Id_insumo INT NOT NULL,
    Cantidad_requerida DECIMAL(10, 3) NOT NULL DEFAULT 0.100,
    FOREIGN KEY (Id_platillo) REFERENCES Platillos(Id_platillo) ON DELETE CASCADE,
    FOREIGN KEY (Id_insumo) REFERENCES Inventario(Id_insumo) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 5. Tabla de Configuración de Turnos Activos
CREATE TABLE IF NOT EXISTS Turnos_Activos (
    Id_turno INT AUTO_INCREMENT PRIMARY KEY,
    Nombre_turno VARCHAR(80) NOT NULL DEFAULT 'Turno Matutino - Vespertino',
    Modalidad ENUM('Turno completo', 'Medio turno', 'Turno matutino', 'Turno vespertino') DEFAULT 'Turno completo',
    Hora_inicio VARCHAR(10) NOT NULL DEFAULT '08:00',
    Hora_fin VARCHAR(10) NOT NULL DEFAULT '22:00',
    Id_usuario_responsable INT NULL,
    Notas VARCHAR(255) DEFAULT 'Operación normal de salón y cocina',
    Activo BOOLEAN DEFAULT TRUE,
    Actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (Id_usuario_responsable) REFERENCES Usuarios(id_Usuario) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 6. Tabla de Pedidos / Comandas (Transacciones ACID, máx. 12 comensales por mesa)
CREATE TABLE IF NOT EXISTS Pedidos (
    Id_pedido INT AUTO_INCREMENT PRIMARY KEY,
    Id_usuario INT NOT NULL,
    Numero_mesa INT DEFAULT 1,
    Personas INT DEFAULT 2,
    Nota_cocina VARCHAR(255) DEFAULT '',
    Fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    Estado ENUM('pendiente', 'en_preparacion', 'preparado', 'entregado', 'cerrado', 'cancelado') DEFAULT 'pendiente',
    Total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    FOREIGN KEY (Id_usuario) REFERENCES Usuarios(id_Usuario),
    CONSTRAINT chk_personas_mesa CHECK (Personas >= 1 AND Personas <= 12),
    INDEX idx_pedidos_mesa_estado (Numero_mesa, Estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 7. Tabla de Detalle de Pedido
CREATE TABLE IF NOT EXISTS Detalle_Pedido (
    Id_detalle INT AUTO_INCREMENT PRIMARY KEY,
    Id_pedido INT NOT NULL,
    Id_platillo INT NOT NULL,
    Cantidad INT NOT NULL,
    Subtotal DECIMAL(10, 2) NOT NULL,
    Notas_item VARCHAR(255) DEFAULT '',
    FOREIGN KEY (Id_pedido) REFERENCES Pedidos(Id_pedido) ON DELETE CASCADE,
    FOREIGN KEY (Id_platillo) REFERENCES Platillos(Id_platillo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 8. Tabla de Pagos y División de Cuentas
CREATE TABLE IF NOT EXISTS Pagos (
    Id_pago INT AUTO_INCREMENT PRIMARY KEY,
    Id_pedido INT NOT NULL,
    Numero_mesa INT NOT NULL,
    Metodo VARCHAR(50) NOT NULL,
    Monto DECIMAL(10, 2) NOT NULL,
    Concepto_division VARCHAR(100) DEFAULT 'Cuenta única',
    Fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (Id_pedido) REFERENCES Pedidos(Id_pedido)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================================
-- DATOS SEMILLA OFICIALES (Hash bcrypt real verificado para 'admin123')
-- ============================================================================

INSERT IGNORE INTO Usuarios (id_Usuario, nombre, usuario_login, rol, contrasena, turno, tipo_turno, hora_inicio, hora_fin, activo) VALUES
(1, 'J. David', 'J. David', 'administrador', '$2b$12$nN3n/ucK2qPog2dr.PPNauTdawl6pv5YTNKS2oJTaxLz7ANNx.38W', '08:00 - 18:00', 'Turno completo', '08:00', '18:00', TRUE),
(2, 'Maria', 'Maria', 'mesera', '$2b$12$nN3n/ucK2qPog2dr.PPNauTdawl6pv5YTNKS2oJTaxLz7ANNx.38W', '09:00 - 17:00', 'Turno completo', '09:00', '17:00', TRUE),
(3, 'Roberto', 'Roberto', 'cocina', '$2b$12$nN3n/ucK2qPog2dr.PPNauTdawl6pv5YTNKS2oJTaxLz7ANNx.38W', '08:00 - 16:00', 'Turno completo', '08:00', '16:00', TRUE),
(4, 'Ana L.', 'Ana L.', 'mesera', '$2b$12$nN3n/ucK2qPog2dr.PPNauTdawl6pv5YTNKS2oJTaxLz7ANNx.38W', '09:00 - 17:00', 'Turno completo', '09:00', '17:00', TRUE);

INSERT IGNORE INTO Platillos (Id_platillo, Nombre, Descripcion, Categoria, Precio, Stock, Unidad_stock, Disponible, Tiempo_prep_min) VALUES
(1, 'Enchiladas verdes', 'Pollo, salsa verde, crema y queso', 'Plato fuerte', 95.00, 18, 'porciones', TRUE, 12),
(2, 'Sopa de lima', 'Caldo de pollo, lima y juliana de tortilla', 'Entradas', 65.00, 14, 'porciones', TRUE, 8),
(3, 'Gorditas de chicharrón', 'Masa de maíz, chicharrón prensado y salsa', 'Entradas', 70.00, 16, 'porciones', TRUE, 10),
(4, 'Caldo de res', 'Res, elote, zanahoria, papa y calabaza', 'Plato fuerte', 110.00, 12, 'porciones', TRUE, 15),
(5, 'Chilaquiles rojos', 'Totopos, salsa guajillo, pollo y crema', 'Plato fuerte', 85.00, 20, 'porciones', TRUE, 10),
(6, 'Mole con pollo', 'Pechuga o pierna en mole artesanal con arroz', 'Plato fuerte', 120.00, 3, 'porciones', TRUE, 14),
(7, 'Costillas en salsa verde', 'Costilla de cerdo en salsa de tomatillo', 'Plato fuerte', 135.00, 9, 'porciones', TRUE, 16),
(8, 'Agua de horchata 1L', 'Arroz, canela y leche condensada', 'Bebidas', 35.00, 25, 'jarras', TRUE, 3),
(9, 'Agua de jamaica 1L', 'Infusión natural de flor de jamaica', 'Bebidas', 35.00, 22, 'jarras', TRUE, 3),
(10, 'Café de olla', 'Café de grano con canela y piloncillo', 'Bebidas', 25.00, 30, 'tazas', TRUE, 4),
(11, 'Arroz con leche', 'Postre casero con canela y pasas', 'Postres', 45.00, 15, 'porciones', TRUE, 5),
(12, 'Flan napolitano', 'Flan horneado con caramelo casero', 'Postres', 50.00, 10, 'porciones', TRUE, 5);

INSERT IGNORE INTO Inventario (Id_insumo, Nombre, Categoria_insumo, Cantidad, Cantidad_maxima, Unidad, Minimo_alerta) VALUES
(1, 'Chile verde', 'principal', 0.50, 10.00, 'kg', 2.00),
(2, 'Crema', 'principal', 1.00, 10.00, 'L', 2.50),
(3, 'Mole', 'principal', 3.00, 12.00, 'porc.', 4.00),
(4, 'Tortillas', 'principal', 2.00, 15.00, 'kg', 4.00),
(5, 'Pollo', 'principal', 8.00, 12.00, 'kg', 3.00),
(6, 'Res', 'principal', 6.00, 10.00, 'kg', 2.50),
(7, 'Tomate verde', 'principal', 4.00, 8.00, 'kg', 2.00),
(8, 'Cebolla blanca', 'principal', 5.00, 8.00, 'kg', 2.00),
(9, 'Queso Oaxaca', 'principal', 3.50, 6.00, 'kg', 1.50),
(10, 'Horchata', 'secundario', 12.00, 15.00, 'L', 4.00),
(11, 'Jamaica', 'secundario', 10.00, 15.00, 'L', 4.00),
(12, 'Aguacate', 'secundario', 0.40, 8.00, 'kg', 1.50),
(13, 'Aceite', 'secundario', 6.00, 10.00, 'L', 2.00);

INSERT IGNORE INTO Recetas_Platillo (Id_platillo, Id_insumo, Cantidad_requerida) VALUES
(1, 5, 0.200), (1, 1, 0.050), (1, 2, 0.050), (1, 4, 0.120),
(2, 5, 0.150), (2, 4, 0.080),
(3, 4, 0.150), (3, 9, 0.080),
(4, 6, 0.250), (4, 8, 0.050),
(5, 4, 0.150), (5, 2, 0.050), (5, 5, 0.150),
(6, 3, 1.000), (6, 5, 0.250),
(7, 1, 0.080), (7, 7, 0.150),
(8, 10, 1.000),
(9, 11, 1.000);
