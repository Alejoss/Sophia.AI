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

export const createPathPurchasePayment = async (purchaseId) => {
  try {
    const response = await axiosInstance.post(`/payments/path-purchase/${purchaseId}/`, {});
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo crear el pago del camino');
  }
};

export const listPathPurchasePayments = async (purchaseId) => {
  try {
    const response = await axiosInstance.get(`/payments/path-purchase/${purchaseId}/list/`);
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo listar los pagos del camino');
  }
};

export const createAnchorRequestPayment = async (requestId) => {
  try {
    const response = await axiosInstance.post(`/payments/anchor-request/${requestId}/`, {});
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo crear el pago del anclaje');
  }
};

export const listAnchorRequestPayments = async (requestId) => {
  try {
    const response = await axiosInstance.get(`/payments/anchor-request/${requestId}/list/`);
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo listar los pagos del anclaje');
  }
};

export const createAnchorRequestBchPayment = async (requestId) => {
  try {
    const response = await axiosInstance.post(`/payments/anchor-request/${requestId}/bch/`, {});
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo crear la orden BCH');
  }
};

export const getAnchorRequestBchPayment = async (requestId) => {
  try {
    const response = await axiosInstance.get(`/payments/anchor-request/${requestId}/bch/`);
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo consultar la orden BCH');
  }
};

export const verifyAnchorRequestBchPayment = async (requestId) => {
  try {
    const response = await axiosInstance.post(`/payments/anchor-request/${requestId}/bch/verify/`, {});
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo verificar el pago BCH');
  }
};

export const getAdminBchCatalog = async () => {
  try {
    const response = await axiosInstance.get('/payments/admin/bch-catalog/');
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo cargar el catálogo BCH');
  }
};

export const updateKnowledgePathBch = async (pathId, payload) => {
  try {
    const response = await axiosInstance.patch(`/payments/admin/knowledge-paths/${pathId}/`, payload);
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo actualizar el camino');
  }
};

export const updateTopicBch = async (topicId, payload) => {
  try {
    const response = await axiosInstance.patch(`/payments/admin/topics/${topicId}/`, payload);
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo actualizar el tema');
  }
};

export const createPathPurchaseBchPayment = async (purchaseId) => {
  try {
    const response = await axiosInstance.post(`/payments/path-purchase/${purchaseId}/bch/`, {});
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo crear la orden BCH');
  }
};

export const verifyPathPurchaseBchPayment = async (purchaseId) => {
  try {
    const response = await axiosInstance.post(`/payments/path-purchase/${purchaseId}/bch/verify/`, {});
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo verificar el pago BCH');
  }
};

export const createTopicPurchaseBchPayment = async (purchaseId) => {
  try {
    const response = await axiosInstance.post(`/payments/topic-purchase/${purchaseId}/bch/`, {});
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo crear la orden BCH');
  }
};

export const verifyTopicPurchaseBchPayment = async (purchaseId) => {
  try {
    const response = await axiosInstance.post(`/payments/topic-purchase/${purchaseId}/bch/verify/`, {});
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo verificar el pago BCH');
  }
};
