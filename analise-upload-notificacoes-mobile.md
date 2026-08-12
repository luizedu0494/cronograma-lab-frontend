# CronoLab — Análise: Upload de Imagens, Notificações e App Mobile (sem sair do plano Spark)

> Base da análise: código-fonte do repositório `cronograma-lab-frontend` (Firebase Spark + Vercel Functions + React/Vite).

---

## 1. Resumo executivo

| Frente | Situação atual | O que falta | Precisa de plano pago? |
|---|---|---|---|
| Upload de imagem (banner + perfil) | Não implementado. `firebase/storage` está importado em `firebaseConfig.js` mas nunca é usado. Avatar só existe via foto do Google (`firebaseUser.photoURL`) | Upload real de arquivo, salvar URL no Firestore | **Não**, desde que não se use o Firebase Storage |
| Notificações | Telegram 100% funcional (client-side, grátis). Push via FCM está **desligado por engano** (`api/send-push-notification.js` retorna 501 "não disponível no plano gratuito") | Completar o endpoint reaproveitando o padrão que **já existe** em `api/save-push-token.js` | **Não** — é um mal-entendido, ver seção 3 |
| App mobile | PWA parcialmente configurado (`manifest.json`, `firebase-messaging-sw.js`) mas incompleto e não divulgado | Completar PWA e, opcionalmente, empacotar com Capacitor | **Não** |

Boa notícia: dá para resolver as três frentes **sem sair do Firebase Spark (grátis)** e sem Vercel pago, combinando serviços com free tier generosos.

---

## 2. Upload de imagens (banner do dashboard + foto de perfil)

### 2.1 Por que não usar o Firebase Storage

O projeto já importa `getStorage` em `src/firebaseConfig.js`, mas isso é enganoso: desde 2020 o Google exige uma **conta de faturamento (Blaze)** vinculada ao projeto para *qualquer* uso do Firebase Storage, mesmo que o consumo fique dentro da faixa gratuita. Ou seja, é justamente o serviço que vocês querem evitar — o `getStorage`/`storage` export hoje é código morto e serve como armadilha se alguém tentar usar sem perceber.

### 2.2 Alternativas gratuitas (sem cartão de crédito / sem Blaze)

| Serviço | Free tier | Como funciona no front-end | Prós | Contras |
|---|---|---|---|---|
| **Cloudinary** ⭐ recomendado | 25 GB armazenamento + 25 GB banda/mês | Upload direto do navegador via *unsigned upload preset* (sem backend) | Redimensiona/otimiza imagem via URL (`w_300,h_300,c_fill`), CDN rápido, fácil de integrar | Preset unsigned exige cuidado (ver 2.4) |
| **ImgBB** | Uploads ilimitados na API gratuita | POST simples com `API key` pública | Extremamente simples | Sem redimensionamento automático, menos controle sobre exclusão |
| **Supabase Storage** | 1 GB grátis | SDK próprio ou REST | Já vem com regras de acesso parecidas com Firestore rules | Mais um serviço/conta para gerenciar |
| **Base64 direto no Firestore** | Dentro da cota do Spark | Salvar a imagem (já comprimida) como string base64 no doc do usuário/config | Zero serviço externo | Limite de 1 MB por documento — só serve para avatares pequenos, não para banners grandes |
| **Vercel Blob** | 1 GB grátis (Hobby) | Upload via API route na própria Vercel (o projeto já usa Vercel Functions) | Fica tudo no mesmo provedor do deploy | Requer login com cartão para ativar Blob mesmo no free tier, dependendo da conta |

**Recomendação:** Cloudinary para o banner do dashboard e para a foto de perfil, e (opcional) fallback em base64/Firestore só para casos onde não haja internet estável — não é necessário para o MVP.

### 2.3 Onde os dois uploads entram no sistema atual

- **Banner do início do dashboard** → hoje é uma imagem fixa (`destaque-calendario.jpeg` embutida no build). Passaria a ser configurável: salvar a URL em `config/dashboardBanner` no Firestore (a coleção `config` já existe nas `firestore.rules`, com `allow write: if isCoordinator()`), lido pela `PaginaInicial.jsx`.
- **Foto de perfil** → hoje só existe `photoURL` vindo do Google Auth. Passaria a ter opção de upload manual em `ConfiguracoesPerfil.jsx`, salvando a URL retornada pelo Cloudinary no campo `photoURL` do doc em `users/{uid}` (a regra já permite `isOwner(userId)` atualizar o próprio doc).

### 2.4 Fluxo de implementação sugerido (Cloudinary)

