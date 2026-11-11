const bcrypt = require('bcrypt');

// Generamos el hash para la contraseña "admin123" con 10 rondas de seguridad
bcrypt.hash('admin123', 10).then(hash => {
    console.log("Copia esta cadena larga:");
    console.log(hash);
});