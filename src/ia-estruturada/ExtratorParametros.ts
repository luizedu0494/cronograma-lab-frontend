/**
 * ExtratorParametros.ts
 *
 * Sistema de extração de parâmetros estruturados a partir do texto do usuário.
 * Identifica datas, horários, cursos, laboratórios, assuntos, etc.
 */

import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);
dayjs.locale('pt-br');

export interface ParametrosExtraidos {
  data: string | null;
  mes: string | null;
  ano: string | null;
  horario: string | null;
  cursos: string[];
  laboratorios: string[];
  assunto: string | null;
  termoBusca: string | null;
}

export interface ValidacaoResultado {
  valido: boolean;
  mensagemErro: string | null;
}

// Constantes do sistema
const CURSOS_VALIDOS = [
  'biomedicina',
  'farmácia',
  'farmacia',
  'enfermagem',
  'odontologia',
  'medicina',
  'fisioterapia',
  'nutrição',
  'nutricao',
  'ed. física',
  'ed fisica',
  'educação física',
  'educacao fisica',
  'psicologia',
  'medicina veterinária',
  'medicina veterinaria',
  'química tecnológica',
  'quimica tecnologica',
  'engenharia',
  'tec. e cosmético',
  'tec e cosmetico',
];

const HORARIOS_VALIDOS = [
  '07:00-09:10',
  '09:30-12:00',
  '13:00-15:10',
  '15:30-18:00',
  '18:30-20:10',
  '20:30-22:00',
];

const TIPOS_LABORATORIO: Record<string, string[]> = {
  anatomia: ['anatomia 1', 'anatomia 2', 'anatomia 3', 'anatomia 4', 'anatomia 5', 'anatomia 6'],
  microscopia_normal: [
    'microscopia 1',
    'microscopia 2',
    'microscopia 3',
    'microscopia 4',
    'microscopia 5',
  ],
  microscopia_galeria: ['microscopia 6', 'microscopia 7'],
  multidisciplinar: [
    'multidisciplinar 1',
    'multidisciplinar 2',
    'multidisciplinar 3',
    'multidisciplinar 4',
  ],
  habilidades_ney: [
    'habilidades ney braga 1',
    'habilidades ney braga 2',
    'habilidades ney braga 3',
    'habilidades ney braga 4',
  ],
  habilidades_santander: [
    'habilidades santander 1',
    'habilidades santander 2',
    'habilidades santander 3',
  ],
  habilidades_galeria: ['habilidades galeria 1', 'habilidades galeria 2', 'habilidades galeria 3'],
  especializados: ['farmacêutico', 'farmaceutico', 'tec. dietética', 'tec dietetica', 'uda'],
};

class ExtratorParametros {
  private mesesPorExtenso: Record<string, number>;
  private diasSemana: Record<string, number>;

  constructor() {
    this.mesesPorExtenso = {
      janeiro: 1,
      fevereiro: 2,
      março: 3,
      marco: 3,
      abril: 4,
      maio: 5,
      junho: 6,
      julho: 7,
      agosto: 8,
      setembro: 9,
      outubro: 10,
      novembro: 11,
      dezembro: 12,
    };

    this.diasSemana = {
      domingo: 0,
      segunda: 1,
      terça: 2,
      terca: 2,
      quarta: 3,
      quinta: 4,
      sexta: 5,
      sábado: 6,
      sabado: 6,
    };
  }

  /**
   * Extrai todos os parâmetros relevantes do texto
   * @param texto - Texto da consulta do usuário
   */
  extrair(texto: string): Partial<ParametrosExtraidos> {
    if (!texto || typeof texto !== 'string') {
      return {};
    }

    const textoNormalizado = texto.toLowerCase().trim();

    return {
      data: this.extrairData(textoNormalizado),
      mes: this.extrairMes(textoNormalizado),
      ano: this.extrairAno(textoNormalizado),
      horario: this.extrairHorario(textoNormalizado),
      cursos: this.extrairCursos(textoNormalizado),
      laboratorios: this.extrairLaboratorios(textoNormalizado),
      assunto: this.extrairAssunto(textoNormalizado, texto),
      termoBusca: this.extrairTermoBusca(textoNormalizado, texto),
    };
  }