1. Criar conta gratuita no Cloudinary e um **Upload Preset "unsigned"**, restrito por pasta (`cronolab/avatars`, `cronolab/banners`) e com limite de tamanho/formato (ex.: só `jpg/png/webp`, máx. 5 MB) — isso evita abuso, já que o preset fica público no front-end.
2. Criar um componente reutilizável `UploadImagem.tsx`:
   - Input de arquivo → preview → `fetch` para `https://api.cloudinary.com/v1_1/{cloud_name}/image/upload` com `FormData` (`file` + `upload_preset`).
   - Retorna a `secure_url` da imagem já otimizada.
3. **Perfil:** em `ConfiguracoesPerfil.jsx`, adicionar `<UploadImagem />` acima do `TextField` de nome; ao concluir, chamar `updateDoc(userDocRef, { photoURL: novaUrl })` (mesmo padrão que já existe para `name`/`telegramChatId`).
4. **Banner do dashboard:** criar uma tela simples em `Gerenciar/` (visível só para coordenador, seguindo o padrão de `GerenciarAvisos.jsx`) para trocar a imagem, salvando em `config/dashboardBanner`. A `PaginaInicial.jsx` passa a ler esse doc via `onSnapshot`/`getDoc` em vez de importar a imagem estática.
5. Guardar `VITE_CLOUDINARY_CLOUD_NAME` e `VITE_CLOUDINARY_UPLOAD_PRESET` no `.env` (mesmo padrão do `.env.example` atual).
6. Remover (ou deixar comentado) o `getStorage`/`storage` de `firebaseConfig.js` para não confundir o time no futuro.

**Esforço estimado:** 1 componente reutilizável + 2 pontos de integração → tarde de trabalho para um dev familiarizado com o projeto.

---

## 3. Notificações push sem sair do plano Spark

### 3.1 O mal-entendido no código

O comentário em `api/send-push-notification.js` diz que push "exige plano Blaze". Isso **não é verdade** para o caminho que vocês já usam:

- O Blaze só é obrigatório para **Cloud Functions do Firebase** fazendo chamadas de rede externas.
- Vocês **não usam Cloud Functions** — usam **Vercel Serverless Functions** (`/api/*.js`) com o `firebase-admin` SDK. Isso já está funcionando hoje em `api/save-push-token.js` (grava token no Firestore) e em `api/send-notification.js` (dispara e-mail via Brevo, lendo dados do Firestore com Admin SDK) — ambos usando `firebase-admin` normalmente, sem qualquer bloqueio do plano Spark.
- Enviar push via `admin.messaging().send(...)` é apenas mais uma chamada de rede feita pela **Vercel** (não pelo Firebase), então cai na mesma categoria dos outros dois endpoints que já funcionam.

Ou seja: a infraestrutura para push **já está 90% pronta** — falta só reescrever esse endpoint.

### 3.2 O que falta implementar

1. Gerar uma **VAPID key** gratuita no console do Firebase (Project Settings → Cloud Messaging → Web Push certificates) — necessária para o SDK do FCM no navegador pedir permissão e obter o token.
2. No front-end, usar `getMessaging` + `getToken(messaging, { vapidKey })` (o service worker `public/firebase-messaging-sw.js` já existe e está correto) e enviar o token para `api/save-push-token.js` (endpoint já pronto).
3. Reescrever `api/send-push-notification.js` no mesmo padrão de `api/send-notification.js`:
   ```js
   import admin from 'firebase-admin';
   // ...init igual ao send-notification.js
   const db = admin.firestore();

   export default async function handler(req, res) {
     const { uids, title, body } = req.body;
     const tokensSnap = await db.collection('fcmTokens')
        .where(admin.firestore.FieldPath.documentId(), 'in', uids)
        .get();
     const tokens = tokensSnap.docs.flatMap(d => d.data().tokens || []);
     if (!tokens.length) return res.status(200).json({ message: 'Nenhum token encontrado.' });

     const response = await admin.messaging().sendEachForMulticast({
       tokens,
       notification: { title, body },
     });
     return res.status(200).json({ successCount: response.successCount, failureCount: response.failureCount });
   }
   ```
4. Chamar esse endpoint no mesmo ponto onde hoje se chama o Telegram e a Brevo — em `ExecutorAcoes.ts` (adicionar/editar/excluir aula) e em `PainelAvisos`/`GerenciarAvisos` (novo aviso).
5. Na tela de perfil (`ConfiguracoesPerfil.jsx`), adicionar um botão **"Ativar notificações no navegador"** que dispara `Notification.requestPermission()` e o fluxo de token — hoje só existe o campo de Telegram Chat ID.

### 3.3 Resultado

