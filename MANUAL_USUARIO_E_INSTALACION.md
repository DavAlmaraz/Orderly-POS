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

### 1.3 Uso desde otra computadora o teléfono en el restaurante (Aplicación Móvil Nativa y Diseño Responsivo)
No es necesario instalar Node.js ni copiar el código en las demás computadoras, tabletas o teléfonos. Toda la interfaz cuenta con **diseño responsivo automático**: en pantallas de `900 px` o menores (teléfonos y tabletas verticales), la barra lateral se oculta automáticamente como menú deslizable activado desde el botón de menú (`≡`) superior, y los formularios, tarjetas y controles de cantidad/botones se reorganizan en columnas para evitar recortes o superposiciones.

1. En la pantalla de **Inicio de sesión** de Orderly (en la computadora principal o desde el panel interno **Configuración / Respaldos**), haga clic en **"Ver código QR móvil"**.
2. Conecte su teléfono o tableta a la **misma red Wi-Fi** que la computadora principal.
3. Escanee el **código QR** con la cámara del dispositivo móvil (o escriba en el navegador la dirección `http://<IP_LOCAL>:3000/login` indicada debajo del QR).
4. **Instalar como aplicación nativa (PWA)**:
   - **Android (Chrome)**: Toque el menú superior derecho (`⋮`) y seleccione **"Instalar aplicación"** o **"Agregar a la pantalla principal"**.
   - **iPhone / iPad (Safari)**: Toque el botón **Compartir** y seleccione **"Agregar a inicio"**.
   - A partir de ese momento Orderly aparecerá con su ícono propio en el teléfono y abrirá a pantalla completa sin barra de direcciones.

### 1.4 Configuración de Firewall, Redes en Otras Computadoras y Túneles (Presentación / Demostración)

Si va a presentar o ejecutar Orderly POS en **otra computadora** que tenga el Firewall de Windows activo o restricciones en la red local, utilice cualquiera de las siguientes opciones:

#### A. Cambiar perfil de red a Privada (Interfaz de Windows)
1. Al abrir **`Iniciar_Orderly_POS.bat`** por primera vez, si Windows muestra la alerta *"Firewall de Windows Defender bloqueó algunas características de esta aplicación"*, marque **Redes privadas** (y **Redes públicas** si presentará en Wi-Fi abierto) y haga clic en **Permitir acceso**.
2. En **Configuración de Windows → Red e Internet → Propiedades de su conexión (Wi-Fi o Ethernet)**, cambie el perfil de red de **Pública** a **Privada**.

#### B. Comandos para CMD (Símbolo del sistema como Administrador)
Abra el menú **Inicio**, escriba `cmd`, haga clic derecho sobre **Símbolo del sistema → Ejecutar como administrador** y ejecute:

```bat
REM 1. Permitir conexiones entrantes al puerto TCP 3000 en el Firewall de Windows
netsh advfirewall firewall add rule name="Orderly POS Puerto 3000" dir=in action=allow protocol=TCP localport=3000

REM 2. Verificar que el servidor esté activo y escuchando en el puerto 3000
netstat -ano | findstr ":3000 "

REM 3. Consultar las direcciones IPv4 activas de la computadora
ipconfig
```

*(Opcional al terminar la demostración en una PC prestada, para eliminar la regla creada):*
```bat
netsh advfirewall firewall delete rule name="Orderly POS Puerto 3000"
```

#### C. Comandos para PowerShell (como Administrador)
Abra **Inicio**, escriba `PowerShell`, haga clic derecho sobre **Windows PowerShell → Ejecutar como administrador** y ejecute:

```powershell
# 1. Cambiar todas las conexiones activas al perfil de Red Privada
Get-NetConnectionProfile | Set-NetConnectionProfile -NetworkCategory Private

# 2. Permitir el puerto TCP 3000 en el Firewall (entrada)
New-NetFirewallRule -DisplayName "Orderly POS Puerto 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Any

# 3. Ver las IPv4 activas (Ethernet / Wi-Fi / Zona móvil) y probar el puerto 3000
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' } | Select-Object InterfaceAlias, IPAddress
Test-NetConnection -ComputerName localhost -Port 3000
```

