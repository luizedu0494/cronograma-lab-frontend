# 🧪 Cronograma Lab - Sistema de Agendamento de Laboratórios

## 🎯 Visão Geral do Projeto

O **Cronograma Lab** é uma aplicação web robusta e moderna, desenvolvida para otimizar a gestão e o agendamento de aulas e atividades em laboratórios de instituições de ensino. Construído com **React** e **Firebase**, o sistema oferece uma solução completa para coordenadores, professores e alunos, garantindo transparência, eficiência e comunicação em tempo real sobre a ocupação dos espaços laboratoriais.

Este projeto foi recentemente aprimorado com foco em **Experiência do Usuário (UX)**, **Otimização de Dados** e **Novas Funcionalidades** estratégicas, tornando-o uma ferramenta ainda mais poderosa para o ambiente acadêmico.

## ✨ Principais Funcionalidades

### 🚀 Melhorias de UX e Interface (Fases 2 e 3)

| Funcionalidade | Descrição | Benefício |
| :--- | :--- | :--- |
| **Filtros Dinâmicos** | Adição de filtros por laboratório, curso, status e dia da semana na visualização do cronograma. | Permite aos usuários localizar rapidamente as informações de interesse, melhorando a navegabilidade. |
| **Visualização de Ocupação** | Mapa de calor simplificado que exibe a ocupação horária do laboratório, indicando aulas simultâneas. | Ajuda coordenadores e proponentes a identificar horários de pico e janelas de disponibilidade. |
| **Drag-and-Drop (D&D)** | Funcionalidade de arrastar e soltar para propostas de aula pendentes, permitindo que coordenadores as movam facilmente no calendário. | Agiliza o processo de aprovação e reagendamento de propostas. |
| **Contador de Pendências** | Notificação visual no painel de avisos e na navegação principal para propostas de aula aguardando aprovação. | Garante que nenhuma proposta seja esquecida, melhorando o tempo de resposta. |
| **Atualização em Tempo Real** | Uso de `onSnapshot` do Firestore para garantir que o painel de avisos e o calendário reflitam as alterações instantaneamente. | Elimina a necessidade de recarregar a página, proporcionando uma experiência fluida. |

### 📊 Novas Funcionalidades Estratégicas (Fase 4)

| Funcionalidade | Descrição | Benefício |
| :--- | :--- | :--- |
| **Dashboard de Análise** | Novo módulo com gráficos e métricas de uso dos laboratórios (por curso, tipo de atividade, turno, mês). Inclui a métrica de **Proposta vs. Aprovação**. | Fornece dados valiosos para a gestão, auxiliando na tomada de decisões sobre recursos e planejamento. |
| **Exportação para Calendário (.ics)** | Permite aos usuários exportar o cronograma filtrado para seus calendários pessoais (Google Calendar, Outlook, Apple Calendar) via arquivo `.ics`. | Facilita a organização pessoal e a integração com ferramentas de produtividade. |
| **Integração de Feriados** | O calendário agora exibe e destaca automaticamente os feriados nacionais, estaduais e municipais (com base em dados mockados/API). | Evita agendamentos em dias não letivos, melhorando a precisão do cronograma. |
| **Otimização de Consultas** | Implementação de indexação e normalização de dados para consultas mais rápidas e eficientes no Firebase Firestore. | Reduz a latência e o custo operacional do banco de dados. |

## 🛠️ Stack Tecnológico

*   **Frontend:** React (CRA)
*   **Estilização:** Material-UI (MUI)
*   **Banco de Dados:** Firebase Firestore
*   **Autenticação:** Firebase Authentication
*   **Gráficos:** Chart.js (integrado via `react-chartjs-2`)
*   **Manipulação de Datas:** Day.js
*   **Drag-and-Drop:** `@dnd-kit/core`
*   **Exportação de Arquivos:** `file-saver` e `xlsx` (para Excel)

## ⚙️ Instalação e Configuração

Para configurar o projeto localmente, siga os passos abaixo:

### 1. Clonar o Repositório

```bash
git clone [URL_DO_SEU_REPOSITORIO]
cd cronograma-lab-frontend-main
```

### 2. Instalar Dependências

Certifique-se de ter o Node.js e o npm (ou pnpm/yarn) instalados.

```bash
npm install
# ou pnpm install
```

### 3. Configuração do Firebase

O projeto depende de uma instância do Firebase.

1.  Crie um novo projeto no [Firebase Console](https://console.firebase.google.com/).
2.  Adicione um aplicativo web ao seu projeto e copie as credenciais de configuração.
3.  Crie um arquivo `.env` na raiz do projeto e adicione suas credenciais:

    ```
    # .env
    REACT_APP_FIREBASE_API_KEY=SUA_API_KEY
    REACT_APP_FIREBASE_AUTH_DOMAIN=SEU_AUTH_DOMAIN
    REACT_APP_FIREBASE_PROJECT_ID=SEU_PROJECT_ID
    REACT_APP_FIREBASE_STORAGE_BUCKET=SEU_STORAGE_BUCKET
    REACT_APP_FIREBASE_MESSAGING_SENDER_ID=SEU_MESSAGING_SENDER_ID
    REACT_APP_FIREBASE_APP_ID=SEU_APP_ID
    ```

4.  **Firestore:** Habilite o Firestore e crie a coleção `aulas`. Para o funcionamento correto, o sistema espera que os documentos de aula contenham campos como `dataInicio`, `dataFim`, `status` (`aprovada`, `pendente`, `rejeitada`), `laboratorioSelecionado` e `cursos`.

### 4. Rodar a Aplicação

```bash
npm start
# ou pnpm start
```

A aplicação estará disponível em `http://localhost:3000`.

## 🤝 Contribuição

Contribuições são bem-vindas! Se você tiver sugestões de melhoria, relatar bugs ou quiser adicionar novas funcionalidades, sinta-se à vontade para abrir uma *issue* ou enviar um *Pull Request*.

## 📄 Licença

Este projeto está licenciado sob a Licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

---
