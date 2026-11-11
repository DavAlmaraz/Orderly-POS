// Reemplaza esto con tu token real
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sIjoiY29jaW5hIiwiaWF0IjoxNzk0Mjg5MzY3LCJleHAiOjE3OTQzMTgxNjd9.EWwBrJrqxFL4oHV7Ozg8xw7E2RHsXl2Qii7JGGaYKa0";

fetch('http://localhost:3000/api/platillos', {
    method: 'GET',
    headers: { 
        'Authorization': 'Bearer ' + token 
    }
})
.then(res => {
    console.log("Código de estado HTTP:", res.status);
    return res.json();
})
.then(data => console.log("Respuesta del servidor:", data))
.catch(err => console.error("Error en la petición:", err));