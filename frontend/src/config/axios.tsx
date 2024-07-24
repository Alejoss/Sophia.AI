import axios from 'axios'


const clienteAxios= axios.create({
    baseURL:'http://127.0.0.1:8000/api',
});

export default clienteAxios;