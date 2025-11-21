# Sistema de Consulta Estruturada - IA para Gerenciamento de Aulas

## Visão Geral

Este sistema implementa uma **IA estruturada** que processa consultas em linguagem natural e retorna respostas em **formato de dados diretos**, sem interface de chat tradicional. O foco é em **eficiência, clareza e profissionalismo**.

## Arquitetura

### Componentes Principais

```
┌─────────────────────────────────────────────────────────────┐
│                    ConsultaEstruturada.jsx                  │
│              (Interface Minimalista de Consulta)            │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   ProcessadorConsultas.js                   │
│              (Motor de Processamento de IA)                 │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────┐  ┌──────────────────────────┐   │
│  │ ClassificadorIntencao │  │  ExtratorParametros      │   │
│  └───────────────────────┘  └──────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     ExecutorAcoes.js                        │
│              (Execução de Ações no Firebase)                │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  FormatadorResultados.jsx                   │
│              (Visualização de Dados Estruturados)           │
└─────────────────────────────────────────────────────────────┘
```

### 1. ClassificadorIntencao.js

**Responsabilidade:** Identificar a intenção do usuário usando padrões e palavras-chave.

**Tipos de Intenção:**
- `CONSULTAR_AULA`: Buscar informações sobre aulas
- `CONSULTAR_HORARIO`: Verificar horário de aula específica
- `CONSULTAR_QUANTIDADE`: Contar número de aulas
- `CONSULTAR_ESTATISTICAS`: Gerar análises e estatísticas
- `ADICIONAR_AULA`: Criar nova aula
- `EDITAR_AULA`: Modificar aula existente
- `EXCLUIR_AULA`: Remover aula

**Exemplo:**
```javascript
const classificador = new ClassificadorIntencao();
const intencao = classificador.classificar("Quantas aulas tem hoje?");
// Retorna: CONSULTAR_QUANTIDADE
```

### 2. ExtratorParametros.js

**Responsabilidade:** Extrair parâmetros estruturados do texto do usuário.

**Parâmetros Extraídos:**
- **Data:** DD/MM/AAAA ou termos relativos ("hoje", "amanhã")
- **Mês:** MM/YYYY ou por extenso ("dezembro")
- **Ano:** YYYY ou termos relativos ("ano passado")
- **Horário:** HH:MM ou períodos ("manhã", "tarde", "noite")
- **Cursos:** Lista de cursos mencionados
- **Laboratórios:** Lista de laboratórios mencionados
- **Assunto:** Tema da aula
- **Termo de Busca:** Palavra-chave genérica

**Exemplo:**
```javascript
const extrator = new ExtratorParametros();
const params = extrator.extrair("Aulas de Medicina em dezembro de 2025");
// Retorna: { mes: "12/2025", cursos: ["Medicina"] }
```

### 3. ProcessadorConsultas.js

**Responsabilidade:** Motor principal que integra classificação, extração e processamento.

**Fluxo de Processamento:**
1. Classifica a intenção
2. Extrai parâmetros
3. Valida dados
4. Decide entre processamento local ou com IA
5. Retorna dados estruturados

**Processamento Híbrido:**
- **Local:** Para consultas simples e diretas (mais rápido)
- **IA (OpenAI):** Para casos complexos ou ambíguos (mais inteligente)

**Exemplo:**
```javascript
const processador = new ProcessadorConsultas();
const resultado = await processador.processar("Quantas aulas tem hoje?");
// Retorna: { acao: "consultar", tipo_visual: "card_resumo", ... }
```

### 4. ExecutorAcoes.js

**Responsabilidade:** Executar ações no Firebase e retornar dados estruturados.

**Ações Suportadas:**
- **consultar:** Busca aulas no Firebase
- **adicionar:** Cria novas aulas (com verificação de conflitos)
- **editar:** Atualiza aulas existentes
- **excluir:** Remove aulas

**Tipos de Resultado:**
- `card_resumo`: Estatísticas agregadas
- `tabela_aulas`: Lista detalhada de aulas
- `grafico_estatisticas`: Dados para gráficos
- `confirmacao_acao`: Resultado de operações

**Exemplo:**
```javascript
const executor = new ExecutorAcoes(currentUser);
const resultado = await executor.executar(dadosProcessados);
// Retorna: { tipo: "tabela_aulas", dados_consulta: [...] }
```

### 5. FormatadorResultados.jsx

**Responsabilidade:** Renderizar resultados de forma visual e estruturada.

