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
  const notificationTitle = payload.notification?.title || payload.data?.title || 'NeetMaster';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: '/logo.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);

  // Confirm actual receipt back to the server — a "success" from the
  // send endpoint only means FCM accepted the message, not that this
  // device got it.
  const notificationId = payload.data?.notificationId;
  const token = payload.data?.token;
  if (notificationId && token) {
    fetch('https://mrdk.onrender.com/api/ack-delivery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId, token }),
    }).catch((err) => console.warn('[firebase-messaging-sw.js] ack-delivery failed', err));
  }
});
