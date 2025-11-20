# Documentação do Assistente IA - Gerenciamento de Aulas

## Visão Geral

O **Assistente IA** é uma funcionalidade exclusiva para coordenadores que permite gerenciar aulas (adicionar, editar, excluir) através de comandos em linguagem natural. A IA utiliza a API Groq com o modelo `llama-3.1-8b-instant` para interpretar os comandos e executar as ações no Firebase.

## Características Principais

### ✅ Funcionalidades Implementadas

1. **Adicionar Aulas**
   - Suporte a múltiplos horários
   - Suporte a múltiplos cursos
   - Suporte a múltiplos laboratórios
   - Verificação automática de conflitos
   - Validação de dados antes de salvar

2. **Editar Aulas**
   - Edição de aulas existentes por ID
   - Atualização de assunto, tipo de atividade, cursos, data e horário

3. **Excluir Aulas**
   - Exclusão por ID específico
   - Exclusão por critérios (data, laboratório, etc.)
   - Suporte a exclusão em lote

4. **Confirmação Dupla**
   - Primeira confirmação: IA interpreta o comando e mostra o que será feito
   - Segunda confirmação: Usuário revisa os dados e confirma a ação
   - Possibilidade de cancelar a qualquer momento

5. **Validações Robustas**
   - Validação de data completa (DD/MM/AAAA)
   - Validação de cursos existentes
   - Validação de laboratórios existentes
   - Validação de horários válidos
   - Verificação de conflitos antes de adicionar

## Como Usar

### Acesso

1. Faça login como **coordenador**
2. No menu lateral, clique em **"Assistente IA"** (ícone de robô)
3. Você será redirecionado para a interface do assistente

### Comandos Suportados

#### 1. Adicionar Aula Simples

```
Adicionar aula de Anatomia para Medicina no laboratório Anatomia 1 no dia 20/11/2025 das 07:00-09:10
```

#### 2. Adicionar Aula com Múltiplos Cursos

```
Adicionar aula de Histologia para Biomedicina e Farmácia no laboratório Microscopia 1 no dia 25/11/2025 das 13:00-15:10
```

#### 3. Adicionar Aula com Múltiplos Horários

```
Adicionar aula de Fisiologia para Medicina nos horários 07:00-09:10 e 09:30-12:00 no dia 22/11/2025 no laboratório Multidisciplinar 1
```

#### 4. Adicionar Aula com Múltiplos Laboratórios

```
Adicionar aula de Microbiologia para Biomedicina nos laboratórios Microscopia 1 e Microscopia 2 no dia 23/11/2025 das 15:30-18:00
```

#### 5. Adicionar Aula Completa (Múltiplos Cursos, Horários e Laboratórios)

```
Adicionar aula de Anatomia Humana para Medicina, Enfermagem e Fisioterapia nos laboratórios Anatomia 1, Anatomia 2 e Anatomia 3 no dia 24/11/2025 nos horários 07:00-09:10, 09:30-12:00 e 13:00-15:10
```

#### 6. Excluir Aulas por Data

```
Excluir todas as aulas de Medicina no dia 20/11/2025
```

#### 7. Excluir Aula Específica

```
Excluir a aula com ID abc123xyz
```

#### 8. Editar Aula

```
Editar a aula com ID abc123xyz mudando o assunto para "Anatomia Avançada" e a data para 21/11/2025 das 09:30-12:00
```

## Dados Disponíveis

### Cursos

- `biomedicina` - Biomedicina
- `farmacia` - Farmácia
- `enfermagem` - Enfermagem
- `odontologia` - Odontologia
- `medicina` - Medicina
- `fisioterapia` - Fisioterapia
- `nutricao` - Nutrição
- `ed_fisica` - Ed. Física
- `psicologia` - Psicologia
- `med_veterinaria` - Medicina Veterinária
- `quimica_tecnologica` - Química Tecnológica
- `engenharia` - Engenharia
- `tec_cosmetico` - Tec. e Cosmético

