import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAqE4ZL1DeCXUonCDCUAVySCCeVJgry-us",
  authDomain: "sistema-gestao-protocolo.firebaseapp.com",
  projectId: "sistema-gestao-protocolo",
  storageBucket: "sistema-gestao-protocolo.firebasestorage.app",
  messagingSenderId: "1015021251500",
  appId: "1:1015021251500:web:8e1003ca36b808daee2809",
  measurementId: "G-FQ00XCPBSE"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
