import { createContext, useState } from 'react';
// / TODO manejar esto con redux toolkit slice
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [username, setUsername] = useState('');

  return (
    <AuthContext.Provider value={{ username, setUsername }}>
      {children}
    </AuthContext.Provider>
  );
};

export { AuthContext, AuthProvider };