import admin from "firebase-admin";

let firebaseAdminApp;

function getCredential() {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (clientEmail && privateKey) {
    return admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail,
      privateKey
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return admin.credential.applicationDefault();
  }

  return null;
}

export function getFirebaseAdminApp() {
  if (firebaseAdminApp) {
    return firebaseAdminApp;
  }

  const credential = getCredential();

  if (!credential || !process.env.FIREBASE_PROJECT_ID) {
    return null;
  }

  firebaseAdminApp = admin.initializeApp({
    credential,
    projectId: process.env.FIREBASE_PROJECT_ID
  });

  return firebaseAdminApp;
}

export function getAdminAuth() {
  const app = getFirebaseAdminApp();
  return app ? admin.auth(app) : null;
}

export function getAdminFirestore() {
  const app = getFirebaseAdminApp();
  return app ? admin.firestore(app) : null;
}

export function isFirebaseAdminConfigured() {
  return Boolean(getCredential() && process.env.FIREBASE_PROJECT_ID);
}
