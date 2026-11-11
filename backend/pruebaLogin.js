// pruebaLogin.js
fetch('http://localhost:3000/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Probamos iniciar sesión con la mesera que acabas de registrar
    body: JSON.stringify({ nombre: 'Roberto', contrasena: 'admin123' }) 
})
.then(res => res.json())
.then(data => {
    console.log("--- RESPUESTA DEL SERVIDOR ---");
    console.log(data);
    
    if(data.token) {
        console.log("\n¡ÉXITO! Aquí está tu JWT para la siguiente prueba:");
        console.log(data.token);
    }
})
.catch(err => console.error("Error en la petición:", err));