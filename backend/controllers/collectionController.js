const fileManager = require('../services/fileManager');

/**
 * SIMPLIFIED COLLECTION CONTROLLER
 * 
 * Loads transactions for collection display
 * - Active customers: load from active files
 * - Deleted customers: load from archived files (for history display)
 * - NO chain walking, NO remainingAtDeletion logic
 */

class CollectionController {
  /**
   * Get collections with filters
   * Query params: days (comma-separated), date, dateFrom, dateTo
   */
  async getCollections(req, res, next) {
    try {
      const { lineId } = req.params;
      const { days, date, dateFrom, dateTo } = req.query;
      
      let selectedDays = [];
      if (days) {
        selectedDays = days.split(',');
      } else {
        selectedDays = fileManager.readJSON(`days/${lineId}.json`) || [];
      }
      
      let incomingTransactions = [];
      let goingTransactions = [];
      
      // Load transactions for selected days
      selectedDays.forEach(day => {
        // Load active customers
        const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
        const customerMap = new Map();
        
        customers.forEach(c => {
          const internalId = c.internalId || c.id;
          customerMap.set(internalId, c);
        });
        
        // Load incoming transactions from active customers
        const transFiles = fileManager.listFiles(`transactions/${lineId}/${day}`);
        transFiles.forEach(file => {
          const fileInternalId = file.replace('.json', '');
          const transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${file}`) || [];
          const customer = customerMap.get(fileInternalId);
          
          if (!customer) return; // Skip if customer not found
          
          transactions.forEach(trans => {
            incomingTransactions.push({
              ...trans,
              customerId: customer.id,
              customerName: trans.customerName || customer.name,
              day,
              type: trans.type || 'received',
              isDeleted: false
            });
          });
        });
        
        // Load chat transactions from active customers
        const chatFiles = fileManager.listFiles(`chat/${lineId}/${day}`);
        chatFiles.forEach(file => {
          const fileInternalId = file.replace('.json', '');
          const chatTransactions = fileManager.readJSON(`chat/${lineId}/${day}/${file}`) || [];
          const customer = customerMap.get(fileInternalId);
          
          if (!customer) return;
          
          chatTransactions.forEach(trans => {
            incomingTransactions.push({
              ...trans,
              customerId: customer.id,
              customerName: trans.customerName || customer.name,
              day,
              type: trans.type || 'received',
              isDeleted: false
            });
          });
        });
        
        // Load going transactions (customer creation - loans given out)
        customers.forEach(customer => {
          if (customer.takenAmount && customer.date) {
            goingTransactions.push({
              id: `customer_creation_${customer.id}`,
              customerId: customer.id,
              customerName: customer.name,
              amount: parseFloat(customer.takenAmount),
              date: customer.date,
              day,
              type: 'given',
              comment: 'Initial Loan',
              isDeleted: false
            });
          }
        });
        
        // Load renewals as going transactions
        customers.forEach(customer => {
          const internalId = customer.internalId || customer.id;
          const renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${internalId}.json`) || [];
          
          renewals.forEach(renewal => {
            goingTransactions.push({
              id: `renewal_${renewal.id}`,
              customerId: customer.id,
              customerName: customer.name,
              amount: parseFloat(renewal.takenAmount),
              date: renewal.date,
              day,
              type: 'given',
              comment: 'Renewal',
              isDeleted: false
            });
          });
        });
      });
      
      // Load archived transactions from deleted customers (for history)
      const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
      
      deletedCustomers.forEach(deletedCustomer => {
        if (!deletedCustomer || !deletedCustomer.deletionTimestamp) return;
        if (!selectedDays.includes(deletedCustomer.deletedFrom)) return;
        if (deletedCustomer.isRestored === true) return; // Skip restored (their data is in active files)
        
        const day = deletedCustomer.deletedFrom;
        const internalId = deletedCustomer.internalId || deletedCustomer.id;
        const timestamp = deletedCustomer.deletionTimestamp;
        
        // Load archived transactions
        const archivedTransactions = fileManager.readJSON(
          `transactions_deleted/${lineId}/${day}/${internalId}_${timestamp}.json`
        ) || [];
        
        archivedTransactions.forEach(trans => {
          incomingTransactions.push({
            ...trans,
            customerId: deletedCustomer.id,
            customerName: trans.customerName || deletedCustomer.name,
            day,
            type: trans.type || 'received',
            isDeleted: true,
            isArchived: true
          });
        });
        
        // Load archived chat
        const archivedChat = fileManager.readJSON(
          `chat_deleted/${lineId}/${day}/${internalId}_${timestamp}.json`
        ) || [];
        
        archivedChat.forEach(trans => {
          incomingTransactions.push({
            ...trans,
            customerId: deletedCustomer.id,
            customerName: trans.customerName || deletedCustomer.name,
            day,
            type: trans.type || 'received',
            isDeleted: true,
            isArchived: true
          });
        });
        
        // Load archived customer loan
        goingTransactions.push({
          id: `deleted_customer_${deletedCustomer.id}_${timestamp}`,
          customerId: deletedCustomer.id,
          customerName: deletedCustomer.name,
          amount: parseFloat(deletedCustomer.takenAmount),
          date: deletedCustomer.date,
          day,
          type: 'given',
          comment: 'Initial Loan (Deleted)',
          isDeleted: true,
          isArchived: true
        });
        
        // Load archived renewals
        const archivedRenewals = fileManager.readJSON(
          `renewals_deleted/${lineId}/${day}/${internalId}_${timestamp}.json`
        ) || [];
        
        archivedRenewals.forEach(renewal => {
          goingTransactions.push({
            id: `deleted_renewal_${renewal.id}_${timestamp}`,
            customerId: deletedCustomer.id,
            customerName: deletedCustomer.name,
            amount: parseFloat(renewal.takenAmount),
            date: renewal.date,
            day,
            type: 'given',
            comment: 'Renewal (Deleted)',
            isDeleted: true,
            isArchived: true
          });
        });
      });
      
      // Apply date filters
      if (date) {
        incomingTransactions = incomingTransactions.filter(t => t.date === date);
        goingTransactions = goingTransactions.filter(t => t.date === date);
      } else if (dateFrom || dateTo) {
        if (dateFrom) {
          incomingTransactions = incomingTransactions.filter(t => t.date >= dateFrom);
          goingTransactions = goingTransactions.filter(t => t.date >= dateFrom);
        }
        if (dateTo) {
          incomingTransactions = incomingTransactions.filter(t => t.date <= dateTo);
          goingTransactions = goingTransactions.filter(t => t.date <= dateTo);
        }
      }
      
      // Calculate totals
      const totalIncoming = incomingTransactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
      const totalGoing = goingTransactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
      const netBalance = totalIncoming - totalGoing;
      
      res.json({
        incoming: incomingTransactions,
        going: goingTransactions,
        summary: {
          totalIncoming,
          totalGoing,
          netBalance
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get deleted customer chat (for history display)
   */
  async getDeletedCustomerChat(req, res, next) {
    try {
      const { id, lineId } = req.params;
      const { deletionTimestamp, deletedFrom } = req.query;
      
      if (!deletionTimestamp || !deletedFrom) {
        return res.status(400).json({ 
          error: 'deletionTimestamp and deletedFrom are required' 
        });
      }
      
      const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
      const deletedCustomer = deletedCustomers.find(
        dc => dc.id === id && 
              dc.deletionTimestamp === parseInt(deletionTimestamp) &&
              dc.deletedFrom === deletedFrom
      );
      
      if (!deletedCustomer) {
        return res.status(404).json({ error: 'Deleted customer not found' });
      }
      
      const internalId = deletedCustomer.internalId || deletedCustomer.id;
      const timestamp = deletedCustomer.deletionTimestamp;
      const day = deletedCustomer.deletedFrom;
      
      // Load archived data
      const chat = fileManager.readJSON(
        `chat_deleted/${lineId}/${day}/${internalId}_${timestamp}.json`
      ) || [];
      
      const transactions = fileManager.readJSON(
        `transactions_deleted/${lineId}/${day}/${internalId}_${timestamp}.json`
      ) || [];
      
      const renewals = fileManager.readJSON(
        `renewals_deleted/${lineId}/${day}/${internalId}_${timestamp}.json`
      ) || [];
      
      res.json({
        chat,
        transactions,
        renewals,
        customer: deletedCustomer
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CollectionController();
