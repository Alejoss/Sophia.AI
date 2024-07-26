import React, { useState, useEffect,useContext } from 'react';
import clienteAxios from '/src/api/axios.ts';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '/src/context/AuthContext.tsx'; // Importa el contexto


const Login = () =>{
    const navigate = useNavigate();
    const { username, setUsername } = useContext(AuthContext);
    const [auth, setAuth]=useState(false);


    useEffect(() => {
    const fetchProfileData = async () => {
      try {
        console.log('Fetching profile data');
        const { data } = await clienteAxios.get('/profiles');
        console.log(data[0].user.username);

      } catch (error) {
        console.error('Error al buscar perfiles:', error);
      }
    };

    fetchProfileData();
  }, []);
  const handleLogin = async () => {
    try {
      const response = await clienteAxios.get('/profiles');
      const profiles = response.data;

      const user = profiles.find(profile => profile.user.username === username);

      if (user) {
        setAuth(true);
        localStorage.setItem('userName', username);
        console.log('Sign in successfully:', user);
        navigate(`/courses/about`);
      } else {
        console.error('Sign in error: User not found');
      }
    } catch (error) {
      console.error('Sign in error:', error);
    }
  };


    return (

        <div>
            <h1> Login</h1>
            <form className="login-form">
                <div className="form-group">
                  <label htmlFor="email">Email:</label>
                  <input
                    type="email"
                    id="email"
                    value={username}
                    placeholder={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
        </div>
        <div className="form-actions">
          <button type="button" onClick={handleLogin}>Sign in</button>
        </div>

      </form>

        </div>


        );


    };


export default Login