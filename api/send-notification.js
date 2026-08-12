// Em: seu-projeto/api/send-notification.js

import Brevo from '@getbrevo/brevo';
import admin from 'firebase-admin';
import dayjs from 'dayjs'; // Certifique-se de ter 'dayjs' no package.json da raiz do projeto

// --- Configuração do Firebase Admin ---
// Garante que o app admin só seja inicializado uma vez
if (!admin.apps.length) {
  try {
    // A variável de ambiente FIREBASE_SERVICE_ACCOUNT_JSON deve conter o CONTEÚDO do seu arquivo JSON da conta de serviço
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("Firebase Admin SDK inicializado na Vercel Function.");
  } catch (e) {
    console.error("ERRO CRÍTICO ao inicializar Firebase Admin SDK:", e);
    // Se o Admin SDK não inicializar, a função não poderá acessar o Firestore.
  }
}
const db = admin.firestore();

// --- Configuração do Cliente Brevo ---
let transactionalEmailsApi;
if (process.env.BREVO_API_KEY) {
  let defaultClient = Brevo.ApiClient.instance;
  let apiKey = defaultClient.authentications['api-key'];
  apiKey.apiKey = process.env.BREVO_API_KEY;
  transactionalEmailsApi = new Brevo.TransactionalEmailsApi();
  console.log("Cliente Brevo API inicializado na Vercel Function.");
} else {
  console.error("FATAL ERROR: BREVO_API_KEY não configurada nas variáveis de ambiente da Vercel.");
}

// --- Função Handler da Vercel ---
export default async function handler(req, res) {
  // 1. Verificar método e chave secreta (segurança básica)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  const clientSecret = req.headers['x-app-secret-key']; // Ou req.body.secretKey
  if (clientSecret !== process.env.MY_APP_SECRET_KEY) {
    console.warn("Acesso não autorizado ao endpoint de notificação.");
    return res.status(403).json({ error: 'Não autorizado.' });
  }

  // 2. Extrair dados do corpo da requisição
  const { newlyAssignedUids, aulaDetails } = req.body;

  if (!newlyAssignedUids || !aulaDetails || !Array.isArray(newlyAssignedUids) || newlyAssignedUids.length === 0) {
    return res.status(400).json({ error: 'Dados inválidos: newlyAssignedUids (array) e aulaDetails são obrigatórios.' });
  }

  if (!transactionalEmailsApi) {
    console.error("API da Brevo não inicializada.");
    return res.status(500).json({ error: 'Erro interno do servidor (Brevo API).' });
  }
  if (!admin.apps.length || !db) {
    console.error("Firebase Admin não inicializado corretamente.");
    return res.status(500).json({ error: 'Erro interno do servidor (Firebase Admin).' });
  }

  console.log(`Notificando UIDs: ${JSON.stringify(newlyAssignedUids)} para aula: ${aulaDetails.assunto}`);
  const emailResults = [];

  for (const technicianUid of newlyAssignedUids) {
    try {
      const userDoc = await db.collection("users").doc(technicianUid).get();

      if (!userDoc.exists) {
        console.error(`Usuário ${technicianUid} não encontrado.`);
        emailResults.push({ uid: technicianUid, status: 'erro', detail: 'Usuário não encontrado' });
        continue;
      }

      const userData = userDoc.data();
      const userEmail = userData.email;
      const userName = userData.name || userData.displayName || (userEmail ? userEmail.split("@")[0] : technicianUid);

      if (!userEmail) {
        console.error(`Usuário ${userName} (${technicianUid}) não tem e-mail.`);
        emailResults.push({ uid: technicianUid, status: 'erro', detail: 'E-mail do usuário não encontrado' });
        continue;
      }

      // Formata datas (aulaDetails.dataInicio/dataFim podem vir como strings ISO ou objetos com _seconds)
      const dataInicioDayjs = aulaDetails.dataInicio ? dayjs(aulaDetails.dataInicio._seconds ? aulaDetails.dataInicio._seconds * 1000 : aulaDetails.dataInicio) : null;
      const dataFimDayjs = aulaDetails.dataFim ? dayjs(aulaDetails.dataFim._seconds ? aulaDetails.dataFim._seconds * 1000 : aulaDetails.dataFim) : null;

      const dataFmt = dataInicioDayjs ? dataInicioDayjs.format("DD/MM/YYYY") : "N/A";
      const horarioFmt = dataInicioDayjs && dataFimDayjs ? `${dataInicioDayjs.format("HH:mm")} - ${dataFimDayjs.format("HH:mm")}` : "N/A";
      
      const emailSubject = `Nova Designação: ${aulaDetails.assunto || "Aula/Revisão"} no Laboratório`;
      const emailBodyHtml = `
        <p>Olá ${userName},</p>
        <p>Você foi designado(a) para uma nova atividade no cronograma do laboratório:</p>
        <ul>
          <li><strong>Atividade:</strong> ${aulaDetails.assunto || "Não especificado"} (${aulaDetails.tipoAtividade || ""})</li>
          <li><strong>Laboratório:</strong> ${aulaDetails.laboratorioSelecionado || "Não especificado"}</li>
          <li><strong>Data:</strong> ${dataFmt}</li>
          <li><strong>Horário:</strong> ${horarioFmt}</li>
          ${aulaDetails.observacoes ? `<li><strong>Observações:</strong> ${aulaDetails.observacoes}</li>` : ""}
          ${aulaDetails.propostaPorNome || aulaDetails.propostaPorEmail ? `<li><strong>Proposto por:</strong> ${aulaDetails.propostaPorNome || aulaDetails.propostaPorEmail}</li>` : ""}
        </ul>
        <p>Por favor, verifique o cronograma no sistema para mais detalhes.</p>
        <p>Atenciosamente,<br>Sistema de Cronograma de Laboratórios</p>
      `;

      // !!! Substitua pelos seus dados verificados na Brevo !!!
      const senderEmail = "fgojp61@gmail.com"; // SEU E-MAIL VERIFICADO NA BREVO
      const senderName = "labagendamentos";   // NOME DO REMETENTE

      let sendSmtpEmail = new Brevo.SendSmtpEmail();
      sendSmtpEmail.sender = { email: senderEmail, name: senderName };
      sendSmtpEmail.to = [{ email: userEmail, name: userName }];
      sendSmtpEmail.subject = emailSubject;
      sendSmtpEmail.htmlContent = emailBodyHtml;

      const data = await transactionalEmailsApi.sendTransacEmail(sendSmtpEmail);
      console.log(`E-mail enviado para ${userEmail}. Message ID: ${data?.messageId}`);
      emailResults.push({ uid: technicianUid, status: 'sucesso', messageId: data?.messageId });

    } catch (error) {
      const errMsg = String(error?.response?.body?.message || error?.message || error).substring(0, 100);
      console.error(`Erro ao enviar para ${technicianUid}: ${errMsg}`, error);
      emailResults.push({ uid: technicianUid, status: 'erro', detail: errMsg });
    }
  }

  const successCount = emailResults.filter(r => r.status === 'sucesso').length;
  if (successCount > 0 && successCount === newlyAssignedUids.length) {
    res.status(200).json({ message: `Todas as ${successCount} notificações enviadas.`, details: emailResults });
  } else if (successCount > 0) {
    res.status(207).json({ message: `${successCount} de ${newlyAssignedUids.length} notificações enviadas com alguns erros.`, details: emailResults });
  } else {
    res.status(500).json({ message: `Falha ao enviar todas as ${newlyAssignedUids.length} notificações.`, details: emailResults });
  }
}