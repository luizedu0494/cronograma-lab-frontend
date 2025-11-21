# Arquitetura da IA Estruturada - Sistema de Consulta de Aulas

## Análise do Sistema Atual

### Problemas Identificados
1. **Interface de Chat Tradicional**: Usa balões de mensagem e histórico de conversação
2. **Respostas Mistas**: Combina texto narrativo com dados estruturados
3. **Processamento Limitado**: A IA não está executando todas as operações corretamente
4. **Dependência Externa**: Usa API Groq (llama-3.1-8b-instant) que pode ter limitações

### Estrutura Atual
- **AssistenteIA.jsx**: Componente principal com interface de chat
- **ResultadoVisual.jsx**: Componente para exibir dados estruturados (cards e tabelas)
- **Firebase**: Backend para armazenar aulas
- **Groq API**: Processamento de linguagem natural

## Nova Arquitetura Proposta

### 1. Interface Minimalista de Consulta

**Componente: `ConsultaEstruturada.jsx`**

```
┌─────────────────────────────────────────────┐
│  Sistema de Consulta de Aulas              │
├─────────────────────────────────────────────┤
│                                             │
│  [Campo de texto para consulta]    [Enviar]│
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │   RESULTADO EM FORMATO DE DADOS       │ │
│  │                                       │ │
│  │   [Cards, Tabelas, Gráficos]          │ │
│  │                                       │ │
│  └───────────────────────────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

**Características:**
- Campo de texto único no topo
- Área de resultado que ocupa 90% da tela
- Sem histórico de mensagens
- Sem balões de chat
- Foco total nos dados retornados

### 2. Motor de Processamento Inteligente

**Componente: `ProcessadorConsultas.js`**

#### 2.1 Sistema de Classificação de Intenção

```javascript
TIPOS_CONSULTA = {
  CONSULTA_SIMPLES: 'consultar_aula',
  CONSULTA_ESTATISTICA: 'estatisticas',
  ADICIONAR_AULA: 'adicionar',
  EDITAR_AULA: 'editar',
  EXCLUIR_AULA: 'excluir',
  CONSULTA_HORARIO: 'horario_especifico',
  CONSULTA_QUANTIDADE: 'quantidade'
}
```

#### 2.2 Extração de Parâmetros

**Padrões de Reconhecimento:**
- **Datas**: "hoje", "amanhã", "DD/MM/AAAA", "próxima semana", "dezembro"
- **Horários**: "07:00", "manhã", "tarde", "noite", slots específicos
- **Cursos**: Lista de cursos válidos
- **Laboratórios**: Lista de laboratórios válidos
- **Assuntos**: Busca por palavra-chave

#### 2.3 Processamento Híbrido

**Opção A: IA Local (OpenAI API disponível)**
- Usar `gpt-4.1-mini` ou `gemini-2.5-flash` disponíveis no ambiente
- Prompt otimizado para extração de dados estruturados
- Retorno sempre em JSON

**Opção B: Sistema de Regras + IA**
- Regras para consultas simples e diretas
- IA apenas para casos complexos ou ambíguos
- Maior confiabilidade e velocidade

### 3. Camada de Dados e Execução

**Componente: `ExecutorAcoes.js`**

```javascript
class ExecutorAcoes {
  async consultarAulas(criterios) {
    // Busca no Firebase
    // Retorna dados estruturados
  }
  
  async adicionarAula(dados) {
    // Validação
    // Inserção no Firebase
    // Retorna confirmação estruturada
  }
  
  async editarAula(criterios, novos_dados) {
    // Busca aula(s)
    // Atualiza
    // Retorna resultado estruturado
  }
  
  async excluirAula(criterios) {
    // Busca aula(s)
    // Remove
    // Retorna confirmação estruturada
  }
  