**Componentes de Visualização:**
- **CardResumo:** Cards com estatísticas (total, próxima aula, lab mais usado)
- **TabelaAulas:** Tabela detalhada com assunto, data, horário, lab, cursos
- **GraficoEstatisticas:** Gráfico de barras com distribuição
- **ConfirmacaoAcao:** Feedback de operações (adicionar/editar/excluir)

### 6. ConsultaEstruturada.jsx

**Responsabilidade:** Interface minimalista focada em dados.

**Características:**
- Campo de texto único no topo
- Botão de envio e reconhecimento de voz
- Área de resultado que ocupa 90% da tela
- Sem histórico de mensagens
- Sem balões de chat
- Exemplos de consultas clicáveis
- Dialog de ajuda

## Exemplos de Uso

### Consultas

#### 1. Consulta Simples
```
Usuário: "Qual é a aula de hoje?"

Resultado:
┌─────────────────────────────────────────┐
│ 2 aula(s) encontrada(s) - 21/11/2025    │
├─────────────────────────────────────────┤
│ Assunto      │ Data       │ Horário     │
│ Anatomia     │ 21/11/2025 │ 07:00-09:10 │
│ Bioquímica   │ 21/11/2025 │ 13:00-15:10 │
└─────────────────────────────────────────┘
```

#### 2. Consulta de Quantidade
```
Usuário: "Quantas aulas tem no ano?"

Resultado:
┌─────────────────────────────────────────┐
│         Resumo - 2025                   │
├─────────────────────────────────────────┤
│  Total de Aulas: 245                    │
│  Próxima Aula: Anatomia - 22/11/2025    │
│  Lab Mais Usado: Anatomia 1             │
└─────────────────────────────────────────┘
```

#### 3. Consulta com Filtros
```
Usuário: "Aulas de Medicina em dezembro"

Resultado:
┌─────────────────────────────────────────┐
│ 15 aula(s) - Medicina - 12/2025         │
├─────────────────────────────────────────┤
│ [Tabela com 15 aulas]                   │
└─────────────────────────────────────────┘
```

#### 4. Consulta por Termo
```
Usuário: "Tem aula de bcmol?"

Resultado:
┌─────────────────────────────────────────┐
│ 3 aula(s) encontrada(s) - "bcmol"       │
├─────────────────────────────────────────┤
│ [Tabela com aulas que contêm "bcmol"]   │
└─────────────────────────────────────────┘
```

### Ações

#### 5. Adicionar Aula
```
Usuário: "Adicionar aula de Anatomia para 25/12/2025 às 07:00 no Anatomia 1"

Confirmação:
┌─────────────────────────────────────────┐
│ Confirma adicionar aula de "Anatomia"   │
│ para 25/12/2025 às 07:00-09:10?         │
│                                         │
│ [Cancelar]  [Confirmar]                 │
└─────────────────────────────────────────┘

Resultado:
┌─────────────────────────────────────────┐
│ ✓ Aula Adicionada                       │
│ 1 aula(s) adicionada(s) com sucesso!    │
│                                         │
│ Detalhes:                               │
│ - Assunto: Anatomia                     │
│ - Data: 25/12/2025                      │
└─────────────────────────────────────────┘
```

#### 6. Editar Aula
```
Usuário: "Editar aula de Anatomia do dia 25/12/2025, mudar horário para 09:30"

Confirmação:
┌─────────────────────────────────────────┐
│ Confirma editar aula de Anatomia,       │
│ alterando horário para 09:30-12:00?     │
│                                         │
│ [Cancelar]  [Confirmar]                 │
└─────────────────────────────────────────┘

Resultado:
┌─────────────────────────────────────────┐
│ ✓ Aula Editada                          │
│ Aula editada com sucesso!               │
│                                         │
│ Campos Alterados: horarios              │
└─────────────────────────────────────────┘
```

#### 7. Excluir Aula
```
Usuário: "Excluir aula de Anatomia do dia 25/12/2025"

Confirmação:
┌─────────────────────────────────────────┐
│ Confirma excluir aula de Anatomia?      │
│                                         │
│ ⚠️ Esta ação irá modificar o cronograma │
│                                         │
│ [Cancelar]  [Confirmar]                 │
└─────────────────────────────────────────┘

Resultado:
┌─────────────────────────────────────────┐
│ ✓ Aula Excluída                         │
│ Aula excluída com sucesso!              │
│                                         │
│ Assunto: Anatomia                       │
│ Data: 25/12/2025                        │
└─────────────────────────────────────────┘
```

## Casos de Teste

### Testes de Classificação

