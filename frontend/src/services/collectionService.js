import api from './api';

const collectionService = {
  // Get collections for a line with optional filters
  getCollections: async (lineId, filters = {}) => {
    const params = new URLSearchParams();
    
    if (filters.days) params.append('days', filters.days);
    if (filters.date) params.append('date', filters.date);
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.append('dateTo', filters.dateTo);
    
    const queryString = params.toString();
    const url = `/api/collections/lines/${lineId}${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get(url);
    return response.data;
  },
};

export default collectionService;
