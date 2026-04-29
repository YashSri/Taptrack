import { initializeApp } from 'firebase/app'
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
} from 'firebase/auth'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: 'AIzaSyCVviO3sVGsUGO6fLJoZuaarKQ9GdW8jro',
  authDomain: 'taptrack-aa0df.firebaseapp.com',
  projectId: 'taptrack-aa0df',
  messagingSenderId: '963465105325',
  appId: '1:963465105325:web:08456f6aaeeadfb8a91b24',
  measurementId: 'G-8KFYFYYB3F',
}

const realtimeDatabaseUrl =
  import.meta.env.VITE_FIREBASE_DATABASE_URL ||
  'https://taptrack-aa0df-default-rtdb.asia-southeast1.firebasedatabase.app'

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getDatabase(app, realtimeDatabaseUrl)

setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('Unable to persist Firebase session locally.', error)
})

export { app, auth, db, firebaseConfig, realtimeDatabaseUrl }
export default app
