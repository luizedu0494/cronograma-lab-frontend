# Programa de Sugestões — Agendamento e IA do CronoLab

> Documento de análise e proposta de melhorias para o CronoLab (CESMAC), com foco em:
> (1) experiência de agendamento para **Técnico** e **Coordenador**, e
> (2) evolução do **Assistente de IA**, sempre respeitando o limite **Firebase Spark (gratuito)**.

---

## 1. Metodologia

Esta análise foi feita em cima do código-fonte real do projeto (`src/`, `api/`, `docs/`), incluindo:
- Fluxo de propostas/aprovações (`GerenciarAprovacoes.jsx`, `MinhasPropostas.jsx`, `DesignarTecnicosModal.jsx`)
- Motor de IA híbrido (`ia-estruturada/*.ts`, `AssistenteIATecnico.jsx`, `AssistenteIA.jsx`, `api/groq.js`)
- Documentos de análise já existentes no próprio repositório (`docs/analise_cronolab.md`, `docs/analise_melhorias_cronolab.md`)
- Restrições reais do plano Firebase Spark já mapeadas no código (`useUsageCounter.jsx`, limite de 50.000 leituras/dia)

**Nota importante:** o repositório já contém duas análises anteriores. Parte do que elas recomendavam (ex: visão master-detail em Aprovações e motivo obrigatório de rejeição) **já está implementado** em `GerenciarAprovacoes.jsx`. Este documento não repete o que já foi feito — ele parte do estado atual real do código, aprofunda o fluxo de agendamento e foca com mais profundidade na parte de **IA**, que é o pedido central.

---

## 2. Diagnóstico rápido do estado atual

| Área | Situação atual |
|---|---|
| Agendamento | Blocos de horário fixos, verificação de conflito por lab, fluxo proposta → aprovação/rejeição com motivo obrigatório, designação de múltiplos técnicos |
| Técnico | Painel "hoje" (oficial + agenda privada), Minhas Propostas, Minhas Designações, onboarding de labs favoritos |
| Coordenador | Master-detail em Aprovações, KPIs, análises, importação externa, gestão de usuários/avisos/eventos |
| IA | **Duas IAs separadas**: `AssistenteIA` (coordenador, pode consultar/adicionar/editar/excluir via Groq + motor local) e `AssistenteIATecnico` (técnico, **somente consulta**, bloqueado por prompt para qualquer ação de escrita) |
| Infraestrutura | 100% Firebase Spark + Vercel Serverless, monitor de uso de leituras já existe |

**Ponto central identificado:** o técnico — que é o usuário mais frequente do sistema — tem uma IA deliberadamente limitada a "só responder perguntas". Isso é uma decisão de segurança correta (técnico não deve aprovar/criar aula direto), mas deixa a IA subutilizada no perfil que mais precisa de agilidade no dia a dia. Essa é a maior oportunidade de expansão.

---

## 3. Restrição-guia: continuar 100% no Firebase Spark

Toda sugestão abaixo foi pensada para **não exigir upgrade de plano**:
- Sem Cloud Functions pagas (usar sempre client-side + Vercel Serverless, como já é feito)
- Sem aumento de leituras Firestore em tempo real desnecessárias (preferir `getDocs` pontual a `onSnapshot` permanente onde não há necessidade de tempo real)
- Cache local (`localStorage`/`sessionStorage`) para tudo que não precisa de sincronização entre dispositivos
- Uso do modelo Groq gratuito (`llama-3.1-8b-instant` para tarefas simples, `llama-3.3-70b-versatile` só quando necessário) para manter custo zero e resposta rápida

---

## 4. Melhorias no fluxo de agendamento

### 4.1 Para o Técnico

| Sugestão | Problema que resolve | Custo Spark |
|---|---|---|
| **Proposta assistida por IA** (ver seção 5) | Preencher formulário de proposta é lento e repetitivo | Zero (Groq free) |
| **Confirmação de "lab preparado"** com checklist simples por aula (localStorage) | Hoje não há sinal visual de progresso do dia | Zero |
| **Alerta de aula em ≤30 min** (chip dourado no topo do painel) | Técnico perde o timing de preparar o laboratório | Zero (cálculo local com dados já carregados) |
| **Notificação de status da proposta** (badge + toast via `onSnapshot` já existente, com cleanup) | Técnico precisa checar manualmente "Minhas Propostas" | Já dentro do padrão de leitura existente |
| **"Repetir última proposta"** — duplica os dados da proposta anterior, só troca a data | Aulas recorrentes (ex: mesma disciplina toda semana) exigem preencher tudo de novo | Zero |
| **Modo offline-first no formulário de proposta** — salva rascunho no `localStorage` e envia quando a conexão voltar | Laboratórios costumam ter Wi-Fi instável | Zero |

