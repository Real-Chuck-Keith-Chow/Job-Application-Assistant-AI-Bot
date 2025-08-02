const { Firestore } = require('@google-cloud/firestore');

// Initialize with environment variables (secure)
const db = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

// Verify connection
db.listCollections()
  .then(() => console.debug('Firestore connected'))
  .catch((err) => {
    console.error('Firestore connection failed:', err);
    process.exit(1);
  });

module.exports = db;
