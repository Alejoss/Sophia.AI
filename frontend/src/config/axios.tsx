import axios from 'axios'


const clienteAxios= axios.create({
    baseURL:'http://127.0.0.1:8000/api',
});

export default clienteAxios;

// TODO todo debe estar en ingles. Y el orden de las carpetas no se entiende muy bien, hay un axios.ts en la carpeta api