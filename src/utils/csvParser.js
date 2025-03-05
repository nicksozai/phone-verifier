const csv = require('csv-parser');
const fs = require('fs');

// Function to parse a CSV file and return leads as an array of objects
const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const leads = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        // Auto-detect column names (case-insensitive)
        const lead = {};
        for (const key in row) {
          const lowerKey = key.toLowerCase().trim();
          if (lowerKey.includes('phone') || lowerKey.includes('number') || lowerKey.includes('tel')) {
            lead.phoneNumber = row[key];
          } else if (lowerKey.includes('first') || lowerKey.includes('fname')) {
            lead.firstName = row[key];
          } else if (lowerKey.includes('last') || lowerKey.includes('lname')) {
            lead.lastName = row[key];
          } else if (lowerKey.includes('company') || lowerKey.includes('org')) {
            lead.company = row[key];
          }
        }
        // Ensure required fields are present
        if (lead.phoneNumber && lead.firstName && lead.lastName) {
          leads.push(lead);
        }
      })
      .on('end', () => resolve(leads))
      .on('error', (err) => reject(err));
  });
};

module.exports = { parseCSV };