# CrossCity Hub - Performance Dashboard 🏋️‍♂️🔥

Este é um dashboard de alta performance desenvolvido para boxes de CrossFit, otimizado para exibição em TVs. Ele oferece uma experiência visual imersiva para acompanhamento de treinos (WODs) em tempo real, rankings dinâmicos e histórico de resultados.

## 🚀 Funcionalidades Principais

- **Layout Otimizado para TV:** Design limpo, fontes grandes e alto contraste para visualização à distância.
- **Modo WOD Ativo (Competição):** Transição de tela para um modo focado no treino com cronômetro centralizado.
- **Ranking em Tempo Real:** Barras de progresso dinâmicas que se reordenam automaticamente conforme os atletas avançam no WOD.
- **Frequência Cardíaca Opcional:** Suporte para exibição de BPM para atletas com dispositivos conectados (exibe "Not Connected" para os demais).
- **Histórico de Resultados:** Salvamento automático do ranking final ao encerrar o WOD, acessível via ícone de histórico.
- **Branding Personalizado:** Identidade visual focada no "CrossCity Hub - CrossFit Elite".

## 🛠️ Tecnologias Utilizadas

- **React 19** + **Vite**
- **Tailwind CSS 4.0** (Estilização baseada em utilitários e variáveis de tema)
- **Framer Motion** (Animações fluidas e transições de estado)
- **Lucide React** (Ícones modernos)
- **Google Fonts** (Space Grotesk & Inter)

## 📦 Instalação e Configuração

Se você estiver integrando este frontend em um projeto existente:

1. **Instale as dependências necessárias:**
   ```bash
   npm install lucide-react motion
   ```

2. **Importe as fontes no seu CSS global (`index.css`):**
   ```css
   @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
   ```

3. **Certifique-se de que o Tailwind CSS está configurado** para ler as classes utilitárias e variáveis definidas no `src/index.css`.

## 🔌 Guia de Integração (Backend/App Existente)

Para conectar este frontend ao seu aplicativo "pronto", siga estas diretrizes:

### 1. Interface de Dados (Atletas)
O componente `App.tsx` espera um array de atletas no seguinte formato:

```typescript
interface Athlete {
  id: string;
  name: string;
  role: string;
  hr: number;      // Frequência cardíaca atual
  reps: number;    // Repetições totais (opcional)
  image: string;   // URL da foto do atleta
  progress: number; // 0 a 100 (porcentagem de conclusão do WOD)
  hasWatch: boolean; // Define se o sistema deve tentar ler BPM
}
```

### 2. Conexão com API
Substitua o estado inicial `INITIAL_ATHLETES` por uma chamada à sua API ou WebSocket para atualizações em tempo real:

```tsx
// Exemplo de integração via useEffect
useEffect(() => {
  const socket = new WebSocket('ws://seu-backend.com/live-wod');
  socket.onmessage = (event) => {
    const updatedAthletes = JSON.parse(event.data);
    setAthletes(updatedAthletes);
  };
  return () => socket.close();
}, []);
```

### 3. Persistência de Resultados
A função `handleStartWod` gera um objeto `WodResult` quando o WOD é interrompido. Você deve enviar este objeto para o seu banco de dados:

```typescript
interface WodResult {
  time: string;      // Tempo final formatado (ex: "18:42")
  athletes: Athlete[]; // Lista final ordenada pelo progresso
  date: string;      // Data e hora da conclusão
}
```

## 🎨 Customização Visual

Toda a identidade visual está concentrada no arquivo `src/index.css`. Você pode ajustar as cores neon e os efeitos de brilho alterando as variáveis no bloco `@theme`:

- `--color-primary`: Cor principal (Verde Neon/Lime)
- `--color-secondary`: Cor de destaque (Laranja/Alerta)
- `--color-background`: Fundo escuro profundo

---
Desenvolvido para **CrossCity Hub - CrossFit Elite**. 
*Transformando dados em performance.*
