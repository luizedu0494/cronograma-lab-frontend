import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import mammoth from 'mammoth';

const MAPA_COLUNAS = {
  data: ['data', 'date', 'dia', 'data da aula', 'dt_aula', 'data_aula'],
  horarioInicio: ['inicio', 'hora início', 'horário início', 'start', 'h. início', 'hora_inicio', 'horario_inicio', 'horario inicio'],
  horarioFim: ['fim', 'hora fim', 'horário fim', 'end', 'h. fim', 'término', 'termino', 'hora_fim', 'horario_fim', 'horario fim'],
  horario: ['horario', 'horário', 'time', 'hora', 'horários', 'horarios'],
  laboratorio: ['lab', 'laboratório', 'laboratorio', 'sala', 'room', 'local', 'lab_nome', 'presencial'],
  disciplina: ['disciplina', 'matéria', 'materia', 'aula', 'subject', 'componente', 'assunto', 'tema'],
  professor: ['professor', 'docente', 'teacher', 'prof', 'prof.', 'docentes', 'docente(s)'],
  curso: ['curso', 'turma', 'course', 'graduação', 'graduacao'],
  turno: ['turno', 'period', 'período', 'periodo'],
  observacoes: ['observações', 'observacoes', 'obs', 'nota', 'detalhes']
};

function normalizarTexto(texto) {
  if (!texto) return '';
  return String(texto)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function encontrarIndiceColuna(cabecalhos, aliases) {
  for (let i = 0; i < cabecalhos.length; i++) {
    const cab = normalizarTexto(cabecalhos[i]);
    if (aliases.some(alias => cab === alias || cab.includes(alias))) {
      return i;
    }
  }
  return -1;
}

function mapearIndiceColunas(cabecalhos) {
  const mapaIndices = {};
  for (const [chave, aliases] of Object.entries(MAPA_COLUNAS)) {
    mapaIndices[chave] = encontrarIndiceColuna(cabecalhos, aliases);
  }
  return mapaIndices;
}

function extrairHorariosComplexos(texto) {
  if (!texto) return { inicio: '', fim: '' };
  
  // Converte formatos como "07h30" para "07:30"
  const normalizado = String(texto).replace(/(\d{1,2})h(\d{2})/g, '$1:$2').replace(/(\d{1,2})h\b/g, '$1:00');
  const horas = normalizado.match(/\d{1,2}:\d{2}/g) || [];

  if (horas.length === 0) return { inicio: '', fim: '' };

  return {
    inicio: horas[0],
    fim: horas[horas.length - 1],
  };
}

function construirItemBruto(linha, indices) {
  const extrairValor = (idx) => (idx !== -1 && linha[idx] !== undefined && linha[idx] !== null) ? String(linha[idx]).trim() : '';
  
  let horarioInicio = extrairValor(indices.horarioInicio);
  let horarioFim = extrairValor(indices.horarioFim);
  const horarioGeral = extrairValor(indices.horario);

  if ((!horarioInicio || !horarioFim) && horarioGeral) {
    const extraido = extrairHorariosComplexos(horarioGeral);
    if (extraido.inicio) horarioInicio = extraido.inicio;
    if (extraido.fim) horarioFim = extraido.fim;
  }

  return {
    data: extrairValor(indices.data),
    horarioInicio,
    horarioFim,
    laboratorio: extrairValor(indices.laboratorio),
    disciplina: extrairValor(indices.disciplina),
    professor: extrairValor(indices.professor),
    curso: extrairValor(indices.curso),
    turno: extrairValor(indices.turno),
    observacoes: extrairValor(indices.observacoes),
  };
}

export async function parseCronogramaExterno(arquivo) {
  const nome = arquivo.name.toLowerCase();

  if (nome.endsWith('.doc') && !nome.endsWith('.docx')) {
    throw new Error('FORMATO_DOC_ANTIGO');
  }

  if (nome.endsWith('.xlsx') || nome.endsWith('.xls')) {
    return await parseXlsx(arquivo);
  } else if (nome.endsWith('.docx')) {
    return await parseDocx(arquivo);
  } else if (nome.endsWith('.csv')) {
    return await parseCsv(arquivo);
  } else if (nome.endsWith('.json')) {
    return await parseJson(arquivo);
  } else {
    throw new Error('FORMATO_NAO_SUPORTADO');
  }
}

async function parseXlsx(arquivo) {
  const buffer = await arquivo.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const matriz = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const valoresLinha = row.values.slice(1).map(val => {
      if (val && typeof val === 'object' && val.result !== undefined) return val.result;
      if (val && typeof val === 'object' && val.text !== undefined) return val.text;
      if (val instanceof Date) return val.toLocaleDateString('pt-BR');
      return val ?? '';
    });
    matriz.push(valoresLinha);
  });

  if (matriz.length < 2) return [];

  const cabecalhos = matriz[0];
  const indices = mapearIndiceColunas(cabecalhos);

  return matriz.slice(1)
    .map(linha => construirItemBruto(linha, indices))
    .filter(item => item.data || item.laboratorio || item.disciplina);
}

