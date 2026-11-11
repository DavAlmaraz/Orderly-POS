# Orderly-POS — Sistema de Punto de Venta (Restaurante Dios Padre)

Sistema integral de Punto de Venta (POS) y Monitor de Cocina en Tiempo Real (KDS) desarrollado para el **Restaurante Dios Padre**.

**Autores:**
- Almaraz Remigio Jesús David
- Ortiz Tapia Abner

---

## Arquitectura y Tecnologías

- **Frontend (`/frontend`):** React 19 + Vite + React Router DOM + Axios + Socket.io-client.
  - Paleta de colores oficial por rol (`Orderlyv6.pdf`):
    - **Administrador (`#6B3A07`):** Dashboard gerencial, KPIs en vivo, gráficas de ventas por hora y platillos más vendidos, mapa de mesas, catálogo de platillos, inventario con alertas y directorio de proveedores, gestión de usuarios RBAC con `bcrypt`, corte de caja y respaldos automáticos.
    - **Cocina / KDS (`#1F5C35` / `#4D7A5D`):** Monitor de comandas pendientes en tiempo real (con persistencia ante recargas `F5`), alerta de notas de alergia, marcado de comandas listas o agotadas, notificación de tiempo extendido (`+10 min`), switches de disponibilidad de platillos e inventario de cocina.
    - **Mesera / Salón (`#2B3A4A`):** Mapa interactivo de 10 mesas (`Libre`, `Ocupada`, `Por cobrar`), toma de nueva comanda con filtros por categoría y buscador, gestión de comanda activa, transferencia de mesas y **Modal de Cobro y Separación de Cuentas** (cuenta única, por platillo, por porcentaje `%` o por monto `$`).
- **Backend (`/backend`):** Node.js + Express + Socket.io + MySQL (`mysql2/promise`) + Autenticación JWT (`jsonwebtoken`) + Encriptación `bcrypt` (10 rondas de salado) + Motor Resiliente ACID con respaldos automáticos en JSON.

---

## Credenciales de Acceso (Contraseña para todos: `admin123`)

| Rol | Usuario / Nombre | Contraseña | Ruta al iniciar sesión |
| :--- | :--- | :--- | :--- |
| **Administrador** | `J. David` (o `Jesus`) | `admin123` | `/admin` |
| **Mesera** | `Maria` | `admin123` | `/mesero` |
| **Cocina (KDS)** | `Roberto` | `admin123` | `/cocina` |
| **Mesera** | `Ana L.` | `admin123` | `/mesero` |

> **Soporte Multi-Pestaña:** La sesión se almacena por pestaña (`sessionStorage` sincronizado con `localStorage`), por lo que puedes abrir 3 pestañas en el mismo navegador (una como **Maria**, otra como **Roberto** y otra como **J. David**) sin que se sobrescriban los tokens ni ocurra el error `403 Forbidden`.

---

## Instrucciones de Ejecución

### 1. Base de Datos MySQL (Opcional — Incluye Motor Resiliente Automático)
Si deseas conectarlo a tu servidor MySQL local, ejecuta el script `backend/database.sql` en MySQL Workbench y configura tu contraseña en `backend/.env`. Si MySQL no está activo en el equipo, el backend activa automáticamente su motor espejo ACID con todos los datos semilla de `Orderlyv6.pdf`.

### 2. Iniciar el Servidor Backend (Puerto `3000`)
```bash
cd backend
npm install
node index.js
```

### 3. Iniciar la Aplicación Frontend (Puerto `5173`)
```bash
cd frontend
npm install
npm run dev
```
Finalmente, abre `http://localhost:5173` en tu navegador.
