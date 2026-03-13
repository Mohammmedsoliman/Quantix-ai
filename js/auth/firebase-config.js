// firebase-config.js

// 1. استدعاء مكتبات فايربيز الأساسية
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 2. حط الـ Config الخاص بيك هنا (اللي نسخته من موقع فايربيز)
const firebaseConfig = {
  apiKey: "AIzaSyBgTT2yBcOEr0RtH2c8m99wUcWFotmQaCk",
  authDomain: "quantix-6978e.firebaseapp.com",
  projectId: "quantix-6978e",
  storageBucket: "quantix-6978e.firebasestorage.app",
  messagingSenderId: "1004031879500",
  appId: "1:1004031879500:web:cbd3b3938f01b1cfe7c7e9",
  measurementId: "G-F0GZ84H59B"
};

// 3. تشغيل Firebase
const app = initializeApp(firebaseConfig);

// 4. تشغيل خدمات تسجيل الدخول وقاعدة البيانات عشان نستخدمهم في باقي الملفات
export const auth = getAuth(app);
export const db = getFirestore(app);

console.log("Firebase Initialized Successfully!");