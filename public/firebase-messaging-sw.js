// public/firebase-messaging-sw.js

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// Inicialização com as configurações do projeto
if (!firebase.apps.length) {
  firebase.initializeApp({
    apiKey: new URL(location.href).searchParams.get("apiKey") || undefined,
    authDomain: new URL(location.href).searchParams.get("authDomain") || undefined,
    projectId: new URL(location.href).searchParams.get("projectId") || undefined,
    storageBucket: new URL(location.href).searchParams.get("storageBucket") || undefined,
    messagingSenderId: "386849385604",
    appId: "1:386849385604:web:8c76bd4ca86d3d2ea926d1"
  });
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

