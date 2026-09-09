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
    throwApiError(error, 'No se pudo crear el pago. Inténtalo de nuevo');
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
    throwApiError(error, 'No se pudo crear el pago del camino. Inténtalo de nuevo');
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
    throwApiError(error, 'No se pudo crear el pago del anclaje. Inténtalo de nuevo');
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
    throwApiError(error, 'No se pudo crear la orden BCH. Inténtalo de nuevo');
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

export const verifyAnchorRequestBchPayment = async (requestId, txid) => {
  try {
    const response = await axiosInstance.post(
      `/payments/anchor-request/${requestId}/bch/verify/`,
      { txid },
    );
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo verificar el pago BCH. Inténtalo de nuevo');
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

export const getAdminBchOrders = async ({ status, limit } = {}) => {
  try {
    const params = {};
    if (status) params.status = status;
    if (limit != null) params.limit = limit;
    const response = await axiosInstance.get('/payments/admin/bch-orders/', { params });
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo cargar las órdenes BCH');
  }
};

export const confirmAdminBchOrder = async (orderId, txid) => {
  try {
    const response = await axiosInstance.post(
      `/payments/admin/bch-orders/${orderId}/confirm/`,
      { txid },
    );
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo confirmar el pago BCH. Inténtalo de nuevo');
  }
};

export const reportBchOrderTxid = async (orderId, { txid, note } = {}) => {
  try {
    const response = await axiosInstance.post(
      `/payments/bch-orders/${orderId}/report-txid/`,
      { txid, note: note || '' },
    );
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo registrar el TXID. Inténtalo de nuevo');
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
    throwApiError(error, 'No se pudo crear la orden BCH. Inténtalo de nuevo');
  }
};

export const verifyPathPurchaseBchPayment = async (purchaseId, txid) => {
  try {
    const response = await axiosInstance.post(
      `/payments/path-purchase/${purchaseId}/bch/verify/`,
      { txid },
    );
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo verificar el pago BCH. Inténtalo de nuevo');
  }
};

export const createTopicPurchaseBchPayment = async (purchaseId) => {
  try {
    const response = await axiosInstance.post(`/payments/topic-purchase/${purchaseId}/bch/`, {});
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo crear la orden BCH. Inténtalo de nuevo');
  }
};

export const verifyTopicPurchaseBchPayment = async (purchaseId, txid) => {
  try {
    const response = await axiosInstance.post(
      `/payments/topic-purchase/${purchaseId}/bch/verify/`,
      { txid },
    );
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo verificar el pago BCH. Inténtalo de nuevo');
  }
};

export const getTokenPackages = async () => {
  try {
    const response = await axiosInstance.get('/payments/token-packages/');
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudieron cargar los paquetes de tokens');
  }
};

export const listTokenPurchases = async () => {
  try {
    const response = await axiosInstance.get('/payments/token-purchases/');
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudieron cargar las compras de tokens');
  }
};

export const createTokenPurchase = async (packageId) => {
  try {
    const response = await axiosInstance.post('/payments/token-purchases/', { package_id: packageId });
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo iniciar la compra de tokens');
  }
};

export const createTokenPurchasePayment = async (purchaseId) => {
  try {
    const response = await axiosInstance.post(`/payments/token-purchase/${purchaseId}/`, {});
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo crear el pago de tokens');
  }
};

export const listTokenPurchasePayments = async (purchaseId) => {
  try {
    const response = await axiosInstance.get(`/payments/token-purchase/${purchaseId}/list/`);
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudieron listar los pagos de tokens');
  }
};

export const createTokenPurchaseBchPayment = async (purchaseId) => {
  try {
    const response = await axiosInstance.post(`/payments/token-purchase/${purchaseId}/bch/`, {});
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo crear la orden BCH. Inténtalo de nuevo');
  }
};

export const verifyTokenPurchaseBchPayment = async (purchaseId, txid) => {
  try {
    const response = await axiosInstance.post(
      `/payments/token-purchase/${purchaseId}/bch/verify/`,
      { txid },
    );
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo verificar el pago BCH. Inténtalo de nuevo');
  }
};
