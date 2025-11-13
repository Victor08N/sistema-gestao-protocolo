import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAqE4ZL1DeCXUonCDCUAVySCCeVJgry-us",
  authDomain: "sistema-gestao-protocolo.firebaseapp.com",
  projectId: "sistema-gestao-protocolo",
  storageBucket: "sistema-gestao-protocolo.appspot.com",
  messagingSenderId: "1015021251500",
  appId: "1:1015021251500:web:8e1003ca36b808daee2809",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
