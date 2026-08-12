# 📥 Upload de Cronograma Externo — Análise e Proposta de Implementação
> **CronoLab — CESMAC** · Funcionalidade exclusiva para Coordenador

---

## 1. Contexto e Objetivo

O sistema já possui `ImportarCronograma.jsx` e `ImportarAgendamento.jsx`, que indicam que a base para importação existe mas provavelmente é manual ou limitada. A nova funcionalidade proposta é:

> O coordenador faz upload de um cronograma externo (Excel/CSV/JSON), o sistema analisa automaticamente cada item e exibe uma tela de revisão onde o coordenador escolhe **o que será agendado ou não**, com feedback visual de conflitos, incompatibilidades e itens válidos.

---

## 2. Análise do Projeto Atual

### O que já existe (aproveitar)
| Arquivo | Função atual | Como reaproveitá-lo |
|---|---|---|
| `ImportarCronograma.jsx` | Importação parcial de dados | Refatorar como base da nova tela |
| `ImportarAgendamento.jsx` | Agendamento de itens importados | Reutilizar lógica de agendamento em batch |
| `analiseCronograma.js` | Utilitário de análise de horários | Base para detecção de conflitos |
| `DownloadCronograma.jsx` | Exporta para Excel com `ExcelJS` | Referenciar parser de colunas (schema do xlsx) |
| `aulaQueries.js` | Queries no Firestore | Reutilizar para verificar ocupação |
| `GerenciarPeriodos.jsx` | Períodos acadêmicos ativos | Validar se as datas do arquivo estão dentro do período |
| `AuthContext.jsx` | Controle de perfil | Guard para acesso exclusivo de coordenador |

### O que precisa ser criado
- `UploadCronogramaExterno.jsx` — tela principal (página exclusiva do coordenador)
- `src/utils/parseCronogramaExterno.ts` — parser de arquivos (xlsx, csv, json)
- `src/utils/analisarItensImportados.ts` — motor de análise e classificação
- Integração na rota de navegação do coordenador

---

## 3. Fluxo da Funcionalidade

```
[Coordenador acessa "Importar Cronograma Externo"]
        │
        ▼
[ETAPA 1 — Upload]
  Arrasta ou seleciona o arquivo (.xlsx / .csv / .json)
  Sistema lê e extrai os itens do arquivo
        │
        ▼
[ETAPA 2 — Análise automática]
  Para cada item, o sistema verifica:
  ✅ Laboratório existe no sistema?
  ✅ Data está dentro de um período ativo?
  ✅ Horário não conflita com aulas existentes?
  ✅ Curso/disciplina é reconhecido?
  ⚠️ Item fora do padrão mas recuperável?
  ❌ Conflito ou dado inválido?
        │
        ▼
[ETAPA 3 — Tela de revisão interativa]
  Lista de todos os itens com status visual:
  🟢 Válido — pronto para agendar
  🟡 Atenção — válido mas com aviso (ex: lab diferente do habitual)
  🔴 Conflito — horário ocupado ou dado inválido
  
  Coordenador seleciona/deseleciona cada item com checkboxes
  Filtros rápidos: "Mostrar só válidos", "Mostrar conflitos"
        │
        ▼
[ETAPA 4 — Confirmação e agendamento em batch]
  Somente os itens selecionados são agendados
  Log de resultado: X agendados, Y ignorados, Z com erro
  Notificação push/Telegram opcional para técnicos
```

---

## 4. Formatos de Arquivo Suportados

### 4.1 Word (.docx / .doc) — formato mais comum na prática

Este é o caso mais complexo pois o cronograma pode vir como **tabela formatada** ou **texto corrido** dentro do documento.

#### Estratégia: biblioteca `mammoth`

`mammoth` converte `.docx` para HTML no browser, permitindo extrair tabelas com estrutura preservada. Para `.doc` legado, o sistema orienta o coordenador a salvar como `.docx` antes de importar (conversão automática no server-side não é viável no plano Spark).

