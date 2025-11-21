# Implementação de Notificações via Telegram

## 📌 Resumo Executivo

Foi implementado um **sistema completo de notificações via Telegram** que envia mensagens automáticas quando uma aula é **adicionada, editada ou excluída** no sistema de gerenciamento de aulas.

**Solução escolhida:** Telegram Bot API (gratuita, sem limites, sem Firebase Functions)

---

## ✅ O que foi Implementado

### 1. Novo Módulo: `NotificadorTelegram.js`

**Localização:** `src/ia-estruturada/NotificadorTelegram.js`

**Funcionalidades:**
- Envio de mensagens via Telegram Bot API
- Formatação de mensagens com emojis e HTML
- Suporte para múltiplos usuários
- Teste de conexão com o bot
- Tratamento de erros robusto

**Métodos principais:**
```javascript
// Enviar notificação para um usuário
await notificadorTelegram.enviarNotificacao(chatId, dados, tipo);

// Enviar para múltiplos usuários
await notificadorTelegram.enviarParaMultiplos(chatIds, dados, tipo);

// Testar conexão
await notificadorTelegram.testarConexao();
```

### 2. Modificações em `ExecutorAcoes.js`

**Mudanças:**
- Adicionado import do `NotificadorTelegram`
- Integração de notificações em 3 métodos:
  - `adicionar()` - envia notificação após adicionar aula
  - `editar()` - envia notificação após editar aula
  - `excluir()` - envia notificação após excluir aula

**Fluxo:**
```javascript
// Exemplo: ao adicionar aula
await batch.commit(); // Salva no Firebase
await notificadorTelegram.enviarNotificacao(...); // Envia notificação
return { ... }; // Retorna resultado
```

### 3. Configuração de Variáveis de Ambiente

**Arquivo:** `.env.local` (criar na raiz do projeto)

```env
VITE_TELEGRAM_BOT_TOKEN=seu_token_aqui
```

**Arquivo template:** `.env.example`

---

## 🔧 Arquitetura Técnica

### Fluxo de Dados

```
┌─────────────────────────────────────────────────┐
│  Usuário adiciona/edita/exclui aula             │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  ExecutorAcoes.js                               │
│  - Valida dados                                 │
│  - Salva no Firebase                            │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  NotificadorTelegram.enviarNotificacao()        │
│  - Formata mensagem                             │
│  - Faz requisição HTTP para Telegram API        │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  Telegram Bot API                               │
│  https://api.telegram.org/bot{TOKEN}/sendMessage│
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  Mensagem entregue no Telegram do usuário       │
└─────────────────────────────────────────────────┘
```

### Tecnologias Utilizadas

| Tecnologia | Propósito | Custo |
|-----------|-----------|-------|
| Telegram Bot API | Envio de mensagens | Gratuito |
| Fetch API | Requisições HTTP | Nativo (sem deps) |
| Firebase Firestore | Armazenar chat_id | Plano Spark |
| Vite | Variáveis de ambiente | Nativo |

---

## 📊 Comparação com Alternativas

| Solução | Custo | Complexidade | Recomendação |
|---------|-------|--------------|--------------|
| **Telegram Bot API** ✅ | Gratuito | Baixa | **ESCOLHIDA** |
| Make.com | Limitado (100/mês) | Média | Alternativa |
| Zapier | Limitado (100/mês) | Média | Alternativa |
| WhatsApp Cloud API | Pago | Alta | Não recomendado |
| Firebase Functions | Gratuito | Alta | Não permitido |

---

## 🚀 Como Usar

### Configuração Inicial (Uma vez)

1. **Criar bot Telegram:**
   ```
   Telegram → @BotFather → /newbot → Copiar token
   ```

2. **Obter Chat ID:**
   ```
   Telegram → @userinfobot → Copiar User ID
   ```

3. **Configurar variáveis:**
   ```bash
   # Criar .env.local na raiz do projeto
   VITE_TELEGRAM_BOT_TOKEN=seu_token_aqui
   ```

4. **Adicionar Chat ID ao Firebase:**
   ```
   Firebase Console → users → Seu usuário → Adicionar campo:
   telegramChatId: "seu_chat_id"
   ```

5. **Iniciar servidor:**
   ```bash
   npm start
   ```

