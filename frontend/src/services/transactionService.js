import api from './api';

const transactionService = {
  // Create transaction
  createTransaction: async (customerId, lineId, day, transactionData) => {
    const response = await api.post(`/api/transactions/customers/${customerId}/lines/${lineId}/days/${day}`, transactionData);
    return response.data;
  },

  // Update transaction
  updateTransaction: async (transactionId, customerId, lineId, day, transactionData) => {
    const response = await api.put(`/api/transactions/${transactionId}/customers/${customerId}/lines/${lineId}/days/${day}`, transactionData);
    return response.data;
  },

  // Delete transaction
  deleteTransaction: async (transactionId, customerId, lineId, day) => {
    const response = await api.delete(`/api/transactions/${transactionId}/customers/${customerId}/lines/${lineId}/days/${day}`);
    return response.data;
  },
};

export default transactionService;