```typescript
// src/utils/parseCronogramaExterno.ts

import mammoth from 'mammoth'; // já disponível no projeto (listado em componentes React)

async function parseDocx(arquivo: File): Promise<ItemBruto[]> {
  const arrayBuffer = await arquivo.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });

  // Extrair tabelas do HTML gerado
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const tabelas = doc.querySelectorAll('table');

  if (tabelas.length === 0) {
    // Fallback: tentar extrair de texto corrido por padrões de data/horário
    return extrairDeTextoCorrido(doc.body.innerText);
  }

  // Pegar a tabela com mais colunas (geralmente é o cronograma)
  const tabelaPrincipal = Array.from(tabelas)
    .sort((a, b) => b.querySelectorAll('th, td').length - a.querySelectorAll('th, td').length)[0];

  return extrairDeTabela(tabelaPrincipal);
}

function extrairDeTabela(tabela: Element): ItemBruto[] {
  const linhas = Array.from(tabela.querySelectorAll('tr'));
  if (linhas.length < 2) return [];

  // Primeira linha = cabeçalho
  const cabecalho = Array.from(linhas[0].querySelectorAll('th, td'))
    .map(cel => cel.textContent?.trim().toLowerCase() ?? '');

  // Mapear índices das colunas pelo MAPA_COLUNAS
  const indices = mapearIndices(cabecalho, MAPA_COLUNAS);

  // Demais linhas = dados
  return linhas.slice(1).map(linha => {
    const cels = Array.from(linha.querySelectorAll('td'));
    return {
      data:          cels[indices.data]?.textContent?.trim(),
      horarioInicio: cels[indices.horarioInicio]?.textContent?.trim(),
      horarioFim:    cels[indices.horarioFim]?.textContent?.trim(),
      laboratorio:   cels[indices.laboratorio]?.textContent?.trim(),
      disciplina:    cels[indices.disciplina]?.textContent?.trim(),
      professor:     cels[indices.professor]?.textContent?.trim(),
      curso:         cels[indices.curso]?.textContent?.trim(),
      turno:         cels[indices.turno]?.textContent?.trim(),
    };
  }).filter(item => item.data || item.laboratorio); // remove linhas vazias
}

// Fallback para cronogramas em texto corrido (sem tabela)
// Exemplo de padrão comum: "10/08 - Anatomia 1 - 08:00 às 10:00 - Medicina"
function extrairDeTextoCorrido(texto: string): ItemBruto[] {
  const linhas = texto.split('\n').filter(l => l.trim());
  const REGEX_DATA = /\d{1,2}\/\d{1,2}(\/\d{2,4})?/;
  const REGEX_HORA = /\d{1,2}:\d{2}/g;

  return linhas
    .filter(linha => REGEX_DATA.test(linha))
    .map(linha => {
      const datas = linha.match(REGEX_DATA);
      const horas = linha.match(REGEX_HORA) || [];
      return {
        data:          datas?.[0],
        horarioInicio: horas[0],
        horarioFim:    horas[1],
        textoOriginal: linha, // preservar para exibição na tela de revisão
      };
    });
}
```

#### Aviso sobre `.doc` (formato antigo binário)

`.doc` (Word 97-2003) **não pode ser lido diretamente no browser**. O sistema deve exibir um aviso orientando o coordenador:

```jsx
// Detecção na etapa de upload
if (arquivo.name.endsWith('.doc') && !arquivo.name.endsWith('.docx')) {
  return (
    <Alert severity="warning" sx={{ mt: 2 }}>
      <AlertTitle>Formato .doc não suportado diretamente</AlertTitle>
      Abra o arquivo no Word e salve como <strong>.docx</strong> (Arquivo → Salvar como → Word (.docx)).
      O sistema aceita .docx, .xlsx, .csv e .json.
    </Alert>
  );
}
```

---

### 4.2 Excel (.xlsx) — formato mais estruturado

O parser deve mapear colunas flexíveis (nomes em português e variações comuns):

```typescript
const MAPA_COLUNAS = {
  data:          ['data', 'date', 'dia', 'data da aula'],
  horarioInicio: ['inicio', 'hora início', 'horário início', 'start', 'h. início'],
  horarioFim:    ['fim', 'hora fim', 'horário fim', 'end', 'h. fim', 'término'],
  laboratorio:   ['lab', 'laboratório', 'sala', 'room', 'local'],
  disciplina:    ['disciplina', 'matéria', 'aula', 'subject', 'componente'],
  professor:     ['professor', 'docente', 'teacher', 'prof'],
  curso:         ['curso', 'turma', 'course', 'graduação'],
  turno:         ['turno', 'period', 'período', 'turno/período'],
};
```

### 4.3 CSV (.csv) — suporte secundário
- Detectar separador automaticamente (`,` ou `;`)
- Usar `papaparse` (já disponível no projeto)

### 4.4 JSON (.json) — para integrações futuras com outros sistemas
- Array de objetos com chaves livres mapeadas pelo `MAPA_COLUNAS`

