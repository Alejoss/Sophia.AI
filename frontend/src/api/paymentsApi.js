import axiosInstance from './axiosConfig.js';

const throwApiError = (error, fallbackMessage) => {
  if (error.response?.data) {
    throw error.response.data;
  }
  throw new Error(fallbackMessage);
};

export const getPaymentGatewayStatus = async () => {
  try {
    const response = await axiosInstance.get('/payments/status/');
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo obtener el estado de la pasarela');
  }
};

export const createRegistrationPayment = async (registrationId) => {
  try {
    const response = await axiosInstance.post(`/payments/registration/${registrationId}/`, {});
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo crear el pago');
  }
};

export const getPaymentStatus = async (paymentId) => {
  try {
    const response = await axiosInstance.get(`/payments/${paymentId}/`);
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo consultar el pago');
  }
};

export const listRegistrationPayments = async (registrationId) => {
  try {
    const response = await axiosInstance.get(`/payments/registration/${registrationId}/list/`);
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo listar los pagos');
  }
};
