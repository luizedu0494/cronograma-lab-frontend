# Assistente IA - Instruções de Instalação e Configuração

## 📋 Pré-requisitos

- Node.js 16+ instalado
- Projeto React já configurado
- Firebase já configurado
- Acesso à API Groq

## 🚀 Instalação

### 1. Arquivos Adicionados

Os seguintes arquivos foram criados/modificados:

```
src/
  ├── AssistenteIA.jsx          (NOVO - Componente principal)
  └── App.jsx                    (MODIFICADO - Rotas e menu)

Documentação:
  ├── ASSISTENTE_IA_DOCUMENTACAO.md
  └── ASSISTENTE_IA_README.md
```

### 2. Dependências

Todas as dependências necessárias já estão instaladas no projeto:
- `@mui/material` - Interface do usuário
- `firebase` - Banco de dados
- `react-router-dom` - Roteamento
- `dayjs` - Manipulação de datas

**Não é necessário instalar nenhuma dependência adicional.**

### 3. Configuração da API Groq

A API Key do Groq já está configurada no código:

```javascript
const GROQ_API_KEY = 'SUA_CHAVE_AQUI';
const GROQ_MODEL = 'llama-3.1-8b-instant';
```

**⚠️ IMPORTANTE PARA PRODUÇÃO:**

Para maior segurança, mova a API Key para variáveis de ambiente:

1. Crie um arquivo `.env` na raiz do projeto:
```env
VITE_GROQ_API_KEY=SUA_CHAVE_AQUI
```

2. Modifique o `AssistenteIA.jsx`:
```javascript
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
```

3. Adicione `.env` ao `.gitignore`:
```
.env
```

## 🔧 Modificações Realizadas

### App.jsx

#### 1. Import do componente (linha 44):
```javascript
const AssistenteIA = lazy(() => import('./AssistenteIA'));
```

#### 2. Import do ícone Bot (linha 21):
```javascript
import {
    Menu as MenuIcon, Sun, Moon, LogOut, User, HelpCircle, UserCheck, Users, Group, CalendarOff, Settings, Bell, ListTodo, Calendar, LayoutDashboard, ThumbsUp, PlusCircle, Download, BarChart, Bug, History, Bot
} from 'lucide-react';
```

#### 3. Rota adicionada (linha 304):
```javascript
{role === 'coordenador' && (<>
    <Route path="/gerenciar-aprovacoes" element={<GerenciarAprovacoes />} />
    <Route path="/gerenciar-usuarios" element={<GerenciarUsuarios />} />
    <Route path="/gerenciar-avisos" element={<GerenciarAvisos />} />
    <Route path="/gerenciar-grupos" element={<GerenciarGrupos />} />
    <Route path="/gerenciar-periodos" element={<GerenciarPeriodos />} />
    <Route path="/gerenciar-aulas" element={<GerenciarAulasAvancado />} />
    <Route path="/analise-aulas" element={<AnaliseAulas />} />
    <Route path="/verificar-integridade" element={<VerificarIntegridadeDados />} />
    <Route path="/assistente-ia" element={<AssistenteIA userInfo={userProfileData} currentUser={user} />} />
</>)}
```

#### 4. Menu de navegação (linha 225):
```javascript
...(role === 'coordenador' && !approvalPending ? [
    <MenuItem key="agend" component={Link} to="/propor-aula" onClick={handleMenuClose}><PlusCircle size={18} style={{marginRight: 10}}/> Agendar Aula</MenuItem>,
    <MenuItem key="assistente-ia" component={Link} to="/assistente-ia" onClick={handleMenuClose}><Bot size={18} style={{marginRight: 10}}/> Assistente IA</MenuItem>,
    <MenuItem key="gerenciar-menu" onClick={handleCoordenadorMenuOpen}><ListTodo size={18} style={{marginRight: 10}}/> Gerenciar</MenuItem>,
    // ... resto do menu
] : []),
```

## 🧪 Testando a Instalação

### 1. Compilar o projeto

```bash
cd cronograma-lab-frontend-9c51f4cd0cf5d66bc7d4273b3f8c266536f1bdf0
npm run build
```

### 2. Executar em desenvolvimento

```bash
npm run dev
```

### 3. Acessar o Assistente IA

1. Faça login como **coordenador**
2. No menu lateral, clique em **"Assistente IA"** (ícone de robô)
3. Digite um comando de teste:
   ```
   Adicionar aula de Anatomia para Medicina no laboratório Anatomia 1 no dia 20/11/2025 das 07:00-09:10
   ```

### 4. Teste da API (opcional)

Execute o script de teste fornecido:

```bash
node test_groq_api.js
```

## 📝 Verificação de Funcionalidades

Marque as funcionalidades testadas:

