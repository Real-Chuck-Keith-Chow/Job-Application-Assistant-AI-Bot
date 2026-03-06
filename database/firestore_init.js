"use strict";

const fs = require("fs");
const { Firestore } = require("@google-cloud/firestore");

let db;

function getFirestore() {
  if (db) return db;

  const config = {};

  if (process.env.GOOGLE_CLOUD_PROJECT) {
    config.projectId = process.env.GOOGLE_CLOUD_PROJECT;
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!fs.existsSync(keyFilename)) {
      throw new Error(`Firestore credentials file not found: ${keyFilename}`);
    }

    config.keyFilename = keyFilename;
  }

  db = new Firestore(config);
  return db;
}

// Useful for isolated tests
function resetFirestore() {
  db = null;
}

module.exports = {
  getFirestore,
  resetFirestore,
};
