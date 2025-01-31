import React, { useEffect, useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormContext } from '../context/FormContext';

const acceptedFileTypes = {
  VIDEO: 'video/*',
  AUDIO: 'audio/*',
  TEXT: '.txt,.pdf,.doc,.docx',
  IMAGE: 'image/*'
};

const CreateContentStepTwo = () => {
  const navigate = useNavigate();
  const { formData, setFormData } = useContext(FormContext);
  const [file, setFile] = useState(null);

  useEffect(() => {
    if (!formData.media_type) {
      navigate('/create_content_step_one'); // Redirect if media type is not set
    }
  }, [formData.media_type, navigate]);

  const handleFileChange = (event) => {
    const uploadedFile = event.target.files[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setFormData((prev) => ({ ...prev, file: uploadedFile }));
    }
  };

  const handleNext = () => {
    navigate('/create_content_step_three');
  };

  const handleBack = () => {
    navigate('/create_content_step_one');
  }

  return (
      <div>
        <h1>Upload Your File</h1>
        <p>Expected file type: {formData.media_type}</p>

        <input
            type="file"
            accept={acceptedFileTypes[formData.media_type] || '*/*'}
            onChange={handleFileChange}
        />

        <button onClick={handleNext} disabled={!file}>
          Next
        </button>

        <button onClick={handleBack}>
          Back
        </button>
      </div>
  );
};

export default CreateContentStepTwo;
