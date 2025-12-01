const fileManager = require('../services/fileManager');
const PDFDocument = require('pdfkit');

class PDFController {
  // Get customer transaction data for PDF generation
  async getCustomerTransactionData(req, res, next) {
    try {
      const { id, lineId, day } = req.params;
      
      // Get customer
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      const customer = customers.find(c => c.id === id);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      // Get line data
      const lines = fileManager.readJSON('lines.json') || [];
      const line = lines.find(l => l.id === lineId);
      
      // Use internalId for file operations
      const internalId = customer.internalId || customer.id;
      
      // Load all transactions, chat, and renewals from CURRENT day
      let transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
      let chatTransactions = fileManager.readJSON(`chat/${lineId}/${day}/${internalId}.json`) || [];
      let renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${internalId}.json`) || [];
      
      // Calculate total owed and paid - ONLY for current active loan
      let totalOwed = 0;
      let latestRenewalDate = null;
      let customerStartDate = null; // Track when current loan started
      const takenAmount = parseFloat(customer.takenAmount) || 0;
      
      // Check if there are renewals
      if (renewals.length > 0) {
        // Sort renewals by date to get the latest one
        const sortedRenewals = renewals
          .filter(r => !(r.isArchived && r.isSettled))
          .sort((a, b) => {
            const dateA = new Date(a.renewalDate || a.date).getTime();
            const dateB = new Date(b.renewalDate || b.date).getTime();
            return dateB - dateA;
          });
        
        if (sortedRenewals.length > 0) {
          const latestRenewal = sortedRenewals[0];
          totalOwed = parseFloat(latestRenewal.takenAmount) || 0;
          latestRenewalDate = new Date(latestRenewal.renewalDate || latestRenewal.date).getTime();
          customerStartDate = latestRenewalDate;
        }
      } else {
        // No renewals, use customer's original loan
        totalOwed = takenAmount;
        // For restored customers, use createdAt as the start date to exclude old transactions
        if (customer.isRestoredCustomer) {
          customerStartDate = new Date(customer.createdAt).getTime();
        }
      }
      
      // Calculate totalPaid: Only count payments made after the current loan started
      const allReceived = [...transactions, ...chatTransactions];
      const totalPaid = allReceived
        .filter(t => !(t.isArchived && t.isSettled))
        .reduce((sum, t) => {
          const paymentDate = new Date(t.createdAt || t.date).getTime();
          // If there's a renewal or customer start date, only count payments made after it
          if (customerStartDate && paymentDate < customerStartDate) {
            return sum; // Skip payments before current loan started
          }
          return sum + (parseFloat(t.amount) || 0);
        }, 0);
      
      const remainingAmount = totalOwed - totalPaid;
      
      // Prepare bank statement data - aggregate by date
      // Show COMPLETE TRANSACTION HISTORY (including restoration chain)
      const statementMap = new Map();
      
      // Add current customer creation (Taken)
      if (customer.date && takenAmount > 0) {
        statementMap.set(customer.date, {
          date: customer.date,
          taken: takenAmount,
          received: 0
        });
      }
      
      // IMPORTANT: If customer was restored, also add ALL previous taken amounts from the restoration chain
      // This shows complete transaction history in the statement
      if (customer.isRestoredCustomer && customer.restoredFromTimestamp) {
        const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
        
        // Trace back through the entire restoration chain
        let currentTimestamp = customer.restoredFromTimestamp;
        let currentId = customer.restoredFromId;
        const visitedTimestamps = new Set(); // Prevent infinite loops
        
        while (currentTimestamp && !visitedTimestamps.has(currentTimestamp)) {
          visitedTimestamps.add(currentTimestamp);
          
          // Find the deleted customer record
          const deletedCustomer = deletedCustomers.find(dc => 
            dc.deletionTimestamp === currentTimestamp &&
            dc.id === currentId &&
            dc.deletedFrom === day
          );
          
          if (deletedCustomer) {
            // Add this deleted customer's takenAmount to the statement
            if (deletedCustomer.date && deletedCustomer.takenAmount > 0) {
              const existing = statementMap.get(deletedCustomer.date) || { 
                date: deletedCustomer.date, 
                taken: 0, 
                received: 0 
              };
              existing.taken += parseFloat(deletedCustomer.takenAmount) || 0;
              statementMap.set(deletedCustomer.date, existing);
            }
            
            // Continue tracing if this deleted customer was also a restored customer
            if (deletedCustomer.wasRestoredCustomer && deletedCustomer.restoredFromTimestamp) {
              currentTimestamp = deletedCustomer.restoredFromTimestamp;
              currentId = deletedCustomer.restoredFromId;
            } else {
              break; // Reached the original customer
            }
          } else {
            break; // No more records found
          }
        }
      }
      
      // Add renewals (Taken) - aggregate same day renewals
      renewals.forEach(renewal => {
        if (renewal.date) {
          const existing = statementMap.get(renewal.date) || { date: renewal.date, taken: 0, received: 0 };
          existing.taken += parseFloat(renewal.takenAmount) || 0;
          statementMap.set(renewal.date, existing);
        }
      });
      
      // Add ALL received payments (complete history)
      allReceived.forEach(trans => {
        if (trans.date) {
          const existing = statementMap.get(trans.date) || { date: trans.date, taken: 0, received: 0 };
          existing.received += parseFloat(trans.amount) || 0;
          statementMap.set(trans.date, existing);
        }
      });
      
      // Convert to array and sort by date
      const statementData = Array.from(statementMap.values()).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
      );
      
      // Return data for frontend PDF generation
      res.json({
        customer,
        line,
        day,
        totals: {
          totalOwed,
          totalPaid,
          remainingAmount
        },
        statementData,
        // Include individual transaction details for printing
        transactions: transactions || [],
        chatTransactions: chatTransactions || [],
        renewals: renewals || []
      });
      
    } catch (error) {
      next(error);
    }
  }
  
  // Get collections data for PDF generation
  async getCollectionsData(req, res, next) {
    try {
      const { lineId } = req.params;
      const { days, dateFrom, dateTo } = req.query;
      
      // Get line data
      const lines = fileManager.readJSON('lines.json') || [];
      const line = lines.find(l => l.id === lineId);
      
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
        const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
        const customerMap = new Map();
        customers.forEach(c => {
          // Map by internalId (for file lookups) AND by id (for display)
          const internalId = c.internalId || c.id;
          customerMap.set(internalId, { ...c, day });
          customerMap.set(c.id, { ...c, day }); // Also keep id mapping
        });
        
        // Also load deleted customers
        const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
        deletedCustomers.forEach(dc => {
          if (dc.deletedFrom === day && dc.deletionTimestamp) {
            const internalId = dc.internalId || dc.id;
            const compoundKey = `${dc.id}_deleted_${dc.deletionTimestamp}`;
            customerMap.set(internalId, { ...dc, day, isDeleted: true });
            customerMap.set(compoundKey, { ...dc, day, isDeleted: true });
          }
        });
        
        // Load incoming transactions
        const transFiles = fileManager.listFiles(`transactions/${lineId}/${day}`);
        transFiles.forEach(file => {
          const fileInternalId = file.replace('.json', '');
          const transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${file}`) || [];
          const customer = customerMap.get(fileInternalId);
          
          // CRITICAL FIX: Use customer.id for display, not internalId from filename
          const displayCustomerId = customer ? customer.id : fileInternalId;
          
          transactions.forEach(trans => {
            incomingTransactions.push({
              ...trans,
              customerId: displayCustomerId,
              customerName: trans.customerName || (customer ? customer.name : `Customer ${displayCustomerId}`),
              day,
              isDeleted: customer?.isDeleted || false,
              customerDetails: customer || null
            });
          });
        });
        
        // Load chat transactions
        const chatFiles = fileManager.listFiles(`chat/${lineId}/${day}`);
        chatFiles.forEach(file => {
          const fileInternalId = file.replace('.json', '');
          const chatTransactions = fileManager.readJSON(`chat/${lineId}/${day}/${file}`) || [];
          const customer = customerMap.get(fileInternalId);
          
          // CRITICAL FIX: Use customer.id for display, not internalId from filename
          const displayCustomerId = customer ? customer.id : fileInternalId;
          
          chatTransactions.forEach(trans => {
            incomingTransactions.push({
              ...trans,
              customerId: displayCustomerId,
              customerName: trans.customerName || (customer ? customer.name : `Customer ${displayCustomerId}`),
              day,
              isDeleted: customer?.isDeleted || false,
              customerDetails: customer || null
            });
          });
        });
        
        // Load archived incoming transactions from deleted customers
        deletedCustomers.forEach(dc => {
          if (dc.deletedFrom === day && dc.deletionTimestamp) {
            const timestamp = dc.deletionTimestamp;
            
            // STEP 8 FIX: Load archived transactions using internalId (no timestamp suffix)
            const deletedInternalId = dc.internalId || dc.id;
            const archivedTrans = fileManager.readJSON(
              `transactions_deleted/${lineId}/${day}/${deletedInternalId}.json`
            ) || [];
            const archivedChat = fileManager.readJSON(
              `chat_deleted/${lineId}/${day}/${deletedInternalId}.json`
            ) || [];
            
            [...archivedTrans, ...archivedChat].forEach(trans => {
              incomingTransactions.push({
                ...trans,
                customerId: dc.id,
                customerName: trans.customerName || dc.name,
                day,
                isDeleted: true,
                customerDetails: dc
              });
            });
          }
        });
        
        // Load going transactions (customer creation)
        customers.forEach(customer => {
          if (customer.takenAmount && customer.date) {
            goingTransactions.push({
              id: `customer_creation_${day}_${customer.id}`,
              customerId: customer.id,
              customerName: customer.name,
              amount: parseFloat(customer.takenAmount),
              date: customer.date,
              type: 'customer_creation',
              comment: 'Customer Created',
              day,
              isDeleted: false,
              customerDetails: { ...customer, day }
            });
          }
        });
        
        // Load going transactions from deleted customers
        deletedCustomers.forEach(dc => {
          if (dc.deletedFrom === day && dc.takenAmount && dc.date) {
            goingTransactions.push({
              id: `customer_creation_deleted_${dc.id}_${dc.deletionTimestamp}`,
              customerId: dc.id,
              customerName: dc.name,
              amount: parseFloat(dc.takenAmount),
              date: dc.date,
              type: 'customer_creation',
              comment: 'Customer Created',
              day,
              isDeleted: true,
              customerDetails: dc
            });
          }
        });
        
        // Load renewals
        const renewalFiles = fileManager.listFiles(`renewals/${lineId}/${day}`);
        renewalFiles.forEach(file => {
          const fileInternalId = file.replace('.json', '');
          const renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${file}`) || [];
          const customer = customerMap.get(fileInternalId);
          
          // CRITICAL FIX: Use customer.id for display, not internalId from filename
          const displayCustomerId = customer ? customer.id : fileInternalId;
          
          renewals.forEach(renewal => {
            if (renewal.takenAmount && renewal.date) {
              goingTransactions.push({
                id: renewal.id || `renewal_${Date.now()}`,
                customerId: displayCustomerId,
                customerName: renewal.customerName || (customer ? customer.name : `Customer ${displayCustomerId}`),
                amount: parseFloat(renewal.takenAmount),
                date: renewal.date,
                type: 'renewal',
                comment: 'Renewal',
                day,
                isDeleted: customer?.isDeleted || false,
                customerDetails: customer || null
              });
            }
          });
        });
        
        // Load archived renewals from deleted customers
        deletedCustomers.forEach(dc => {
          if (dc.deletedFrom === day && dc.deletionTimestamp) {
            const archivedRenewals = fileManager.readJSON(
              `renewals_deleted/${lineId}/${day}/${dc.id}_${dc.deletionTimestamp}.json`
            ) || [];
            
            archivedRenewals.forEach(renewal => {
              if (renewal.takenAmount && renewal.date) {
                goingTransactions.push({
                  id: renewal.id || `renewal_archived_${Date.now()}`,
                  customerId: dc.id,
                  customerName: renewal.customerName || dc.name,
                  amount: parseFloat(renewal.takenAmount),
                  date: renewal.date,
                  type: 'renewal',
                  comment: 'Renewal',
                  day,
                  isDeleted: true,
                  customerDetails: dc
                });
              }
            });
          }
        });
      });
      
      // Filter by date range
      if (dateFrom && dateTo) {
        incomingTransactions = incomingTransactions.filter(t => t.date >= dateFrom && t.date <= dateTo);
        goingTransactions = goingTransactions.filter(t => t.date >= dateFrom && t.date <= dateTo);
      }
      
      // Sort by day order, then by date
      const dayOrder = selectedDays;
      incomingTransactions.sort((a, b) => {
        const dayDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
        if (dayDiff !== 0) return dayDiff;
        return new Date(b.date) - new Date(a.date);
      });
      
      goingTransactions.sort((a, b) => {
        const dayDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
        if (dayDiff !== 0) return dayDiff;
        return new Date(b.date) - new Date(a.date);
      });
      
      // Calculate totals
      const incomingTotal = incomingTransactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
      const goingTotal = goingTransactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
      const netFlow = incomingTotal - goingTotal;
      
      // Return data for frontend PDF generation
      res.json({
        line,
        selectedDays,
        incomingTransactions,
        goingTransactions,
        totals: {
          incoming: incomingTotal,
          going: goingTotal,
          netFlow
        },
        bfAmount: line?.currentBF || 0
      });
      
    } catch (error) {
      next(error);
    }
  }
  
  // Get customer summary data for PDF generation
  async getCustomerSummaryData(req, res, next) {
    try {
      const { lineId } = req.params;
      const { days, selectAllDays } = req.query;
      
      // Get line data
      const lines = fileManager.readJSON('lines.json') || [];
      const line = lines.find(l => l.id === lineId);
      
      let selectedDays = [];
      if (days) {
        selectedDays = days.split(',');
      } else {
        selectedDays = fileManager.readJSON(`days/${lineId}.json`) || [];
      }
      
      const isSelectAllDays = selectAllDays === 'true';
      
      const summaryData = [];
      
      for (const day of selectedDays) {
        const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
        const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
        
        const customersWithTotals = customers.map(customer => {
          // Use internalId for file operations
          const internalId = customer.internalId || customer.id;
          
          // Load transactions
          const transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
          const chatTransactions = fileManager.readJSON(`chat/${lineId}/${day}/${internalId}.json`) || [];
          const renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${internalId}.json`) || [];
          
          // Calculate total owed and paid - ONLY for current active loan
          // ALWAYS use customer's current takenAmount as the active loan
          let totalOwed = parseFloat(customer.takenAmount) || 0;
          let latestRenewalDate = null;
          let customerStartDate = null; // Track when current loan started
          const customerCreatedAt = customer.createdAt ? new Date(customer.createdAt).getTime() : null;
          
          // Check if there are renewals to determine the start date of current loan cycle
          if (renewals.length > 0) {
            // Sort renewals by date to get the latest one
            const sortedRenewals = renewals
              .filter(r => !(r.isArchived && r.isSettled))
              .sort((a, b) => {
                const dateA = new Date(a.renewalDate || a.date).getTime();
                const dateB = new Date(b.renewalDate || b.date).getTime();
                return dateB - dateA;
              });
            
            if (sortedRenewals.length > 0) {
              const latestRenewal = sortedRenewals[0];
              latestRenewalDate = new Date(latestRenewal.renewalDate || latestRenewal.date).getTime();
              
              // If customer was created AFTER the latest renewal, the current loan is NEW
              // Use customer's createdAt as the start date, not the renewal date
              if (customerCreatedAt && customerCreatedAt > latestRenewalDate) {
                customerStartDate = customerCreatedAt;
              } else {
                customerStartDate = latestRenewalDate;
              }
            }
          } else {
            // No renewals
            // For restored customers, use createdAt as the start date to exclude old transactions
            if (customer.isRestoredCustomer && customerCreatedAt) {
              customerStartDate = customerCreatedAt;
            }
          }
          
          // Calculate totalPaid: Only count payments made after the current loan started
          const totalPaid = [...transactions, ...chatTransactions]
            .filter(t => !(t.isArchived && t.isSettled))
            .reduce((sum, t) => {
              const paymentDate = new Date(t.createdAt || t.date).getTime();
              // If there's a renewal or customer start date, only count payments made after it
              if (customerStartDate && paymentDate < customerStartDate) {
                return sum; // Skip payments before current loan started
              }
              return sum + (parseFloat(t.amount) || 0);
            }, 0);
          
          const remainingAmount = totalOwed - totalPaid;
          
          return {
            id: customer.id,
            name: customer.name,
            day,
            totalOwed,
            totalPaid,
            remainingAmount
          };
        });
        
        summaryData.push({
          day,
          customers: customersWithTotals
        });
      }
      
      // Return data for frontend PDF generation
      res.json({
        line,
        selectedDays,
        isSelectAllDays,
        summaryData,
        bfAmount: line?.currentBF || 0
      });
      
    } catch (error) {
      next(error);
    }
  }

  // Legacy PDF generation methods (keeping for backward compatibility)
  // Generate customer transaction PDF
  async generateCustomerTransactionPDF(req, res, next) {
    try {
      const { id, lineId, day } = req.params;
      
      // Get customer
      const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
      const customer = customers.find(c => c.id === id);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      // Get line data
      const lines = fileManager.readJSON('lines.json') || [];
      const line = lines.find(l => l.id === lineId);
      
      // Use internalId for file operations
      const internalId = customer.internalId || customer.id;
      
      // Load all transactions, chat, and renewals from CURRENT day
      let transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
      let chatTransactions = fileManager.readJSON(`chat/${lineId}/${day}/${internalId}.json`) || [];
      let renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${internalId}.json`) || [];
      
      // Calculate total owed and paid - ONLY for current active loan
      let totalOwed = 0;
      let latestRenewalDate = null;
      let customerStartDate = null; // Track when current loan started
      const currentTakenAmount = parseFloat(customer.takenAmount) || 0;
      
      // Check if there are renewals
      if (renewals.length > 0) {
        // Sort renewals by date to get the latest one
        const sortedRenewals = renewals
          .filter(r => !(r.isArchived && r.isSettled))
          .sort((a, b) => {
            const dateA = new Date(a.renewalDate || a.date).getTime();
            const dateB = new Date(b.renewalDate || b.date).getTime();
            return dateB - dateA;
          });
        
        if (sortedRenewals.length > 0) {
          const latestRenewal = sortedRenewals[0];
          totalOwed = parseFloat(latestRenewal.takenAmount) || 0;
          latestRenewalDate = new Date(latestRenewal.renewalDate || latestRenewal.date).getTime();
          customerStartDate = latestRenewalDate;
        }
      } else {
        // No renewals, use customer's original loan
        totalOwed = currentTakenAmount;
        // For restored customers, use createdAt as the start date to exclude old transactions
        if (customer.isRestoredCustomer) {
          customerStartDate = new Date(customer.createdAt).getTime();
        }
      }
      
      // Calculate totalPaid: Only count payments made after the current loan started
      const allReceived = [...transactions, ...chatTransactions];
      const totalPaid = allReceived
        .filter(t => !(t.isArchived && t.isSettled))
        .reduce((sum, t) => {
          const paymentDate = new Date(t.createdAt || t.date).getTime();
          // If there's a renewal or customer start date, only count payments made after it
          if (customerStartDate && paymentDate < customerStartDate) {
            return sum; // Skip payments before current loan started
          }
          return sum + (parseFloat(t.amount) || 0);
        }, 0);
      
      const remainingAmount = totalOwed - totalPaid;
      
      // Prepare bank statement data - aggregate by date
      // Show COMPLETE TRANSACTION HISTORY (including restoration chain)
      const statementMap = new Map();
      
      // Add current customer creation (Taken)
      if (customer.date && currentTakenAmount > 0) {
        statementMap.set(customer.date, {
          date: customer.date,
          taken: currentTakenAmount,
          received: 0
        });
      }
      
      // Add previous loans from restoration chain to statement
      if (customer.isRestoredCustomer && customer.restoredFromTimestamp) {
        const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
        
        // Trace back through the entire restoration chain
        let currentTimestamp = customer.restoredFromTimestamp;
        let currentId = customer.restoredFromId;
        const visitedTimestamps = new Set(); // Prevent infinite loops
        
        while (currentTimestamp && !visitedTimestamps.has(currentTimestamp)) {
          visitedTimestamps.add(currentTimestamp);
          
          // Find the deleted customer record
          const deletedCustomer = deletedCustomers.find(dc => 
            dc.deletionTimestamp === currentTimestamp &&
            dc.id === currentId &&
            dc.deletedFrom === day
          );
          
          if (deletedCustomer) {
            // Add this deleted customer's takenAmount to the statement
            if (deletedCustomer.date && deletedCustomer.takenAmount > 0) {
              const existing = statementMap.get(deletedCustomer.date) || { 
                date: deletedCustomer.date, 
                taken: 0, 
                received: 0 
              };
              existing.taken += parseFloat(deletedCustomer.takenAmount) || 0;
              statementMap.set(deletedCustomer.date, existing);
            }
            
            // Continue tracing if this deleted customer was also a restored customer
            if (deletedCustomer.wasRestoredCustomer && deletedCustomer.restoredFromTimestamp) {
              currentTimestamp = deletedCustomer.restoredFromTimestamp;
              currentId = deletedCustomer.restoredFromId;
            } else {
              break; // Reached the original customer
            }
          } else {
            break; // No more records found
          }
        }
      }
      
      // Add renewals (Taken) - aggregate same day renewals
      renewals.forEach(renewal => {
        if (renewal.date) {
          const existing = statementMap.get(renewal.date) || { date: renewal.date, taken: 0, received: 0 };
          existing.taken += parseFloat(renewal.takenAmount) || 0;
          statementMap.set(renewal.date, existing);
        }
      });
      
      // Add ALL received payments (complete history)
      allReceived.forEach(trans => {
        if (trans.date) {
          const existing = statementMap.get(trans.date) || { date: trans.date, taken: 0, received: 0 };
          existing.received += parseFloat(trans.amount) || 0;
          statementMap.set(trans.date, existing);
        }
      });
      
      // Convert to array and sort by date
      const statementData = Array.from(statementMap.values()).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
      );
      
      // Generate PDF using PDFKit
      const doc = new PDFDocument({ margin: 50 });
      
      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Customer_${customer.id}_${customer.name}_Transactions.pdf`);
      
      // Pipe PDF to response
      doc.pipe(res);
      
      // Add content
      doc.fontSize(20).text('CUSTOMER TRANSACTIONS', { align: 'center' });
      doc.moveDown();
      
      // Customer details
      doc.fontSize(12);
      doc.text(`Line: ${line?.name || 'Unknown'}`);
      doc.text(`Day: ${day}`);
      doc.text(`Customer ID: ${customer.id}`);
      doc.text(`Name: ${customer.name}`);
      doc.text(`Village: ${customer.village || 'N/A'}`);
      doc.text(`Phone: ${customer.phone || 'N/A'}`);
      doc.moveDown();
      
      // Summary
      doc.fontSize(14).text('Summary:', { underline: true });
      doc.fontSize(12);
      doc.text(`Total Owed: ₹${totalOwed.toFixed(2)}`);
      doc.text(`Total Paid: ₹${totalPaid.toFixed(2)}`);
      doc.text(`Remaining: ₹${remainingAmount.toFixed(2)}`);
      doc.moveDown();
      
      // Transactions table
      if (statementData.length > 0) {
        doc.fontSize(14).text('Transaction Statement:', { underline: true });
        doc.fontSize(10);
        doc.moveDown(0.5);
        
        // Table headers
        const tableTop = doc.y;
        const col1X = 50;
        const col2X = 200;
        const col3X = 350;
        
        doc.text('Date', col1X, tableTop);
        doc.text('Taken', col2X, tableTop);
        doc.text('Received', col3X, tableTop);
        
        doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).stroke();
        doc.moveDown();
        
        // Table rows
        statementData.forEach(row => {
          const currentY = doc.y;
          doc.text(row.date, col1X, currentY);
          doc.text(row.taken > 0 ? `₹${row.taken.toFixed(2)}` : '-', col2X, currentY);
          doc.text(row.received > 0 ? `₹${row.received.toFixed(2)}` : '-', col3X, currentY);
          doc.moveDown(0.8);
        });
      }
      
      // Finalize PDF
      doc.end();
      
    } catch (error) {
      next(error);
    }
  }
  
  // Generate collections PDF
  async generateCollectionsPDF(req, res, next) {
    try {
      const { lineId } = req.params;
      const { days, dateFrom, dateTo } = req.query;
      
      // Get line data
      const lines = fileManager.readJSON('lines.json') || [];
      const line = lines.find(l => l.id === lineId);
      
      let selectedDays = [];
      if (days) {
        selectedDays = days.split(',');
      } else {
        selectedDays = fileManager.readJSON(`days/${lineId}.json`) || [];
      }
      
      let incomingTransactions = [];
      let goingTransactions = [];
      
      // Load transactions for selected days (using same logic as collection controller)
      selectedDays.forEach(day => {
        const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
        const customerMap = new Map();
        customers.forEach(c => {
          // Map by internalId (for file lookups) AND by id (for display)
          const internalId = c.internalId || c.id;
          customerMap.set(internalId, c);
          customerMap.set(c.id, c); // Also keep id mapping
        });
        
        // Load incoming transactions
        const transFiles = fileManager.listFiles(`transactions/${lineId}/${day}`);
        transFiles.forEach(file => {
          const fileInternalId = file.replace('.json', '');
          const transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${file}`) || [];
          const customer = customerMap.get(fileInternalId);
          
          // CRITICAL FIX: Use customer.id for display, not internalId from filename
          const displayCustomerId = customer ? customer.id : fileInternalId;
          
          transactions.forEach(trans => {
            incomingTransactions.push({
              ...trans,
              customerId: displayCustomerId,
              customerName: trans.customerName || (customer ? customer.name : `Customer ${displayCustomerId}`),
              day
            });
          });
        });
        
        // Load chat transactions
        const chatFiles = fileManager.listFiles(`chat/${lineId}/${day}`);
        chatFiles.forEach(file => {
          const fileInternalId = file.replace('.json', '');
          const chatTransactions = fileManager.readJSON(`chat/${lineId}/${day}/${file}`) || [];
          const customer = customerMap.get(fileInternalId);
          
          // CRITICAL FIX: Use customer.id for display, not internalId from filename
          const displayCustomerId = customer ? customer.id : fileInternalId;
          
          chatTransactions.forEach(trans => {
            incomingTransactions.push({
              ...trans,
              customerId: displayCustomerId,
              customerName: trans.customerName || (customer ? customer.name : `Customer ${displayCustomerId}`),
              day
            });
          });
        });
        
        // Load going transactions (customer creation)
        customers.forEach(customer => {
          if (customer.takenAmount && customer.date) {
            goingTransactions.push({
              customerId: customer.id,
              customerName: customer.name,
              amount: parseFloat(customer.takenAmount),
              date: customer.date,
              type: 'customer_creation',
              day
            });
          }
        });
        
        // Load renewals
        const renewalFiles = fileManager.listFiles(`renewals/${lineId}/${day}`);
        renewalFiles.forEach(file => {
          const fileInternalId = file.replace('.json', '');
          const renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${file}`) || [];
          const customer = customerMap.get(fileInternalId);
          
          // CRITICAL FIX: Use customer.id for display, not internalId from filename
          const displayCustomerId = customer ? customer.id : fileInternalId;
          
          renewals.forEach(renewal => {
            if (renewal.takenAmount && renewal.date) {
              goingTransactions.push({
                customerId: displayCustomerId,
                customerName: renewal.customerName || (customer ? customer.name : `Customer ${displayCustomerId}`),
                amount: parseFloat(renewal.takenAmount),
                date: renewal.date,
                type: 'renewal',
                day
              });
            }
          });
        });
      });
      
      // Filter by date range
      if (dateFrom && dateTo) {
        incomingTransactions = incomingTransactions.filter(t => t.date >= dateFrom && t.date <= dateTo);
        goingTransactions = goingTransactions.filter(t => t.date >= dateFrom && t.date <= dateTo);
      }
      
      // Calculate totals
      const incomingTotal = incomingTransactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
      const goingTotal = goingTransactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
      const netFlow = incomingTotal - goingTotal;
      
      // Generate PDF using PDFKit
      const doc = new PDFDocument({ margin: 50 });
      
      // Set response headers
      const fileName = `Collections_${line?.name || 'Statement'}_${dateFrom || 'all'}_${dateTo || 'all'}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
      
      // Pipe PDF to response
      doc.pipe(res);
      
      // Add content
      doc.fontSize(20).text('COLLECTIONS STATEMENT', { align: 'center' });
      doc.moveDown();
      
      // Header info
      doc.fontSize(12);
      doc.text(`Line: ${line?.name || 'Unknown'}`);
      doc.text(`Days: ${selectedDays.join(', ')}`);
      if (dateFrom && dateTo) {
        doc.text(`Period: ${dateFrom} to ${dateTo}`);
      }
      doc.text(`Generated: ${new Date().toLocaleString()}`);
      doc.moveDown();
      
      // Summary
      doc.fontSize(14).text('Summary:', { underline: true });
      doc.fontSize(12);
      doc.text(`Incoming: ₹${incomingTotal.toFixed(2)}`);
      doc.text(`Going: ₹${goingTotal.toFixed(2)}`);
      doc.text(`Net Flow: ₹${netFlow.toFixed(2)}`);
      doc.moveDown();
      
      // Going transactions
      if (goingTransactions.length > 0) {
        doc.fontSize(14).text('Going Transactions:', { underline: true });
        doc.fontSize(10);
        goingTransactions.forEach(trans => {
          const amount = parseFloat(trans.amount) || 0;
          doc.text(`${trans.date} - ${trans.customerName} (${trans.customerId}) - ₹${amount.toFixed(2)} [${trans.type}]`);
        });
        doc.moveDown();
      }
      
      // Incoming transactions
      if (incomingTransactions.length > 0) {
        doc.fontSize(14).text('Incoming Transactions:', { underline: true });
        doc.fontSize(10);
        incomingTransactions.forEach(trans => {
          const amount = parseFloat(trans.amount) || 0;
          doc.text(`${trans.date} - ${trans.customerName} (${trans.customerId}) - ₹${amount.toFixed(2)}`);
        });
      }
      
      // Finalize PDF
      doc.end();
      
    } catch (error) {
      next(error);
    }
  }

  // Generate customer summary PDF
  async generateCustomerSummaryPDF(req, res, next) {
    try {
      const { lineId } = req.params;
      const { days, selectAllDays } = req.query;
      
      // Get line data
      const lines = fileManager.readJSON('lines.json') || [];
      const line = lines.find(l => l.id === lineId);
      
      let selectedDays = [];
      if (days) {
        selectedDays = days.split(',');
      } else {
        selectedDays = fileManager.readJSON(`days/${lineId}.json`) || [];
      }
      
      const isSelectAllDays = selectAllDays === 'true';
      
      // Generate PDF using PDFKit
      const doc = new PDFDocument({ margin: 50 });
      
      // Set response headers
      const fileName = `Customer_Summary_${line?.name || 'Report'}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
      
      // Pipe PDF to response
      doc.pipe(res);
      
      // Header
      doc.fillColor('#3B82F6').rect(0, 0, 612, 80).fill();
      
      doc.fontSize(24).fillColor('#FFFFFF').font('Helvetica-Bold')
        .text('CUSTOMER SUMMARY', 0, 30, { align: 'center' });
      
      doc.moveTo(100, 60).lineTo(512, 60).strokeColor('#FFFFFF').lineWidth(2).stroke();
      
      // Line and BF info boxes
      doc.fontSize(10).font('Helvetica-Bold');
      doc.fillColor('#FFFFFF').roundedRect(50, 65, 200, 25, 3).fill();
      doc.fillColor('#FFFFFF').roundedRect(300, 65, 200, 25, 3).fill();
      
      doc.fillColor('#3B82F6')
        .text(`Line: ${line?.name || 'Unknown'}`, 50, 73, { width: 200, align: 'center' });
      
      const dayText = isSelectAllDays 
        ? `BF: Rs.${line?.currentBF?.toFixed(2) || '0.00'}` 
        : selectedDays.join(', ');
      doc.text(dayText, 300, 73, { width: 200, align: 'center' });
      
      let yPos = 110;
      
      // If all days selected, group by day
      if (isSelectAllDays) {
        for (const day of selectedDays) {
          const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
          const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
          
          if (customers.length === 0) continue;
          
          // Calculate totals for each customer
          const customersWithTotals = customers.map(customer => {
            // Use internalId for file operations
            const internalId = customer.internalId || customer.id;
            
            // Load transactions
            const transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
            const chatTransactions = fileManager.readJSON(`chat/${lineId}/${day}/${internalId}.json`) || [];
            const renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${internalId}.json`) || [];
            
            // Calculate total owed and paid - ONLY for current active loan
            // ALWAYS use customer's current takenAmount as the active loan
            let totalOwed = parseFloat(customer.takenAmount) || 0;
            let latestRenewalDate = null;
            let customerStartDate = null;
            const customerCreatedAt = customer.createdAt ? new Date(customer.createdAt).getTime() : null;
            
            // Check if there are renewals to determine start date of current loan cycle
            if (renewals.length > 0) {
              // Sort renewals by date to get the latest one
              const sortedRenewals = renewals
                .filter(r => !(r.isArchived && r.isSettled))
                .sort((a, b) => {
                  const dateA = new Date(a.renewalDate || a.date).getTime();
                  const dateB = new Date(b.renewalDate || b.date).getTime();
                  return dateB - dateA;
                });
              
              if (sortedRenewals.length > 0) {
                const latestRenewal = sortedRenewals[0];
                latestRenewalDate = new Date(latestRenewal.renewalDate || latestRenewal.date).getTime();
                
                // If customer was created AFTER the latest renewal, the current loan is NEW
                // Use customer's createdAt as the start date, not the renewal date
                if (customerCreatedAt && customerCreatedAt > latestRenewalDate) {
                  customerStartDate = customerCreatedAt;
                } else {
                  customerStartDate = latestRenewalDate;
                }
              }
            } else {
              // No renewals
              // For restored customers, use createdAt as the start date to exclude old transactions
              if (customer.isRestoredCustomer && customerCreatedAt) {
                customerStartDate = customerCreatedAt;
              }
            }
            
            // Calculate totalPaid: Only count payments made after latest renewal (if exists)
            const totalPaid = [...transactions, ...chatTransactions]
              .filter(t => !(t.isArchived && t.isSettled))
              .reduce((sum, t) => {
                const paymentDate = new Date(t.createdAt || t.date).getTime();
                // If there's a renewal or customer start date, only count payments made after it
                if (customerStartDate && paymentDate < customerStartDate) {
                  return sum; // Skip payments before current loan started
                }
                return sum + (parseFloat(t.amount) || 0);
              }, 0);
            
            const remainingAmount = totalOwed - totalPaid;
            
            return {
              id: customer.id,
              name: customer.name,
              totalOwed,
              totalPaid,
              remainingAmount
            };
          });
          
          // Day heading
          doc.font('Helvetica-Bold').fontSize(14).fillColor('#DC2626')
            .text(day, 50, yPos);
          yPos += 20;
          
          // Table header
          doc.fontSize(10).fillColor('#FFFFFF');
          doc.fillColor('#3B82F6').rect(50, yPos, 512, 25).fill();
          
          doc.fillColor('#FFFFFF').font('Helvetica-Bold')
            .text('ID', 60, yPos + 8, { width: 80, align: 'center' })
            .text('Name', 150, yPos + 8, { width: 150, align: 'left' })
            .text('Owed', 310, yPos + 8, { width: 80, align: 'right' })
            .text('Paid', 400, yPos + 8, { width: 80, align: 'right' })
            .text('Remaining', 490, yPos + 8, { width: 70, align: 'right' });
          
          yPos += 25;
          
          // Table rows
          doc.font('Helvetica').fontSize(9);
          customersWithTotals.forEach((customer, index) => {
            const bgColor = index % 2 === 0 ? '#F5F7FA' : '#FFFFFF';
            doc.fillColor(bgColor).rect(50, yPos, 512, 20).fill();
            
            doc.fillColor('#000000')
              .text(customer.id, 60, yPos + 5, { width: 80, align: 'center' })
              .text(customer.name, 150, yPos + 5, { width: 150, align: 'left' });
            
            doc.fillColor('#3B82F6')
              .text(`Rs.${customer.totalOwed.toFixed(2)}`, 310, yPos + 5, { width: 80, align: 'right' });
            
            doc.fillColor('#16A34A')
              .text(`Rs.${customer.totalPaid.toFixed(2)}`, 400, yPos + 5, { width: 80, align: 'right' });
            
            doc.fillColor('#DC2626')
              .text(`Rs.${customer.remainingAmount.toFixed(2)}`, 490, yPos + 5, { width: 70, align: 'right' });
            
            yPos += 20;
            
            // Add new page if needed
            if (yPos > 720) {
              doc.addPage();
              yPos = 50;
            }
          });
          
          yPos += 10;
        }
      } else {
        // Selected specific days - show all in one table with Day column
        const allCustomersData = [];
        
        for (const day of selectedDays) {
          const customers = fileManager.readJSON(`customers/${lineId}/${day}.json`) || [];
          const deletedCustomers = fileManager.readJSON(`deleted_customers/${lineId}.json`) || [];
          
          customers.forEach(customer => {
            // Use internalId for file operations
            const internalId = customer.internalId || customer.id;
            
            // Calculate totals
            const transactions = fileManager.readJSON(`transactions/${lineId}/${day}/${internalId}.json`) || [];
            const chatTransactions = fileManager.readJSON(`chat/${lineId}/${day}/${internalId}.json`) || [];
            const renewals = fileManager.readJSON(`renewals/${lineId}/${day}/${internalId}.json`) || [];
            
            // Calculate total owed and paid - ONLY for current active loan
            // ALWAYS use customer's current takenAmount as the active loan
            let totalOwed = parseFloat(customer.takenAmount) || 0;
            let latestRenewalDate = null;
            let customerStartDate = null;
            const customerCreatedAt = customer.createdAt ? new Date(customer.createdAt).getTime() : null;
            
            // Check if there are renewals to determine start date of current loan cycle
            if (renewals.length > 0) {
              // Sort renewals by date to get the latest one
              const sortedRenewals = renewals
                .filter(r => !(r.isArchived && r.isSettled))
                .sort((a, b) => {
                  const dateA = new Date(a.renewalDate || a.date).getTime();
                  const dateB = new Date(b.renewalDate || b.date).getTime();
                  return dateB - dateA;
                });
              
              if (sortedRenewals.length > 0) {
                const latestRenewal = sortedRenewals[0];
                latestRenewalDate = new Date(latestRenewal.renewalDate || latestRenewal.date).getTime();
                
                // If customer was created AFTER the latest renewal, the current loan is NEW
                // Use customer's createdAt as the start date, not the renewal date
                if (customerCreatedAt && customerCreatedAt > latestRenewalDate) {
                  customerStartDate = customerCreatedAt;
                } else {
                  customerStartDate = latestRenewalDate;
                }
              }
            } else {
              // No renewals
              // For restored customers, use createdAt as the start date to exclude old transactions
              if (customer.isRestoredCustomer && customerCreatedAt) {
                customerStartDate = customerCreatedAt;
              }
            }
            
            // Calculate totalPaid: Only count payments made after latest renewal (if exists)
            const totalPaid = [...transactions, ...chatTransactions]
              .filter(t => !(t.isArchived && t.isSettled))
              .reduce((sum, t) => {
                const paymentDate = new Date(t.createdAt || t.date).getTime();
                // If there's a renewal or customer start date, only count payments made after it
                if (customerStartDate && paymentDate < customerStartDate) {
                  return sum; // Skip payments before current loan started
                }
                return sum + (parseFloat(t.amount) || 0);
              }, 0);
            
            const remainingAmount = totalOwed - totalPaid;
            
            allCustomersData.push({
              id: customer.id,
              name: customer.name,
              day,
              totalOwed,
              totalPaid,
              remainingAmount
            });
          });
        }
        
        // Table header
        doc.fontSize(10).fillColor('#FFFFFF');
        doc.fillColor('#3B82F6').rect(50, yPos, 512, 25).fill();
        
        doc.fillColor('#FFFFFF').font('Helvetica-Bold')
          .text('ID', 60, yPos + 8, { width: 60, align: 'center' })
          .text('Name', 130, yPos + 8, { width: 120, align: 'left' })
          .text('Day', 260, yPos + 8, { width: 60, align: 'center' })
          .text('Owed', 330, yPos + 8, { width: 70, align: 'right' })
          .text('Paid', 410, yPos + 8, { width: 70, align: 'right' })
          .text('Remaining', 490, yPos + 8, { width: 70, align: 'right' });
        
        yPos += 25;
        
        // Table rows
        doc.font('Helvetica').fontSize(9);
        allCustomersData.forEach((customer, index) => {
          const bgColor = index % 2 === 0 ? '#F5F7FA' : '#FFFFFF';
          doc.fillColor(bgColor).rect(50, yPos, 512, 20).fill();
          
          doc.fillColor('#000000')
            .text(customer.id, 60, yPos + 5, { width: 60, align: 'center' })
            .text(customer.name, 130, yPos + 5, { width: 120, align: 'left' })
            .text(customer.day, 260, yPos + 5, { width: 60, align: 'center' });
          
          doc.fillColor('#3B82F6')
            .text(`Rs.${customer.totalOwed.toFixed(2)}`, 330, yPos + 5, { width: 70, align: 'right' });
          
          doc.fillColor('#16A34A')
            .text(`Rs.${customer.totalPaid.toFixed(2)}`, 410, yPos + 5, { width: 70, align: 'right' });
          
          doc.fillColor('#DC2626')
            .text(`Rs.${customer.remainingAmount.toFixed(2)}`, 490, yPos + 5, { width: 70, align: 'right' });
          
          yPos += 20;
          
          // Add new page if needed
          if (yPos > 720) {
            doc.addPage();
            yPos = 50;
          }
        });
      }
      
      // Footer on all pages
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.moveTo(50, 770).lineTo(562, 770).strokeColor('#C8C8C8').lineWidth(0.5).stroke();
        doc.fontSize(8).font('Helvetica').fillColor('#646464')
          .text(`Page ${i + 1} of ${pageCount}`, 0, 775, { align: 'center' })
          .text('Generated by Entry Details', 50, 775);
      }
      
      // Finalize PDF
      doc.end();
      
    } catch (error) {
      // console.error('Error generating customer summary PDF:', error);
      next(error);
    }
  }
}

module.exports = new PDFController();