#### D. Cable Ethernet + Internet compartido (Hotspot) o redes con aislamiento entre equipos
1. **Doble conexión (Cable Ethernet + Wi-Fi compartido desde Windows):** Si la computadora recibe internet por cable y comparte red inalámbrica mediante *Zona con cobertura inalámbrica móvil*, el código QR principal prioriza la IP del cable Ethernet y muestra debajo las direcciones alternativas (la IP del Hotspot compartido en Windows suele ser `http://192.168.137.1:3000/login`).
2. **Redes escolares, empresariales o públicas (con *AP Isolation*):** Algunas redes bloquean la comunicación directa entre dos dispositivos conectados al mismo Wi-Fi. En ese caso:
   - **Opción 1 (Red local directa):** Active la **Zona con cobertura inalámbrica móvil** en Windows (o comparta internet desde un teléfono) y conecte ahí tanto la PC como los dispositivos de prueba.
   - **Opción 2 (Túnel temporal HTTPS):** Si la computadora tiene salida a internet, puede exponer el puerto `3000` mediante un túnel HTTPS temporal sin tocar el firewall ni la configuración del router (funciona directo en Android e iOS sin advertencias SSL):
     ```powershell
     # Con Cloudflare Quick Tunnel (si tiene cloudflared instalado)
     cloudflared tunnel --url http://localhost:3000

     # O con ngrok (si tiene cuenta/agente ngrok)
     ngrok http 3000

     # O sin instalación previa usando Node.js (localtunnel)
     npx localtunnel --port 3000
     ```

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
Diseñado en color azul pizarra (`#2B3A4A`) para computadoras, tablets y teléfonos móviles:
- **Mapa de mesas**: Muestra en tiempo real las 10 mesas con su estado (**Libre**, **Ocupada** o **Por cobrar**) y el total acumulado.
- **Nueva comanda y sugerencias dinámicas**:
  1. Seleccione una mesa libre e indique el número de comensales (límite máximo permitido: **12 personas por mesa**).
  2. Utilice la barra de **Sugerencias** en tiempo real (calculadas por el módulo de predicción de demanda según inventario, rotación y margen) para agregar platillos recomendados con un clic.
  3. Elija platillos por categoría; el sistema muestra el stock **libre real** en tiempo real (descontando desde el inicio lo ya comprometido en comandas activas de otras mesas pendientes en cocina) y bloquea cualquier platillo agotado o sin insumos suficientes.
  4. Puede agregar notas de cocina por platillo (ej. *sin cebolla*, *término medio*).
  5. Presione **Enviar comanda a cocina**; el stock de platillos y sus insumos vinculados se descuentan automáticamente y la comanda aparece al instante en la pantalla de Cocina.
- **Editar comanda activa**:
  - Agregue nuevos platillos (validando stock disponible en el momento; si la comanda ya estaba marcada como lista en cocina, vuelve a estado pendiente para preparar lo recién agregado), modifique cantidades o elimine artículos con el botón **Quitar** (regresando automáticamente el stock al inventario).
  - Transfiera la comanda a otra mesa disponible o cancele la orden indicando motivo si el cliente lo solicita.
- **Cobro, pago anticipado y división de cuentas**:
  - **Validación por estado en cocina**: Si la comanda sigue pendiente en cocina (aún no marcada como lista), el sistema advierte y bloquea el cobro estándar para evitar liquidar pedidos sin confirmar.
  - **Pago anticipado (clientes que pagan antes)**: Cuando un cliente solicita pagar por adelantado antes de que cocina termine su pedido, el botón **Cobrar anticipado** abre el modal donde debe marcarse explícitamente **"Confirmar pago anticipado del cliente"**. El pago se registra de inmediato y la comanda **permanece visible en Cocina** hasta estar lista; al entregarla, presione **Entregar y liberar mesa** (sin riesgo de doble cobro).
  - **Pago completo**: Seleccione método de pago (**Efectivo**, **Tarjeta de crédito/débito**, **Transferencia** o **Monedero electrónico**) y cierre la mesa.
  - **Separar por platillo**: Asigne artículos individuales a cada comensal y cobre cada subcuenta.
  - **Separar por monto**: Divida en pagos parciales; el sistema valida que la suma no supere el total de la cuenta.
  - **Separar por porcentaje**: Divida dinámicamente entre el total de comensales registrados en la mesa, validando que la suma no exceda el `100%`.

### 3.2 Módulo de Cocina (KDS)
Diseñado en color verde operativo (`#1F5C35` / `#4D7A5D`):
- **Comandas pendientes**: Lista cronológica en tiempo real con el tiempo de espera, mesera responsable, platillos y notas especiales de preparación (incluyendo órdenes pagadas anticipadamente hasta ser marcadas como listas).
- **Control por platillo**: Marque platillos individuales conforme avanzan en cocina y presione **Marcar comanda lista** al terminar para notificar al mesero mediante alerta emergente y notificación Push.
- **Tiempo extendido o platillo agotado**: Informe retrasos de `+10 min` o notifique cuando un producto se agote para actualizar automáticamente las pantallas de salón.
- **Platillos disponibles e inventario de cocina**: Habilite o deshabilite platillos del menú con un interruptor y consulte existencias de insumos en niveles **Óptimo**, **Bajo** o **Crítico**. Si algún insumo requerido por la receta de un platillo es insuficiente o crítico, el sistema deshabilita el platillo automáticamente y bloquea su reactivación hasta reabastecer el ingrediente.

