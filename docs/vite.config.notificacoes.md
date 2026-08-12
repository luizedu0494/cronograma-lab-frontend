# Configuração de Variáveis de Ambiente para Notificações

## Arquivo `.env.local`

Crie um arquivo `.env.local` na raiz do projeto com o seguinte conteúdo:

```env
# Telegram Bot Token
VITE_TELEGRAM_BOT_TOKEN=seu_token_do_bot_aqui
```

## Como Obter o Token

1. Abra o Telegram
2. Procure por **@BotFather**
3. Envie `/newbot`
4. Siga as instruções
5. Copie o token gerado (formato: `123456789:ABCdefGHIjklmnoPQRstuvWXYZ`)
6. Cole no arquivo `.env.local`

## Arquivo `.env.example`

Este arquivo serve como template e deve ser versionado no Git:

```env
# Telegram Bot Configuration
VITE_TELEGRAM_BOT_TOKEN=seu_token_aqui
```

## Gitignore

Certifique-se de que `.env.local` está no `.gitignore`:

```
.env.local
.env.*.local
```

## Acessando a Variável no Código

No código React/Vite, acesse assim:

```javascript
const token = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
```

## Variáveis Disponíveis

| Variável | Tipo | Obrigatória | Descrição |
|----------|------|-------------|-----------|
| `VITE_TELEGRAM_BOT_TOKEN` | String | Sim | Token do bot Telegram |

## Desenvolvimento vs Produção

- **Desenvolvimento:** Use `.env.local`
- **Produção:** Configure variáveis de ambiente no seu host (Vercel, Firebase, etc)

Para Vercel:
1. Vá para Project Settings
2. Environment Variables
3. Adicione `VITE_TELEGRAM_BOT_TOKEN`

Para Firebase Hosting:
1. Configure no arquivo `.firebaserc` ou use Firebase CLI
2. Ou configure no seu CI/CD pipeline

## Testando a Configuração

Para verificar se a variável está sendo carregada:

```javascript
console.log('Token:', import.meta.env.VITE_TELEGRAM_BOT_TOKEN);
```

Deve exibir seu token (ou `undefined` se não configurado).
