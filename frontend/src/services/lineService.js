import api from './api';

const lineService = {
  // Get all lines with BF
  getLines: async () => {
    const response = await api.get('/api/lines');
    return response.data;
  },

  // Get single line by ID
  getLineById: async (lineId) => {
    const response = await api.get(`/api/lines/${lineId}`);
    return response.data;
  },

  // Create new line
  createLine: async (lineData) => {
    const response = await api.post('/api/lines', lineData);
    return response.data;
  },

  // Update line
  updateLine: async (lineId, lineData) => {
    const response = await api.put(`/api/lines/${lineId}`, lineData);
    return response.data;
  },

  // Delete line
  deleteLine: async (lineId) => {
    const response = await api.delete(`/api/lines/${lineId}`);
    return response.data;
  },

  // Get days for a line
  getDays: async (lineId) => {
    const response = await api.get(`/api/days/lines/${lineId}`);
    return response.data;
  },

  // Create day for a line
  createDay: async (lineId, dayData) => {
    const response = await api.post(`/api/days/lines/${lineId}`, dayData);
    return response.data;
  },
};

export default lineService;
