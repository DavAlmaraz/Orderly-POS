# Manual de Usuario e Instalación — Orderly POS

Sistema de Punto de Venta (POS) y Gestión Restaurantera para **Salón (Meseros)**, **Cocina (KDS)** y **Administración**.

---

## 1. Requisitos e Instalación en Cualquier Computadora

### 1.1 Requisitos mínimos
- **Sistema operativo**: Windows 10 o Windows 11 (64 bits).
- **Node.js**: Versión 20 o superior ([nodejs.org](https://nodejs.org/)).
- **Base de datos (opcional recomendada)**: MySQL Server 9.4.0 y MySQL Workbench 8.0. Si MySQL no está encendido al abrir el sistema, Orderly POS inicia automáticamente en modo resiliente en memoria sin interrumpir el servicio del restaurante.
- **Red local**: Computadora y dispositivos móviles conectados a la misma red Wi-Fi.

### 1.2 Instalación desde cero (primera vez en una computadora nueva)
1. Copie la carpeta completa **`Orderly-POS`** (o clone el repositorio con Git) en la computadora principal del restaurante (caja o administración).
2. Verifique que **Node.js** esté instalado abriendo una terminal y ejecutando:
   ```bash
   node -v
   ```
3. *(Opcional — Conexión a MySQL local)* Si desea almacenar los registros de manera persistente en MySQL:
   - Abra **MySQL Workbench 8.0** y verifique que su servidor MySQL local (puerto `3306`) esté activo.
   - Ejecute el script `backend/database.sql` o configure la conexión directamente desde el panel **Configuración / Respaldos** dentro de Orderly (el sistema creará y migrará automáticamente la base de datos `OrderlyDB`).
4. **Inicio en un clic**: haga doble clic en el archivo **`Iniciar_Orderly_POS.bat`** ubicado en la raíz de la carpeta `Orderly-POS`.
   - En la primera ejecución instalará dependencias y compilará automáticamente la interfaz si aún no existe.
   - Iniciará el servidor unificado en el puerto `3000`, mostrará la dirección de red local y abrirá **`http://localhost:3000/login`** en el navegador.
5. Para apagar el sistema al finalizar la jornada, haga doble clic en **`Detener_Orderly_POS.bat`**.

### 1.3 Uso desde otra computadora o teléfono en el restaurante (Aplicación Móvil Nativa)
No es necesario instalar Node.js ni copiar el código en las demás computadoras, tabletas o teléfonos:
1. En la pantalla de **Inicio de sesión** de Orderly (en la computadora principal o desde el panel **Administrador -> Configuración / Respaldos**), haga clic en **"Ver código QR móvil"**.
2. Conecte su teléfono o tableta a la **misma red Wi-Fi** que la computadora principal.
3. Escanee el **código QR** con la cámara del dispositivo móvil (o escriba en el navegador la dirección `http://<IP_LOCAL>:3000/login` indicada debajo del QR).
4. **Instalar como aplicación nativa (PWA)**:
   - **Android (Chrome)**: Toque el menú superior derecho (`⋮`) y seleccione **"Instalar aplicación"** o **"Agregar a la pantalla principal"**.
   - **iPhone / iPad (Safari)**: Toque el botón **Compartir** y seleccione **"Agregar a inicio"**.
   - A partir de ese momento Orderly aparecerá con su ícono propio en el teléfono y abrirá a pantalla completa sin barra de direcciones.

> **Nota sobre Firewall de Windows**: Si el teléfono no logra abrir la dirección del QR en el primer intento, permita el tráfico de Node.js en redes privadas desde *Seguridad de Windows -> Firewall y protección de red -> Permitir una aplicación a través de firewall* (puerto `3000`).

---

## 2. Acceso, Seguridad y Cierre de Sesión

### 2.1 Credenciales de inicio de sesión
Ingrese su **usuario** y **contraseña** asignados por el administrador. Por seguridad, las contraseñas se almacenan cifradas con `bcrypt` (12 rondas) y tras 5 intentos fallidos la cuenta se bloquea temporalmente durante 3 minutos.

| Área / Rol | Usuario de acceso | Contraseña inicial (cambiar en producción) |
| :--- | :--- | :--- |
| Administrador | `J. David` | `admin123` |
| Mesera (Salón) | `Maria` / `Ana L.` | `admin123` |
| Cocina (KDS) | `Roberto` | `admin123` |

> **Importante**: Se recomienda cambiar las contraseñas iniciales desde **Administrador -> Usuarios y turnos** antes de iniciar operación con clientes reales.

### 2.2 Protección al presionar el botón "Volver" (Atrás)
Por políticas estrictas de seguridad del punto de venta:
- Si un colaborador presiona el botón **Atrás / Volver** del navegador o del teléfono celular mientras se encuentra dentro de Salón, Cocina o Administración, la sesión se **cierra y revoca inmediatamente** y el sistema exige volver a iniciar sesión.
- Presionar **Atrás** o **Adelante** nuevamente nunca reabre una sesión cerrada ni permite ver pantallas operativas anteriores.
- Utilice siempre el menú lateral dentro de la aplicación para cambiar de pantalla sin perder su sesión.

---

## 3. Manual de Operación por Rol

### 3.1 Módulo de Meseros / Salón
Diseñado en color azul pizarra (`#2B3A4A`) para tablets y teléfonos móviles:
- **Mapa de mesas**: Muestra en tiempo real las 10 mesas con su estado (**Libre**, **Ocupada** o **Por cobrar**) y el total acumulado.
- **Nueva comanda**:
  1. Seleccione una mesa libre e indique el número de comensales (límite máximo permitido: **12 personas por mesa**).
  2. Elija platillos por categoría; el sistema muestra el stock disponible en tiempo real y bloquea cualquier platillo agotado.
  3. Puede agregar notas de cocina por platillo (ej. *sin cebolla*, *término medio*).
  4. Presione **Enviar a cocina**; el stock de platillos y sus insumos vinculados se descuentan automáticamente y la comanda aparece al instante en la pantalla de Cocina.
- **Editar comanda activa**:
  - Agregue nuevos platillos (validando stock disponible en el momento), modifique cantidades o elimine artículos (regresando automáticamente el stock al inventario).
  - Transfiera la comanda a otra mesa disponible o cancele la orden indicando motivo si el cliente lo solicita.
- **Cobro y división de cuentas**:
  - **Pago completo**: Seleccione método de pago (**Efectivo**, **Tarjeta débito/crédito** o **Transferencia**) y cierre la mesa.
  - **Separar por platillo**: Asigne artículos individuales a cada comensal y cobre cada subcuenta.
  - **Separar por monto**: Divida en pagos parciales; el sistema valida que la suma no supere el total de la cuenta.
  - **Separar por porcentaje**: Divida dinámicamente entre el total de comensales registrados en la mesa, validando que la suma no exceda el `100%`.

### 3.2 Módulo de Cocina (KDS)
Diseñado en color verde operativo (`#1F5C35` / `#4D7A5D`):
- **Comandas pendientes**: Lista cronológica en tiempo real con el tiempo de espera, mesera responsable, platillos y notas especiales de preparación.
- **Control por platillo**: Marque platillos individuales conforme avanzan en cocina y presione **Marcar comanda lista** al terminar para notificar al mesero mediante alerta emergente y notificación Push.
- **Tiempo extendido o platillo agotado**: Informe retrasos de `+10 min` o notifique cuando un producto se agote para actualizar automáticamente las pantallas de salón.
- **Platillos disponibles e inventario de cocina**: Habilite o deshabilite platillos del menú con un interruptor y consulte existencias de insumos en niveles **Óptimo**, **Bajo** o **Crítico**.

### 3.3 Módulo de Administración
Diseñado en color naranja oscuro (`#6B3A07`):
- **Dashboard — Resumen del día**: Monitoreo en tiempo real de ventas del día, mesas atendidas, tiempo promedio de servicio, alertas activas de inventario, gráfica de ventas por hora, platillos más vendidos, últimas transacciones y **desempeño del personal** por turno.
- **Gestión del turno activo**: Haga clic en la etiqueta **Editar** del turno activo en la barra superior para cambiar la modalidad (*Turno completo*, *Medio turno matutino/vespertino*), horario de inicio/fin y responsables asignados.
- **Catálogo de platillos y recetas**: Cree nuevos platillos vinculando exactamente qué **insumos de inventario** y en qué cantidad se requieren por porción; al vender o cancelar un platillo el inventario de materia prima se actualiza de forma automática.
- **Inventario y alertas Push**: Registre reabastecimientos o mermas. Active **Alertas Push** en la barra superior de cualquier dispositivo para recibir avisos visuales y sonoros cuando un insumo entre en nivel bajo o crítico.
- **Usuarios, contraseñas y respaldos**: Gestione cuentas activas, restablezca contraseñas, configure la conexión MySQL Server 9.4.0 / Workbench 8.0, genere respaldos firmados con HMAC-SHA256 y obtenga el código QR de acceso móvil.
