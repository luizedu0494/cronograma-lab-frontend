// public/firebase-messaging-sw.js

// Tenta inicialização automática do Firebase via Hosting
try {
  importScripts('/__/firebase/init.js');
} catch (e) {
  // Em dev ou sem Firebase Hosting, usa compat scripts
  importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js");
}

if (!firebase.apps.length) {
  // Inicialização condicional dinâmica se necessário
}

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log(
    "[firebase-messaging-sw.js] Mensagem recebida em segundo plano: ",
    payload
  );

  const notificationTitle = payload.notification?.title || "CronoLab";
  const notificationOptions = {
    body: payload.notification?.body || "Nova atualização recebida.",
    icon: "/logo192.png"
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