---

## 5. Motor de Análise — Classificação de Itens

```typescript
// src/utils/analisarItensImportados.ts

type StatusItem = 'valido' | 'atencao' | 'conflito' | 'invalido';

interface ItemAnalisado {
  original: Record<string, any>;    // dados brutos do arquivo
  normalizado: AulaInput | null;    // dados convertidos para o schema do sistema
  status: StatusItem;
  motivos: string[];                // ex: ["Horário conflita com Medicina - Anatomia 1"]
  selecionado: boolean;             // controlado pelo coordenador na tela de revisão
}

// Verificações em ordem de prioridade:
async function analisarItem(item, aulasExistentes, periodos, laboratorios): Promise<ItemAnalisado> {
  const motivos: string[] = [];
  let status: StatusItem = 'valido';

  // 1. Validar campos obrigatórios
  if (!item.data || !item.laboratorio) {
    return { status: 'invalido', motivos: ['Dados obrigatórios ausentes (data ou laboratório)'], ... };
  }

  // 2. Verificar se laboratório existe
  const labExiste = laboratorios.some(l => normalizar(l.nome) === normalizar(item.laboratorio));
  if (!labExiste) {
    motivos.push(`Laboratório "${item.laboratorio}" não encontrado no sistema`);
    status = 'conflito';
  }

  // 3. Verificar período acadêmico ativo
  const dentroDoPeriodo = periodos.some(p =>
    dayjs(item.data).isBetween(p.inicio, p.fim, 'day', '[]')
  );
  if (!dentroDoPeriodo) {
    motivos.push('Data fora de qualquer período acadêmico ativo');
    status = status === 'valido' ? 'atencao' : status;
  }

  // 4. Verificar conflito de horário no lab
  const conflito = aulasExistentes.find(a =>
    a.laboratorio === item.laboratorio &&
    a.data === item.data &&
    horariosColidem(a.horario, item.horario)
  );
  if (conflito) {
    motivos.push(`Conflito com "${conflito.disciplina}" no mesmo horário`);
    status = 'conflito';
  }

  // 5. Verificar feriado
  const ehFeriado = await verificarFeriado(item.data); // reaproveitando holiday-api.jsx
  if (ehFeriado) {
    motivos.push(`Data é feriado: ${ehFeriado.name}`);
    status = status === 'valido' ? 'atencao' : status;
  }

  return {
    original: item,
    normalizado: montarAulaInput(item),
    status,
    motivos,
    selecionado: status === 'valido', // pré-seleciona só os válidos
  };
}
```

---

## 6. Interface da Tela de Revisão

### Estrutura do componente principal

```jsx
// src/UploadCronogramaExterno.jsx

// ETAPA 1 — Upload (Stepper com 3 etapas)
<Stepper activeStep={etapa}>
  <Step label="Upload do Arquivo" />
  <Step label="Análise" />
  <Step label="Revisão e Confirmação" />
</Stepper>

// ETAPA 2 — Análise (feedback visual durante processamento)
<Box sx={{ textAlign: 'center', py: 4 }}>
  <CircularProgress />
  <Typography>Analisando {total} itens...</Typography>
  <LinearProgress value={(analisados / total) * 100} />
</Box>

// ETAPA 3 — Tabela de revisão
<Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
  {/* Chips de resumo */}
  <Chip icon={<CheckCircle />} label={`${validos} válidos`} color="success" />
  <Chip icon={<Warning />}     label={`${atencao} atenção`} color="warning" />
  <Chip icon={<Error />}       label={`${conflitos} conflitos`} color="error" />
  
  {/* Filtros rápidos */}
  <Button onClick={() => setFiltro('todos')}>Todos</Button>
  <Button onClick={() => setFiltro('valido')}>Só válidos</Button>
  <Button onClick={() => setFiltro('conflito')}>Conflitos</Button>
</Box>

{/* Lista de itens com checkbox */}
{itensFiltrados.map((item, idx) => (
  <ItemRevisaoCard
    key={idx}
    item={item}
    onToggle={() => toggleSelecionado(idx)}
  />
))}

{/* Barra de ação fixa no rodapé */}
<Box sx={{ position: 'sticky', bottom: 0, bgcolor: 'background.paper', p: 2 }}>
  <Typography>{selecionados} de {total} itens selecionados</Typography>
  <Button
    variant="contained"
    disabled={selecionados === 0}
    onClick={agendar}
  >
    Agendar {selecionados} item(ns) selecionado(s)
  </Button>
</Box>
```