### Uso Diário

1. Adicione/edite/exclua uma aula normalmente
2. Notificação será enviada automaticamente para seu Telegram
3. Nenhuma configuração adicional necessária

---

## 📝 Exemplos de Mensagens

### Aula Adicionada
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

### Aula Editada
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

### Aula Excluída
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

## 🧪 Testes

### Testes Unitários

Arquivo: `src/ia-estruturada/NotificadorTelegram.test.js`

Execute com:
```bash
npm test
```

**Testes inclusos:**
- ✅ Geração de mensagens para cada tipo de ação
- ✅ Formatação de dados
- ✅ Tratamento de dados faltantes
- ✅ Validação de entrada
- ✅ Envio para múltiplos usuários

### Teste Manual

1. Abra o console do navegador (F12)
2. Adicione uma aula
3. Verifique:
   - ✅ Console para logs de sucesso
   - ✅ Telegram para receber mensagem

---

## 🔐 Segurança

### Boas Práticas Implementadas

1. **Token em variável de ambiente**
   - Nunca exposto no código
   - Guardado em `.env.local` (não versionado)

2. **Chat ID no Firebase**
   - Armazenado de forma segura
   - Associado ao usuário autenticado

3. **Tratamento de erros**
   - Erros não interrompem operação principal
   - Logs informativos no console

4. **Validação de entrada**
   - Verifica se token e chat_id existem
   - Trata dados faltantes graciosamente

---

## 📋 Checklist de Implementação

- [x] Criar módulo `NotificadorTelegram.js`
- [x] Integrar com `ExecutorAcoes.js`
- [x] Adicionar suporte a variáveis de ambiente
- [x] Criar arquivo `.env.example`
- [x] Implementar testes unitários
- [x] Criar documentação completa
- [x] Tratamento de erros robusto
- [x] Formatação de mensagens com emojis
- [x] Suporte para múltiplos usuários
- [x] Teste de conexão com bot

---

## 📚 Arquivos Criados/Modificados

### Criados:
1. ✅ `src/ia-estruturada/NotificadorTelegram.js` - Módulo principal
2. ✅ `src/ia-estruturada/NotificadorTelegram.test.js` - Testes
3. ✅ `.env.example` - Template de variáveis
4. ✅ `GUIA_NOTIFICACOES_TELEGRAM.md` - Guia completo
5. ✅ `IMPLEMENTACAO_NOTIFICACOES.md` - Este arquivo
6. ✅ `vite.config.notificacoes.md` - Configuração Vite

### Modificados:
1. ✅ `src/ia-estruturada/ExecutorAcoes.js` - Integração de notificações

---

## 🚨 Troubleshooting

### Notificação não é enviada

**Verificar:**
1. Token configurado em `.env.local`?
2. Chat ID no Firebase?
3. Bot iniciado no Telegram?
4. Logs do console (F12)?

### Erro "Unauthorized"

**Solução:**
1. Verifique token em @BotFather
2. Copie novo token se necessário
3. Atualize `.env.local`

### Erro "Chat not found"

**Solução:**
1. Envie mensagem para o bot no Telegram
2. Verifique Chat ID com @userinfobot
3. Atualize `telegramChatId` no Firebase

---

## 🔮 Melhorias Futuras

1. **Notificações em grupo**
   - Enviar para múltiplos coordenadores
   - Criar canal privado no Telegram

2. **Customização**
   - Permitir usuário escolher eventos
   - Horários específicos para notificações

3. **Histórico**
   - Armazenar log de notificações
   - Dashboard de notificações

4. **Integração WhatsApp**
   - Usar Twilio ou WhatsApp Cloud API
   - Suporte para múltiplos canais

---

## 📞 Suporte

Para dúvidas ou problemas:

1. Consulte `GUIA_NOTIFICACOES_TELEGRAM.md`
2. Verifique seção Troubleshooting
3. Consulte documentação oficial do Telegram Bot API
4. Verifique logs do console (F12)

---

## 📄 Licença

Este código é parte do projeto de Sistema de Gerenciamento de Aulas.

---

**Implementado em:** 21 de Novembro de 2025  
**Versão:** 1.0  
**Status:** ✅ Pronto para produção