// Suporte aprimorado a modelos de cronogramas do CESMAC em .docx (tabelas com metadados no cabeçalho)
async function parseDocx(arquivo) {
  const arrayBuffer = await arquivo.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const tabelas = doc.querySelectorAll('table');

  if (tabelas.length === 0) {
    return extrairTextoCorridoDocx(doc.body.textContent || '');
  }

  // Tabela principal (geralmente a com maior número de elementos)
  const tabelaPrincipal = Array.from(tabelas)
    .sort((a, b) => b.querySelectorAll('th, td').length - a.querySelectorAll('th, td').length)[0];

  const linhas = Array.from(tabelaPrincipal.querySelectorAll('tr'));
  if (linhas.length < 2) return [];

  // Extração de metadados do cabeçalho do documento (ex: Curso, Componente, Docente, Turno)
  const contexto = extrairMetadadosDocx(doc.body.textContent || '');

  // Localizar a linha do cabeçalho da tabela de encontros
  const idxCabecalho = linhas.findIndex(tr => {
    const txt = normalizarTexto(tr.textContent);
    return (txt.includes('encontro') || txt.includes('etapa')) && (txt.includes('data') || txt.includes('dia'));
  });

  const linhaCabecalho = idxCabecalho !== -1 ? linhas[idxCabecalho] : linhas[0];
  const cabecalhos = Array.from(linhaCabecalho.querySelectorAll('th, td')).map(cel => cel.textContent?.trim() ?? '');
  const indices = mapearIndiceColunas(cabecalhos);

  const linhasDados = idxCabecalho !== -1 ? linhas.slice(idxCabecalho + 1) : linhas.slice(1);

  return linhasDados.map(linha => {
    const textoLinha = linha.textContent?.trim() ?? '';
    if (/^\d+ª\s+ETAPA/i.test(textoLinha) || /FINALIZAÇÃO/i.test(textoLinha)) return null;

    const cels = Array.from(linha.querySelectorAll('td')).map(c => c.textContent?.trim() ?? '');
    if (cels.length === 0) return null;

    const item = construirItemBruto(cels, indices);

    // Se a data veio sem ano (ex: "31/07"), inferir o ano atual ou do documento
    if (item.data && !item.data.includes('/202') && !item.data.includes('/203')) {
      const matchData = item.data.match(/(\d{1,2})\/(\d{1,2})/);
      if (matchData) {
        const anoRef = contexto.anoInferido || new Date().getFullYear();
        item.data = `${matchData[1].padStart(2, '0')}/${matchData[2].padStart(2, '0')}/${anoRef}`;
      }
    }

    // Preencher com metadados do documento se a célula estiver em branco
    if (!item.curso && contexto.curso) item.curso = contexto.curso;
    if (!item.disciplina && contexto.disciplina) item.disciplina = contexto.disciplina;
    if (!item.professor && contexto.professor) item.professor = contexto.professor;
    if (!item.turno && contexto.turno) item.turno = contexto.turno;

    return item;
  }).filter(Boolean).filter(item => item.data || item.laboratorio || item.disciplina);
}

function extrairMetadadosDocx(textoCompleto) {
  const norm = textoCompleto;

  const extrairApos = (chave) => {
    const reg = new RegExp(`${chave}[:\\s]+([^\\n\\r]+)`, 'i');
    const match = norm.match(reg);
    return match ? match[1].trim() : '';
  };

  const curso = extrairApos('CURSO');
  const disciplina = extrairApos('COMPONENTE CURRICULAR') || extrairApos('DISCIPLINA');
  const professor = extrairApos('DOCENTE') || extrairApos('PROFESSOR');
  const turno = extrairApos('TURNO');
  
  const anoMatch = norm.match(/\b(202\d)\b/);
  const anoInferido = anoMatch ? parseInt(anoMatch[1], 10) : new Date().getFullYear();

  return { curso, disciplina, professor, turno, anoInferido };
}

function extrairTextoCorridoDocx(texto) {
  const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);
  const REGEX_DATA = /\d{1,2}\/\d{1,2}(\/\d{2,4})?/;
  const REGEX_HORA = /\d{1,2}:\d{2}/g;

  return linhas
    .filter(linha => REGEX_DATA.test(linha))
    .map(linha => {
      const datas = linha.match(REGEX_DATA);
      const horas = linha.match(REGEX_HORA) || [];
      return {
        data: datas?.[0] || '',
        horarioInicio: horas[0] || '',
        horarioFim: horas[1] || '',
        laboratorio: '',
        disciplina: linha,
        professor: '',
        curso: '',
        turno: '',
        observacoes: 'Extraído de texto corrido .docx',
      };
    });
}

function parseCsv(arquivo) {
  return new Promise((resolve, reject) => {
    Papa.parse(arquivo, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          resolve([]);
          return;
        }

        const cabecalhos = Object.keys(results.data[0]);
        const indices = mapearIndiceColunas(cabecalhos);

        const itens = results.data.map(obj => {
          const valores = cabecalhos.map(c => obj[c]);
          return construirItemBruto(valores, indices);
        }).filter(item => item.data || item.laboratorio || item.disciplina);

        resolve(itens);
      },
      error: (err) => reject(err),
    });
  });
}

async function parseJson(arquivo) {
  const conteudo = await arquivo.text();
  const dados = JSON.parse(conteudo);
  const lista = Array.isArray(dados) ? dados : (dados.aulas || dados.cronograma || []);

  if (lista.length === 0) return [];

  const cabecalhos = Object.keys(lista[0]);
  const indices = mapearIndiceColunas(cabecalhos);

  return lista.map(obj => {
    const valores = cabecalhos.map(c => obj[c]);
    return construirItemBruto(valores, indices);
  }).filter(item => item.data || item.laboratorio || item.disciplina);
}