  /**
   * Extrai data do texto (formato DD/MM/AAAA ou termos relativos)
   * @param texto - Texto normalizado
   */
  extrairData(texto: string): string | null {
    // Padrão DD/MM/AAAA
    const padraoDataCompleta = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
    const matchData = texto.match(padraoDataCompleta);

    if (matchData) {
      const [_, dia, mes, ano] = matchData;
      const data = dayjs(`${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`);
      if (data.isValid()) {
        return data.format('DD/MM/YYYY');
      }
    }

    // Termos relativos
    if (/\b(hoje)\b/.test(texto)) {
      return dayjs().format('DD/MM/YYYY');
    }

    if (/\b(amanhã|amanha)\b/.test(texto)) {
      return dayjs().add(1, 'day').format('DD/MM/YYYY');
    }

    if (/\b(ontem)\b/.test(texto)) {
      return dayjs().subtract(1, 'day').format('DD/MM/YYYY');
    }

    // Próximo dia da semana
    for (const [dia, numero] of Object.entries(this.diasSemana)) {
      const regex = new RegExp(`\\b(próxima|proxima|próximo|proximo)?\\s*${dia}\\b`, 'i');
      if (regex.test(texto)) {
        const hoje = dayjs();
        const diaAtual = hoje.day();
        let diasAte = numero - diaAtual;
        if (diasAte <= 0) diasAte += 7;
        return hoje.add(diasAte, 'day').format('DD/MM/YYYY');
      }
    }

    return null;
  }

  /**
   * Extrai mês do texto
   * @param texto - Texto normalizado
   */
  extrairMes(texto: string): string | null {
    // Mês por extenso
    for (const [mes, numero] of Object.entries(this.mesesPorExtenso)) {
      const regex = new RegExp(`\\b${mes}\\b`, 'i');
      if (regex.test(texto)) {
        const ano = this.extrairAno(texto) || dayjs().year();
        return `${String(numero).padStart(2, '0')}/${ano}`;
      }
    }

    // Padrão MM/YYYY
    const padraoMes = /(\d{1,2})\/(\d{4})/;
    const matchMes = texto.match(padraoMes);
    if (matchMes) {
      const [_, mes, ano] = matchMes;
      return `${mes.padStart(2, '0')}/${ano}`;
    }

    // Termos relativos
    if (/\b(este mês|esse mês|mês atual|mes atual)\b/.test(texto)) {
      return dayjs().format('MM/YYYY');
    }

    if (/\b(próximo mês|proximo mes|mês que vem|mes que vem)\b/.test(texto)) {
      return dayjs().add(1, 'month').format('MM/YYYY');
    }

    if (/\b(mês passado|mes passado)\b/.test(texto)) {
      return dayjs().subtract(1, 'month').format('MM/YYYY');
    }

    return null;
  }

  /**
   * Extrai ano do texto
   * @param texto - Texto normalizado
   */
  extrairAno(texto: string): string | null {
    const padraoAno = /\b(20\d{2})\b/;
    const matchAno = texto.match(padraoAno);
    if (matchAno) {
      return matchAno[1];
    }

    if (/\b(este ano|esse ano|ano atual)\b/.test(texto)) {
      return String(dayjs().year());
    }

    if (/\b(próximo ano|proximo ano|ano que vem)\b/.test(texto)) {
      return String(dayjs().add(1, 'year').year());
    }

    if (/\b(ano passado)\b/.test(texto)) {
      return String(dayjs().subtract(1, 'year').year());
    }

    return null;
  }

  /**
   * Extrai horário do texto
   * @param texto - Texto normalizado
   */
  extrairHorario(texto: string): string | null {
    const padraoHorario = /\b(\d{1,2}):(\d{2})\b/;
    const matchHorario = texto.match(padraoHorario);

    if (matchHorario) {
      const [_, hora, minuto] = matchHorario;
      const horarioFormatado = `${hora.padStart(2, '0')}:${minuto}`;

      for (const slot of HORARIOS_VALIDOS) {
        if (slot.startsWith(horarioFormatado)) {
          return slot;
        }
      }

      return horarioFormatado;
    }

    if (/\b(manhã|manha|matutino|07:00|09:30)\b/.test(texto)) {
      return HORARIOS_VALIDOS[0];
    }

    if (/\b(tarde|vespertino|13:00|15:30)\b/.test(texto)) {
      return HORARIOS_VALIDOS[2];
    }

    if (/\b(noite|noturno|18:30|20:30)\b/.test(texto)) {
      return HORARIOS_VALIDOS[4];
    }

    return null;
  }

  /**
   * Extrai cursos mencionados no texto
   * @param texto - Texto normalizado
   */
  extrairCursos(texto: string): string[] {
    const cursosEncontrados: string[] = [];

    for (const curso of CURSOS_VALIDOS) {
      const regex = new RegExp(`\\b${curso}\\b`, 'i');
      if (regex.test(texto)) {
        cursosEncontrados.push(this.normalizarCurso(curso));
      }
    }

    return [...new Set(cursosEncontrados)];
  }