### 4.2 Para o Coordenador

| Sugestão | Problema que resolve | Custo Spark |
|---|---|---|
| **Aprovação em lote** — selecionar várias propostas sem conflito e aprovar de uma vez | Picos de propostas no início do semestre geram fila | Mesma quantidade de `updateDoc`, só agrupados na UI |
| **Sinalizador de conflito preventivo na tela de aprovação** — antes de aprovar, mostrar se o horário/lab já está ocupado por outra aula aprovada no mesmo slot | Hoje o conflito só é validado no cadastro direto, não necessariamente na tela de aprovação de proposta | Reaproveita query já feita para o mês |
| **Sugestão automática de técnico** ao designar (baseada em quem já atende aquele laboratório com mais frequência) | `DesignarTecnicosModal` hoje exige escolha manual sem contexto de histórico | Calculado a partir de dados já em memória (sem novas leituras) |
| **Exportação seletiva de aprovações pendentes por e-mail/Telegram no fim do dia** (resumo diário automático) | Propostas paradas geram atraso pro técnico | Reaproveita `NotificadorTelegram.ts` já existente, disparado 1x/dia |
| **Painel "semana em risco"** — laboratórios com maior taxa histórica de conflito/cancelamento, destacados no dashboard | Ajuda o coordenador a agir antes do problema, não depois | Reaproveita dados de `AnaliseAulas.jsx` |

### 4.3 Fluxo compartilhado (Técnico + Coordenador)

- **Histórico de conflitos evitados**: toda vez que o sistema bloquear um agendamento por conflito, registrar isso de forma leve (contador, não log completo) para o coordenador enxergar quais laboratórios são mais disputados — direciona decisões de infraestrutura.
- **Padronização de feedback**: todo Snackbar de ação (aprovar, rejeitar, propor, excluir) com o mesmo padrão visual e mesma duração — pequeno, mas reduz fricção cognitiva de quem alterna entre os dois perfis (ex: um coordenador que também atua tecnicamente).

---

## 5. Expansão do Assistente de IA (foco principal)

### 5.1 O que existe hoje

- **Coordenador** (`AssistenteIA` + `ProcessadorConsultas.ts`): motor completo — classifica intenção localmente, tenta resolver sem IA quando possível (ex: "adicionar aula" com todos os dados já extraídos por regex vira ação direta, sem gastar chamada de API), e recorre ao Groq (`llama-3.3-70b-versatile`) para consultas abertas, gráficos e análises (taxa de ocupação, horários vagos, dias lotados etc). Pode consultar, adicionar, editar e excluir.
- **Técnico** (`AssistenteIATecnico` + `llama-3.1-8b-instant`): **apenas consulta**. Qualquer tentativa de ação retorna recusa fixa: *"Meu papel é apenas consultar o cronograma."*

Essa arquitetura híbrida (regras locais + Groq) é uma decisão de projeto muito boa — mantém custo zero e resposta rápida na maioria dos casos. A expansão deve **seguir esse mesmo padrão**, não substituí-lo.

### 5.2 Proposta central: IA do técnico ganha ação, mas sem ganhar poder de aprovação

A recusa atual do assistente do técnico é uma proteção correta contra criar/editar/excluir aulas **diretamente no cronograma oficial**. Mas o técnico já tem, no sistema, um caminho de escrita legítimo: **propor** aula/evento para aprovação. A IA pode operar exatamente dentro desse limite.

**Nova ação permitida para a IA do técnico: `propor`** (nunca `adicionar`, `editar` ou `excluir` direto)

Exemplo de uso:
> Técnico digita: *"Propor revisão de anatomia amanhã às 13h no Lab Anatomia 2 para enfermagem"*
> A IA extrai os parâmetros (já existe `ExtratorParametros.ts` fazendo isso no lado coordenador — é só reaproveitar), monta o rascunho da proposta e **exibe uma tela de confirmação** com os dados preenchidos, exatamente como já acontece hoje no fluxo manual de "Propor Aula".
> O técnico revisa e confirma → a proposta entra na fila de aprovação normal, como se tivesse preenchido o formulário manualmente.

Isso:
- Não quebra a governança (coordenador continua aprovando 100% das propostas)
- Reaproveita 90% do código já existente (`ExtratorParametros.ts`, tela de confirmação, coleção `aulas` com `status: 'pendente'`)
- Resolve a maior fricção do técnico no dia a dia: preencher formulário

### 5.3 Outras expansões de escopo da IA (ambos os perfis)