  async obterEstatisticas(criterios) {
    // Calcula estatísticas
    // Retorna dados agregados
  }
}
```

### 4. Formatadores de Resposta

**Componente: `FormatadorResultados.jsx`**

#### 4.1 Tipos de Visualização

**CARD_RESUMO**: Para consultas de quantidade/estatísticas
```javascript
{
  tipo: 'card_resumo',
  dados: {
    total_aulas: 15,
    proxima_aula: {
      assunto: 'Anatomia',
      data: '22/11/2025',
      horario: '07:00-09:10'
    },
    laboratorio_mais_usado: 'Anatomia 1'
  }
}
```

**TABELA_AULAS**: Para listagem de aulas
```javascript
{
  tipo: 'tabela_aulas',
  dados: [
    {
      id: 'xxx',
      assunto: 'Anatomia Humana',
      data: '22/11/2025',
      horario: '07:00-09:10',
      laboratorio: 'Anatomia 1',
      cursos: ['Medicina', 'Enfermagem']
    }
  ]
}
```

**CONFIRMACAO_ACAO**: Para adicionar/editar/excluir
```javascript
{
  tipo: 'confirmacao_acao',
  acao: 'adicionar',
  status: 'sucesso',
  mensagem: 'Aula adicionada com sucesso',
  dados_afetados: {
    total_aulas_adicionadas: 1,
    detalhes: {...}
  }
}
```

**GRAFICO_ESTATISTICAS**: Para análises
```javascript
{
  tipo: 'grafico_estatisticas',
  dados: {
    labels: ['Nov', 'Dez', 'Jan'],
    valores: [10, 15, 8],
    tipo_grafico: 'bar'
  }
}
```

### 5. Fluxo de Processamento

```
Usuário digita consulta
        ↓
Classificador de Intenção
        ↓
Extrator de Parâmetros
        ↓
Validador de Dados
        ↓
Executor de Ação
        ↓
Formatador de Resultado
        ↓
Renderizador Visual
        ↓
Exibição na Tela
```

## Implementação Técnica

### Estrutura de Arquivos

```
src/
├── ia-estruturada/
│   ├── ConsultaEstruturada.jsx          # Interface principal
│   ├── ProcessadorConsultas.js          # Motor de IA
│   ├── ExecutorAcoes.js                 # Operações no Firebase
│   ├── FormatadorResultados.jsx         # Componentes visuais
│   ├── ClassificadorIntencao.js         # Análise de intenção
│   ├── ExtratorParametros.js            # Extração de dados
│   └── ValidadorDados.js                # Validação de entrada
```

### Tecnologias

- **React**: Interface
- **Material-UI**: Componentes visuais
- **Firebase**: Backend
- **OpenAI API** (gpt-4.1-mini): Processamento de linguagem natural
- **Chart.js**: Gráficos e estatísticas
- **dayjs**: Manipulação de datas

### Exemplos de Uso

**Consulta 1**: "Qual é a aula de hoje?"
```javascript
// Resultado
{
  tipo: 'tabela_aulas',
  titulo: 'Aulas de Hoje (21/11/2025)',
  dados: [
    {
      assunto: 'Anatomia Humana',
      horario: '07:00-09:10',
      laboratorio: 'Anatomia 1',
      cursos: ['Medicina']
    }
  ]
}
```

**Consulta 2**: "Quantas aulas tem no ano?"
```javascript
// Resultado
{
  tipo: 'card_resumo',
  titulo: 'Estatísticas do Ano 2025',
  dados: {
    total_aulas: 245,
    por_mes: {...},
    por_curso: {...}
  }
}
```

**Consulta 3**: "Qual o horário da aula de anatomia?"
```javascript
// Resultado
{
  tipo: 'tabela_aulas',
  titulo: 'Aulas de Anatomia',
  dados: [
    {
      assunto: 'Anatomia Humana',
      data: '22/11/2025',
      horario: '07:00-09:10',
      laboratorio: 'Anatomia 1'
    }
  ]
}
```

**Consulta 4**: "Adicionar aula de bioquímica para 25/12/2025 às 15:30 no lab 2"
```javascript
// Resultado
{
  tipo: 'confirmacao_acao',
  acao: 'adicionar',
  status: 'sucesso',
  mensagem: 'Aula adicionada com sucesso',
  dados: {
    assunto: 'Bioquímica',
    data: '25/12/2025',
    horario: '15:30-18:00',
    laboratorio: 'Multidisciplinar 2'
  }
}
```

## Vantagens da Nova Arquitetura

1. **Foco nos Dados**: Interface limpa, sem distrações
2. **Respostas Diretas**: Dados estruturados, não narrativas
3. **Processamento Robusto**: Sistema híbrido (regras + IA)
4. **Escalabilidade**: Fácil adicionar novos tipos de consulta
5. **Performance**: Consultas simples não precisam de IA
6. **Confiabilidade**: Validação em múltiplas camadas
7. **Experiência do Usuário**: Resposta visual imediata

## Próximos Passos

1. Implementar `ProcessadorConsultas.js` com sistema de regras
2. Criar `ConsultaEstruturada.jsx` com interface minimalista
3. Desenvolver `FormatadorResultados.jsx` com todos os tipos visuais
4. Integrar com OpenAI API disponível no ambiente
5. Testar com casos de uso reais
6. Otimizar performance e UX
