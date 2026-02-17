'use client';

import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  type Auth,
} from 'firebase/auth';

function getFirebaseConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  if (!apiKey || !authDomain || !projectId || !appId) {
    throw new Error(
      'Missing Firebase web config env vars. Set NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_APP_ID.'
    );
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
  };
}

export function getFirebaseApp(): FirebaseApp {
  if (getApps().length) return getApp();
  return initializeApp(getFirebaseConfig());
}

let authInstance: Auth | null = null;
let persistenceInitialized = false;

export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(getFirebaseApp());
  }

  if (typeof window !== 'undefined' && authInstance && !persistenceInitialized) {
    persistenceInitialized = true;
    setPersistence(authInstance, browserLocalPersistence).catch(() => {
      // Ignore persistence failures; Firebase will fall back to in-memory.
    });
  }

  return authInstance;
}

export function getDefaultPhoneCountryCallingCode(): string {
  return process.env.NEXT_PUBLIC_DEFAULT_PHONE_COUNTRY_CALLING_CODE || '91';
}
