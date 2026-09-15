import { getApps, initializeApp, type FirebaseOptions } from 'firebase/app'
import { getAuth } from 'firebase/auth'

/**
 * Firebase client SDK — usado SÓ no navegador (tela de login/registro).
 * As chaves aqui são públicas por natureza (identificam o projeto, não dão
 * acesso a nada por si só — quem protege os dados são as Firestore Rules
 * e as regras de Authentication).
 */
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

export const firebaseApp = getApps()[0] ?? initializeApp(firebaseConfig)
export const firebaseAuth = getAuth(firebaseApp)
