# Guia de Notificações via Telegram

## 📋 Visão Geral

Este guia explica como configurar e usar o sistema de **notificações automáticas via Telegram** quando uma aula é **adicionada, editada ou excluída** no sistema de gerenciamento de aulas.

**Características:**
- ✅ Completamente gratuito
- ✅ Sem limites de mensagens
- ✅ Sem necessidade de Firebase Functions
- ✅ Implementação simples
- ✅ Funciona no plano Spark do Firebase

---

## 🚀 Passo a Passo de Configuração

### Passo 1: Criar um Bot Telegram

1. Abra o Telegram e procure por **@BotFather**
2. Clique em "Iniciar" ou envie `/start`
3. Envie o comando `/newbot`
4. Siga as instruções:
   - **Nome do bot:** Ex: "Sistema de Aulas Bot"
   - **Username do bot:** Ex: "sistema_aulas_bot" (deve ser único e terminar em "bot")
5. BotFather vai gerar um **token** como este:
   ```
   123456789:ABCdefGHIjklmnoPQRstuvWXYZ-1234567890
   ```
6. **Copie e guarde este token** - você vai precisar dele!

### Passo 2: Obter seu Chat ID do Telegram

Existem duas formas:

#### Opção A: Usando um Bot (Recomendado)

1. Procure por **@userinfobot** no Telegram
2. Clique em "Iniciar"
3. O bot vai mostrar seu **User ID** (este é seu Chat ID)
4. **Copie e guarde este número**

#### Opção B: Usando a API do Telegram

1. Envie uma mensagem para o bot que você criou
2. Abra no navegador:
   ```
   https://api.telegram.org/bot123456789:ABCdefGHIjklmnoPQRstuvWXYZ/getUpdates
   ```
   (Substitua `123456789:ABCdefGHIjklmnoPQRstuvWXYZ` pelo seu token)
3. Procure por `"chat":{"id":` - o número depois é seu Chat ID

### Passo 3: Configurar Variáveis de Ambiente

1. Na raiz do projeto, crie um arquivo `.env.local`:
   ```bash
   VITE_TELEGRAM_BOT_TOKEN=seu_token_aqui
   ```

2. Ou copie o arquivo `.env.example` e preencha:
   ```bash
   cp .env.example .env.local
   ```

### Passo 4: Adicionar Chat ID ao Perfil do Usuário

O sistema procura pelo `telegramChatId` no objeto do usuário. Você pode adicionar isso de duas formas:

#### Opção A: Adicionar Campo no Firebase (Recomendado)

1. Acesse o Firebase Console
2. Vá para **Firestore Database**
3. Abra a coleção **users**
4. Edite seu usuário e adicione um campo:
   - **Campo:** `telegramChatId`
   - **Tipo:** String
   - **Valor:** Seu Chat ID do Telegram (ex: `123456789`)

#### Opção B: Adicionar via Código

Se você tiver acesso ao código de autenticação, adicione:

```javascript
// Após login bem-sucedido
import { updateProfile } from 'firebase/auth';

await updateProfile(currentUser, {
  telegramChatId: '123456789' // Seu Chat ID
});
```

### Passo 5: Testar a Configuração

1. Inicie o servidor de desenvolvimento:
   ```bash
   npm start
   ```

2. Abra o console do navegador (F12 > Console)

3. Adicione uma aula usando o sistema

4. Verifique:
   - ✅ Console do navegador para mensagens de sucesso
   - ✅ Seu Telegram para receber a notificação

---

## 📱 Exemplos de Notificações

### Quando uma aula é ADICIONADA:

```
✅ Nova Aula Adicionada

Uma nova aula foi adicionada ao sistema.

Detalhes da Aula:
📖 Assunto: Anatomia Humana
📅 Data: 25/11/2025
🕐 Horário: 07:00-09:10
🏢 Laboratório: Anatomia 1
👥 Cursos: Medicina, Enfermagem

Gerado automaticamente pelo Sistema de Aulas
```

### Quando uma aula é EDITADA:

```
✏️ Aula Editada

Uma aula foi modificada.

Detalhes da Aula:
📖 Assunto: Bioquímica
📅 Data: 30/11/2025
🕐 Horário: 14:00-16:10
🏢 Laboratório: Multidisciplinar 2
👥 Cursos: Farmácia

Gerado automaticamente pelo Sistema de Aulas
```

### Quando uma aula é EXCLUÍDA:

