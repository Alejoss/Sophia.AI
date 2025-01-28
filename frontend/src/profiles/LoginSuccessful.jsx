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
      <h1>Login Successful</h1>
      {user && (
        <div>
          <p>Welcome back, {user.username}!</p>
        </div>
      )}
    </div>
  );
};

export default LoginSuccessful;
