import api from './api';

const accountService = {
  // Get accounts for a line
  getAccounts: async (lineId) => {
    const response = await api.get(`/api/accounts/lines/${lineId}`);
    return response.data;
  },

  // Create account
  createAccount: async (lineId, accountData) => {
    const response = await api.post(`/api/accounts/lines/${lineId}`, accountData);
    return response.data;
  },

  // Update account
  updateAccount: async (accountId, lineId, accountData) => {
    const response = await api.put(`/api/accounts/${accountId}/lines/${lineId}`, accountData);
    return response.data;
  },

  // Delete account
  deleteAccount: async (accountId, lineId) => {
    const response = await api.delete(`/api/accounts/${accountId}/lines/${lineId}`);
    return response.data;
  },

  // Get account transactions
  getAccountTransactions: async (accountId, lineId) => {
    const response = await api.get(`/api/accounts/${accountId}/transactions/lines/${lineId}`);
    return response.data;
  },

  // Create account transaction
  createAccountTransaction: async (accountId, lineId, transactionData) => {
    const response = await api.post(`/api/accounts/${accountId}/transactions/lines/${lineId}`, transactionData);
    return response.data;
  },

  // Delete account transaction
  deleteAccountTransaction: async (accountId, transactionId, lineId) => {
    const response = await api.delete(`/api/accounts/${accountId}/transactions/${transactionId}/lines/${lineId}`);
    return response.data;
  },
};

export default accountService;