- [ ] Login como coordenador
- [ ] Acesso ao menu "Assistente IA"
- [ ] Interface do chat carrega corretamente
- [ ] Envio de comando simples
- [ ] Recebimento de resposta da IA
- [ ] Dialog de confirmação aparece
- [ ] Confirmação da ação
- [ ] Aula é criada no Firebase
- [ ] Mensagem de sucesso é exibida
- [ ] Teste com múltiplos horários
- [ ] Teste com múltiplos cursos
- [ ] Teste com múltiplos laboratórios
- [ ] Teste de exclusão de aulas
- [ ] Validação de data completa
- [ ] Validação de cursos inválidos
- [ ] Validação de laboratórios inválidos
- [ ] Verificação de conflitos

## 🐛 Solução de Problemas Comuns

### Erro: "Module not found: AssistenteIA"

**Solução**: Verifique se o arquivo `src/AssistenteIA.jsx` foi criado corretamente.

### Erro: "Bot is not defined"

**Solução**: Verifique se o ícone `Bot` foi adicionado ao import do `lucide-react` no `App.jsx`.

### Erro: "Cannot read property 'role' of null"

**Solução**: Certifique-se de estar logado como coordenador. O componente só é acessível para coordenadores.

### Erro: "Failed to fetch" ao chamar a API Groq

**Solução**: 
1. Verifique sua conexão com a internet
2. Verifique se a API Key está correta
3. Verifique se há bloqueios de CORS (pode ser necessário configurar um proxy)

### Erro: "Data inválida ou incompleta"

**Solução**: Sempre forneça a data no formato DD/MM/AAAA (exemplo: 20/11/2025).

## 🔒 Segurança

### Checklist de Segurança para Produção

- [ ] API Key movida para variáveis de ambiente
- [ ] `.env` adicionado ao `.gitignore`
- [ ] Validação de permissões no backend (Firebase Rules)
- [ ] Rate limiting configurado na API Groq
- [ ] Logs de auditoria implementados
- [ ] Tratamento de erros sensíveis (não expor detalhes internos)

### Firebase Security Rules (Recomendado)

Adicione regras de segurança no Firebase:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /aulas/{aulaId} {
      // Apenas coordenadores podem criar/editar/excluir
      allow create, update, delete: if request.auth != null 
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'coordenador';
      
      // Todos autenticados podem ler
      allow read: if request.auth != null;
    }
  }
}
```

## 📊 Monitoramento

### Logs Importantes

O componente registra logs no console para debug:

```javascript
console.log('Comando do usuário:', comandoUsuario);
console.log('Resposta da IA:', respostaIA);
console.log('Ação executada:', resultado);
```

### Métricas Recomendadas

- Número de comandos processados
- Taxa de sucesso/erro
- Tempo médio de resposta da API
- Tipos de ação mais utilizados (adicionar, editar, excluir)

## 🚀 Deploy

### Vite (Recomendado)

```bash
npm run build
npm run preview
```

### Firebase Hosting

```bash
npm run build
firebase deploy --only hosting
```

### Vercel

```bash
npm run build
vercel --prod
```

## 📚 Documentação Adicional

- [Documentação Completa do Assistente IA](./ASSISTENTE_IA_DOCUMENTACAO.md)
- [Documentação da API Groq](https://console.groq.com/docs)
- [Documentação do Firebase](https://firebase.google.com/docs)

## 🆘 Suporte

Para dúvidas ou problemas:

1. Consulte a [Documentação Completa](./ASSISTENTE_IA_DOCUMENTACAO.md)
2. Verifique os logs do console do navegador
3. Execute o script de teste: `node test_groq_api.js`
4. Entre em contato com o administrador do sistema

## 📝 Changelog

### Versão 1.0.0 (Novembro 2025)

**Funcionalidades Implementadas:**
- ✅ Adicionar aulas com múltiplos horários/cursos/laboratórios
- ✅ Editar aulas existentes
- ✅ Excluir aulas por ID ou critérios
- ✅ Confirmação dupla antes de executar ações
- ✅ Validação robusta de dados
- ✅ Verificação de conflitos
- ✅ Interface de chat intuitiva
- ✅ Integração com API Groq
- ✅ Integração com Firebase
- ✅ Acesso restrito a coordenadores

**Melhorias Futuras:**
- [ ] Histórico de comandos executados
- [ ] Busca mais avançada para edição/exclusão
- [ ] Suporte a comandos em lote
- [ ] Confirmação visual no calendário
- [ ] Sugestões de comandos baseadas no contexto
- [ ] Logs de auditoria mais detalhados

---

**Versão**: 1.0.0  
**Data**: Novembro 2025  
**Autor**: Sistema CronoLab
