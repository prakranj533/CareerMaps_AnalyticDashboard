import firebase from "firebase/compat/app";
import "firebase/compat/auth";

type FirebaseConfig = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
};

const firebaseConfig: FirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let firebaseAppPromise: Promise<firebase.app.App> | null = null;

function isCompleteConfig(config: FirebaseConfig) {
  return Boolean(config.apiKey && config.authDomain && config.projectId);
}

export function hasFirebaseConfig() {
  return isCompleteConfig(firebaseConfig);
}

export function shouldBypassFirebaseAuth() {
  return process.env.NODE_ENV === "development" && !hasFirebaseConfig();
}

async function resolveFirebaseConfig() {
  if (hasFirebaseConfig()) return firebaseConfig;

  const response = await fetch("/__/firebase/init.json");
  if (!response.ok) throw new Error("Unable to load Firebase configuration.");

  const runtimeConfig = await response.json() as FirebaseConfig;
  if (!isCompleteConfig(runtimeConfig)) throw new Error("Firebase configuration is incomplete.");
  return runtimeConfig;
}

export function getFirebaseApp() {
  firebaseAppPromise ??= resolveFirebaseConfig().then((config) => (
    firebase.apps.length ? firebase.app() : firebase.initializeApp(config)
  ));
  return firebaseAppPromise;
}

export async function getFirebaseAuth() {
  return (await getFirebaseApp()).auth();
}

export { firebase };
