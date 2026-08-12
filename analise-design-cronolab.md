# 🎨 Análise de Design & UX — CronoLab

> Revisão visual e de experiência do usuário baseada no código-fonte do repositório `cronograma-lab-frontend`.  
> Foco em melhorias de interface, consistência visual, acessibilidade e experiência mobile.

---

## Sumário

1. [Pontos Positivos Já Existentes](#1-pontos-positivos-já-existentes)
2. [Problemas de Consistência Visual](#2-problemas-de-consistência-visual)
3. [Cores e Identidade Visual](#3-cores-e-identidade-visual)
4. [Tipografia](#4-tipografia)
5. [Componentes com Oportunidade de Melhoria](#5-componentes-com-oportunidade-de-melhoria)
6. [Experiência Mobile](#6-experiência-mobile)
7. [Dark Mode](#7-dark-mode)
8. [Feedback Visual e Estados da Interface](#8-feedback-visual-e-estados-da-interface)
9. [Acessibilidade](#9-acessibilidade)
10. [Animações e Transições](#10-animações-e-transições)
11. [Sugestões de Implementação Prioritária](#11-sugestões-de-implementação-prioritária)

---

## 1. Pontos Positivos Já Existentes

Antes de entrar nas melhorias, vale reconhecer o que já está bem feito:

- **Identidade institucional clara** — as cores `#1E7EC8` (azul CESMAC) e `#F5C518` (dourado) são consistentes e têm origem no logo oficial.
- **Dark mode implementado** — fundo `#0B0F18` é elegante e tem boa profundidade visual.
- **Fonte Sora** — escolha acertada para um sistema acadêmico: moderna, legível e com personalidade.
- **Chips coloridos por curso** — o mapeamento `CURSO_COLORS` em `AulaCard.jsx` é uma ótima ideia de diferenciação visual rápida.
- **`EventoCard.jsx` com `borderLeft` colorido** — padrão profissional de cards com indicador de tipo por cor.
- **`EmptyState.tsx`** — componente dedicado para estados vazios é uma boa prática de UX frequentemente ignorada.

---

## 2. Problemas de Consistência Visual

### 2.1 Cores hardcoded espalhadas pelo código

Vários componentes definem cores diretamente no `sx`, sem usar o tema MUI, criando inconsistência.

**Exemplos encontrados:**

```jsx
// AssistenteIATecnico.jsx — cores de chat hardcoded
const backgroundColor = isUsuario
  ? (mode === 'dark' ? '#3f51b5' : '#3f51b5')  // índigo fixo, não usa o azul CESMAC
  : (mode === 'dark' ? '#424242' : '#f0f0f0');
```

```jsx
// EventoCard.jsx — cores de evento fora do tema
const EVENT_COLORS = {
  'Manutenção': '#f44336',
  'Feriado': '#ff9800',
  'Evento': '#2196f3',   // Azul Material padrão, não o azul CESMAC (#1E7EC8)
  'Giro': '#9c27b0',
};
```

**Sugestão:** Centralizar todas as paletas de cor em `theme.js` e usar `theme.palette.custom.*` ou variáveis semânticas. O que está em `theme.js` já existe — o problema é que os componentes não o consultam.

```js
// theme.js — adicionar paleta semântica
palette: {
  curso: {
    biomedicina: '#4CAF50',
    farmacia:    '#F44336',
    medicina:    '#9C27B0',
    // ...
  },
  evento: {
    manutencao: '#f44336',
    feriado:    '#ff9800',
    evento:     '#1E7EC8', // ← usar azul CESMAC, não o azul Material padrão
  },
  chat: {
    usuario: '#1E7EC8', // ← azul CESMAC, não #3f51b5
    ia:      'action.hover',
  }
}
```

---

### 2.2 Elevações inconsistentes nos Paper

Ao longo do código há `elevation={2}`, `elevation={3}`, `elevation={5}` sem critério definido. Isso cria uma hierarquia visual confusa — o usuário não sabe o que é "mais importante" ou "está acima" de quê.

**Sugestão:** Definir uma escala semântica:

| Nível | elevation | Uso |
|---|---|---|
| Base | 0 | Página de fundo |
| Card | 2 | Cards de conteúdo |
| Painel | 4 | Painéis flutuantes |
| Modal | 8 | Diálogos e modais |
| Topo | 12 | Navbar / App Bar |

---

### 2.3 Bordas e border-radius sem padrão

Cards usam `borderRadius: 2` em alguns lugares e valores literais em px em outros (`borderRadius: '20px 20px 5px 20px'` no chat). O MUI usa escala de 4px por unidade — definir um padrão no tema resolve isso globalmente.

```js
// theme.js
shape: {
  borderRadius: 10, // 10px como base — todos os Papers herdam automaticamente
}
```

---

## 3. Cores e Identidade Visual

### 3.1 O azul do chat não é o azul do CESMAC

O `AssistenteIATecnico.jsx` usa `#3f51b5` (índigo Material Design) para as bolhas do usuário, mas o sistema todo usa `#1E7EC8`. Corrigir isso unifica a linguagem visual da IA com o restante do sistema.

### 3.2 `CURSO_COLORS` duplicado em dois arquivos

O mapa de cores por curso existe em `AulaCard.jsx` e em `DownloadCronograma.jsx` separadamente. Se uma cor for alterada em um, não muda no outro. Criar um arquivo `src/constants/cursoColors.ts` único elimina essa divergência.

```ts
// src/constants/cursoColors.ts
export const CURSO_COLORS: Record<string, string> = {
  biomedicina:          '#4CAF50',
  farmacia:             '#F44336',
  enfermagem:           '#2196F3',
  odontologia:          '#FF9800',
  medicina:             '#9C27B0',
  fisioterapia:         '#FFC107',
  nutricao:             '#00BCD4',
  ed_fisica:            '#795548',
  psicologia:           '#E91E63',
  med_veterinaria:      '#8BC34A',
  quimica_tecnologica:  '#607D8B',
  engenharia:           '#9E9E9E',
  tec_cosmetico:        '#3F51B5',
  default:              '#616161',
};
```

### 3.3 Dourado subutilizado

O dourado (`#F5C518`) aparece no README como cor institucional, mas sua presença nos componentes é tímida — restrito a "revisões" e alguns alertas. Considere usar o dourado com mais intenção: badges de destaque, ações premium/coordenador, bordas de cards de avisos importantes.

---

## 4. Tipografia

### 4.1 Hierarquia de texto não documentada

O sistema usa a fonte Sora, mas não há definição explícita de escala tipográfica no `theme.js`. Isso deixa cada componente livre para usar qualquer `variant`, gerando páginas onde há 3 ou 4 tamanhos de texto sem hierarquia clara.

**Sugestão — definir no tema:**

```js
// theme.js
typography: {
  fontFamily: "'Sora', sans-serif",
  h1: { fontSize: '2rem',   fontWeight: 700, letterSpacing: '-0.5px' },
  h2: { fontSize: '1.5rem', fontWeight: 700 },
  h3: { fontSize: '1.25rem',fontWeight: 600 },
  h4: { fontSize: '1.1rem', fontWeight: 600 },
  h5: { fontSize: '1rem',   fontWeight: 600 },
  h6: { fontSize: '0.9rem', fontWeight: 600 },
  body1: { fontSize: '0.875rem', lineHeight: 1.6 },
  body2: { fontSize: '0.8rem',   lineHeight: 1.5 },
  caption: { fontSize: '0.72rem', letterSpacing: '0.02em' },
}
```

### 4.2 `fontWeight: 800` exagerado em números de KPI

Em `ImportarAgendamento.jsx` (tela de resultado) há `fontWeight={800}` em números grandes dentro de cards. Isso cria um visual pesado. `fontWeight: 700` já é bold suficiente para destaque; reservar 800+ para headings principais.

---

## 5. Componentes com Oportunidade de Melhoria

### 5.1 `EmptyState.tsx` — funcional mas genérico demais

O componente atual renderiza ícone + título + mensagem com estilo idêntico em qualquer contexto. Adicionar uma variante `action` com um botão opcional tornaria os estados vazios mais úteis:

```tsx
// Sugestão de interface ampliada
interface EmptyStateProps {
  icon?: React.ComponentType;
  title?: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'contained' | 'outlined';
  };
}
```

Exemplo de uso: na listagem de aulas vazia, mostrar "Nenhuma aula encontrada → [Adicionar Aula]".

---

### 5.2 `AulaCard.jsx` — modo edição visualmente confuso

Quando `isEditing` é `true`, o card exibe campos de formulário dentro de um `ListItem`, mas o layout quebra em mobile por conta do `Grid` aninhado com `sm={6}` que colapsa mal em telas pequenas. O estado de edição merece um visual mais claro:

- Adicionar um fundo levemente diferente (já tem `bgcolor: 'action.hover'` — aumentar o contraste)
- Incluir um indicador visual de "modo edição ativo" (ex.: borda esquerda em azul ou ícone de lápis no topo do card)
- Garantir que os botões "Salvar" e "Cancelar" tenham espaçamento vertical mínimo de `8px` entre si em mobile

---

### 5.3 `GradeDisponibilidade.jsx` — tabela sem responsividade adequada

A grade de laboratórios × horários usa `overflowX: 'auto'` como único mecanismo de responsividade. Em mobile, o usuário precisa rolar horizontalmente por uma tabela larga, o que é ruim para usabilidade.

**Sugestão:** Para telas menores que `sm`, trocar a exibição de tabela por uma lista agrupada por laboratório:

```
[ Anatomia 1 ]
  Manhã 1 → Ocupado (Medicina)
  Manhã 2 → Livre
  Tarde 1 → Ocupado (Enfermagem)
  ...

[ Anatomia 2 ]
  ...
```

Isso pode ser feito com `useMediaQuery('(max-width: 600px)')` para alternar entre os dois layouts.

---

### 5.4 `EventoCard.jsx` — chip de tipo muito pequeno

```jsx
<Chip label={evento.tipo} size="small" sx={{ height: 16, fontSize: '0.6rem', ... }} />
```

`height: 16` e `fontSize: 0.6rem` são extremamente pequenos — praticamente ilegíveis em mobile. O MUI `size="small"` já tem `height: 24px` que é o mínimo aceitável. Remover o override de `height` e usar `fontSize: '0.7rem'` no mínimo.

---

### 5.5 Chat do Assistente IA — interface sem identidade visual

O `AssistenteIATecnico.jsx` tem um visual funcional mas genérico — parece qualquer chatbot, sem a identidade azul do CronoLab. Melhorias sugeridas:

- Usar o azul CESMAC (`#1E7EC8`) nas bolhas do usuário (hoje usa índigo `#3f51b5`)
- Adicionar avatar de IA com ícone personalizado (ex.: o logo CESMAC em miniatura ou um ícone de microscópio)
- O cabeçalho do chat exibe `Assistente IA de Consulta (Técnico)` com `variant="h5"` — considerar separar a interface de coordenador e técnico com diferença visual clara (ex.: badge de perfil)
- O input de texto com o botão de microfone e enviar poderia ter visual mais polido com `InputAdornment` ao invés de elementos soltos em `Box`

---

## 6. Experiência Mobile

### 6.1 Formulários com campos em `Grid item sm={6}` sem `xs={12}`

Vários formulários usam:

```jsx
<Grid item xs={12} sm={6}>
```

Isso está correto. Porém em `AulaCard.jsx` no modo edição há:

```jsx
<FormControl sx={{ minWidth: 160 }} size="small">
```

`minWidth: 160` fixo dentro de um `Grid` fluido pode causar overflow em telas de 360px de largura. Trocar por `fullWidth` nos `FormControl` dentro de Grid.

### 6.2 Botões de ação sem altura mínima garantida

Alvos de toque devem ter no mínimo 44×44px (iOS HIG) ou 48×48px (Material Design). `IconButton size="small"` tem apenas 30px de área clicável. Nos cards de aula e evento, onde há múltiplos ícones pequenos lado a lado, o risco de erro de toque é alto.

**Sugestão global no tema:**

```js
// theme.js
components: {
  MuiIconButton: {
    defaultProps: { size: 'medium' }, // garante 40px mínimo
  },
  MuiButton: {
    styleOverrides: {
      root: { minHeight: 40 },
    },
  },
}
```

### 6.3 Tipografia `caption` muito pequena em mobile

`caption` (0.72rem ≈ 11.5px) é difícil de ler em telas pequenas. Considerar aumentar para `0.78rem` no tema e garantir que informações secundárias importantes (horário, lab) não usem `caption` — preferir `body2`.

---

## 7. Dark Mode

### 7.1 Fundo `rgba(0,0,0,0.02)` invisível no dark mode

Em `EventoCard.jsx`:

```jsx
bgcolor: 'rgba(0,0,0,0.02)'
```

No dark mode com fundo `#0B0F18`, um overlay de `rgba(0,0,0,0.02)` é imperceptível — o card fica com a mesma cor do fundo. Trocar por `bgcolor: 'background.paper'` que o MUI adapta automaticamente entre modos.

### 7.2 Cores literais que não se adaptam ao dark mode

```jsx
// AssistenteIATecnico.jsx
const color = isUsuario
  ? '#ffffff'
  : (mode === 'dark' ? '#ffffff' : '#000000');
```

O sistema verifica `mode` manualmente em vez de usar tokens semânticos do MUI. Com o tema configurado corretamente, `color: 'text.primary'` já lida com isso automaticamente e é mais robusto.

### 7.3 Sugestão: Surface layers no dark mode

O dark mode atual usa uma cor sólida (`#0B0F18`) para tudo. O Material Design recomenda "elevation overlays" — surfaces mais altas ficam levemente mais claras. O MUI v5+ faz isso automaticamente quando `mode: 'dark'` está ativo e você usa `elevation` nos componentes. Verificar se o tema está com `background.default` e `background.paper` configurados para aproveitar esse comportamento:

```js
palette: {
  mode: 'dark',
  background: {
    default: '#0B0F18',
    paper:   '#111827', // levemente mais claro — cria profundidade
  },
}
```

---

## 8. Feedback Visual e Estados da Interface

### 8.1 Loading states heterogêneos

O sistema usa `CircularProgress` em alguns lugares e não mostra nada em outros durante carregamento. Em `GerenciarAulasAvancado.jsx` o loading é um `CircularProgress` centralizado; em `CardAulasRecentes.jsx` é um Skeleton — inconsistência que o usuário percebe.

**Sugestão:** Padronizar: usar `Skeleton` (MUI) para listas e cards (mais elegante, mantém o layout), e `CircularProgress` apenas para ações pontuais (submit de formulário, exclusão).

```jsx
// Padrão para cards em carregamento
{loading ? (
  <>
    <Skeleton variant="rectangular" height={60} sx={{ mb: 1, borderRadius: 1 }} />
    <Skeleton variant="rectangular" height={60} sx={{ mb: 1, borderRadius: 1 }} />
    <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 1 }} />
  </>
) : (
  <List>...</List>
)}
```

### 8.2 Snackbars sem posição padrão

Alguns Snackbars não definem `anchorOrigin`, usando o padrão do MUI (bottom-left). Outros definem `anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}`. Em mobile, `bottom-center` é muito melhor pois não fica atrás da navegação. Definir no tema:

```js
components: {
  MuiSnackbar: {
    defaultProps: {
      anchorOrigin: { vertical: 'bottom', horizontal: 'center' },
    },
  },
}
```

### 8.3 Ausência de feedback para ações bem-sucedidas silenciosas

Ações como "ativar notificações", "salvar preferências de perfil" e "designar técnico" terminam sem confirmação visual clara em alguns fluxos. Todo submit que altere dados deve ter:
- Estado de `loading` no botão (substituir texto por `CircularProgress size={20}`)
- Snackbar de sucesso com mensagem específica (não genérica)
- Em caso de erro, mensagem com o motivo real (não apenas "Erro interno")

---

## 9. Acessibilidade

### 9.1 `onClick` em elementos não interativos

```jsx
// EventoCard.jsx
<Box onClick={() => setExpanded(!expanded)} sx={{ p: 1.5, cursor: 'pointer' }}>
```

Um `Box` com `onClick` não é acessível via teclado e não tem semântica de botão. Trocar por `ButtonBase` do MUI (que é um `button` HTML semântico com estilo limpo) ou adicionar `role="button"` e `tabIndex={0}` com handler de `onKeyDown`.

```jsx
// Correto
import ButtonBase from '@mui/material/ButtonBase';

<ButtonBase
  onClick={() => setExpanded(!expanded)}
  sx={{ p: 1.5, width: '100%', textAlign: 'left', display: 'block' }}
>
  ...
</ButtonBase>
```

### 9.2 Chips de status sem texto acessível

Chips de status usam apenas `label` (texto visível) e cor, mas não têm `aria-label` descritivo. Para leitores de tela, "aprovada" em verde e "aprovada" em contexto de chip genérico têm o mesmo anúncio. Adicionar contexto:

```jsx
<Chip
  label={aula.status}
  aria-label={`Status da aula: ${aula.status}`}
  color={statusColor}
/>
```

### 9.3 Campos de formulário sem `id` vinculado ao `label`

Alguns `TextField` são criados com `label` inline do MUI (correto), mas `Select` dentro de `FormControl` às vezes não tem `labelId` ou `id` explícitos, quebrando a associação semântica.

---

## 10. Animações e Transições

### 10.1 `EventoCard` tem transição, outros cards não

```jsx
// EventoCard.jsx
transition: 'all 0.2s ease-in-out',
```

`transition: 'all'` é uma má prática de performance — anima propriedades que não deveriam ser animadas (ex.: `color`, `font-size`). Preferir especificar:

```jsx
transition: 'box-shadow 0.2s ease-in-out, transform 0.15s ease-in-out',
```

### 10.2 Ausência de micro-animação nos botões primários

Botões de ação principal (ex.: "Confirmar", "Salvar Aula") não têm feedback visual além do `ripple` padrão do MUI. Um sutil `scale(0.97)` no `active` e `scale(1.02)` no `hover` cria sensação de responsividade:

```js
// theme.js
components: {
  MuiButton: {
    styleOverrides: {
      containedPrimary: {
        transition: 'transform 0.1s ease, box-shadow 0.2s ease',
        '&:hover':  { transform: 'translateY(-1px)', boxShadow: '0 4px 12px rgba(30,126,200,0.35)' },
        '&:active': { transform: 'translateY(0)',    boxShadow: 'none' },
      },
    },
  },
}
```

---

## 11. Sugestões de Implementação Prioritária

As melhorias abaixo estão ordenadas por impacto visual imediato × esforço de implementação.

### 🔴 Alta prioridade (impacto alto, esforço baixo)

| # | Melhoria | Arquivo(s) | Esforço |
|---|---|---|---|
| 1 | Centralizar `CURSO_COLORS` em `src/constants/cursoColors.ts` e importar de lá | `AulaCard.jsx`, `DownloadCronograma.jsx` | 30 min |
| 2 | Corrigir `rgba(0,0,0,0.02)` para `bgcolor: 'background.paper'` | `EventoCard.jsx` | 5 min |
| 3 | Padronizar `anchorOrigin` do Snackbar no tema | `theme.js` | 10 min |
| 4 | Corrigir cor do chat IA de `#3f51b5` para `#1E7EC8` | `AssistenteIATecnico.jsx` | 5 min |
| 5 | Remover `height: 16` do Chip do EventoCard | `EventoCard.jsx` | 5 min |
| 6 | Adicionar `background.paper: '#111827'` no dark mode | `theme.js` | 10 min |

### 🟡 Média prioridade (impacto alto, esforço médio)

| # | Melhoria | Arquivo(s) | Esforço |
|---|---|---|---|
| 7 | Definir escala tipográfica completa no tema | `theme.js` | 1–2h |
| 8 | Padronizar `borderRadius` e `elevation` via tema | `theme.js` | 1h |
| 9 | Substituir `transition: 'all'` por propriedades específicas | `EventoCard.jsx` e outros | 30 min |
| 10 | Trocar `Box onClick` por `ButtonBase` em cards clicáveis | `EventoCard.jsx`, `AulaCard.jsx` | 1h |
| 11 | Adicionar `MuiIconButton defaultProps size: medium` no tema | `theme.js` | 10 min |
| 12 | Padronizar uso de Skeleton vs CircularProgress | Todos os componentes com loading | 2–3h |

### 🟢 Backlog (impacto médio, esforço maior)

| # | Melhoria | Arquivo(s) | Esforço |
|---|---|---|---|
| 13 | Responsividade alternativa para `GradeDisponibilidade` em mobile | `GradeDisponibilidade.jsx` | 3–4h |
| 14 | Adicionar variante `action` ao `EmptyState` | `EmptyState.tsx` | 1h |
| 15 | Redesign visual do `AssistenteIATecnico` com identidade CESMAC | `AssistenteIATecnico.jsx` | 4–6h |
| 16 | Adicionar micro-animações nos botões primários via tema | `theme.js` | 1h |
| 17 | Adicionar `aria-label` descritivos nos Chips de status | Todos os componentes | 1–2h |
| 18 | Adicionar paleta semântica de cursos/eventos no `theme.js` | `theme.js` | 1h |

---

## Referências Rápidas

- [MUI — Customizing the theme](https://mui.com/material-ui/customization/theming/)
- [MUI — Dark mode](https://mui.com/material-ui/customization/dark-mode/)
- [Material Design — Elevation & surfaces](https://m2.material.io/design/environment/elevation.html)
- [WCAG 2.1 — Touch target size](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
- [CSS-Tricks — Why `transition: all` is bad](https://css-tricks.com/transition-or-animation-which-do-you-use/)

---

*Análise realizada com base no código-fonte do CronoLab — CESMAC · 2026*
