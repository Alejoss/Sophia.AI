import React, { useEffect, useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormContext } from '../context/FormContext';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';

const acceptedFileTypes = {
  VIDEO: 'video/*',
  AUDIO: 'audio/*',
  TEXT: '.txt,.pdf,.doc,.docx',
  IMAGE: 'image/*'
};

// Add validation schema
const schema = yup.object().shape({
  file: yup
    .mixed()
    .required('File is required')
    .test('fileType', 'Invalid file type', function (value) {
      if (!value) return false;
      const fileType = value[0]?.type;
      const mediaType = this.parent.media_type;
      return acceptedFileTypes[mediaType]?.includes(fileType);
    }),
});

const CreateContentStepTwo = () => {
  const navigate = useNavigate();
  const { formMethods } = useContext(FormContext);
  const { register, handleSubmit, formState: { errors }, setValue } = formMethods;

  useEffect(() => {
    if (!formMethods.getValues('media_type')) {
      navigate('/create_content_step_one');
    }
  }, [navigate, formMethods]);

  const onSubmit = (data) => {
    navigate('/content/create_content_step_three');
  };

  const handleBack = () => {
    navigate('/content/create_content_step_one');
  };

  return (
    <div>
      <h1>Upload Your File</h1>
      <p>Expected file type: {formMethods.getValues('media_type')}</p>

      <form onSubmit={handleSubmit(onSubmit)}>
        <input
          type="file"
          accept={acceptedFileTypes[formMethods.getValues('media_type')] || '*/*'}
          {...register('file')}
        />
        {errors.file && <span>{errors.file.message}</span>}
        
        <button type="button" onClick={handleBack}>
          Back
        </button>

        <button type="submit">
          Next
        </button>
      </form>
    </div>
  );
};

export default CreateContentStepTwo;
