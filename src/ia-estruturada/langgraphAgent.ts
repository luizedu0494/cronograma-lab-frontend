import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { ClassificadorIntencao } from "./ClassificadorIntencao";
import { ExtratorParametros } from "./ExtratorParametros";
import { ExecutorAcoes } from "./ExecutorAcoes";
import { TODAS_FERRAMENTAS_LANGCHAIN } from "./langchainTools";

// Definindo o Estado do Grafo de IA
export const AgentState = Annotation.Root({
  mensagemUsuario: Annotation<string>(),
  intencaoLocal: Annotation<any>(),
  parametrosExtraidos: Annotation<any>(),
  requerConfirmacao: Annotation<boolean>(),
  propostaPendente: Annotation<any>(),
  resultadoExecucao: Annotation<any>(),
  erro: Annotation<string>(),
});

/**
 * Nó 1: Classificação Local Rápida (Determinística / Heurística)
 */
async function classificarLocalNode(state: typeof AgentState.State) {
  const classificador = new ClassificadorIntencao();
  const extrator = new ExtratorParametros();

  const intencao = classificador.classificar(state.mensagemUsuario);
  const parametros = extrator.extrair(state.mensagemUsuario);

  let requerConfirmacao = false;
  if (intencao.categoria === 'agendar' || intencao.categoria === 'cancelar') {
    requerConfirmacao = true;
  }

  return {
    intencaoLocal: intencao,
    parametrosExtraidos: parametros,
    requerConfirmacao,
  };
}

/**
 * Nó 2: Processamento e Execução de Ações
 */
async function executarAcaoNode(state: typeof AgentState.State) {
  try {
    const executor = new ExecutorAcoes();
    const resultado = await executor.executar({
      intencao: state.intencaoLocal?.categoria || 'consultar',
      acao: state.intencaoLocal?.categoria === 'agendar' ? 'propor' : 'consultar',
      criterios_busca: state.parametrosExtraidos || {},
      tipo_visual: 'lista_simples',
    });

    return {
      resultadoExecucao: resultado,
    };
  } catch (err: any) {
    return {
      erro: err.message || 'Erro ao processar solicitação no LangGraph',
    };
  }
}

// Construção do Grafo
const workflow = new StateGraph(AgentState)
  .addNode("classificar_local", classificarLocalNode)
  .addNode("executar_acao", executarAcaoNode)
  .addEdge(START, "classificar_local")
  .addEdge("classificar_local", "executar_acao")
  .addEdge("executar_acao", END);

export const langgraphAgent = workflow.compile();
export default langgraphAgent;