### Card de item individual

```jsx
// Variações visuais por status
const COR_STATUS = {
  valido:   { borda: 'success.main', fundo: 'rgba(76,175,80,0.05)' },
  atencao:  { borda: 'warning.main', fundo: 'rgba(255,152,0,0.05)' },
  conflito: { borda: 'error.main',   fundo: 'rgba(244,67,54,0.05)' },
  invalido: { borda: 'grey.400',     fundo: 'rgba(0,0,0,0.03)' },
};

<Paper sx={{
  borderLeft: `4px solid`,
  borderColor: COR_STATUS[item.status].borda,
  bgcolor: COR_STATUS[item.status].fundo,
  p: 2, mb: 1,
  opacity: item.status === 'invalido' ? 0.5 : 1,
}}>
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
    <Checkbox
      checked={item.selecionado}
      disabled={item.status === 'invalido'}
      onChange={() => onToggle()}
    />
    <Box sx={{ flex: 1 }}>
      <Typography variant="body1" fontWeight={600}>
        {item.original.disciplina || '(sem disciplina)'} — {item.original.laboratorio}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {formatarData(item.original.data)} · {item.original.horario} · {item.original.curso}
      </Typography>
      {/* Motivos de atenção/conflito */}
      {item.motivos.map((m, i) => (
        <Typography key={i} variant="caption" color={corTextoStatus(item.status)}>
          ⚠ {m}
        </Typography>
      ))}
    </Box>
    <StatusBadge status={item.status} />
  </Box>
</Paper>
```

---

## 7. Agendamento em Batch

```javascript
// Lógica de agendamento em lote (em UploadCronogramaExterno.jsx)

const agendar = async () => {
  const itensSelecionados = itens.filter(i => i.selecionado && i.normalizado);
  setAgendando(true);
  
  const resultados = { sucesso: 0, erro: 0, detalhes: [] };
  
  // Firestore suporta batches de até 500 operações
  const chunks = dividirEmChunks(itensSelecionados, 400);
  
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach(item => {
      const ref = doc(collection(db, 'aulas'));
      batch.set(ref, {
        ...item.normalizado,
        criadoPor: usuarioAtual.uid,
        criadoEm: serverTimestamp(),
        origem: 'importacao_externa',
        nomeArquivoOrigem: nomeArquivo,
      });
    });
    
    try {
      await batch.commit();
      resultados.sucesso += chunk.length;
    } catch (err) {
      resultados.erro += chunk.length;
      resultados.detalhes.push(err.message);
    }
  }
  
  setResultado(resultados);
  setEtapa(3); // vai para tela de resultado
  
  // Log para auditoria
  await addDoc(collection(db, 'logs_importacao'), {
    coordenador: usuarioAtual.uid,
    arquivo: nomeArquivo,
    totalImportados: resultados.sucesso,
    totalIgnorados: itensSelecionados.length - resultados.sucesso,
    timestamp: serverTimestamp(),
  });
};
```

---

## 8. Controle de Acesso — Somente Coordenador

```jsx
// src/UploadCronogramaExterno.jsx — guard no topo do componente

import { useAuth } from './AuthContext';
import { Navigate } from 'react-router-dom';

export default function UploadCronogramaExterno() {
  const { usuario, perfil } = useAuth();

  if (!usuario || perfil !== 'coordenador') {
    return <Navigate to="/" replace />;
  }

  // ... resto do componente
}
```

```jsx
// Em App.jsx — rota protegida
<Route
  path="/importar-cronograma-externo"
  element={
    <RotaProtegida perfisPermitidos={['coordenador']}>
      <UploadCronogramaExterno />
    </RotaProtegida>
  }
/>
```

O menu de navegação do coordenador também deve exibir o item somente quando `perfil === 'coordenador'`.

---

## 9. Auditoria e Rastreabilidade

Cada aula criada por importação deve ter campos extras no Firestore:

```javascript
{
  // campos normais da aula...
  origem: 'importacao_externa',        // distingue de aulas criadas manualmente
  nomeArquivoOrigem: 'cronograma_sem2.xlsx',
  coordenadorImportador: 'uid123',
  dataImportacao: Timestamp,
}
```

Coleção `logs_importacao` para histórico:
```javascript
{
  coordenador: 'uid123',
  arquivo: 'cronograma_sem2.xlsx',
  totalNoArquivo: 120,
  totalSelecionados: 98,
  totalAgendados: 95,
  totalComErro: 3,
  timestamp: Timestamp,
}
```

