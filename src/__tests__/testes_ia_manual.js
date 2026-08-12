/**
 * testes.js
 * 
 * Arquivo de testes para validar o funcionamento do sistema de IA estruturada.
 * Execute este arquivo no console do navegador para testar os componentes.
 */

import ClassificadorIntencao, { TIPOS_INTENCAO } from './ClassificadorIntencao';
import ExtratorParametros from './ExtratorParametros';
import ProcessadorConsultas from './ProcessadorConsultas';

// ============================================================================
// TESTES DO CLASSIFICADOR DE INTENÇÃO
// ============================================================================

console.log('========================================');
console.log('TESTES DO CLASSIFICADOR DE INTENÇÃO');
console.log('========================================\n');

const classificador = new ClassificadorIntencao();

const testesClassificacao = [
  // Consultas de aula
  { texto: 'Qual é a aula de hoje?', esperado: TIPOS_INTENCAO.CONSULTAR_AULA },
  { texto: 'Tem aula de anatomia?', esperado: TIPOS_INTENCAO.CONSULTAR_AULA },
  { texto: 'Mostrar aulas de Medicina', esperado: TIPOS_INTENCAO.CONSULTAR_AULA },
  { texto: 'Listar aulas em dezembro', esperado: TIPOS_INTENCAO.CONSULTAR_AULA },
  
  // Consultas de horário
  { texto: 'Qual o horário da aula de anatomia?', esperado: TIPOS_INTENCAO.CONSULTAR_HORARIO },
  { texto: 'Que horas é a aula?', esperado: TIPOS_INTENCAO.CONSULTAR_HORARIO },
  
  // Consultas de quantidade
  { texto: 'Quantas aulas tem hoje?', esperado: TIPOS_INTENCAO.CONSULTAR_QUANTIDADE },
  { texto: 'Quantas aulas tem no ano?', esperado: TIPOS_INTENCAO.CONSULTAR_QUANTIDADE },
  { texto: 'Contar aulas de Medicina', esperado: TIPOS_INTENCAO.CONSULTAR_QUANTIDADE },
  
  // Adicionar aula
  { texto: 'Adicionar aula de Anatomia para 25/12/2025', esperado: TIPOS_INTENCAO.ADICIONAR_AULA },
  { texto: 'Criar nova aula de Bioquímica', esperado: TIPOS_INTENCAO.ADICIONAR_AULA },
  { texto: 'Agendar aula para 30/11/2025', esperado: TIPOS_INTENCAO.ADICIONAR_AULA },
  
  // Editar aula
  { texto: 'Editar aula de Anatomia', esperado: TIPOS_INTENCAO.EDITAR_AULA },
  { texto: 'Mudar horário da aula', esperado: TIPOS_INTENCAO.EDITAR_AULA },
  { texto: 'Alterar aula do dia 25/12', esperado: TIPOS_INTENCAO.EDITAR_AULA },
  
  // Excluir aula
  { texto: 'Excluir aula de Anatomia', esperado: TIPOS_INTENCAO.EXCLUIR_AULA },
  { texto: 'Cancelar aula do dia 25/12', esperado: TIPOS_INTENCAO.EXCLUIR_AULA },
  { texto: 'Remover aula de Bioquímica', esperado: TIPOS_INTENCAO.EXCLUIR_AULA }
];

let acertosClassificacao = 0;
testesClassificacao.forEach((teste, index) => {
  const resultado = classificador.classificar(teste.texto);
  const passou = resultado === teste.esperado;
  
  console.log(`Teste ${index + 1}: ${passou ? '✓' : '✗'}`);
  console.log(`  Texto: "${teste.texto}"`);
  console.log(`  Esperado: ${teste.esperado}`);
  console.log(`  Obtido: ${resultado}`);
  console.log('');
  
  if (passou) acertosClassificacao++;
});

console.log(`Resultado: ${acertosClassificacao}/${testesClassificacao.length} testes passaram\n`);

// ============================================================================
// TESTES DO EXTRATOR DE PARÂMETROS
// ============================================================================

console.log('========================================');
console.log('TESTES DO EXTRATOR DE PARÂMETROS');
console.log('========================================\n');

const extrator = new ExtratorParametros();

const testesExtracao = [
  // Datas
  {
    texto: 'Aula para 25/12/2025',
    esperado: { data: '25/12/2025' }
  },
  {
    texto: 'Aula de hoje',
    esperado: { data: new Date().toLocaleDateString('pt-BR') }
  },
  {
    texto: 'Aula de amanhã',
    esperado: { data: null } // Será calculado dinamicamente
  },
  
  // Meses
  {
    texto: 'Aulas de dezembro',
    esperado: { mes: '12/2025' }
  },
  {
    texto: 'Aulas em novembro de 2025',
    esperado: { mes: '11/2025' }
  },
  
  // Horários
  {
    texto: 'Aula às 07:00',
    esperado: { horario: '07:00-09:10' }
  },
  {
    texto: 'Aula de manhã',
    esperado: { horario: '07:00-09:10' }
  },
  {
    texto: 'Aula à tarde',
    esperado: { horario: '13:00-15:10' }
  },
  {
    texto: 'Aula à noite',
    esperado: { horario: '18:30-20:10' }
  },
  
  // Cursos
  {
    texto: 'Aulas de Medicina',
    esperado: { cursos: ['Medicina'] }
  },
  {
    texto: 'Aulas de Medicina e Enfermagem',
    esperado: { cursos: ['Medicina', 'Enfermagem'] }
  },
  
  // Laboratórios
  {
    texto: 'Aula no Anatomia 1',
    esperado: { laboratorios: ['anatomia 1'] }
  },
  {
    texto: 'Aula no lab 2',
    esperado: { laboratorios: ['lab 2'] }
  },
  
  // Assunto
  {
    texto: 'Aula de Anatomia Humana',
    esperado: { assunto: 'Anatomia Humana' }
  },
  
  // Múltiplos parâmetros
  {
    texto: 'Aulas de Medicina em dezembro às 07:00',
    esperado: {
      mes: '12/2025',
      horario: '07:00-09:10',
      cursos: ['Medicina']
    }
  }
];