### 3.3 Módulo de Administración
Diseñado en color naranja oscuro (`#6B3A07`):
- **Dashboard — Resumen del día y Predicción de demanda**: Monitoreo en tiempo real de ventas del día, mesas atendidas, tiempo promedio de servicio, alertas activas de inventario, gráfica de ventas por hora, platillos más vendidos, módulo de **Predicción de demanda y cobertura de inventario** (estimación de cierre, déficit proyectado y estado *Óptima* / *Ajustada* / *Reabastecer* / *Agotado*), últimas transacciones y **desempeño del personal** por turno.
- **Gestión del turno activo**: Haga clic en el botón **Editar** del turno activo en la barra superior para cambiar la modalidad (*Turno completo*, *Medio turno matutino/vespertino*), horario de inicio/fin y responsables asignados.
- **Catálogo de platillos y recetas**: Cree o edite platillos vinculando exactamente qué **insumos de inventario** y en qué cantidad se requieren por porción; al vender o cancelar un platillo el inventario de materia prima se actualiza de forma automática y no es posible activar ni crear un platillo con `Stock` activo si algún insumo de su receta es insuficiente o crítico.
- **Inventario y alertas en tiempo real**: Registre reabastecimientos o mermas; el sistema muestra alertas visuales y sonoras en tiempo real cuando un insumo entra en nivel bajo o crítico y permite abrir el directorio de **Proveedores** con marcación telefónica directa (`tel:`) en dispositivos móviles.
- **Reportes de ventas, modificación de pagos y Cierre de caja**: En **Reportes de ventas** filtre transacciones por método de pago o mesero, **modifique el método de pago** directamente en una transacción registrada cuando necesite corregir un cobro (quedando auditado en bitácora) y exporte a CSV; en **Cierre de caja** revise el resumen esperado y capture el conteo físico de efectivo para el arqueo final del turno.
- **Usuarios, contraseñas y panel técnico reservado**: Gestione cuentas activas y restablezca contraseñas desde **Usuarios y turnos**. Para mantener limpia la vista operativa, la sección técnica **Configuración / Respaldos** (conexión MySQL Server 9.4.0 / Workbench 8.0, respaldos firmados HMAC-SHA256 y QR de red local) permanece oculta en la barra lateral y se abre únicamente haciendo **doble clic** en la tarjeta de usuario en la parte inferior del menú lateral (o mediante `?sistema=1`).

---

## 4. Despliegue Gratuito en la Nube (Render — Sin Descargar Nada)

Para que sus compañeros o docentes prueben Orderly POS desde cualquier navegador o celular sin instalar programas ni configurar redes locales, el proyecto incluye el archivo **`render.yaml`** listo para **Render** (plan gratuito con **HTTPS automático**, WebSockets en tiempo real y compatibilidad completa para instalar la PWA en Android e iOS):

1. Cree una cuenta gratuita (no requiere tarjeta) en [render.com](https://render.com/) e inicie sesión con su cuenta de **GitHub**.
2. **Si usted no es el propietario del repositorio** (por ejemplo, se lo compartió un compañero): entre primero al repositorio en GitHub y haga clic en el botón **Fork** (esquina superior derecha) para guardar una copia en su propia cuenta.
3. En el panel de Render haga clic en **New + → Blueprint** (o **Web Service**), conecte su cuenta de GitHub y seleccione el repositorio **`Orderly-POS`** (propio o mediante su *Fork*).
4. Render detectará automáticamente **`render.yaml`**:
   - En **Blueprint Name**, escriba un nombre identificador (por ejemplo, `Orderly POS`).
   - Verifique que **Branch** esté en **`main`** (puede dejar el campo opcional vacío).
   - Presione **Deploy Blueprint** (Render compilará el frontend con `vite build` y arrancará el servidor unificado de `backend`).
5. Al terminar, Render le dará un enlace público seguro con **HTTPS** (por ejemplo `https://orderly-pos.onrender.com`) para compartirlo directamente o escanear su código QR desde cualquier teléfono.

> **Notas del plan gratuito de Render**:
> - Si pasan más de 15 minutos sin tráfico, el servicio gratuito entra en reposo y tarda entre 30 y 50 segundos en despertar al recibir la primera visita.
> - Si no conecta una base de datos MySQL externa en la nube, el sistema operará en modo resiliente en memoria y los datos de prueba volverán a su estado inicial cada vez que el servicio se reinicie.