---

## 10. Template de Arquivo para Download

Oferecer um botão **"Baixar modelo .xlsx"** na tela de upload, para que os coordenadores saibam o formato esperado:

```javascript
// Gerar template com ExcelJS (já usado em DownloadCronograma.jsx)
const gerarTemplate = async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Cronograma');
  
  ws.columns = [
    { header: 'Data',          key: 'data',        width: 12 }, // formato: DD/MM/AAAA
    { header: 'Horário Início',key: 'horarioInicio',width: 15 }, // formato: HH:MM
    { header: 'Horário Fim',   key: 'horarioFim',  width: 15 },
    { header: 'Laboratório',   key: 'laboratorio', width: 20 }, // nome exato do sistema
    { header: 'Disciplina',    key: 'disciplina',  width: 25 },
    { header: 'Professor',     key: 'professor',   width: 25 },
    { header: 'Curso',         key: 'curso',       width: 20 },
    { header: 'Turno',         key: 'turno',       width: 12 }, // Manhã/Tarde/Noite
  ];
  
  // Linha de exemplo
  ws.addRow({
    data: '15/08/2025', horarioInicio: '08:00', horarioFim: '10:00',
    laboratorio: 'Anatomia 1', disciplina: 'Anatomia Humana I',
    professor: 'Prof. Silva', curso: 'Medicina', turno: 'Manhã',
  });
  
  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), 'modelo_importacao_cronolab.xlsx');
};
```

---

## 11. Plano de Implementação — Ordem Sugerida

| Etapa | O que fazer | Arquivos envolvidos | Estimativa |
|---|---|---|---|
| **1** | Criar parser de arquivo (docx/xlsx/csv/json) | `parseCronogramaExterno.ts` | 1.5 dias |
| **2** | Criar motor de análise e classificação | `analisarItensImportados.ts` | 1–2 dias |
| **3** | Criar componente de upload (etapa 1 do stepper) | `UploadCronogramaExterno.jsx` | 0.5 dia |
| **4** | Criar tela de análise com progress bar | Mesmo arquivo | 0.5 dia |
| **5** | Criar tela de revisão interativa com cards | Mesmo arquivo + `ItemRevisaoCard.jsx` | 2 dias |
| **6** | Implementar agendamento em batch | `aulaQueries.js` + Firestore batch | 1 dia |
| **7** | Guard de acesso + rota em App.jsx | `App.jsx`, `AuthContext.jsx` | 0.5 dia |
| **8** | Gerar template de download | Reutilizar `ExcelJS` de `DownloadCronograma.jsx` | 0.5 dia |
| **9** | Adicionar log de auditoria + coleção Firestore | `logs_importacao` | 0.5 dia |
| **10** | Testes e ajustes de UX | — | 1 dia |

**Total estimado: ~8 dias úteis de desenvolvimento**

---

## 12. Dependências

| Dependência | Uso nesta feature | Status |
|---|---|---|
| `ExcelJS` | Ler e gerar arquivos `.xlsx` | ✅ Já instalado |
| `papaparse` | Ler arquivos `.csv` | ✅ Já instalado |
| `mammoth` | Ler arquivos `.docx` e extrair tabelas | ✅ Já instalado (usado nos componentes React do projeto) |
| `dayjs` | Manipular e comparar datas | ✅ Já instalado |
| `firebase/firestore` | Batch write + log | ✅ Já configurado |
| `@mui/material` | Todos os componentes de UI | ✅ Já instalado |
| `file-saver` (saveAs) | Download do template | ✅ Já usado em DownloadCronograma |

**Nenhuma nova dependência é necessária.**

> ⚠️ **`.doc` (Word antigo):** não é lido pelo browser. O sistema exibe um aviso orientando o coordenador a salvar como `.docx` antes de importar.

---

## 13. Considerações Finais

- **Zero impacto para outros perfis**: a funcionalidade fica 100% restrita ao coordenador, sem alterar fluxos de técnicos e alunos.
- **Compatível com plano Spark do Firebase**: o batch write é eficiente e não gera leituras excessivas — a análise usa dados já carregados em memória.
- **Reversível**: como cada aula tem `origem: 'importacao_externa'`, o coordenador (ou uma futura tela de gestão) pode filtrar e excluir todas as aulas de uma importação específica.
- **Extensível**: a arquitetura do motor de análise permite adicionar novas verificações (ex: carga horária máxima do lab por semana) sem reescrever a tela.
