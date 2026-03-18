import firebase from "firebase/compat/app";
import "firebase/compat/auth";

const firebaseConfig = {
  platform: {
    apiKey: process.env.NEXT_PUBLIC_PLATFORM_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_PLATFORM_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_PLATFORM_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_PLATFORM_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_PLATFORM_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_PLATFORM_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_PLATFORM_MEASUREMENT_ID,
  },
};

function getFirebaseApp(name: string, config: Record<string, unknown>) {
  try {
    return firebase.app(name);
  } catch {
    return firebase.initializeApp(config, name);
  }
}

export const platformFirebase = getFirebaseApp("platform", firebaseConfig.platform);