### Horários Disponíveis

**Matutino:**
- 07:00-09:10
- 09:30-12:00

**Vespertino:**
- 13:00-15:10
- 15:30-18:00

**Noturno:**
- 18:30-20:10
- 20:30-22:00

### Tipos de Laboratório

- **Anatomia**: Anatomia 1 a 6
- **Microscopia Normal**: Microscopia 1 a 5
- **Microscopia Galeria**: Microscopia 6 e 7 (Galeria)
- **Multidisciplinar**: Multidisciplinar 1 a 4
- **Habilidades Ney Braga**: Habilidades 1 a 4 (Ney Braga)
- **Habilidades Santander**: Habilidades 1 a 3 (Santander)
- **Habilidades Galeria**: Habilidades 1 a 3 (Galeria)
- **Farmacêutico**: Farmacêutico
- **Tec. Dietética**: Tec. Dietética
- **UDA**: UDA

## Fluxo de Confirmação

### Passo 1: Comando do Usuário
O usuário digita um comando em linguagem natural.

### Passo 2: Processamento pela IA
A IA Groq processa o comando e extrai:
- Tipo de ação (adicionar, editar, excluir)
- Dados estruturados (assunto, cursos, laboratórios, horários, data)
- Texto de confirmação para o usuário

### Passo 3: Primeira Confirmação
A IA mostra o que entendeu do comando e pede confirmação:
- Exibe um resumo da ação
- Mostra os dados estruturados em JSON
- Oferece opções de "Confirmar" ou "Cancelar"

### Passo 4: Validação
Antes de executar, o sistema valida:
- Data completa e no formato correto
- Cursos existem no sistema
- Laboratórios existem no sistema
- Horários são válidos
- Não há conflitos (para adições)

### Passo 5: Execução
Se tudo estiver correto:
- A ação é executada no Firebase
- Uma mensagem de sucesso é exibida
- O histórico da conversa é atualizado

### Passo 6: Tratamento de Erros
Se houver erros:
- Uma mensagem clara é exibida
- O usuário pode corrigir e tentar novamente
- Nenhuma alteração é feita no banco de dados

## Segurança e Validações

### ✅ Validações Implementadas

1. **Acesso Restrito**: Apenas coordenadores podem acessar
2. **Data Completa Obrigatória**: Evita erros de interpretação
3. **Validação de Dados**: Todos os dados são validados antes de salvar
4. **Verificação de Conflitos**: Não permite agendar no mesmo horário/laboratório
5. **Confirmação Dupla**: Usuário sempre revisa antes de confirmar
6. **Tratamento de Erros**: Erros são capturados e exibidos claramente

### 🔒 Segurança

- A API Key do Groq está no código (para desenvolvimento)
- **IMPORTANTE**: Em produção, mova a API Key para variáveis de ambiente
- Apenas coordenadores autenticados podem usar
- Todas as ações são registradas no Firebase com timestamp e usuário

## Limitações Conhecidas

1. **Edição de Múltiplas Aulas**: Atualmente, edição funciona apenas para uma aula por vez
2. **Busca por Critérios Complexos**: Exclusão por critérios está limitada a data e laboratório
3. **Idioma**: A IA funciona melhor com comandos em português brasileiro
4. **Contexto**: Cada comando é independente (não há memória de comandos anteriores)

## Melhorias Futuras

- [ ] Adicionar histórico de comandos executados
- [ ] Implementar busca mais avançada para edição/exclusão
- [ ] Adicionar suporte a comandos em lote
- [ ] Implementar confirmação visual no calendário
- [ ] Adicionar sugestões de comandos baseadas no contexto
- [ ] Implementar logs de auditoria mais detalhados

## Solução de Problemas

### Problema: "Data inválida ou incompleta"
**Solução**: Sempre forneça a data no formato DD/MM/AAAA (exemplo: 20/11/2025)

