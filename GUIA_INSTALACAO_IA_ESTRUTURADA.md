# Guia de Instalação e Uso - Sistema de Consulta Estruturada

## O que foi implementado?

Foi criado um **sistema de IA estruturado** que permite consultar e gerenciar aulas através de **linguagem natural**, retornando respostas em **formato de dados diretos** (tabelas, cards, gráficos), **sem interface de chat tradicional**.

### Principais Características

✅ **Interface Minimalista**: Campo de texto único + área de resultado focada em dados  
✅ **Processamento Inteligente**: Sistema híbrido (regras + IA OpenAI)  
✅ **Consultas em Linguagem Natural**: "Quantas aulas tem hoje?", "Aulas de Medicina em dezembro"  
✅ **Ações Completas**: Adicionar, editar, excluir aulas com confirmação  
✅ **Visualização Profissional**: Cards, tabelas, gráficos (sem balões de chat)  
✅ **Reconhecimento de Voz**: Suporte para consultas por voz  
✅ **Validação Robusta**: Verificação de conflitos e validação de dados  

## Arquivos Criados

```
src/ia-estruturada/
├── ClassificadorIntencao.js      # Identifica o tipo de consulta/ação
├── ExtratorParametros.js         # Extrai datas, horários, cursos, etc.
├── ProcessadorConsultas.js       # Motor principal de IA
├── ExecutorAcoes.js              # Executa ações no Firebase
├── FormatadorResultados.jsx      # Componentes visuais de resultado
├── ConsultaEstruturada.jsx       # Interface principal
├── README.md                     # Documentação completa
└── testes.js                     # Testes unitários
```

### Arquivos Modificados

```
src/App.jsx                       # Adicionado import e rota para ConsultaEstruturada
```

## Como Usar

### 1. Acessar o Sistema

**Rota:** `/consulta-estruturada`

**Permissões:** Apenas coordenadores

**Menu:** Menu Principal > Consulta Estruturada

### 2. Fazer Consultas

Digite sua consulta no campo de texto e clique em "Consultar" ou pressione Enter.

#### Exemplos de Consultas

**Consultar Aulas:**
- "Qual é a aula de hoje?"
- "Aulas de Medicina em dezembro"
- "Tem aula de anatomia?"
- "Aulas no Anatomia 1"

**Consultar Quantidade:**
- "Quantas aulas tem hoje?"
- "Quantas aulas tem no ano?"
- "Quantas aulas de Medicina em novembro?"

**Consultar Horário:**
- "Qual o horário da aula de anatomia?"
- "Que horas é a aula de bioquímica?"

**Adicionar Aula:**
- "Adicionar aula de Anatomia para 25/12/2025 às 07:00"
- "Criar aula de Bioquímica para 30/11/2025 no Multidisciplinar 1"

**Editar Aula:**
- "Editar aula de Anatomia do dia 25/12/2025, mudar horário para 09:30"
- "Alterar aula de Bioquímica de 30/11/2025"

**Excluir Aula:**
- "Excluir aula de Anatomia do dia 25/12/2025"
- "Cancelar aula de Bioquímica"

### 3. Usar Reconhecimento de Voz

1. Clique no ícone do microfone
2. Fale sua consulta
3. O texto será transcrito automaticamente
4. Clique em "Consultar"

### 4. Ver Ajuda

Clique no ícone de interrogação (?) no canto superior direito para ver:
- Tipos de consulta suportados
- Exemplos práticos
- Dicas de uso

## Configuração (Opcional)

### API OpenAI

O sistema funciona **sem configuração adicional** usando processamento local baseado em regras.

Para habilitar processamento avançado com IA:

1. Obtenha uma API key do OpenAI
2. Adicione no arquivo `.env`:
   ```env
   VITE_OPENAI_API_KEY=sua_chave_aqui
   ```
3. Reinicie o servidor de desenvolvimento

**Modelos disponíveis no ambiente:**
- `gpt-4.1-mini` (recomendado)
- `gpt-4.1-nano`
- `gemini-2.5-flash`

## Diferenças entre Assistente IA (Chat) e Consulta Estruturada

| Característica | Assistente IA (Chat) | Consulta Estruturada |
|---|---|---|
| Interface | Balões de mensagem | Campo único + área de dados |
| Histórico | Mantém conversação | Sem histórico |
| Foco | Conversação | Dados diretos |
| Visualização | Texto + cards | Cards, tabelas, gráficos |
| Uso | Exploratório | Objetivo e direto |

## Tipos de Resultado

### 1. Card Resumo
Exibe estatísticas agregadas:
- Total de aulas
- Próxima aula agendada
- Laboratório mais utilizado

**Exemplo:** "Quantas aulas tem hoje?"

### 2. Tabela de Aulas
Lista detalhada com:
- Assunto
- Data
- Horário
- Laboratório
- Cursos envolvidos

**Exemplo:** "Aulas de Medicina em dezembro"

### 3. Gráfico de Estatísticas
Visualização gráfica de distribuição de aulas.

**Exemplo:** "Análise de aulas por mês"

### 4. Confirmação de Ação
Feedback de operações (adicionar/editar/excluir):
- Status da operação
- Detalhes dos dados afetados
- Campos alterados

**Exemplo:** "Adicionar aula de Anatomia para 25/12/2025"

