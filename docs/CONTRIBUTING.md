# Guia de Contribuição (Git Workflow)

Este documento descreve o fluxo de trabalho obrigatório para desenvolvedores no projeto **BoxLink**. Seguimos o modelo de *Feature Branches* para garantir a estabilidade da branch principal (`main`).

## 🚀 Fluxo de Desenvolvimento

### 1. Criando sua Branch
Sempre trabalhe em uma branch separada. O nome deve ser descritivo e seguir o padrão:
- `feature/descricao` (Novas funcionalidades)
- `fix/descricao` (Correção de bugs)
- `chore/descricao` (Tarefas de manutenção ou ambiente)
- `docs/descricao` (Melhorias na documentação)

```bash
git checkout -b feature/minha-tarefa
```

### 2. Padrão de Commits
Nossos commits devem ser claros e objetivos. Recomendamos o uso de [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` Introdução de uma nova funcionalidade.
- `fix:` Correção de um bug.
- `docs:` Alterações na documentação.
- `style:` Alterações que não afetam o significado do código (espaços em branco, formatação).
- `refactor:` Alteração de código que não corrige um bug nem adiciona uma funcionalidade.

```bash
git add .
git commit -m "fix: corrige tipagem do vitest e inicialização do servidor"
```

### 3. Sincronização e Atualização
Antes de abrir uma Pull Request, garanta que sua branch está atualizada com a `main` mais recente.

```bash
# Sincroniza a main local
git checkout main
git pull origin main

# Mescla as novidades na sua branch
git checkout feature/minha-tarefa
git merge main
```

### 4. Abrindo uma Pull Request (PR)
1. Envie sua branch para o GitHub:
   ```bash
   git push origin feature/minha-tarefa
   ```
2. No GitHub, abra a PR apontando da sua branch para a `main`.
3. Preencha a descrição utilizando o template de PR (se disponível).

## 🛠️ Regras Importantes
- **Nunca** faça push direto na `main`.
- **Garanta** que o linter e os testes estejam passando localmente antes do push.
- **Revise** seu código antes de solicitar a revisão de outro desenvolvedor.

---
*Equipe de Desenvolvimento BoxLink*
