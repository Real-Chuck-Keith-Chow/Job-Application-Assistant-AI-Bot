"use strict";

const { Firestore } = require("@google-cloud/firestore");

let db;

/**
 * Returns a singleton Firestore instance.
 * Safe for Cloud Functions and local development.
 */
function getFirestore() {
  if (db) return db;

  const config = {
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
  };

  // Only use key file locally (not in GCP runtime)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    config.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }

  db = new Firestore(config);

  return db;
}

module.exports = getFirestore();
