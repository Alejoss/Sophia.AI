import React, { useEffect, useState } from 'react';
import { getUserFromLocalStorage } from '../context/localStorageUtils.js';

const LoginSuccessful = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = getUserFromLocalStorage();
    if (storedUser) {
      setUser(storedUser);
    }
  }, []);

  return (
    <div>
      <h1>Inicio de sesión exitoso</h1>
      {user && (
        <div>
          <p>¡Bienvenido de nuevo, {user.username}!</p>
        </div>
      )}
    </div>
  );
};

export default LoginSuccessful;