let acertosExtracao = 0;
testesExtracao.forEach((teste, index) => {
  const resultado = extrator.extrair(teste.texto);
  
  // Verifica se os campos esperados estão presentes
  let passou = true;
  for (const [campo, valorEsperado] of Object.entries(teste.esperado)) {
    if (valorEsperado !== null && resultado[campo] !== valorEsperado) {
      // Para arrays, compara conteúdo
      if (Array.isArray(valorEsperado)) {
        if (JSON.stringify(resultado[campo]) !== JSON.stringify(valorEsperado)) {
          passou = false;
        }
      } else {
        passou = false;
      }
    }
  }
  
  console.log(`Teste ${index + 1}: ${passou ? '✓' : '✗'}`);
  console.log(`  Texto: "${teste.texto}"`);
  console.log(`  Esperado:`, teste.esperado);
  console.log(`  Obtido:`, resultado);
  console.log('');
  
  if (passou) acertosExtracao++;
});

console.log(`Resultado: ${acertosExtracao}/${testesExtracao.length} testes passaram\n`);

// ============================================================================
// TESTES DO PROCESSADOR DE CONSULTAS
// ============================================================================

console.log('========================================');
console.log('TESTES DO PROCESSADOR DE CONSULTAS');
console.log('========================================\n');

const processador = new ProcessadorConsultas();

const testesProcessamento = [
  {
    texto: 'Quantas aulas tem hoje?',
    esperado: {
      acao: 'consultar',
      tipo_visual: 'card_resumo',
      processamento: 'local'
    }
  },
  {
    texto: 'Aulas de Medicina em dezembro',
    esperado: {
      acao: 'consultar',
      tipo_visual: 'tabela_aulas',
      processamento: 'local'
    }
  },
  {
    texto: 'Adicionar aula de Anatomia para 25/12/2025 às 07:00',
    esperado: {
      acao: 'adicionar',
      processamento: 'local'
    }
  },
  {
    texto: 'Adicionar aula de Anatomia',
    esperado: {
      erro: 'Data completa (DD/MM/AAAA) é obrigatória para adicionar aula.'
    }
  }
];

async function executarTestesProcessamento() {
  let acertosProcessamento = 0;
  
  for (let index = 0; index < testesProcessamento.length; index++) {
    const teste = testesProcessamento[index];
    const resultado = await processador.processar(teste.texto);
    
    let passou = true;
    
    // Verifica se há erro esperado
    if (teste.esperado.erro) {
      passou = resultado.erro && resultado.erro.includes(teste.esperado.erro);
    } else {
      // Verifica campos esperados
      for (const [campo, valorEsperado] of Object.entries(teste.esperado)) {
        if (resultado[campo] !== valorEsperado) {
          passou = false;
        }
      }
    }
    
    console.log(`Teste ${index + 1}: ${passou ? '✓' : '✗'}`);
    console.log(`  Texto: "${teste.texto}"`);
    console.log(`  Esperado:`, teste.esperado);
    console.log(`  Obtido:`, resultado);
    console.log('');
    
    if (passou) acertosProcessamento++;
  }
  
  console.log(`Resultado: ${acertosProcessamento}/${testesProcessamento.length} testes passaram\n`);
  
  // ============================================================================
  // RESUMO FINAL
  // ============================================================================
  
  console.log('========================================');
  console.log('RESUMO FINAL DOS TESTES');
  console.log('========================================\n');
  
  const totalTestes = testesClassificacao.length + testesExtracao.length + testesProcessamento.length;
  const totalAcertos = acertosClassificacao + acertosExtracao + acertosProcessamento;
  const percentual = ((totalAcertos / totalTestes) * 100).toFixed(2);
  
  console.log(`Classificador de Intenção: ${acertosClassificacao}/${testesClassificacao.length}`);
  console.log(`Extrator de Parâmetros: ${acertosExtracao}/${testesExtracao.length}`);
  console.log(`Processador de Consultas: ${acertosProcessamento}/${testesProcessamento.length}`);
  console.log('');
  console.log(`TOTAL: ${totalAcertos}/${totalTestes} (${percentual}%)`);
  console.log('');
  
  if (percentual >= 90) {
    console.log('✓ Sistema funcionando corretamente!');
  } else if (percentual >= 70) {
    console.log('⚠ Sistema funcionando com algumas falhas.');
  } else {
    console.log('✗ Sistema com muitas falhas. Revisar implementação.');
  }
}

// Executa os testes de processamento (assíncronos)
executarTestesProcessamento();

// ============================================================================
// EXPORTAR FUNÇÕES PARA USO NO CONSOLE
// ============================================================================

export {
  classificador,
  extrator,
  processador,
  testesClassificacao,
  testesExtracao,
  testesProcessamento,
  executarTestesProcessamento
};
