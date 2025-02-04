import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormContext } from '../context/FormContext';
import { useContext } from 'react';
import { createContentSchema } from "../context/formSchemas.js";
import { setFormType } from "../context/localStorageUtils.js";

const CreateContentStepOne = () => {
  const navigate = useNavigate();
  const { formMethods, storedFormType } = useContext(FormContext);
  const { register, handleSubmit, watch } = formMethods;

  // Initialize form with schema if needed
  useEffect(() => {
    if (!storedFormType || storedFormType !== "create_content") {
      formMethods.reset(createContentSchema);
      setFormType("create_content");
    }
  }, []);

  // Watch media_type to control button disabled state
  const mediaType = watch('media_type');

  const onSubmit = (data) => {
    navigate('/content/create_content_step_two');
  };

  return (
    <div>
      <h1>Create Content</h1>
      <form onSubmit={handleSubmit(onSubmit)}>
        {["VIDEO", "AUDIO", "TEXT", "IMAGE"].map((option) => (
          <div key={option}>
            <label>
              <input
                type="radio"
                value={option}
                {...register('media_type')}
              />
              {option}
            </label>
          </div>
        ))}
        <button type="submit" disabled={!mediaType}>Next</button>
      </form>
    </div>
  );
};

export default CreateContentStepOne;