Usuário passa a poder escolher (ou combinar): Telegram, e-mail (Brevo) e push do navegador/PWA — sem custo adicional e sem depender de instalar o Telegram.

---

## 4. App mobile (para tornar as notificações mais acessíveis, sem depender do Telegram)

O código já contém as bases de um PWA (`manifest.json`, `firebase-messaging-sw.js`, ícones 192/512), mas incompleto e sem instalação divulgada. Há três caminhos, do mais barato/rápido ao mais robusto:

| Opção | O que é | Esforço | Custo | Alcance | Push funciona? |
|---|---|---|---|---|---|
| **A. PWA completo** ⭐ recomendado para já | Deixar o site atual "instalável" (ícone na tela inicial, abre sem barra do navegador, funciona quase como app) | Baixo — grande parte já existe | Grátis | Android: ótimo. iOS: precisa "Adicionar à Tela de Início" pelo Safari | Sim (Android nativamente; iOS 16.4+ **somente após instalado** na tela de início) |
| **B. Capacitor (Ionic)** | Empacota o mesmo projeto React já existente dentro de um app nativo Android/iOS, publicável na Play Store/App Store | Médio — reaproveita ~100% do código atual, adiciona wrapper nativo | Grátis para desenvolver; taxa única de US$25 se quiser publicar na Play Store (App Store cobra US$99/ano) | Total, incluindo lojas | Sim, com plugin nativo de push (pode usar o mesmo FCM) |
| **C. App nativo separado (React Native/Flutter)** | Projeto totalmente novo, independente do código web | Alto — reescreve telas do zero | Grátis para desenvolver, mesmas taxas de loja da opção B | Total | Sim |

### Recomendação de caminho

1. **Curto prazo:** finalizar o PWA — não exige reescrever nada, só:
   - Completar o `manifest.json` (já tem a maior parte: falta `icons` com `purpose: "maskable"` e talvez um `screenshots` para o prompt de instalação ficar mais rico).
   - Implementar/ajustar o *service worker* de cache (hoje só há o de mensagens) para permitir abrir o app offline/rápido.
   - Adicionar um botão "Instalar app" na interface, escutando o evento `beforeinstallprompt`.
   - Resolve exatamente o problema citado: notificação chega mesmo sem o usuário abrir o Telegram, direto na tela do celular.
2. **Médio prazo, se quiser presença nas lojas de aplicativos:** envolver o mesmo projeto com **Capacitor**, que roda o build do Vite dentro de um WebView nativo — não é reescrever o app, é empacotar o que já existe. Isso permite ícone próprio na Play Store/App Store mantendo 100% do código React atual.

Não recomendo React Native/Flutter agora: duplicaria manutenção (duas bases de código) para um ganho que o PWA + Capacitor já cobrem.

---

## 5. Roadmap sugerido

| Fase | Entregas | Custo |
|---|---|---|
| **1 — Imagens** | Upload de avatar (perfil) + banner configurável (dashboard) via Cloudinary | Grátis |
| **2 — Push web** | VAPID key, captura de token no front, `api/send-push-notification.js` funcional, opção na tela de perfil | Grátis |
| **3 — PWA completo** | Manifest ajustado, prompt de instalação, cache offline básico | Grátis |
| **4 — (opcional) Capacitor** | Build nativo Android/iOS a partir do mesmo código, push nativo | Grátis para dev; taxas de loja se publicar |

---

## 6. Checklist técnico imediato

- [ ] Criar conta Cloudinary + upload preset unsigned (pastas `avatars/` e `banners/`)
- [ ] Componente `UploadImagem` reutilizável
- [ ] Campo `photoURL` editável em `ConfiguracoesPerfil.jsx`
- [ ] Doc `config/dashboardBanner` + tela de gestão para coordenador
- [ ] `PaginaInicial.jsx` passa a ler o banner do Firestore em vez de asset fixo
- [ ] Gerar VAPID key no Firebase Console
- [ ] Reescrever `api/send-push-notification.js` com `firebase-admin` (mesmo padrão de `send-notification.js`)
- [ ] Botão "Ativar notificações" no perfil, salvando token via `api/save-push-token.js` (já existe)
- [ ] Disparar push nos mesmos pontos onde hoje dispara Telegram (`ExecutorAcoes.ts`) e avisos (`GerenciarAvisos`)
- [ ] Completar `manifest.json` (ícone maskable) + prompt de instalação do PWA
- [ ] Remover `getStorage`/`storage` não utilizado de `firebaseConfig.js`
- [ ] (Opcional, fase 2) Avaliar Capacitor para publicar nas lojas
