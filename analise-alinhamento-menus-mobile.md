# Análise de Alinhamento Visual — Menus em Modo Mobile (CronoLab)

> Baseado na leitura direta do código-fonte enviado (`teste.md`), com foco nos componentes de menu que renderizam no modo mobile: `src/App.jsx` (menu hambúrguer, menu de perfil, submenu "Gerenciar") e `src/components/EventoCard.jsx` (menu de ações do card). Cada ponto abaixo referencia o trecho de código exato e a correção sugerida.

---

## 1. Visão geral do problema

O app tem **um único componente de menu mobile real**: o `<Menu>` (dropdown) do MUI, aberto pelo ícone hambúrguer em `App.jsx`. Não existe `Drawer` nem `BottomNavigation` — os imports existem (`Drawer, BottomNavigation, BottomNavigationAction, List, ListItemButton, ListItemIcon, ListItemText, Collapse`) mas **nenhum é usado no arquivo**, o que já é um sinal de que o alinhamento não foi finalizado.

Dentro desse único menu, o desalinhamento visual concentra-se em **4 causas raiz**, detalhadas abaixo:

1. Espaçamento ícone → texto inconsistente entre itens.
2. Ícones com estilo inline (`style`) em vez de `sx`, sem coluna fixa de alinhamento.
3. Dois `<Menu>` podendo abrir simultaneamente e sobrepor (menu dentro de menu).
4. Ausência de `styleOverrides` no tema para `MuiMenu`/`MuiMenuItem`, fazendo cada menu do app se comportar de um jeito.

---

## 2. Menu principal (hambúrguer) — `src/App.jsx`

### 2.1 Espaçamento ícone→texto quebrado no item "Aprovações"

```jsx
// linha ~6373 — CoordenadorGerenciarMenu
<MenuItem component={Link} to="/gerenciar-aprovacoes" onClick={handleMenuClose}>
  <Badge badgeContent={pendingProposalsCount} color="error" sx={{ mr: 1 }}>
    <ThumbsUp size={18} style={menuIconStyle}/>
  </Badge>Aprovações
</MenuItem>
```

Todos os outros itens do menu têm um espaço literal entre o ícone e o texto:

```jsx
<BarChart size={18} style={menuIconStyle}/> Análise de Aulas
```

Só o item **"Aprovações"** fecha a tag `</Badge>` colada no texto (`</Badge>Aprovações`), sem espaço. Resultado: nesse item específico o texto encosta no badge/ícone, enquanto em todos os outros há uma respiração visual — o olho percebe a fileira de itens como "torta".

**Correção:**
```jsx
<Badge badgeContent={pendingProposalsCount} color="error" sx={{ mr: 1 }}>
  <ThumbsUp size={18} style={menuIconStyle}/>
</Badge>{' '}Aprovações
```

### 2.2 Ícones sem coluna fixa de alinhamento (`style` inline em vez de `ListItemIcon`)

```jsx
const menuIconStyle = { marginRight: 10, color: 'inherit' };
```

Esse objeto é aplicado via `style={menuIconStyle}` diretamente no ícone do `lucide-react`, e não via `<ListItemIcon>` (que no MUI reserva uma largura fixa de coluna, normalmente 36–56px, para todos os itens de uma lista). Consequência prática:

- Itens com `Badge` (ex.: "Aprovações") ocupam mais largura na "coluna do ícone" do que itens sem badge, então o texto de cada `MenuItem` **não começa na mesma posição horizontal**.
- `marginRight: 10` é um valor fixo em pixel, não escalável em telas muito pequenas (não usa `theme.spacing`), quebrando a consistência com o resto do design system que usa `sx={{ mr: 1 }}` (=8px) em outros componentes do próprio projeto (ex. `EventoCard.jsx`, ver seção 3).

**Correção recomendada** — trocar todos os itens do menu para usar `ListItemIcon` + `ListItemText`, que já resolve alinhamento em coluna automaticamente:

```jsx
<MenuItem component={Link} to="/gerenciar-aprovacoes" onClick={handleMenuClose}>
  <ListItemIcon sx={{ minWidth: 36 }}>
    <Badge badgeContent={pendingProposalsCount} color="error">
      <ThumbsUp size={18} />
    </Badge>
  </ListItemIcon>
  <ListItemText primary="Aprovações" />
</MenuItem>
```

Isso também padroniza com o padrão MUI que o próprio projeto já importa (`ListItemIcon`, `ListItemText` estão nos imports de `App.jsx`, mas **nunca são usados** — outro sinal de refatoração incompleta).

### 2.3 Dois menus podem abrir ao mesmo tempo e se sobrepor

```jsx
const handleCoordenadorMenuOpen = (event) => setCoordenadorMenuAnchorEl(event.currentTarget);
...
<MenuItem key="gerenciar-menu" onClick={handleCoordenadorMenuOpen}><ListTodo .../> Gerenciar</MenuItem>,
```

