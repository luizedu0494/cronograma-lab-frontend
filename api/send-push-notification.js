// api/send-push-notification.js

// Esta API foi desativada para funcionar no plano gratuito do Firebase.
// Notificações push em tempo real geralmente exigem o plano Blaze (pago).
// Para mais informações, consulte a documentação do Firebase sobre planos.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  console.log('API de notificação push desativada para o plano gratuito.');
  return res.status(501).json({ error: 'Funcionalidade de notificação push não disponível no plano gratuito do Firebase.' });
}


