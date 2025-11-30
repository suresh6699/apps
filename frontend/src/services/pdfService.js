import api from './api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const pdfService = {
  // Get customer transaction data and generate PDF
  async downloadCustomerTransactionPDF(customerId, lineId, day) {
    try {
      // Fetch data from backend
      const response = await api.get(`/api/pdf/data/customer-transactions/${customerId}/lines/${lineId}/days/${day}`);
      const data = response.data;
      
      const { customer, line, totals, statementData } = data;
      
      // Create PDF with jsPDF
      const doc = new jsPDF();
      
      // Header
      doc.setFillColor(59, 130, 246);
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('CUSTOMER TRANSACTIONS', 105, 16, { align: 'center' });
      
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.8);
      doc.line(35, 22, 175, 22);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(14, 26, 88, 9, 1.5, 1.5, 'F');
      doc.roundedRect(108, 26, 88, 9, 1.5, 1.5, 'F');
      
      doc.setTextColor(59, 130, 246);
      doc.text(`Line: ${line?.name || 'Unknown'}`, 58, 31.5, { align: 'center' });
      doc.text(`Day: ${day}`, 152, 31.5, { align: 'center' });
      
      doc.setTextColor(0, 0, 0);
      
      // Customer Details Box
      let yPos = 48;
      const boxWidth = 182;
      const boxStartX = 14;
      const boxEndX = boxStartX + boxWidth;
      
      doc.setFillColor(240, 248, 255);
      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(0.5);
      doc.roundedRect(boxStartX, yPos, boxWidth, 56, 2, 2, 'FD');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(59, 130, 246);
      doc.text('Customer Details:', 18, yPos + 8);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`ID: ${customer.id}`, 18, yPos + 16);
      doc.text(`Name: ${customer.name}`, 18, yPos + 22);
      doc.text(`Village: ${customer.village || 'N/A'}`, 18, yPos + 28);
      doc.text(`Phone: ${customer.phone || 'N/A'}`, 18, yPos + 34);
      doc.text(`Interest: ${customer.interest || 'N/A'}`, 18, yPos + 40);
      doc.text(`PC: ${customer.pc || 'N/A'}`, 18, yPos + 46);
      doc.text(`Weeks: ${customer.weeks || 'N/A'}`, 18, yPos + 52);
      
      // Summary box on right
      const summaryLabelX = 118;
      const summaryValueX = boxEndX - 6;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(59, 130, 246);
      doc.text(`Owed:`, summaryLabelX, yPos + 20);
      doc.text(`Rs.${totals.totalOwed.toFixed(2)}`, summaryValueX, yPos + 20, { align: 'right' });
      
      doc.setTextColor(22, 163, 74);
      doc.text(`Total Paid:`, summaryLabelX, yPos + 28);
      doc.text(`Rs.${totals.totalPaid.toFixed(2)}`, summaryValueX, yPos + 28, { align: 'right' });
      
      doc.setTextColor(totals.remainingAmount > 0 ? 220 : 22, totals.remainingAmount > 0 ? 38 : 163, totals.remainingAmount > 0 ? 38 : 74);
      doc.text(`Remaining:`, summaryLabelX, yPos + 36);
      doc.text(`Rs.${totals.remainingAmount.toFixed(2)}`, summaryValueX, yPos + 36, { align: 'right' });
      
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      
      yPos += 63;
      
      // Bank Statement Table
      if (statementData.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(220, 38, 38);
        doc.text('Transaction Statement', 14, yPos);
        doc.setTextColor(0, 0, 0);
        yPos += 5;
        
        autoTable(doc, {
          startY: yPos,
          head: [['Date', 'Taken', 'Received']],
          body: statementData.map(row => [
            row.date,
            row.taken > 0 ? `Rs.${row.taken.toFixed(2)}` : '-',
            row.received > 0 ? `Rs.${row.received.toFixed(2)}` : '-'
          ]),
          theme: 'grid',
          headStyles: { 
            fillColor: [59, 130, 246], 
            textColor: 255, 
            fontStyle: 'bold', 
            fontSize: 10,
            halign: 'center',
            lineWidth: 0.5,
            lineColor: [59, 130, 246]
          },
          styles: { 
            fontSize: 9.5, 
            fontStyle: 'bold',
            lineWidth: 0.3,
            lineColor: [200, 200, 200]
          },
          alternateRowStyles: {
            fillColor: [245, 247, 250]
          },
          margin: { left: 14, right: 14 },
          columnStyles: {
            0: { cellWidth: 60, halign: 'center' },
            1: { cellWidth: 60, halign: 'right', textColor: [220, 38, 38] },
            2: { cellWidth: 60, halign: 'right', textColor: [22, 163, 74] }
          }
        });
      }
      
      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(14, 282, 196, 282);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Page ${i} of ${pageCount}`, 105, 287, { align: 'center' });
        doc.text('Generated by Entry Details', 14, 287);
        doc.setTextColor(0, 0, 0);
      }
      
      doc.save(`Customer_${customer.id}_${customer.name}_Transactions.pdf`);
      
      return { success: true };
    } catch (error) {
      // console.error('Error generating customer PDF:', error);
      throw new Error(error.response?.data?.error || 'Failed to generate PDF');
    }
  },

  // Get collections data and generate PDF
  async downloadCollectionsPDF(lineId, filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.days) params.append('days', filters.days);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      
      // Fetch data from backend
      const response = await api.get(`/api/pdf/data/collections/lines/${lineId}?${params.toString()}`);
      const data = response.data;
      
      const { line, selectedDays, incomingTransactions, goingTransactions, totals, bfAmount } = data;
      
      // Helper function to add header section
      const addHeaderSection = (doc, dayLabel, sectionGoingTrans, sectionIncomingTrans) => {
        const sectionGoingTotal = sectionGoingTrans.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        const sectionIncomingTotal = sectionIncomingTrans.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        const sectionNetFlow = sectionIncomingTotal - sectionGoingTotal;
        
        doc.setFont('helvetica', 'normal');
        
        // Header
        doc.setFillColor(59, 130, 246);
        doc.rect(0, 0, 210, 40, 'F');
        
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('COLLECTIONS STATEMENT', 105, 16, { align: 'center' });
        
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.8);
        doc.line(35, 22, 175, 22);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(14, 26, 88, 9, 1.5, 1.5, 'F');
        doc.roundedRect(108, 26, 88, 9, 1.5, 1.5, 'F');
        
        doc.setTextColor(59, 130, 246);
        doc.setFont('helvetica', 'bold');
        doc.text(`BF: Rs.${bfAmount.toFixed(2)}`, 58, 31.5, { align: 'center' });
        doc.text(`Generated: ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`, 152, 31.5, { align: 'center' });
        
        doc.setTextColor(0, 0, 0);
        
        // Info section
        let yPos = 48;
        
        // Left Column - Line Details
        const leftBoxX = 14;
        const leftBoxY = yPos;
        const leftBoxWidth = 90;
        const leftBoxHeight = 32;
        
        doc.setFillColor(240, 248, 255);
        doc.setDrawColor(59, 130, 246);
        doc.setLineWidth(0.5);
        doc.roundedRect(leftBoxX, leftBoxY, leftBoxWidth, leftBoxHeight, 2, 2, 'FD');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('Line Details:', leftBoxX + 4, leftBoxY + 7);
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(`Line: ${line?.name || 'Unknown'}`, leftBoxX + 4, leftBoxY + 13);
        doc.text(`Day: ${dayLabel}`, leftBoxX + 4, leftBoxY + 19);
        const periodText = filters.dateFrom && filters.dateTo
          ? `${filters.dateFrom} - ${filters.dateTo}`
          : 'All dates';
        doc.text(`Period: ${periodText}`, leftBoxX + 4, leftBoxY + 25);
        
        // Right Column - Summary
        const summaryX = 110;
        const summaryY = yPos;
        const summaryWidth = 86;
        const summaryHeight = 32;
        
        doc.setFillColor(240, 248, 255);
        doc.setDrawColor(59, 130, 246);
        doc.setLineWidth(0.5);
        doc.roundedRect(summaryX, summaryY, summaryWidth, summaryHeight, 2, 2, 'FD');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('Summary:', summaryX + 4, summaryY + 7);
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(22, 163, 74);
        doc.text(`Incoming:`, summaryX + 4, summaryY + 13);
        doc.text(`Rs.${sectionIncomingTotal.toFixed(2)}`, summaryX + 82, summaryY + 13, { align: 'right' });
        
        doc.setTextColor(220, 38, 38);
        doc.text(`Going:`, summaryX + 4, summaryY + 19);
        doc.text(`Rs.${sectionGoingTotal.toFixed(2)}`, summaryX + 82, summaryY + 19, { align: 'right' });
        
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(sectionNetFlow >= 0 ? 22 : 220, sectionNetFlow >= 0 ? 163 : 38, sectionNetFlow >= 0 ? 74 : 38);
        doc.text(`Net Flow:`, summaryX + 4, summaryY + 26);
        doc.text(`Rs.${sectionNetFlow.toFixed(2)}`, summaryX + 82, summaryY + 26, { align: 'right' });
        
        doc.setTextColor(0, 0, 0);
        
        return 88;
      };
      
      // Helper function to add transactions tables
      const addTransactionsTables = (doc, goingTrans, incomingTrans, startY) => {
        let yPos = startY;
        
        // Going Transactions Table
        if (goingTrans.length > 0) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(13);
          doc.setTextColor(220, 38, 38);
          doc.text('Going Transactions', 14, yPos);
          doc.setTextColor(0, 0, 0);
          yPos += 5;
          
          autoTable(doc, {
            startY: yPos,
            head: [['Date', 'Customer', 'ID', 'Amount']],
            body: goingTrans.map(trans => {
              let customerNameWithType = trans.customerName || 'Unknown';
              if (trans.type === 'renewal') {
                customerNameWithType += ' (R)';
              } else if (trans.type === 'customer_creation') {
                customerNameWithType += ' (N)';
              } else if (trans.type === 'restore') {
                customerNameWithType += ' (RS)';
              }
              if (trans.isDeleted) {
                customerNameWithType += ' [D]';
              }
              
              return [
                trans.date,
                customerNameWithType,
                trans.customerId,
                `-Rs.${trans.amount.toFixed(2)}`
              ];
            }),
            theme: 'striped',
            headStyles: { 
              fillColor: [220, 38, 38], 
              textColor: 255, 
              fontStyle: 'bold', 
              font: 'helvetica',
              fontSize: 10,
              halign: 'center'
            },
            styles: { 
              fontSize: 9.5, 
              font: 'helvetica',
              fontStyle: 'bold',
              halign: 'center'
            },
            margin: { left: 14, right: 14 },
            tableWidth: 'auto',
            columnStyles: {
              0: { cellWidth: 35, fontStyle: 'bold', halign: 'center' },
              1: { cellWidth: 80, fontStyle: 'bold', halign: 'center' },
              2: { cellWidth: 32, fontStyle: 'bold', halign: 'center' },
              3: { cellWidth: 35, halign: 'center', fontStyle: 'bold' }
            }
          });
          
          yPos = doc.lastAutoTable.finalY + 10;
        }
        
        // Incoming Transactions Table
        if (incomingTrans.length > 0) {
          if (yPos > 250) {
            doc.addPage();
            yPos = 20;
          }
          
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(13);
          doc.setTextColor(59, 130, 246);
          doc.text('Incoming Transactions', 14, yPos);
          doc.setTextColor(0, 0, 0);
          yPos += 5;
          
          autoTable(doc, {
            startY: yPos,
            head: [['Date', 'Customer', 'ID', 'Amount']],
            body: incomingTrans.map(trans => {
              let customerName = trans.customerName || 'Unknown';
              if (trans.isDeleted) {
                customerName += ' [D]';
              }
              
              return [
                trans.date,
                customerName,
                trans.customerId,
                `+Rs.${(trans.amount || 0).toFixed(2)}`
              ];
            }),
            theme: 'striped',
            headStyles: { 
              fillColor: [59, 130, 246], 
              textColor: 255, 
              fontStyle: 'bold', 
              font: 'helvetica',
              fontSize: 10,
              halign: 'center'
            },
            styles: { 
              fontSize: 9.5, 
              font: 'helvetica',
              fontStyle: 'bold',
              halign: 'center'
            },
            margin: { left: 14, right: 14 },
            tableWidth: 'auto',
            columnStyles: {
              0: { cellWidth: 35, fontStyle: 'bold', halign: 'center' },
              1: { cellWidth: 80, fontStyle: 'bold', halign: 'center' },
              2: { cellWidth: 32, fontStyle: 'bold', halign: 'center' },
              3: { cellWidth: 35, halign: 'center', fontStyle: 'bold' }
            }
          });
        }
      };
      
      // Create PDF
      const doc = new jsPDF();
      
      // SECTION 1: ALL DATA (Combined for all selected days)
      const daysText = selectedDays.length === 1 ? selectedDays[0] : selectedDays.join(', ');
      addHeaderSection(doc, daysText, goingTransactions, incomingTransactions);
      addTransactionsTables(doc, goingTransactions, incomingTransactions, 88);
      
      // SECTION 2 onwards: Individual day breakdown
      if (selectedDays.length >= 1) {
        selectedDays.forEach((dayName) => {
          const dayGoingTrans = goingTransactions.filter(t => t.day === dayName);
          const dayIncomingTrans = incomingTransactions.filter(t => t.day === dayName);
          
          if (dayGoingTrans.length === 0 && dayIncomingTrans.length === 0) {
            return;
          }
          
          doc.addPage();
          addHeaderSection(doc, dayName, dayGoingTrans, dayIncomingTrans);
          addTransactionsTables(doc, dayGoingTrans, dayIncomingTrans, 88);
        });
      }
      
      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(14, 282, 196, 282);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Page ${i} of ${pageCount}`, 105, 287, { align: 'center' });
        doc.text('Generated by Collections System', 14, 287);
        doc.setTextColor(0, 0, 0);
      }
      
      const fileName = `Collections_${line?.name || 'Statement'}_${filters.dateFrom || 'all'}_${filters.dateTo || 'all'}.pdf`;
      doc.save(fileName);
      
      return { success: true };
    } catch (error) {
      // console.error('Error generating collections PDF:', error);
      throw new Error(error.response?.data?.error || 'Failed to generate PDF');
    }
  },

  // Get customer summary data and generate PDF
  async downloadCustomerSummaryPDF(lineId, filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.days) params.append('days', filters.days);
      if (filters.selectAllDays !== undefined) params.append('selectAllDays', filters.selectAllDays);
      
      // Fetch data from backend
      const response = await api.get(`/api/pdf/data/customer-summary/lines/${lineId}?${params.toString()}`);
      const data = response.data;
      
      const { line, selectedDays, isSelectAllDays, summaryData, bfAmount } = data;
      
      // Create PDF
      const doc = new jsPDF();
      
      // Header
      doc.setFillColor(59, 130, 246);
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('CUSTOMER SUMMARY', 105, 16, { align: 'center' });
      
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.8);
      doc.line(35, 22, 175, 22);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(14, 26, 88, 9, 1.5, 1.5, 'F');
      doc.roundedRect(108, 26, 88, 9, 1.5, 1.5, 'F');
      
      doc.setTextColor(59, 130, 246);
      doc.text(`Line: ${line?.name || 'Unknown'}`, 58, 31.5, { align: 'center' });
      const dayText = isSelectAllDays 
        ? `BF: Rs.${bfAmount.toFixed(2)}` 
        : selectedDays.join(', ');
      doc.text(`${dayText}`, 152, 31.5, { align: 'center' });
      
      doc.setTextColor(0, 0, 0);
      
      let yPos = 48;
      
      // If all days selected, group by day
      if (isSelectAllDays) {
        summaryData.forEach(({ day, customers }) => {
          if (customers.length === 0) return;
          
          // Day heading
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(13);
          doc.setTextColor(220, 38, 38);
          doc.text(day, 14, yPos);
          doc.setTextColor(0, 0, 0);
          yPos += 5;
          
          autoTable(doc, {
            startY: yPos,
            head: [['ID', 'Name', 'Owed', 'Paid', 'Remaining']],
            body: customers.map(c => [
              c.id,
              c.name,
              `Rs.${c.totalOwed.toFixed(2)}`,
              `Rs.${c.totalPaid.toFixed(2)}`,
              `Rs.${c.remainingAmount.toFixed(2)}`
            ]),
            theme: 'grid',
            headStyles: { 
              fillColor: [59, 130, 246], 
              textColor: 255, 
              fontStyle: 'bold', 
              fontSize: 10,
              halign: 'center',
              lineWidth: 0.5,
              lineColor: [59, 130, 246]
            },
            styles: { 
              fontSize: 9.5, 
              fontStyle: 'bold',
              lineWidth: 0.3,
              lineColor: [200, 200, 200]
            },
            alternateRowStyles: {
              fillColor: [245, 247, 250]
            },
            margin: { left: 14, right: 14 },
            columnStyles: {
              0: { cellWidth: 30, halign: 'center' },
              1: { cellWidth: 60, halign: 'left' },
              2: { cellWidth: 32, halign: 'right', textColor: [59, 130, 246] },
              3: { cellWidth: 32, halign: 'right', textColor: [22, 163, 74] },
              4: { cellWidth: 32, halign: 'right', textColor: [220, 38, 38] }
            }
          });
          
          yPos = doc.lastAutoTable.finalY + 10;
        });
      } else {
        // Selected specific days - show all in one table with Day column
        const allCustomersData = [];
        summaryData.forEach(({ day, customers }) => {
          customers.forEach(c => {
            allCustomersData.push([
              c.id,
              c.name,
              day,
              `Rs.${c.totalOwed.toFixed(2)}`,
              `Rs.${c.totalPaid.toFixed(2)}`,
              `Rs.${c.remainingAmount.toFixed(2)}`
            ]);
          });
        });
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(59, 130, 246);
        doc.text('Customer Summary Report', 14, yPos);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        yPos += 5;
        
        autoTable(doc, {
          startY: yPos,
          head: [['ID', 'Name', 'Day', 'Owed', 'Paid', 'Remaining']],
          body: allCustomersData,
          theme: 'grid',
          headStyles: { 
            fillColor: [59, 130, 246], 
            textColor: 255, 
            fontStyle: 'bold', 
            fontSize: 10,
            halign: 'center',
            lineWidth: 0.5,
            lineColor: [59, 130, 246]
          },
          styles: { 
            fontSize: 9.5, 
            fontStyle: 'bold',
            lineWidth: 0.3,
            lineColor: [200, 200, 200]
          },
          alternateRowStyles: {
            fillColor: [245, 247, 250]
          },
          margin: { left: 14, right: 14 },
          columnStyles: {
            0: { cellWidth: 20, halign: 'center' },
            1: { cellWidth: 45, halign: 'left' },
            2: { cellWidth: 30, halign: 'center' },
            3: { cellWidth: 30, halign: 'right', textColor: [59, 130, 246] },
            4: { cellWidth: 30, halign: 'right', textColor: [22, 163, 74] },
            5: { cellWidth: 30, halign: 'right', textColor: [220, 38, 38] }
          }
        });
      }
      
      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(14, 282, 196, 282);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Page ${i} of ${pageCount}`, 105, 287, { align: 'center' });
        doc.text('Generated by Entry Details', 14, 287);
        doc.setTextColor(0, 0, 0);
      }
      
      const fileName = isSelectAllDays ? 'Customer_Summary_All_Days.pdf' : `Customer_Summary_${selectedDays.join('_')}.pdf`;
      doc.save(fileName);
      
      return { success: true };
    } catch (error) {
      // console.error('Error generating customer summary PDF:', error);
      throw new Error(error.response?.data?.error || 'Failed to generate PDF');
    }
  }
};

export default pdfService;