Ao clicar em "Gerenciar" dentro do menu hambúrguer (`renderMobileMenu`), `handleCoordenadorMenuOpen` **não fecha** o menu pai (`mobileMoreAnchorEl` continua com valor, só `coordenadorMenuAnchorEl` é setado). O resultado em mobile:

- O `CoordenadorGerenciarMenu` abre **por cima** do menu hambúrguer ainda aberto, os dois popovers concorrendo pelo mesmo espaço estreito da tela.
- Nenhum dos dois `<Menu>` define `anchorOrigin`/`transformOrigin`, então ambos usam o padrão do MUI (ancorado no canto do elemento clicado) — como o hambúrguer fica no canto superior direito (`edge="end"`), o menu principal já nasce colado na borda da tela; o submenu por cima piora o efeito de "elementos flutuantes desalinhados".

**Correção:**
```jsx
const handleCoordenadorMenuOpen = (event) => {
  setMobileMoreAnchorEl(null); // fecha o menu pai antes de abrir o submenu
  setCoordenadorMenuAnchorEl(event.currentTarget);
};
```
E adicionar origem explícita para controlar onde o menu nasce em telas pequenas:
```jsx
<Menu
  anchorEl={mobileMoreAnchorEl}
  open={Boolean(mobileMoreAnchorEl)}
  onClose={handleMenuClose}
  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
>
```

### 2.4 Itens longos sem controle de largura/quebra de linha

Itens como `"Importar Cronograma Externo"`, `"Consulta Disponibilidade"` e `"Gerenciar Eventos"` não têm `noWrap` nem `maxWidth` definidos. O `<Menu>` do MUI dimensiona o `Paper` interno pelo conteúdo mais largo — em uma tela de 360–390px isso pode:

- Forçar o menu a quase encostar nas duas bordas da tela, cortando o respiro lateral que os demais componentes do app têm (`Container` usa `px: { xs: 1.5 }`, o menu não usa nada equivalente).
- Se o texto quebrar em duas linhas, o ícone (alinhado ao topo/centro da primeira linha) fica visualmente "flutuando" fora do centro vertical do item.

**Correção:**
```jsx
<ListItemText
  primary="Importar Cronograma Externo"
  primaryTypographyProps={{ noWrap: true, sx: { fontSize: { xs: '0.85rem', sm: '0.9rem' } } }}
/>
```

### 2.5 Toolbar mobile — três elementos de tamanhos diferentes na mesma fileira

```jsx
<IconButton sx={{ ml: 1 }} onClick={handleThemeChange} color="inherit">{darkMode ? <Sun size={20}/> : <Moon size={20}/>}</IconButton>
<IconButton size="large" onClick={handleProfileMenuOpen} color="inherit">
  {userProfileData?.photoURL ? <Avatar src={userProfileData.photoURL} sx={{ width: 32, height: 32 }} /> : <AccountCircle />}
</IconButton>
<IconButton size="large" edge="end" onClick={handleMobileMenuOpen} color="inherit"><MenuIcon /></IconButton>
```

Os três botões do canto direito do `AppBar` misturam:
- ícone `lucide-react` de 20px (tema),
- `Avatar` de 32×32px **ou** `AccountCircle` do MUI (~24px por padrão),
- `MenuIcon` (lucide) sem tamanho explícito (usa o tamanho padrão da lib, diferente dos outros dois).

Como só o botão do meio recebe `size="large"` de forma proposital para acomodar o avatar, mas os três dividem o mesmo `gap: 1` do `Box` pai, o **peso visual** de cada ícone é diferente — em telas pequenas, onde a fileira de ícones já é apertada, isso passa a sensação de itens "fora de esquadro" mesmo estando tecnicamente alinhados pelo `flexbox`.

**Correção:** padronizar todos os ícones dessa fileira em 22–24px e usar `Avatar` com o mesmo `width/height` do ícone `MenuIcon` renderizado (ou envolver o avatar num `Box` de tamanho fixo igual ao dos outros ícones) para que os três botões tenham a mesma "massa" visual.

### 2.6 Divider órfão ao final da lista

```jsx
<Divider key="div2" sx={{ my: 0.5 }} />,
isCoordenadorOrTecnico && !approvalPending ? (<MenuItem .../>) : null,
!approvalPending ? <MenuItem key="ajuda" .../> : null
```

Se `isCoordenadorOrTecnico` for `false` (ex.: usuário recém-aprovado sem cargo específico ainda propagado) e `approvalPending` for `true`, o `Divider key="div2"` pode renderizar como **o último elemento da lista**, deixando uma linha divisória solta sem nada abaixo — quebra o ritmo vertical do menu.

**Correção:** filtrar dividers adjacentes a `null` no `.filter(Boolean)` final, ou construir a lista com um helper que só insere `Divider` quando há pelo menos um item válido depois.

---

## 3. Menu de ações do card — `src/components/EventoCard.jsx` (referência positiva)

