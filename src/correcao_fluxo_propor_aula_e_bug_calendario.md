# Correção — Ordem das Etapas em "Propor Aula" + Bug no Calendário

> Este documento substitui o markdown anterior (`correcao_etapa3_selecao_laboratorios.md`), que continha um entendimento errado do problema.

## 1. Situação atual (como está hoje)

No formulário de Propor Aula (`ProporAulaForm.jsx`), a ordem das etapas é:

- **Etapa 2 — Laboratório(s)**: seleção múltipla de laboratórios (`Select multiple`).
- **Etapa 3 — Data e Horário**: escolhe a data, e logo abaixo aparece o painel **"Consulta de Grade de Disponibilidade"** (componente `GradeDisponibilidade.jsx`) — uma tabela lab × horário com células "Livre"/"Ocupado", clicável para ver detalhes.

## 2. Comportamento esperado (correto)

A ordem das etapas deve ser **invertida**, voltando ao padrão antigo:

- **Etapa 2 — Data e Horário (com disponibilidade)**: o usuário escolhe a data. Junto dela aparece a Grade de Disponibilidade referente àquele dia, mostrando quais laboratórios/horários estão livres ou ocupados. Ao clicar em uma célula (dia/laboratório/horário), aparecem **detalhes** daquele laboratório/ocupação — isso é só consulta, não seleciona nada no formulário.
- **Etapa 3 — Laboratório(s)**: só depois de escolhida a data/horário, aparece a **seleção múltipla de laboratórios** (como já existe hoje), permitindo marcar vários laboratórios de uma vez, com os que já estão ocupados naquela data/horário desabilitados na lista.

Ou seja: a lógica das duas etapas continua a mesma (grade = auxiliar/consulta; seleção múltipla = ação real), **só a ordem entre "Data e Horário" e "Laboratório(s)" precisa trocar** — data primeiro, laboratório depois.

## 3. Bug separado: clique em laboratório ocupado no Calendário

No Calendário (visualização geral / grade de disponibilidade usada a partir do calendário), ao clicar em um laboratório **ocupado**, o sistema está navegando para a tela de **agendar aula** — isso não deveria acontecer.

**Comportamento esperado**: só células **livres** devem ser clicáveis/navegáveis para abrir o formulário de agendamento pré-preenchido. Células **ocupadas** devem, no máximo, abrir um detalhe informativo (qual aula está ocupando aquele horário), nunca levar para a tela de agendar.

## 4. Escopo da mudança

| Arquivo | Mudança |
|---|---|
| `ProporAulaForm.jsx` | Inverter a ordem de renderização: Seção 2 = Data e Horário (+ Grade de Disponibilidade auxiliar), Seção 3 = Laboratório(s) (seleção múltipla). Ajustar também a lógica de "seção completa/bloqueada" (`secao1Completa`, `secao2Completa`) para refletir a nova ordem de dependência. |
| `src/components/GradeDisponibilidade.jsx` | Manter como está (auxiliar/consulta), só passa a ser usada dentro da nova Etapa 2 (Data e Horário) em vez da Etapa 3. |
| Componente de disponibilidade usado no Calendário (ex.: dentro de `CalendarioCronograma.jsx` ou onde a grade aparece ligada ao calendário) | Corrigir o `onClick`/navegação da célula: só permitir clique que leve para "agendar aula" quando a célula estiver **livre**. Em células ocupadas, bloquear a navegação (`clickable={false}` ou handler vazio) e, se quiser, mostrar só um tooltip/detalhe. |

## 5. Checklist de implementação

- [ ] Trocar a ordem das seções no JSX de `ProporAulaForm.jsx`: Data e Horário antes de Laboratório(s).
- [ ] Revisar as dependências de "seção completa" para a nova ordem (ex.: seleção múltipla de labs deve depender de já ter data/horário escolhidos, e não o contrário).
- [ ] Confirmar que a Grade de Disponibilidade continua puramente informativa dentro da nova Etapa 2 (clique = detalhe, não seleciona nada).
- [ ] Localizar o ponto no fluxo do Calendário onde o clique em um laboratório ocupado está navegando para "agendar aula" e bloquear esse clique quando ocupado.
- [ ] Testar: escolher data → ver disponibilidade → clicar em dia/lab ocupado (só mostra detalhe) → ir para Etapa 3 → selecionar múltiplos labs livres → confirmar que labs ocupados aparecem desabilitados.
- [ ] Testar especificamente no Calendário: clicar em lab ocupado não deve abrir o formulário de agendar aula; clicar em lab livre deve abrir normalmente.
