// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAaXdgxNzzETO15PITRgTf6_D0TB_6r8-A",
  authDomain: "pillpal-11778.firebaseapp.com",
  projectId: "pillpal-11778",
  storageBucket: "pillpal-11778.firebasestorage.app",
  messagingSenderId: "754193280937",
  appId: "1:754193280937:web:6d36df285fcc00a6df9eb8",
  measurementId: "G-F3MKDXY1GG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export { app, analytics };

