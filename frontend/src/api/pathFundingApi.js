import axiosInstance from './axiosConfig';

const pathFundingApi = {
  listProposals: async ({ mine = false } = {}) => {
    const response = await axiosInstance.get('/knowledge_paths/proposals/', {
      params: mine ? { mine: '1' } : undefined,
    });
    return response.data;
  },

  getProposal: async (proposalId) => {
    const response = await axiosInstance.get(`/knowledge_paths/proposals/${proposalId}/`);
    return response.data;
  },

  getContract: async () => {
    const response = await axiosInstance.get('/knowledge_paths/proposals/contract/');
    return response.data;
  },

  getCampaign: async (proposalId) => {
    const response = await axiosInstance.get(`/knowledge_paths/proposals/${proposalId}/campaign/`);
    return response.data;
  },

  getUtxos: async (address) => {
    const response = await axiosInstance.get('/knowledge_paths/proposals/utxos/', {
      params: { address },
    });
    return response.data.utxos || [];
  },

  createProposal: async (payload) => {
    const response = await axiosInstance.post('/knowledge_paths/proposals/', payload);
    return response.data;
  },

  openProposal: async (proposalId, payload) => {
    const response = await axiosInstance.post(
      `/knowledge_paths/proposals/${proposalId}/open/`,
      payload,
    );
    return response.data;
  },

  recordPledge: async (proposalId, txid) => {
    const response = await axiosInstance.post(
      `/knowledge_paths/proposals/${proposalId}/pledges/`,
      { txid },
    );
    return response.data;
  },

  refundSpec: async (proposalId, pledgeId) => {
    const response = await axiosInstance.post(
      `/knowledge_paths/proposals/${proposalId}/refund/`,
      { pledge_id: pledgeId },
    );
    return response.data;
  },

  claimSpec: async (proposalId) => {
    const response = await axiosInstance.post(
      `/knowledge_paths/proposals/${proposalId}/claim/`,
      {},
    );
    return response.data;
  },
};

export default pathFundingApi;
