const fileManager = require('../services/fileManager');
const bfCalculation = require('../services/bfCalculation');
const Line = require('../models/Line');

class LineController {
  // Get all lines with calculated BF
  async getAllLines(req, res, next) {
    try {
      let lines = fileManager.readJSON('lines.json') || [];

      // Calculate BF for each line
      lines = lines.map(line => {
        const bfResult = bfCalculation.calculateBF(line.id);
        return {
          ...line,
          currentBF: bfResult.bfAmount,
          bfBreakdown: bfResult.breakdown
        };
      });

      res.json({ lines });
    } catch (error) {
      next(error);
    }
  }

  // Get specific line
  async getLineById(req, res, next) {
    try {
      const { id } = req.params;
      const lines = fileManager.readJSON('lines.json') || [];
      const line = lines.find(l => l.id === id);

      if (!line) {
        return res.status(404).json({ error: 'Line not found' });
      }

      // Calculate BF
      const bfResult = bfCalculation.calculateBF(line.id);

      res.json({
        line: {
          ...line,
          currentBF: bfResult.bfAmount,
          bfBreakdown: bfResult.breakdown
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Create new line
  async createLine(req, res, next) {
    try {
      const lines = fileManager.readJSON('lines.json') || [];

      // Create new line
      const newLine = new Line(req.body);
      lines.push(newLine.toJSON());

      fileManager.writeJSON('lines.json', lines);

      res.status(201).json({
        message: 'Line created successfully',
        line: newLine.toJSON()
      });
    } catch (error) {
      next(error);
    }
  }

  // Update line
  async updateLine(req, res, next) {
    try {
      const { id } = req.params;
      const lines = fileManager.readJSON('lines.json') || [];
      const lineIndex = lines.findIndex(l => l.id === id);

      if (lineIndex === -1) {
        return res.status(404).json({ error: 'Line not found' });
      }

      // Update line
      const updatedLine = new Line({
        ...lines[lineIndex],
        ...req.body,
        id // Preserve ID
      });

      lines[lineIndex] = updatedLine.toJSON();
      fileManager.writeJSON('lines.json', lines);

      // Recalculate BF
      const bfResult = bfCalculation.updateBF(id);

      res.json({
        message: 'Line updated successfully',
        line: {
          ...updatedLine.toJSON(),
          currentBF: bfResult.bfAmount
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete line and all related data
  async deleteLine(req, res, next) {
    try {
      const { id } = req.params;
      let lines = fileManager.readJSON('lines.json') || [];

      const lineIndex = lines.findIndex(l => l.id === id);
      if (lineIndex === -1) {
        return res.status(404).json({ error: 'Line not found' });
      }

      // Remove line
      lines = lines.filter(l => l.id !== id);
      fileManager.writeJSON('lines.json', lines);

      // Delete all related data
      // Delete days
      fileManager.deleteJSON(`days/${id}.json`);

      // Delete customers
      const customerDays = fileManager.listFiles(`customers/${id}`);
      customerDays.forEach(day => {
        fileManager.deleteJSON(`customers/${id}/${day}`);
      });

      // Delete transactions
      const transDays = fileManager.listFiles(`transactions/${id}`);
      transDays.forEach(day => {
        const transFiles = fileManager.listFiles(`transactions/${id}/${day}`);
        transFiles.forEach(file => {
          fileManager.deleteJSON(`transactions/${id}/${day}/${file}`);
        });
      });

      // Delete chat
      const chatDays = fileManager.listFiles(`chat/${id}`);
      chatDays.forEach(day => {
        const chatFiles = fileManager.listFiles(`chat/${id}/${day}`);
        chatFiles.forEach(file => {
          fileManager.deleteJSON(`chat/${id}/${day}/${file}`);
        });
      });

      // Delete renewals
      const renewalDays = fileManager.listFiles(`renewals/${id}`);
      renewalDays.forEach(day => {
        const renewalFiles = fileManager.listFiles(`renewals/${id}/${day}`);
        renewalFiles.forEach(file => {
          fileManager.deleteJSON(`renewals/${id}/${day}/${file}`);
        });
      });

      // Delete accounts
      fileManager.deleteJSON(`accounts/${id}.json`);
      const accountFiles = fileManager.listFiles(`account_transactions/${id}`);
      accountFiles.forEach(file => {
        fileManager.deleteJSON(`account_transactions/${id}/${file}`);
      });

      // Delete deleted customers
      fileManager.deleteJSON(`deleted_customers/${id}.json`);

      res.json({ message: 'Line and all related data deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // Get calculated BF for a line
  async getLineBF(req, res, next) {
    try {
      const { id } = req.params;
      const lines = fileManager.readJSON('lines.json') || [];
      const line = lines.find(l => l.id === id);

      if (!line) {
        return res.status(404).json({ error: 'Line not found' });
      }

      const bfResult = bfCalculation.calculateBF(id);

      res.json({
        lineId: id,
        lineName: line.name,
        bfAmount: bfResult.bfAmount,
        breakdown: bfResult.breakdown
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new LineController();
