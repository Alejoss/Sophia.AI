import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormContext } from '../context/FormContext';
import { useContext } from 'react';
import { createContentSchema } from "../context/formSchemas.js";
import { setFormType} from "../context/localStorageUtils.js";

const CreateContentStepOne = () => {
  const navigate = useNavigate();
  const { formData, setFormData } = useContext(FormContext);
  const [selected, setSelected] = useState(!!formData.media_type);

  // Initialize formData with schema if empty
  useEffect(() => {
    if (Object.keys(formData).length === 0) {
      setFormData(createContentSchema);
      setFormType("create_content");
    }
    else if (localStorage.getItem("form_type") !== "create_content") {
            // User stopped creating one form and started a new one.
            setFormData(createContentSchema);
            setFormType("create_content");
        }
        else {
            // User decided to continue filling the same form
            console.log("User continues to fill the create_content form")
        }
  }, []);

  const handleOptionChange = (event) => {
    setFormData((prev) => ({ ...prev, media_type: event.target.value }));
    setSelected(true);
  };

  const handleNext = () => {
    navigate('/content/create_content_step_two');
  };

  return (
    <div>
      <h1>Create Content</h1>
      <form>
        {["VIDEO", "AUDIO", "TEXT", "IMAGE"].map((option) => (
          <div key={option}>
            <label>
              <input
                type="radio"
                value={option}
                checked={formData.media_type === option}
                onChange={handleOptionChange}
              />
              {option}
            </label>
          </div>
        ))}
      </form>
      <button onClick={handleNext} disabled={!selected}>Next</button>
    </div>
  );
};

export default CreateContentStepOne;
