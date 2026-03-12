"use strict";

const fs = require("node:fs");
const { Firestore } = require("@google-cloud/firestore");

let db = null;

function buildFirestoreConfig() {
  const config = {};
  const {
    GOOGLE_CLOUD_PROJECT,
    GOOGLE_APPLICATION_CREDENTIALS,
    FIRESTORE_EMULATOR_HOST,
  } = process.env;

  if (GOOGLE_CLOUD_PROJECT) {
    config.projectId = GOOGLE_CLOUD_PROJECT;
  }

  if (!FIRESTORE_EMULATOR_HOST && GOOGLE_APPLICATION_CREDENTIALS) {
    if (!fs.existsSync(GOOGLE_APPLICATION_CREDENTIALS)) {
      throw new Error(
        `Firestore credentials file not found: ${GOOGLE_APPLICATION_CREDENTIALS}`
      );
    }

    config.keyFilename = GOOGLE_APPLICATION_CREDENTIALS;
  }

  return config;
}

function getFirestore() {
  if (!db) {
    db = new Firestore(buildFirestoreConfig());
  }

  return db;
}

function resetFirestore() {
  db = null;
}

function hasFirestore() {
  return db !== null;
}

module.exports = {
  getFirestore,
  resetFirestore,
  hasFirestore,
};
