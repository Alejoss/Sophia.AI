// src/context/FormContext.js
import React, { useState, useEffect, createContext } from 'react';

export const FormContext = createContext();

const FormProvider = ({ children }) => {
  const [formData, setFormData] = useState(() => {
    const localState = localStorage.getItem('form');
    return localState ? JSON.parse(localState) : {}; // Empty by default
  });

  useEffect(() => {
    localStorage.setItem('form', JSON.stringify(formData));
  }, [formData]);

  return (
    <FormContext.Provider value={{ formData, setFormData }}>
      {children}
    </FormContext.Provider>
  );
};

export default FormProvider;
