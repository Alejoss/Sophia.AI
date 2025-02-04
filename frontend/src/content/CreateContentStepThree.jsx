import React, { useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormContext } from '../context/FormContext';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';

// Add validation schema
const schema = yup.object().shape({
  description: yup
    .string()
    .required('Description is required')
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must not exceed 500 characters'),
});

const CreateContentStepThree = () => {
  const navigate = useNavigate();
  const { formMethods } = useContext(FormContext);
  const { register, handleSubmit, formState: { errors } } = formMethods;

  useEffect(() => {
    // Check if previous steps are completed
    if (!formMethods.getValues('media_type') || !formMethods.getValues('file')) {
      navigate('/create_content_step_one');
    }
  }, [navigate, formMethods]);

  const onSubmit = (data) => {
    // Here you would typically handle the form submission
    // For now, we'll just log the form data
    console.log('Form submitted:', formMethods.getValues());
    // You could navigate to a success page or the content list
    navigate('/content');
  };

  const handleBack = () => {
    navigate('/content/create_content_step_two');
  };

  return (
    <div>
      <h1>Add Description</h1>
      <p>Please provide a description for your content</p>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div>
          <textarea
            {...register('description')}
            placeholder="Enter your description here..."
            rows={5}
            style={{ width: '100%', maxWidth: '500px' }}
          />
          {errors.description && (
            <span style={{ color: 'red' }}>{errors.description.message}</span>
          )}
        </div>

        <div style={{ marginTop: '20px' }}>
          <button type="button" onClick={handleBack}>
            Back
          </button>
          <button type="submit">
            Submit
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateContentStepThree; 