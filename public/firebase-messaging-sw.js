importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  projectId: "gen-lang-client-0147825816",
  appId: "1:900766773228:web:5271459b996a6dc0115ac9",
  apiKey: "AIzaSyC-gsqDjEtOvuru8B9awQJUdstZ9gNBUuw",
  authDomain: "gen-lang-client-0147825816.firebaseapp.com",
  storageBucket: "gen-lang-client-0147825816.firebasestorage.app",
  messagingSenderId: "900766773228"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
