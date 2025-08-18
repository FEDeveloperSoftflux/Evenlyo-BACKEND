const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
let serviceAccount;

// Try to use JSON file first, then fall back to environment variables
try {
  serviceAccount = require('../serviceAccountKey.json');
  console.log('Using Firebase service account from serviceAccountKey.json');
} catch (error) {
  // Fall back to environment variables
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) 
    {
    serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
    };
    console.log('Using Firebase service account from environment variables');
  } else {
    console.error('Firebase service account key not found. Please either:');
    console.error('1. Add serviceAccountKey.json to the project root, or');
    console.error('2. Set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL environment variables');
    throw new Error('Firebase configuration not found');
  }
}

// Initialize Firebase App if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id, // Explicitly set project ID

  });
}


// Get Firebase Auth instance
const auth = admin.auth();

/**
 * Send a push notification to a device using FCM token
 * @param {string} token - FCM device token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @returns {Promise<object>} FCM response
 */
async function sendNotification(token, title, body) {
  if (!token) throw new Error('No FCM token provided');
  const message = {
    notification: { title, body },
    token,
  };
  try {
    const response = await admin.messaging().send(message);
    return { success: true, response };
  } catch (error) {
    console.error('FCM send error:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  admin,
  auth,
  sendNotification,
  projectId: serviceAccount.project_id // Export project ID for easy access
};