### Problema: "Cursos inválidos"
**Solução**: Verifique se o nome do curso está correto. Use os nomes exatos da lista de cursos.

### Problema: "Laboratórios inválidos"
**Solução**: Use o nome completo do laboratório (exemplo: "Anatomia 1" ao invés de "Anatomia1")

### Problema: "Horários inválidos"
**Solução**: Use apenas os horários da lista de blocos disponíveis (07:00-09:10, 09:30-12:00, etc.)

### Problema: "Nenhuma aula pôde ser criada"
**Solução**: Todos os horários/laboratórios selecionados estão ocupados. Tente outros horários ou laboratórios.

### Problema: "Erro ao processar comando"
**Solução**: Tente reformular o comando de forma mais clara e específica.

## Exemplos Práticos

### Exemplo 1: Agendar Aula Prática de Anatomia

**Comando:**
```
Adicionar aula prática de Anatomia Humana para Medicina no laboratório Anatomia 1 no dia 20/11/2025 das 07:00-09:10
```

**O que acontece:**
1. IA interpreta: adicionar 1 aula
2. Valida: curso Medicina existe, laboratório Anatomia 1 existe, horário válido
3. Verifica conflitos: nenhum conflito encontrado
4. Mostra confirmação com todos os dados
5. Usuário confirma
6. Aula é criada no Firebase com status "aprovada"

### Exemplo 2: Agendar Múltiplas Aulas Simultaneamente

**Comando:**
```
Adicionar aula de Histologia para Biomedicina, Farmácia e Enfermagem nos laboratórios Microscopia 1, 2 e 3 no dia 25/11/2025 nos horários 13:00-15:10 e 15:30-18:00
```

**O que acontece:**
1. IA interpreta: adicionar 18 aulas (3 cursos × 3 laboratórios × 2 horários)
2. Valida todos os dados
3. Verifica conflitos para cada combinação
4. Mostra confirmação com o total de aulas a serem criadas
5. Usuário confirma
6. Todas as aulas sem conflito são criadas em lote

### Exemplo 3: Excluir Aulas de um Dia Específico

**Comando:**
```
Excluir todas as aulas de Medicina no dia 20/11/2025
```

**O que acontece:**
1. IA interpreta: excluir aulas com critérios específicos
2. Busca no Firebase todas as aulas que atendem aos critérios
3. Mostra quantas aulas serão excluídas
4. Usuário confirma
5. Todas as aulas encontradas são excluídas em lote

## Configuração Técnica

### API Groq

- **API Key**: `SUA_CHAVE_AQUI`
- **Modelo**: `llama-3.1-8b-instant`
- **Endpoint**: `https://api.groq.com/openai/v1/chat/completions`
- **Temperature**: 0.3 (para respostas mais consistentes)
- **Max Tokens**: 1500

### Estrutura de Dados no Firebase

```javascript
{
  tipoAtividade: "Aula Prática",
  assunto: "Anatomia Humana",
  observacoes: "",
  tipoLaboratorio: "anatomia",
  laboratorioSelecionado: "anatomia_1",
  cursos: ["medicina"],
  liga: "",
  disciplina: "Anatomia Humana",
  curso: "medicina",
  ano: "2025",
  dataInicio: Timestamp,
  dataFim: Timestamp,
  horarioSlotString: "07:00-09:10",
  status: "aprovada",
  propostoPorUid: "uid_do_usuario",
  propostoPorNome: "Nome do Coordenador",
  tecnicos: [],
  tecnicosInfo: [],
  createdAt: serverTimestamp()
}
```

## Suporte

Para dúvidas ou problemas:
1. Verifique esta documentação
2. Consulte a seção de "Solução de Problemas"
3. Entre em contato com o administrador do sistema

---

**Versão**: 1.0.0  
**Data**: Novembro 2025  
**Autor**: Sistema CronoLab