| Ideia | Descrição | Motor |
|---|---|---|
| **Assistente proativo no painel** ("Hoje você tem 3 aulas, uma delas em 20 min no Lab X") | Resumo gerado localmente, sem chamada de IA — usa os próprios dados já carregados no painel | Regra local, zero custo |
| **Sugestão de horário livre** ("Quero marcar uma aula de anatomia amanhã, qual horário está livre no Lab Anatomia?") | A IA consulta os blocos fixos já existentes e cruza com ocupação do dia — resposta 100% local, sem precisar do Groq | Motor local (`ExecutorAcoes.ts` já tem a estrutura de busca) |
| **Assistente de triagem para o coordenador** ("Quais propostas pendentes têm conflito de horário?") | Roda antes da aprovação, evitando que o coordenador aprove sem perceber sobreposição | Motor local + Groq só se pergunta for aberta |
| **Resumo de fim de dia via Telegram gerado por IA** | Usa o `NotificadorTelegram.ts` já existente + um prompt curto no Groq para gerar um resumo textual das aulas do dia seguinte | Groq (`llama-3.1-8b-instant`, baixíssimo custo, 1 chamada/dia) |
| **Busca por voz mais robusta** | O botão de microfone já existe (`MicIcon`/`isRecording`) na tela do técnico — vale garantir fallback de texto quando o navegador não suportar Web Speech API, e mostrar transcrição antes de enviar, para reduzir erro de reconhecimento | Client-side, zero custo |
| **Sugestões de consulta (chips clicáveis)** | Já estava no roadmap anterior do repo e ainda não aparece implementado nos arquivos analisados — reforçar como prioridade, pois reduz a curva de aprendizado de quem nunca usou IA | Zero custo |
| **Memória curta de conversa** | Hoje cada pergunta parece ser tratada isoladamente. Manter as últimas 2–3 mensagens como contexto (sem persistir no Firestore, só em `state`) permite perguntas de acompanhamento tipo "e na quinta?" sem repetir tudo | Zero custo extra (mesmo payload, só mais mensagens no `messages[]` do Groq) |

### 5.4 Governança e segurança da IA (importante ao ampliar o escopo)

- **Nunca permitir que a IA execute `adicionar`/`editar`/`excluir` direto no perfil técnico** — sempre passar por tela de confirmação humana antes de gravar no Firestore, como já acontece no fluxo do coordenador.
- **Rate limit simples por usuário** (contador em memória ou `localStorage`, resetado por sessão) para evitar que alguém sature a cota gratuita da Groq API com uso abusivo.
- **Log leve de ações via IA** (campo `origem: 'ia'` no documento da proposta) — ajuda o coordenador a entender quando uma proposta foi gerada pelo assistente, sem custo extra de escrita (é só um campo a mais no mesmo `setDoc`).
- **Fallback sem IA sempre disponível**: qualquer ação que a IA ofereça precisa continuar tendo o caminho manual normal, para o dia em que a Groq estiver fora do ar ou a cota gratuita for atingida.

---

## 6. Roadmap priorizado

| Prioridade | Melhoria | Perfil | Esforço |
|:---:|---|:---:|:---:|
| 🔴 1 | Ação `propor` na IA do técnico (com tela de confirmação) | Técnico | Médio |
| 🔴 2 | Sinalizador de conflito preventivo na tela de aprovação | Coordenador | Baixo |
| 🔴 3 | Alerta "aula em breve" (≤30 min) | Técnico | Baixo |
| 🔴 4 | Sugestões de consulta (chips clicáveis) na IA | Ambos | Baixo |
| 🟡 5 | Aprovação em lote de propostas sem conflito | Coordenador | Médio |
| 🟡 6 | Sugestão de horário livre via IA (motor local) | Ambos | Médio |
| 🟡 7 | "Repetir última proposta" | Técnico | Baixo |
| 🟡 8 | Sugestão automática de técnico ao designar | Coordenador | Médio |
| 🟡 9 | Memória curta de conversa na IA | Ambos | Baixo |
| 🟢 10 | Resumo diário via Telegram gerado por IA | Ambos | Baixo |
| 🟢 11 | Modo offline-first no formulário de proposta | Técnico | Médio |
| 🟢 12 | Painel "semana em risco" (labs mais disputados) | Coordenador | Médio |

---

## 7. Conclusão

O CronoLab já resolve bem o problema de centralizar o cronograma e trouxe uma decisão arquitetural sólida ao separar IA local (gratuita, rápida) de IA via Groq (mais flexível, mas limitada por cota). O maior ganho disponível agora não é reconstruir nada — é **estender a IA do técnico do modo "só pergunta" para "propõe com segurança"**, fechando o ciclo entre quem mais usa o sistema no dia a dia e a ferramenta que já existe, sem tirar do coordenador o controle final de aprovação e sem sair do plano Spark em nenhum momento.
