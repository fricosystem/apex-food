# Direção de Design — APEX Food

## Três abordagens exploradas

| Tema | Introdução breve | Probabilidade |
| --- | --- | --- |
| **Brasa de Operação** | Um painel operacional de alto contraste inspirado no aço escurecido, na cozinha profissional e na chama controlada. Prioriza leitura rápida, densidade funcional e presença de marca. | 0,07 |
| **Caderno de Serviço** | Uma linguagem editorial clara inspirada em comandas, cadernos de reserva e etiquetas de cozinha. Usa uma base clara e linhas impressas para transmitir organização tátil. | 0,03 |
| **Ateliê de Hospitalidade** | Uma direção quente e elegante, com tons terrosos e detalhes artesanais para aproximar gestão e experiência de salão. | 0,09 |

## Abordagem escolhida: Brasa de Operação

### Movimento de design

**Utilitarismo editorial contemporâneo** com referências discretas a sistemas de ponto de venda profissionais, sinalização de cozinha e superfícies de aço escovado. A interface não deve parecer decorativa: cada camada visual deve facilitar a decisão operacional.

### Princípios centrais

1. **Leitura sob pressão:** informações, ações e estados devem ser reconhecíveis em poucos segundos.
2. **Contraste disciplinado:** preto profundo, cinzas de superfície e laranja de ação evitam ruído e orientam atenção.
3. **Estrutura modular:** áreas compartilhadas reduzem duplicação, enquanto páginas específicas preservam contexto operacional.
4. **Vazios honestos:** sem métricas, pedidos, nomes ou resultados inventados; o produto mostra estados de início claros e preparações para a futura fonte de dados.

### Filosofia de cor

O preto carvão estabelece concentração e diminui reflexos em ambientes de operação. O laranja queimado (`#EA580C`) atua como assinatura da marca e deve aparecer apenas em ações primárias, seleção de navegação e indicadores importantes. Verde, amarelo e vermelho são reservados exclusivamente para semântica de estado, nunca como ornamento.

### Paradigma de layout

Uma **faixa operacional lateral fixa** ancora a navegação no desktop. O conteúdo se organiza em uma coluna de contexto no topo e painéis de largura variável, com campos de ação na borda direita. Em telas menores, a faixa torna-se uma gaveta acionada pelo cabeçalho, preservando a área útil sem eliminar a navegação.

### Elementos de assinatura

1. **Marca em brasa:** símbolo geométrico composto por chama e talher, aplicado no cabeçalho e no favicon.
2. **Régua laranja:** uma linha de 3 px que marca a rota ativa e os pontos de atenção.
3. **Painéis de aço:** cards de baixo relevo com bordas finas, sombras sutis e títulos em caixa alta com espaçamento amplo.

### Filosofia de interação

Cada interação deve confirmar contexto sem bloquear o fluxo. Ações sem fonte de dados real exibem orientação neutra e direta; não simulam transações. A navegação destaca imediatamente a rota atual e o menu móvel fecha após a escolha para devolver foco ao conteúdo.

### Animação

Transições rápidas, entre 120 e 220 ms, usam `cubic-bezier(0.23, 1, 0.32, 1)`. O menu móvel desliza lateralmente, painéis aparecem com deslocamento vertical de 6 px e os botões respondem com escala de 0,97 ao pressionar. Animações não essenciais são removidas com `prefers-reduced-motion`.

### Sistema tipográfico

**Barlow Condensed** é usada em títulos, indicadores e rótulos operacionais, com caixa alta e rastreamento sutil. **Manrope** é usada para textos, formulários e tabelas, priorizando legibilidade contínua. Títulos devem ter peso 600–700; textos operacionais, 400–600.

### Essência da marca

**APEX Food é o centro de comando para restaurantes que precisam transformar o ritmo do serviço em operações rastreáveis, claras e consistentes.**

Personalidade: **direta, precisa e confiável**.

### Voz da marca

Headlines devem ser curtas e orientadas à ação; CTAs devem dizer exatamente o que farão; microcopy deve explicar o próximo passo sem jargões vazios.

> “Organize o próximo serviço antes do primeiro pedido.”

> “Conecte sua fonte de dados para acompanhar esta operação.”

### Wordmark e logo

O ícone é uma chama angular formada por dois talheres em negativo, dentro de um quadrado de cantos discretamente arredondados. O wordmark combina `APEX` em Barlow Condensed com `FOOD` em Manrope, sempre em caixa alta, com o ícone presente em superfícies de navegação.

### Cor de assinatura

**Laranja Brasa — `#EA580C`**.

## Style Decisions

- Em desktop, o trilho lateral é estrutural e permanece visível: apresenta símbolo, wordmark, grupos de rota e régua laranja da rota ativa.
- Imagens atuam como textura operacional escura, sempre subordinadas por sobreposições de contraste e sem função decorativa de hospitalidade.
- A régua laranja sinaliza seleção, ação primária e atenção crítica; brilhos ou campos laranja extensos são usados com moderação.