```jsx
<Menu anchorEl={anchorEl} open={openMenu} onClose={handleMenuClose}>
  <MenuItem onClick={handleEditClick}><EditIcon fontSize="small" sx={{ mr: 1 }}/> Editar</MenuItem>
  <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}><DeleteIcon fontSize="small" sx={{ mr: 1 }}/> Excluir</MenuItem>
</Menu>
```

Este menu **está corretamente alinhado**: usa `sx={{ mr: 1 }}` (consistente com o `theme.spacing`) em vez de `style` inline, ícones do próprio MUI (`fontSize="small"`, sempre 20px) em vez de misturar bibliotecas de ícone, e não tem badge ou submenu para quebrar a coluna. **Recomendo usar este padrão como referência ao refatorar o menu principal** (seção 2), em vez de criar um terceiro padrão novo.

Único ponto de atenção: o ícone de gatilho (`MoreVertIcon`) fica posicionado em `position: 'absolute', top: 4, right: 4` sobre o card — em cards com `isSelectionMode` ativo, o `Checkbox` (`top: 4, left: 4`) e o menu de ações não têm o mesmo `size`/`padding` interno, então visualmente um lado do card parece "mais pesado" que o outro em mobile, onde os cards ficam lado a lado com pouca margem.

---

## 4. Causa estrutural no tema — falta `styleOverrides` para `MuiMenu`/`MuiMenuItem`

Em `src/theme.js`, existem `styleOverrides` para `MuiIconButton` (garantindo `minWidth/minHeight: 44px`, o alvo de toque recomendado) e para `MuiListItem`, mas **não existe nenhum override para `MuiMenu` ou `MuiMenuItem`**. Isso significa que:

- Cada tela que cria seu próprio `<Menu>` (hoje há pelo menos 3: `App.jsx` × 2, `EventoCard.jsx`) reimplementa o espaçamento do zero, e é exatamente por isso que um ficou diferente do outro (seção 2 vs. 3).
- A altura mínima de toque de 44px, já garantida para `IconButton`, **não é garantida para `MenuItem`** — dependendo da densidade de fonte (`responsiveFontSizes` reduz o `body1`/`body2` em telas pequenas), um item de menu pode ficar abaixo do alvo de toque recomendado em mobile.

**Correção sugerida em `theme.js`**, dentro de `components`:

```js
MuiMenuItem: {
  styleOverrides: {
    root: {
      minHeight: 44,
      paddingTop: 8,
      paddingBottom: 8,
      gap: 10, // substitui o "marginRight: 10" espalhado pelo código
    },
  },
},
MuiMenu: {
  styleOverrides: {
    paper: {
      maxWidth: 'calc(100vw - 32px)', // nunca encosta nas bordas em telas pequenas
    },
  },
},
```

Com `gap: 10` no `MuiMenuItem`, todo `MenuItem` que renderiza `<Ícone /> Texto` como filhos diretos (o padrão atual do projeto) passa a ter o mesmo espaçamento automaticamente, **sem precisar do `menuIconStyle` manual** nem do risco de esquecer o espaço (o bug da seção 2.1).

---

## 5. Resumo — o que corrigir, em ordem de impacto

| # | Problema | Arquivo | Impacto visual | Esforço |
|---|---|---|---|---|
| 1 | `gap: 10` centralizado no tema (`MuiMenuItem`) em vez de `style` manual por ícone | `theme.js` | Alto — resolve a causa raiz de quase todos os itens | Baixo |
| 2 | Espaço faltando entre `</Badge>` e "Aprovações" | `App.jsx` (`CoordenadorGerenciarMenu`) | Alto — bug visual isolado, fácil de notar | Baixo |
| 3 | Fechar `mobileMoreAnchorEl` ao abrir `CoordenadorGerenciarMenu` | `App.jsx` (`handleCoordenadorMenuOpen`) | Alto — dois popovers sobrepostos | Baixo |
| 4 | Definir `anchorOrigin`/`transformOrigin` nos 3 `<Menu>` | `App.jsx` | Médio — evita menu colado/cortado na borda | Baixo |
| 5 | `maxWidth: calc(100vw - 32px)` no `MuiMenu` do tema | `theme.js` | Médio — evita menu mais largo que a tela | Baixo |
| 6 | Padronizar tamanho dos 3 ícones do canto direito do `AppBar` | `App.jsx` (`Toolbar`) | Médio — fileira de ícones com pesos visuais diferentes | Baixo |
| 7 | Trocar ícone+`style` por `ListItemIcon`+`ListItemText` | `App.jsx` (todos os `MenuItem`) | Médio — alinhamento em coluna garantido | Médio |
| 8 | Divider órfão ao final da lista filtrada | `App.jsx` (`navMenuItems`) | Baixo — caso de borda raro | Baixo |
| 9 | Padronizar `Checkbox`/gatilho de menu nos cards de seleção | `EventoCard.jsx` | Baixo — perceptível só com seleção múltipla ativa | Baixo |

Os itens 1, 2, 3 e 5 juntos já resolvem a maior parte da sensação de "desalinhado" com a menor mudança de código possível — recomendo começar por eles.