  /**
   * Normaliza o nome do curso
   * @param curso - Nome do curso
   */
  normalizarCurso(curso: string): string {
    const mapeamento: Record<string, string> = {
      farmacia: 'Farmácia',
      nutricao: 'Nutrição',
      'ed fisica': 'Ed. Física',
      'educacao fisica': 'Ed. Física',
      'medicina veterinaria': 'Medicina Veterinária',
      'quimica tecnologica': 'Química Tecnológica',
      'tec e cosmetico': 'Tec. e Cosmético',
    };

    const cursoNormalizado = curso.toLowerCase();
    return (
      mapeamento[cursoNormalizado] || curso.charAt(0).toUpperCase() + curso.slice(1).toLowerCase()
    );
  }

  /**
   * Extrai laboratórios mencionados no texto
   * @param texto - Texto normalizado
   */
  extrairLaboratorios(texto: string): string[] {
    const laboratoriosEncontrados: string[] = [];

    for (const labs of Object.values(TIPOS_LABORATORIO)) {
      for (const lab of labs) {
        const regex = new RegExp(`\\b${lab}\\b`, 'i');
        if (regex.test(texto)) {
          laboratoriosEncontrados.push(lab);
        }
      }
    }

    const padraoLab = /\b(lab|laboratório|laboratorio)\s*(\d+)\b/gi;
    const matchesLab = texto.matchAll(padraoLab);
    for (const match of matchesLab) {
      const numero = match[2];
      laboratoriosEncontrados.push(`lab ${numero}`);
    }

    return [...new Set(laboratoriosEncontrados)];
  }

  /**
   * Extrai assunto da aula
   * @param textoNormalizado - Texto normalizado
   * @param textoOriginal - Texto original (com capitalização)
   */
  extrairAssunto(textoNormalizado: string, textoOriginal: string): string | null {
    const padroes = [
      /\b(aula|aulas)\s+(de|sobre|do|da)\s+([a-záàâãéèêíïóôõöúçñ\s]+?)(?:\s+para|\s+no|\s+em|\s+às|\s+as|\s*$)/i,
      /\b(adicionar|criar|agendar)\s+aula\s+de\s+([a-záàâãéèêíïóôõöúçñ\s]+?)(?:\s+para|\s+no|\s+em|\s+às|\s+as|\s*$)/i,
      /\b([a-záàâãéèêíïóôõöúçñ]+)\s+para\s+\d{1,2}\/\d{1,2}\/\d{4}/i,
    ];

    for (const padrao of padroes) {
      const match = textoOriginal.match(padrao);
      if (match) {
        const assunto = match[match.length - 1].trim();
        const palavrasRemover = ['aula', 'aulas', 'de', 'sobre', 'do', 'da', 'no', 'na'];
        const assuntoLimpo = assunto
          .split(' ')
          .filter(palavra => !palavrasRemover.includes(palavra.toLowerCase()))
          .join(' ');

        if (assuntoLimpo.length > 2) {
          return assuntoLimpo;
        }
      }
    }

    return null;
  }

  /**
   * Extrai termo de busca genérico (para buscar em assunto/observações)
   * @param textoNormalizado - Texto normalizado
   * @param textoOriginal - Texto original
   */
  extrairTermoBusca(textoNormalizado: string, textoOriginal: string): string | null {
    const padraoAulaDe =
      /\b(aula|aulas)\s+(de|sobre)\s+([a-záàâãéèêíïóôõöúçñ\s]+?)(?:\s+em|\s+no|\s+para|\s*\?|\s*$)/i;
    const match = textoOriginal.match(padraoAulaDe);

    if (match) {
      return match[3].trim();
    }

    const padraoTem = /\btem\s+(aula\s+de\s+)?([a-záàâãéèêíïóôõöúçñ\s]+?)(?:\s*\?|\s*$)/i;
    const matchTem = textoOriginal.match(padraoTem);

    if (matchTem) {
      return matchTem[2].trim();
    }

    return null;
  }

  /**
   * Valida se os parâmetros extraídos são suficientes para a ação
   * @param parametros - Parâmetros extraídos
   * @param tipoIntencao - Tipo de intenção
   */
  validar(parametros: Partial<ParametrosExtraidos>, tipoIntencao: string): ValidacaoResultado {
    switch (tipoIntencao) {
      case 'adicionar_aula':
        if (!parametros.data) {
          return {
            valido: false,
            mensagemErro: 'Data completa (DD/MM/AAAA) é obrigatória para adicionar aula.',
          };
        }
        if (!parametros.assunto && !parametros.termoBusca) {
          return { valido: false, mensagemErro: 'Assunto da aula é obrigatório.' };
        }
        break;

      case 'editar_aula':
      case 'excluir_aula':
        if (!parametros.data && !parametros.assunto && !parametros.termoBusca) {
          return {
            valido: false,
            mensagemErro: 'É necessário especificar ao menos a data ou o assunto da aula.',
          };
        }
        break;
    }

    return { valido: true, mensagemErro: null };
  }
}

export default ExtratorParametros;
