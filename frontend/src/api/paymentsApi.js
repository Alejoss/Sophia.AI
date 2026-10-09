import axiosInstance from './axiosConfig.js';

const throwApiError = (error, fallbackMessage) => {
  const data = error.response?.data;
  if (data && typeof data === 'object') {
    throw { ...data, status: error.response.status };
  }
  if (data) {
    throw { error: String(data), status: error.response.status };
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

export const getCourse = async (courseCode) => {
  try {
    const response = await axiosInstance.get(`/payments/courses/${courseCode}/`);
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo cargar el curso');
  }
};

export const createOrGetCoursePurchase = async (courseCode, { receiptEmail } = {}) => {
  try {
    const body = { course_code: courseCode };
    if (receiptEmail != null) {
      body.receipt_email = receiptEmail;
    }
    const response = await axiosInstance.post('/payments/course-purchases/', body);
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo iniciar la compra del curso');
  }
};

export const createCoursePurchasePayment = async (purchaseId) => {
  try {
    const response = await axiosInstance.post(`/payments/course-purchase/${purchaseId}/`, {});
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo crear el pago del curso. Inténtalo de nuevo');
  }
};

export const createCoursePurchaseBchPayment = async (purchaseId) => {
  try {
    const response = await axiosInstance.post(`/payments/course-purchase/${purchaseId}/bch/`, {});
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo crear la orden BCH. Inténtalo de nuevo');
  }
};

export const verifyCoursePurchaseBchPayment = async (purchaseId, txid) => {
  try {
    const body = txid ? { txid } : {};
    const response = await axiosInstance.post(
      `/payments/course-purchase/${purchaseId}/bch/verify/`,
      body,
    );
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo verificar el pago BCH. Inténtalo de nuevo');
  }
};

export const listCoursePurchasePayments = async (purchaseId) => {
  try {
    const response = await axiosInstance.get(`/payments/course-purchase/${purchaseId}/list/`);
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo listar los pagos del curso');
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

export const createTranscriptGenerationPayment = async (requestId) => {
  try {
    const response = await axiosInstance.post(`/payments/transcript-generation/${requestId}/`, {});
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo crear el pago de la transcripción. Inténtalo de nuevo');
  }
};

export const listTranscriptGenerationPayments = async (requestId) => {
  try {
    const response = await axiosInstance.get(`/payments/transcript-generation/${requestId}/list/`);
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo listar los pagos de la transcripción');
  }
};

export const createTranscriptGenerationBchPayment = async (requestId) => {
  try {
    const response = await axiosInstance.post(`/payments/transcript-generation/${requestId}/bch/`, {});
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo crear la orden BCH. Inténtalo de nuevo');
  }
};

export const verifyTranscriptGenerationBchPayment = async (requestId, txid) => {
  try {
    const body = txid ? { txid } : {};
    const response = await axiosInstance.post(
      `/payments/transcript-generation/${requestId}/bch/verify/`,
      body,
    );
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo verificar el pago BCH. Inténtalo de nuevo');
  }
};

export const payTranscriptGenerationWithTokens = async (requestId) => {
  try {
    const response = await axiosInstance.post(`/payments/transcript-generation/${requestId}/tokens/`, {});
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo pagar la transcripción con tokens. Inténtalo de nuevo');
  }
};

export const payAnchorRequestWithTokens = async (requestId) => {
  try {
    const response = await axiosInstance.post(`/payments/anchor-request/${requestId}/tokens/`, {});
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo pagar el anclaje con tokens. Inténtalo de nuevo');
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
    const body = txid ? { txid } : {};
    const response = await axiosInstance.post(
      `/payments/anchor-request/${requestId}/bch/verify/`,
      body,
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
    const body = txid ? { txid } : {};
    const response = await axiosInstance.post(
      `/payments/path-purchase/${purchaseId}/bch/verify/`,
      body,
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
    const body = txid ? { txid } : {};
    const response = await axiosInstance.post(
      `/payments/topic-purchase/${purchaseId}/bch/verify/`,
      body,
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

export const cancelTokenPurchase = async (purchaseId) => {
  try {
    const response = await axiosInstance.post(`/payments/token-purchase/${purchaseId}/cancel/`, {});
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo cancelar la orden de tokens');
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
    const body = txid ? { txid } : {};
    const response = await axiosInstance.post(
      `/payments/token-purchase/${purchaseId}/bch/verify/`,
      body,
    );
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo verificar el pago BCH. Inténtalo de nuevo');
  }
};

export const createPayphonePayment = async ({ kind, purchaseId }) => {
  try {
    const response = await axiosInstance.post('/payments/payphone/', {
      kind,
      purchaseId,
    });
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo iniciar el pago con tarjeta. Inténtalo de nuevo');
  }
};

export const getPayphonePayment = async (paymentId) => {
  try {
    const response = await axiosInstance.get(`/payments/payphone/${paymentId}/`);
    return response.data;
  } catch (error) {
    throwApiError(error, 'No se pudo obtener el estado del pago Payphone');
  }
};
