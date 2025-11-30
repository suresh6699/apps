import api from './api';

const customerService = {
  // Get customers for a line and day
  getCustomers: async (lineId, day) => {
    const response = await api.get(`/api/customers/lines/${lineId}/days/${day}`);
    return response.data;
  },

  // Get single customer
  getCustomerById: async (customerId, lineId, day) => {
    const response = await api.get(`/api/customers/${customerId}?lineId=${lineId}&day=${day}`);
    return response.data;
  },

  // Get deleted customer by ID
  getDeletedCustomerById: async (customerId, lineId, timestamp) => {
    const url = timestamp 
      ? `/api/customers/${customerId}/deleted/lines/${lineId}?timestamp=${timestamp}`
      : `/api/customers/${customerId}/deleted/lines/${lineId}`;
    const response = await api.get(url);
    return response.data;
  },

  // Create customer
  createCustomer: async (lineId, day, customerData) => {
    const response = await api.post(`/api/customers/lines/${lineId}/days/${day}`, customerData);
    return response.data;
  },

  // Update customer
  updateCustomer: async (customerId, lineId, day, customerData) => {
    const response = await api.put(`/api/customers/${customerId}/lines/${lineId}/days/${day}`, customerData);
    return response.data;
  },

  // Delete customer
  deleteCustomer: async (customerId, lineId, day) => {
    const response = await api.delete(`/api/customers/${customerId}/lines/${lineId}/days/${day}`);
    return response.data;
  },

  // Restore customer
  restoreCustomer: async (customerId, lineId, restoreData) => {
    const response = await api.post(`/api/customers/${customerId}/restore/lines/${lineId}`, restoreData);
    return response.data;
  },

  // Create renewal
  createRenewal: async (customerId, lineId, day, renewalData) => {
    const response = await api.post(`/api/customers/${customerId}/renewals/lines/${lineId}/days/${day}`, renewalData);
    return response.data;
  },

  // Get customer chat
  getChat: async (customerId, lineId, day) => {
    const response = await api.get(`/api/customers/${customerId}/chat/lines/${lineId}/days/${day}`);
    return response.data;
  },

  // Add chat message
  addChatMessage: async (customerId, lineId, day, message) => {
    const response = await api.post(`/api/customers/${customerId}/chat/lines/${lineId}/days/${day}`, { message });
    return response.data;
  },

  // Get all pending customers for a line
  getPendingCustomers: async (lineId) => {
    const response = await api.get(`/api/customers/pending/lines/${lineId}`);
    return response.data;
  },

  // Get all deleted customers for a line
  getDeletedCustomers: async (lineId) => {
    const response = await api.get(`/api/customers/deleted/lines/${lineId}`);
    return response.data;
  },

  // Get next available customer ID
  getNextCustomerId: async (lineId, day) => {
    const response = await api.get(`/api/customers/next-id/lines/${lineId}/days/${day}`);
    return response.data;
  },

  // Get archived chat for deleted customer
  getDeletedCustomerChat: async (customerId, lineId, day, timestamp) => {
    const response = await api.get(`/api/customers/${customerId}/deleted-chat/lines/${lineId}?day=${day}&timestamp=${timestamp}`);
    return response.data;
  },
};

export default customerService;