## Validações e Segurança

### Verificação de Conflitos
- Antes de adicionar ou editar, o sistema verifica conflitos de horário
- Impede agendamento duplo no mesmo laboratório e horário

### Confirmação de Ações
- Todas as ações (adicionar/editar/excluir) requerem confirmação
- Dialog mostra detalhes da operação antes de executar

### Validação de Dados
- Data obrigatória no formato DD/MM/AAAA para ações
- Validação de cursos, laboratórios e horários válidos
- Mensagens de erro claras com sugestões

## Solução de Problemas

### "Não foi possível processar sua consulta"
- Tente reformular a consulta de forma mais clara
- Use datas no formato DD/MM/AAAA para ações
- Seja específico (ex: inclua data E assunto ao editar)

### "Múltiplas aulas encontradas"
- Adicione mais detalhes à consulta (data, horário, laboratório)
- Use data completa para identificar aula específica

### "Conflito de horário detectado"
- Escolha outro horário ou laboratório
- Verifique se já existe aula agendada no mesmo horário/lab

### Reconhecimento de voz não funciona
- Verifique se seu navegador suporta Web Speech API
- Permita acesso ao microfone quando solicitado
- Use Chrome ou Edge para melhor compatibilidade

## Exemplos Práticos

### Cenário 1: Verificar aulas do dia
```
Consulta: "Qual é a aula de hoje?"

Resultado:
┌─────────────────────────────────────────────────────┐
│ 3 aula(s) encontrada(s) - 21/11/2025                │
├─────────────────────────────────────────────────────┤
│ Assunto         │ Data       │ Horário     │ Lab    │
│ Anatomia        │ 21/11/2025 │ 07:00-09:10 │ Ana 1  │
│ Bioquímica      │ 21/11/2025 │ 09:30-12:00 │ Multi 1│
│ Fisiologia      │ 21/11/2025 │ 13:00-15:10 │ Ana 2  │
└─────────────────────────────────────────────────────┘
```

### Cenário 2: Planejar mês seguinte
```
Consulta: "Quantas aulas tem em dezembro?"

Resultado:
┌─────────────────────────────────────────────────────┐
│ Resumo - 12/2025                                    │
├─────────────────────────────────────────────────────┤
│ Total de Aulas: 42                                  │
│ Próxima Aula: Anatomia - 02/12/2025 às 07:00        │
│ Laboratório Mais Usado: Anatomia 1                  │
└─────────────────────────────────────────────────────┘
```

### Cenário 3: Adicionar aula urgente
```
Consulta: "Adicionar aula de Anatomia para 25/12/2025 às 07:00 no Anatomia 1"

Confirmação:
┌─────────────────────────────────────────────────────┐
│ Confirma adicionar aula de "Anatomia"               │
│ para 25/12/2025 às 07:00-09:10?                     │
│                                                     │
│ ⚠️ Esta ação irá modificar o cronograma             │
│                                                     │
│ [Cancelar]  [Confirmar]                             │
└─────────────────────────────────────────────────────┘

Após Confirmar:
┌─────────────────────────────────────────────────────┐
│ ✓ Aula Adicionada                                   │
│ 1 aula(s) adicionada(s) com sucesso!                │
│                                                     │
│ Detalhes:                                           │
│ - Assunto: Anatomia                                 │
│ - Data: 25/12/2025                                  │
│ - Horário: 07:00-09:10                              │
│ - Laboratório: Anatomia 1                           │
└─────────────────────────────────────────────────────┘
```

### Cenário 4: Corrigir erro de agendamento
```
Consulta: "Editar aula de Anatomia do dia 25/12/2025, mudar horário para 09:30"

Confirmação:
┌─────────────────────────────────────────────────────┐
│ Confirma editar aula de Anatomia,                   │
│ alterando horário para 09:30-12:00?                 │
│                                                     │
│ [Cancelar]  [Confirmar]                             │
└─────────────────────────────────────────────────────┘

Após Confirmar:
┌─────────────────────────────────────────────────────┐
│ ✓ Aula Editada                                      │
│ Aula editada com sucesso!                           │
│                                                     │
│ Campos Alterados: horarios                          │
└─────────────────────────────────────────────────────┘
```

## Próximos Passos

1. **Testar o Sistema:**
   - Acesse `/consulta-estruturada`
   - Teste diferentes tipos de consulta
   - Verifique se os resultados estão corretos

2. **Configurar API OpenAI (Opcional):**
   - Adicione a chave no `.env`
   - Teste consultas complexas

3. **Treinar Usuários:**
   - Mostre exemplos de consultas
   - Explique diferença entre chat e consulta estruturada
   - Demonstre reconhecimento de voz

4. **Coletar Feedback:**
   - Identifique consultas que não funcionam bem
   - Ajuste padrões de reconhecimento se necessário
   - Adicione novos tipos de visualização conforme demanda

## Suporte Técnico

Para problemas ou dúvidas:

1. Consulte o README completo em `src/ia-estruturada/README.md`
2. Execute os testes em `src/ia-estruturada/testes.js`
3. Verifique o console do navegador para erros
4. Entre em contato com o desenvolvedor

---

**Sistema desenvolvido para otimizar o gerenciamento de cronograma de laboratórios CESMAC**

**Data:** Novembro 2025  
**Versão:** 1.0.0