```
❌ Aula Excluída

Uma aula foi removida do sistema.

Detalhes da Aula:
📖 Assunto: Fisiologia
📅 Data: 22/11/2025
🕐 Horário: 09:20-11:30
🏢 Laboratório: Fisiologia 1
👥 Cursos: Medicina

Gerado automaticamente pelo Sistema de Aulas
```

---

## 🔧 Arquivos Modificados/Criados

### Novos Arquivos:

1. **`src/ia-estruturada/NotificadorTelegram.js`**
   - Módulo principal de notificações
   - Contém a lógica de envio para Telegram
   - Formata mensagens com emojis e HTML

2. **`.env.example`**
   - Template de variáveis de ambiente
   - Copie para `.env.local` e preencha os valores

### Arquivos Modificados:

1. **`src/ia-estruturada/ExecutorAcoes.js`**
   - Adicionado import do `NotificadorTelegram`
   - Adicionadas chamadas de notificação em:
     - `adicionar()` - após adicionar aula
     - `editar()` - após editar aula
     - `excluir()` - após excluir aula

---

## 🎯 Como Funciona

```
Usuário adiciona/edita/exclui aula
          ↓
ExecutorAcoes.js executa a ação
          ↓
Dados são salvos no Firebase
          ↓
NotificadorTelegram.enviarNotificacao() é chamado
          ↓
Requisição HTTP para Telegram API
          ↓
Mensagem formatada é enviada para o usuário
          ↓
Notificação aparece no Telegram do usuário
```

---

## 🛠️ Troubleshooting

### Problema: Notificação não é enviada

**Possíveis causas:**

1. **Token do bot não configurado**
   - Verifique se `.env.local` tem `VITE_TELEGRAM_BOT_TOKEN`
   - Verifique se o token está correto

2. **Chat ID não configurado**
   - Verifique se o usuário tem o campo `telegramChatId` no Firebase
   - Verifique se o Chat ID está correto

3. **Bot não foi iniciado**
   - Envie uma mensagem para o bot no Telegram primeiro
   - Isso ativa a comunicação entre você e o bot

**Solução:**

1. Abra o console do navegador (F12)
2. Procure por mensagens de erro
3. Verifique se há logs de sucesso/erro ao adicionar aula

### Problema: Erro "Unauthorized"

**Causa:** Token do bot está incorreto ou expirado

**Solução:**
1. Vá para @BotFather
2. Selecione seu bot
3. Clique em "Edit Token"
4. Copie o novo token
5. Atualize `.env.local`

### Problema: Erro "Chat not found"

**Causa:** Chat ID está incorreto ou o bot não foi iniciado

**Solução:**
1. Envie uma mensagem para o bot no Telegram
2. Verifique seu Chat ID usando @userinfobot
3. Atualize o campo `telegramChatId` no Firebase

---

## 📚 Referências

- **Telegram Bot API:** https://core.telegram.org/bots/api
- **Como criar um bot:** https://core.telegram.org/bots#how-do-i-create-a-bot
- **Método sendMessage:** https://core.telegram.org/bots/api#sendmessage

---

## 🔐 Segurança

### Boas Práticas:

1. **Nunca compartilhe seu token do bot**
   - Guarde em `.env.local` (não versionado no Git)
   - Use `.env.example` como template

2. **Chat ID é semi-privado**
   - Armazene no Firebase com segurança
   - Use Firebase Security Rules se necessário

3. **Não exponha variáveis de ambiente**
   - Variáveis com `VITE_` são expostas no cliente (é ok)
   - Variáveis sem `VITE_` são privadas (use para dados sensíveis)

---

## 📝 Próximos Passos

### Melhorias Futuras:

1. **Notificações em Grupo**
   - Adicionar todos os coordenadores a um grupo
   - Enviar notificações para o grupo inteiro

2. **Notificações Customizáveis**
   - Permitir usuário escolher quais eventos notificar
   - Horários específicos para notificações

3. **Histórico de Notificações**
   - Armazenar log de notificações enviadas
   - Permitir visualizar histórico

4. **Integração com WhatsApp**
   - Usar WhatsApp Cloud API (requer conta comercial)
   - Alternativa: Usar Twilio (com custo)

---

## ❓ Dúvidas?

Se tiver dúvidas ou problemas:

1. Verifique a seção **Troubleshooting** acima
2. Consulte a documentação oficial do Telegram Bot API
3. Verifique os logs do console do navegador (F12)
4. Verifique os logs do servidor (npm start)

---

**Última atualização:** 21 de Novembro de 2025
**Versão:** 1.0