```javascript
// Teste 1: Consulta simples
classificador.classificar("Qual é a aula de hoje?")
// Esperado: CONSULTAR_AULA

// Teste 2: Consulta de quantidade
classificador.classificar("Quantas aulas tem em novembro?")
// Esperado: CONSULTAR_QUANTIDADE

// Teste 3: Adicionar aula
classificador.classificar("Adicionar aula de Anatomia para 25/12/2025")
// Esperado: ADICIONAR_AULA

// Teste 4: Editar aula
classificador.classificar("Mudar horário da aula de Anatomia")
// Esperado: EDITAR_AULA

// Teste 5: Excluir aula
classificador.classificar("Cancelar aula de Anatomia do dia 25/12")
// Esperado: EXCLUIR_AULA
```

### Testes de Extração

```javascript
// Teste 1: Data completa
extrator.extrair("Aula para 25/12/2025")
// Esperado: { data: "25/12/2025" }

// Teste 2: Data relativa
extrator.extrair("Aula de amanhã")
// Esperado: { data: "22/11/2025" }

// Teste 3: Mês por extenso
extrator.extrair("Aulas de dezembro")
// Esperado: { mes: "12/2025" }

// Teste 4: Horário
extrator.extrair("Aula às 07:00")
// Esperado: { horario: "07:00-09:10" }

// Teste 5: Curso
extrator.extrair("Aulas de Medicina")
// Esperado: { cursos: ["Medicina"] }

// Teste 6: Múltiplos parâmetros
extrator.extrair("Aulas de Medicina em dezembro às 07:00")
// Esperado: { mes: "12/2025", horario: "07:00-09:10", cursos: ["Medicina"] }
```

### Testes de Processamento

```javascript
// Teste 1: Consulta processada localmente
await processador.processar("Quantas aulas tem hoje?")
// Esperado: { acao: "consultar", processamento: "local", tipo_visual: "card_resumo" }

// Teste 2: Consulta complexa (usa IA)
await processador.processar("Me mostre um resumo das aulas de Medicina que acontecem de manhã")
// Esperado: { acao: "consultar", processamento: "ia", ... }

// Teste 3: Validação de erro
await processador.processar("Adicionar aula de Anatomia")
// Esperado: { erro: "Data completa (DD/MM/AAAA) é obrigatória..." }
```

## Configuração

### Variáveis de Ambiente

Adicione no arquivo `.env`:

```env
VITE_OPENAI_API_KEY=your_openai_api_key_here
```

**Nota:** O sistema funciona mesmo sem a API key do OpenAI, usando apenas processamento local baseado em regras.

### Dependências

O sistema usa as seguintes bibliotecas já instaladas no projeto:

- React
- Material-UI (@mui/material)
- Firebase (firestore)
- dayjs
- chart.js + react-chartjs-2

## Acesso

### Rota
```
/consulta-estruturada
```

### Permissões
- **Coordenadores:** Acesso total (consultar, adicionar, editar, excluir)
- **Técnicos:** Sem acesso (apenas coordenadores)

### Menu
O link aparece no menu principal para coordenadores:
```
Menu > Consulta Estruturada
```

## Vantagens do Sistema

### 1. Foco em Dados
- Sem distrações de interface de chat
- Resultados visuais imediatos
- Informação clara e objetiva

### 2. Processamento Inteligente
- Sistema híbrido (regras + IA)
- Processamento local para consultas simples (rápido)
- IA para casos complexos (inteligente)

### 3. Validação Robusta
- Verificação de conflitos de horário
- Validação de dados em múltiplas camadas
- Mensagens de erro claras e sugestões

### 4. Interface Profissional
- Design limpo e minimalista
- Cores sérias (adequado para ambiente de trabalho)
- Responsivo e acessível

### 5. Flexibilidade
- Suporta linguagem natural
- Reconhecimento de voz
- Múltiplos formatos de visualização

## Melhorias Futuras

1. **Cache de Resultados:** Armazenar consultas frequentes
2. **Histórico de Consultas:** Permitir reutilizar consultas anteriores
3. **Exportação de Dados:** Download de tabelas em Excel/PDF
4. **Filtros Avançados:** Interface visual para construir consultas complexas
5. **Sugestões Inteligentes:** Autocompletar baseado em histórico
6. **Notificações:** Alertas sobre conflitos ou mudanças
7. **Análises Preditivas:** Sugerir melhores horários/laboratórios

## Suporte

Para dúvidas ou problemas:
1. Clique no ícone de ajuda (?) na interface
2. Consulte os exemplos de consultas
3. Entre em contato com o suporte técnico

---

**Desenvolvido para o Sistema de Gerenciamento de Cronograma de Laboratórios CESMAC**
