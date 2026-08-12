# Correção — Restaurar seleção múltipla de laboratórios na Etapa 3 (Propor Aula)

## 1. Problema atual

No fluxo de "Propor Aula" (`ProporAulaForm.jsx`), a etapa de escolha de laboratório perdeu o modo de **seleção múltipla**.

- **Antes**: a Seção 2 (Laboratório) usava um `Select multiple` (`handleLabEspecificoChange`) — o usuário marcava vários laboratórios de uma vez, e os que já possuíam aula no dia/horário selecionado ficavam **desabilitados** na lista (via `horariosOcupados`).
- **Agora**: entrou o componente `GradeDisponibilidade.jsx` (tabela laboratório × bloco de horário, células verdes/vermelhas). A interação virou "clicar em uma célula livre para pré-preencher o formulário", o que só permite **selecionar um laboratório por vez** e transformou a etapa de seleção em uma etapa de visualização.

Resultado: a grade de disponibilidade ficou boa (mostra ocupação claramente), mas substituiu — em vez de complementar — o mecanismo de escolha múltipla.

## 2. Comportamento esperado

A Etapa 3 (antiga Etapa 2) deve voltar a ser uma **seleção múltipla de laboratórios**, com as mesmas regras de antes:

1. Campo de seleção múltipla (`Select multiple` / chips), permitindo marcar vários laboratórios do mesmo tipo.
2. Laboratórios que já têm aula marcada na data/horário escolhidos aparecem **desabilitados** na lista (não podem ser marcados), igual ao comportamento antigo com `horariosOcupados`.
3. A **Grade de Disponibilidade** (`GradeDisponibilidade.jsx`) continua existindo, mas passa a ser **auxiliar/informativa**:
   - Fica visível ao lado ou abaixo da seleção múltipla, só para consulta visual rápida (quais labs/horários estão livres).
   - Ao clicar em uma célula, abre **mais detalhes** (ex.: qual aula está ocupando aquele horário, professor, disciplina) — **não** deve mais funcionar como o único jeito de selecionar o laboratório.
   - Não substitui, nem precisa ficar sincronizada 1:1 com, o campo de seleção múltipla — é só apoio visual.

## 3. Escopo da mudança (arquivos envolvidos)

| Arquivo | Mudança |
|---|---|
| `ProporAulaForm.jsx` | Restaurar/manter o `Select multiple` de laboratórios na Seção 3 (o que hoje está como Seção 2 com `dynamicLabs`), com bloqueio dos laboratórios ocupados via `horariosOcupados`. Adicionar a `GradeDisponibilidade` como painel auxiliar ao lado, sem ligar o clique dela ao preenchimento do formulário — o clique deve só abrir um modal/tooltip com detalhes da ocupação. |
| `src/components/GradeDisponibilidade.jsx` | Alterar o comportamento de `onCelulaClick`: em vez de pré-preencher o formulário, deve abrir um dialog/tooltip com detalhes da aula (assunto, curso, professor/técnico responsável) quando a célula estiver ocupada, e informação simples de "livre" quando não estiver. Remover (ou tornar opcional) o clique como ação de seleção. |

## 4. Regras de negócio a preservar

- Não é possível selecionar (marcar) um laboratório que já tenha aula no mesmo dia/horário escolhido.
- É possível selecionar vários laboratórios do mesmo tipo de uma vez (ex.: 3 laboratórios de anatomia para a mesma aula/horário).
- A grade de disponibilidade é só leitura/apoio — clicar nela não marca nem desmarca nada no formulário, apenas exibe mais informação sobre aquela célula.

## 5. Checklist de implementação

- [ ] Reativar/confirmar `Select multiple` de laboratórios na etapa correspondente, com `renderValue` em chips (como já existe em `dynamicLabs`).
- [ ] Confirmar que `horariosOcupados` desabilita corretamente os laboratórios já ocupados na lista de seleção.
- [ ] Posicionar `GradeDisponibilidade` como painel auxiliar (ex.: accordion, aba "Ver disponibilidade" ou coluna lateral) dentro da mesma etapa.
- [ ] Alterar `onCelulaClick` em `GradeDisponibilidade.jsx` para abrir um `Dialog`/`Popover` de detalhes em vez de pré-preencher o form.
- [ ] Testar: marcar múltiplos laboratórios, tentar marcar um ocupado (deve estar bloqueado), clicar em célula da grade (deve só mostrar detalhe, sem alterar a seleção).
