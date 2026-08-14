// public/firebase-messaging-sw.js

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// Inicialização com as configurações do projeto
if (!firebase.apps.length) {
  try {
    importScripts("/__/firebase/init.js");
  } catch (e) {
    const urlParams = new URLSearchParams(location.search);
    firebase.initializeApp({
      apiKey: urlParams.get("apiKey") || "AIzaSyATwNg81vq-nBJTWB_0cnhMDBuhfxYmWJA",
      authDomain: urlParams.get("authDomain") || "cronolab-novo.firebaseapp.com",
      projectId: urlParams.get("projectId") || "cronolab-novo",
      storageBucket: urlParams.get("storageBucket") || "cronolab-novo.firebasestorage.app",
      messagingSenderId: urlParams.get("messagingSenderId") || "386849385604",
      appId: urlParams.get("appId") || "1:386849385604:web:8c76bd4ca86d3d2ea926d1"
    });
  }
}

const messaging = firebase.messaging();


messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Mensagem recebida em segundo plano: ", payload);

  const notificationTitle = payload.notification?.title || "CronoLab";
  const notificationOptions = {
    body: payload.notification?.body || "Nova atualização recebida.",
    icon: "/logo192.png",
    badge: "/favicon.ico"
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

