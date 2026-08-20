# Auditoria tipográfica do APEX Food

## Diagnóstico

O sistema utiliza a fonte Inter e não possui uma escala tipográfica compartilhada completa. A maior parte das páginas combina classes Tailwind como `text-xs` e `text-sm` com tamanhos arbitrários de `text-[9px]`, `text-[10px]` e `text-[11px]`. O inventário atual encontrou aproximadamente 573 ocorrências de `text-xs`, 330 de `text-sm`, 270 de `text-[10px]`, 21 de `text-[11px]` e 3 de `text-[9px]`. Também existem regras específicas da Visão Geral abaixo de 0,65rem, incluindo `.56rem`, `.58rem` e `.62rem`.

Esses tamanhos são legíveis em alguns monitores, mas ficam excessivamente discretos em telas menores e criam uma hierarquia irregular: labels, chips, notas auxiliares e alguns títulos de seção acabam quase no mesmo tamanho visual.

## Escala proposta

| Nível | Uso | Tamanho mínimo proposto | Peso e entrelinha |
|---|---|---:|---|
| Micro | badges, chips, indicadores compactos e textos de apoio muito curtos | 0,6875rem / 11px | 500–600; 1,3 |
| Auxiliar | labels, metadados, filtros, legendas e descrições breves | 0,75rem / 12px | 400–500; 1,4 |
| Corpo | textos de leitura, navegação e controles | 0,875rem / 14px | 400–500; 1,5 |
| Subtítulo | títulos internos de card e seções menores | 1rem / 16px | 600; 1,35 |
| Título de seção | cabeçalhos de módulos e blocos principais | 1,125rem / 18px | 600–700; 1,3 |
| Valor principal | KPIs e números de destaque | 1,5rem / 24px ou maior | 700; 1,1 |

A intervenção deve ser centralizada em `tokens-apex.css`, com ajustes pontuais em `home.css` para os componentes que usam valores abaixo de 0,65rem. O layout, espaçamento, cores, responsividade e shell único não devem ser alterados. Os tamanhos de títulos grandes e da página de autenticação devem permanecer proporcionais, sem receber aumento global indiscriminado.
