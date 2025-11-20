// public/firebase-messaging-sw.js

// Estas linhas são necessárias para importar as bibliotecas do Firebase para o escopo do Service Worker.
// Use uma versão mais recente se souber qual está no seu package.json, ex: 9.6.1 ou 9.22.1
importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js");

// --- IMPORTANTE: SUBSTITUA PELAS SUAS CONFIGURAÇÕES DO FIREBASE ---
// Elas devem ser as mesmas do seu arquivo src/firebaseConfig.js
const firebaseConfig = {
  apiKey: "AIzaSyATwNg81vq-nBJTWB_0cnhMDBuhfxYmWJA",
  authDomain: "cronolab-novo.firebaseapp.com",
  projectId: "cronolab-novo",
  storageBucket: "cronolab-novo.firebasestorage.app",
  messagingSenderId: "386849385604",
  appId: "1:386849385604:web:8c76bd4ca86d3d2ea926d1"
};

// --- FIM DA SEÇÃO IMPORTANTE ---

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);

// Obtém a instância do serviço de mensagens
const messaging = firebase.messaging();

// Este código lida com notificações recebidas enquanto o seu app está em segundo plano
// ou fechado. Ele exibe a notificação na tela do usuário.
messaging.onBackgroundMessage(function(payload) {
  console.log(
    "[firebase-messaging-sw.js] Mensagem recebida em segundo plano: ",
    payload
  );

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/logo192.png" // Ícone que aparece na notificação
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
