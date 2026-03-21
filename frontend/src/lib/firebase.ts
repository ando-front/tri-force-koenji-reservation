import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
const authDomainFromEnv = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;

function resolveAuthDomain(): string | undefined {
  const normalized = authDomainFromEnv?.trim();
  if (normalized && !normalized.endsWith('.web.app')) {
    return normalized;
  }
  if (projectId) {
    return `${projectId}.firebaseapp.com`;
  }
  return normalized;
}

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            as string,
  authDomain:        resolveAuthDomain(),
  projectId:         projectId as string,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             as string,
};

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// 開発時はエミュレーターに向ける
if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}
