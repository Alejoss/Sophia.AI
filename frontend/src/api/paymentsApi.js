import axiosInstance from './axiosConfig.js';

export const getPaymentGatewayStatus = async () => {
  const response = await axiosInstance.get('/payments/status/');
  return response.data;
};

export const createRegistrationPayment = async (registrationId, payCurrency) => {
  const response = await axiosInstance.post(`/payments/registration/${registrationId}/`, {
    pay_currency: payCurrency,
  });
  return response.data;
};

export const getPaymentStatus = async (paymentId) => {
  const response = await axiosInstance.get(`/payments/${paymentId}/`);
  return response.data;
};

export const listRegistrationPayments = async (registrationId) => {
  const response = await axiosInstance.get(`/payments/registration/${registrationId}/list/`);
  return response.data;
};
