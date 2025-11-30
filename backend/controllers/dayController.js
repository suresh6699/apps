const fileManager = require('../services/fileManager');

class DayController {
  // Get all days for a line
  async getDaysByLine(req, res, next) {
    try {
      const { lineId } = req.params;
      
      const days = fileManager.readJSON(`days/${lineId}.json`) || [];
      
      res.json({ days });
    } catch (error) {
      next(error);
    }
  }

  // Create new day for a line
  async createDay(req, res, next) {
    try {
      const { lineId } = req.params;
      const { day } = req.body;

      let days = fileManager.readJSON(`days/${lineId}.json`) || [];

      // Check if day already exists
      if (days.includes(day)) {
        return res.status(400).json({ error: 'Day already exists for this line' });
      }

      days.push(day);
      fileManager.writeJSON(`days/${lineId}.json`, days);

      res.status(201).json({
        message: 'Day added successfully',
        days
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DayController();
