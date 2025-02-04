// src/context/FormContext.js
import React, { useEffect, createContext } from 'react';
import { useForm } from "react-hook-form";
import { getFormFromLocalStorage, setFormData } from "./localStorageUtils.js";

export const FormContext = createContext();

const FormProvider = ({ children }) => {

  // Load form state from localStorage
  const storedForm = getFormFromLocalStorage()
  const storedFromData = storedForm.formData
  const storedFormType = storedForm.formType

  const formMethods = useForm({
    defaultValues: storedFromData, // Load saved data
    });

  const saveFormData = (data) => {
    setFormData(data);
  }

  // Auto-save form data to localStorage on change
  useEffect(() => {
    const subscription = formMethods.watch((data) => {
      saveFormData(data);
    });

    return () => subscription.unsubscribe(); // Cleanup on unmount
  }, [formMethods.watch]);

  return (
    <FormContext.Provider value={{formMethods, storedFormType}}>
      {children}
    </FormContext.Provider>
  );
};

export default FormProvider;
