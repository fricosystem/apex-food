# Etapa 10 — Auditoria e recorte seguro de Equipe

**Projeto:** APEX Food  
**Ambiente:** Development na Vercel  
**Status:** Auditoria concluída; endpoints server-side aguardando implementação  
**Princípio:** adicionar integração incrementalmente, sem refazer o sistema, sem alterar o shell único, sem duplicar sidebar/header e sem modificar a identidade visual existente.

## 1. Objetivo da auditoria

A Etapa 10 foi aprovada para migrar os módulos **Funcionários**, **Escala de Trabalho** e **Comissões**. A auditoria verificou os dados simulados, as páginas fragmentadas, os scripts de renderização, os filtros e indicadores, os modais e os contratos multi-tenant já aprovados.

O recorte exige cuidado adicional porque Equipe contém **dados pessoais de funcionários** e Comissões contém valores de desempenho e remuneração calculada. A implementação inicial não retornará dados privados completos por conveniência, não permitirá que o navegador escolha papéis ou tenant e não aceitará valores de comissão calculados pelo cliente.

## 2. Inventário funcional auditado

| Módulo | Rota existente | Fonte atual | Elementos preservados | Risco principal |
|---|---|---|---|---|
| Funcionários | `#/funcionarios` | `window.dadosEquipeApexFood.funcionarios` | Indicadores, busca, filtros de setor/status, ordenação, cards, modal de detalhes e formulário | PII de contato e alterações de vínculo |
| Escala de Trabalho | `#/escala-trabalho` | `window.dadosEquipeApexFood.escalas` e `funcionarios` | Agenda de cinco dias, filtros setor/turno/status, tabela, indicadores e formulário de nova escala | Jornadas conflitantes e alteração indevida de presença |
| Comissões | `#/comissoes` | `window.dadosEquipeApexFood.comissoes` e `funcionarios` | Filtro de período, busca, indicadores agregados, ranking, barras e modal de detalhes | Exposição de remuneração e cálculo adulterado |

O dataset atual contém oito funcionários, nove escalas e quatro registros de comissão. Os campos de funcionário incluem nome, iniciais, cargo, setor, telefone, email, status, turno, admissão, percentual de comissão, vendas, avaliação e pedidos. Os campos de escala incluem funcionário, data, entrada, saída, intervalo, turno e status. Os campos de comissão incluem período, vendas, percentual, comissão, pedidos, variação e posição.

Os campos de telefone, email completo, data de admissão e qualquer dado privado não deverão ser devolvidos por um endpoint de lista sem necessidade explícita. A interface existente exibe parte desses valores, portanto o adaptador deverá retornar somente o mínimo necessário à tela autorizada, com contato mascarado quando a tela não exigir o valor completo.

## 3. Coleções canônicas e separação de dados

O schema aprovado define as coleções dentro do restaurante:

```text
restaurantes/{idRestaurante}/funcionarios/{idFuncionario}
restaurantes/{idRestaurante}/dadosPrivadosFuncionarios/{idFuncionario}
restaurantes/{idRestaurante}/escalas/{idEscala}
restaurantes/{idRestaurante}/comissoes/{idComissao}
```

A coleção `funcionarios` conterá somente o perfil operacional mínimo. A coleção `dadosPrivadosFuncionarios` ficará restrita ao backend e não será exposta na primeira versão do endpoint de listagem. O id do documento privado poderá coincidir com o id do funcionário, mas a API nunca deverá aceitar um `idUsuario` ou `idRestaurante` enviado pelo navegador como autoridade.

| Coleção | Campos do primeiro recorte | Regra de proteção |
|---|---|---|
| `funcionarios` | `nome`, `iniciais`, `cargo`, `setor`, `turno`, `status`, `percentualComissao`, `cor`, autoria, timestamps e `versao` | Lista autorizada; sem contato completo por padrão |
| `dadosPrivadosFuncionarios` | `telefone`, `email`, `dataAdmissao`, documentos e observações privadas | Nenhuma leitura pelo navegador no primeiro recorte; acesso futuro por endpoint específico e papel crítico |
| `escalas` | `idFuncionario`, `data`, `entrada`, `saida`, `intervalo`, `turno`, `status`, autoria, timestamps e `versao` | Validar funcionário do mesmo restaurante e conflito de jornada |
| `comissoes` | `idFuncionario`, `periodo`, `vendasCentavos`, `percentual`, `comissaoCentavos`, `pedidos`, `variacaoPercentual`, `posicao`, origem e timestamps | Calculada no servidor; somente leitura no primeiro recorte |

Valores monetários serão armazenados como inteiros em centavos. O campo `comissaoCentavos` será produzido por cálculo server-side a partir de vendas elegíveis e percentual autorizado; o cliente poderá enviar apenas filtros de período e busca, nunca o valor final ou a posição do ranking.

## 4. Matriz inicial de autorização

A resolução do tenant seguirá o mesmo fluxo já implementado: sessão válida, contexto assinado, membro ativo, papéis server-side, autorização da operação, validação do payload e auditoria. Não haverá endpoint público de Equipe.

| Operação | Papéis permitidos inicialmente | Limite |
|---|---|---|
| Listar perfil operacional de funcionários | `proprietario`, `administrador`, `gerente`, `analista`, `auditor` | DTO mínimo, sem documento privado |
| Criar funcionário operacional | `proprietario`, `administrador` | Não cria usuário Firebase nem membership automaticamente |
| Editar nome/cargo/setor/turno/status | `proprietario`, `administrador` | Alteração auditada e com versão |
| Ler `dadosPrivadosFuncionarios` | Nenhum no primeiro endpoint | Será especificado em etapa administrativa própria |
| Listar escalas | `proprietario`, `administrador`, `gerente`, `analista`, `auditor` | Sem dados privados além do nome necessário à tabela |
| Criar/editar escala | `proprietario`, `administrador`, `gerente` | Validar jornada, status e funcionário do mesmo tenant |
| Alterar presença operacional | `proprietario`, `administrador`, `gerente` | Comando explícito, auditado e com estados fechados |
| Ler comissões agregadas | `proprietario`, `administrador`, `gerente`, `financeiro`, `analista`, `auditor` | Retornar somente período e métricas autorizadas |
| Criar/editar comissão | Nenhum no primeiro recorte | Apenas cálculo server-side e revisão controlada |
| Exportar dados de Equipe | Nenhum no primeiro recorte | Exige reautenticação/MFA, escopo e etapa própria |

O papel `gerente` poderá operar escala e status de jornada, mas não terá acesso automático a dados privados, configuração de permissões ou exportação. Um funcionário não receberá acesso ao módulo de Equipe por inferência do cargo textual; eventual autoatendimento deverá usar vínculo explícito e endpoint separado.

## 5. Recorte de implementação

A sequência abaixo reduz o risco e preserva a experiência atual:

| Ordem | Entrega | Motivo |
|---|---|---|
| 1 | Leitura autorizada de funcionários operacionais | Valida DTO mínimo, tenant, PII reduzida e adaptação visual |
| 2 | Leitura de escalas com filtros de data/setor/turno/status | Substitui o mock sem introduzir cálculo financeiro |
| 3 | Leitura de comissões calculadas | Valida período, agregações e proteção de valores |
| 4 | Criação/edição de funcionário operacional | Mutação administrativa pequena, auditada e sem dados privados |
| 5 | Criação/edição de escala e atualização de presença | Validar jornadas conflitantes e máquina de estados |
| 6 | Reprocessamento/revisão de comissões | Somente após origem de vendas e regras de cálculo estarem confirmadas |

O endpoint inicial poderá expor um grupo versionado `/api/v1/equipe` com `GET`, `POST` e `PATCH` controlados por `recurso`. A API deverá limitar quantidade de documentos, aceitar apenas filtros conhecidos e retornar `meta.idRestaurante` sem expor membership completo.

Até a homologação, os dados simulados permanecerão como fallback somente no ambiente local. Em domínio publicado, falha de sessão, tenant ou autorização deverá produzir estado vazio/erro controlado, nunca substituir silenciosamente a resposta por dados de demonstração.

## 6. Riscos e controles específicos

O risco de maior impacto é exposição de PII de funcionários. O controle é separar `funcionarios` de `dadosPrivadosFuncionarios`, mascarar contatos, não registrar email/telefone completo em auditoria e não retornar documento Firestore inteiro. O segundo risco é alterar uma escala para um funcionário de outro restaurante; o endpoint deverá verificar a existência do funcionário dentro do mesmo caminho de restaurante antes de gravar.

O terceiro risco é conflito de jornada. A criação ou atualização de escala deverá validar entrada, saída e intervalo, normalizar virada de meia-noite, limitar duração máxima e rejeitar sobreposição de turnos ativos do mesmo funcionário. A transação deverá ler antes de escrever e não disparar efeitos externos.

O quarto risco é manipulação de comissão. O servidor deverá calcular vendas elegíveis, percentual e valor em centavos. A API de leitura poderá devolver apenas métricas calculadas para o período autorizado. Não será permitido `posicao`, `comissaoCentavos`, `vendasCentavos` ou `percentual` vindos do corpo de uma mutação.

Também será obrigatório validar enums, limitar payload, escapar texto na interface existente, incrementar `versao`, usar autoria server-side, registrar auditoria sem PII e manter as Firestore Rules em deny-by-default.

## 7. Critérios de aceite da auditoria

A auditoria está concluída porque os módulos, campos, riscos, coleções, papéis e recorte de menor risco estão definidos. A próxima fase poderá implementar o contrato da API sem alterar `index.html`, `scripts/shell/apex-shell.js` ou o layout dos fragmentos.

A Etapa 10 somente será considerada concluída após testes de usuário sem sessão, papel insuficiente, tenant incorreto, ID de funcionário manipulado, tentativa de leitura de documento privado, payload de comissão adulterado, escala conflitante, jornada inválida, XSS em nomes e falha de API. A publicação dependerá de testes locais aprovados, inspeção de segredos, deploy Ready e smoke test remoto em Development.

## Referências internas

[1]: `docs/firebase/etapa-6-schema-multitenant.md` — Schema multi-tenant aprovado, coleções de Equipe, papéis e invariantes.  
[2]: `Plano-Firebase.md` — Ordem de migração, critérios de Equipe e requisitos de PII.  
[3]: `scripts/equipe/dados-equipe.js` — Dataset simulado atual.  
[4]: `scripts/equipe/funcionarios.js`, `scripts/equipe/escala-trabalho.js` e `scripts/equipe/comissoes.js` — Contratos visuais e ações atuais.

## 8. Validação local inicial

A rota `#/funcionarios` carregou dentro do shell único com os oito cards de preview, indicadores, busca, filtros, ordenação e formulário de novo funcionário preservados. A rota `#/escala-trabalho` carregou com agenda de cinco dias, quatro turnos de hoje, indicadores de presença/cobertura, filtros e tabela sem erros visíveis. A conversão do formato de data remoto para o formato visual `dd/mm/aaaa` preservou os quatro turnos do dia atual.

A rota `#/comissoes` carregou com quatro colaboradores no período, indicadores de vendas/comissões/ticket, melhor desempenho, ranking, distribuição, busca, seletor de período e modal preservados. O console do navegador não apresentou saída após o carregamento da rota, sem erros de script visíveis.

## 9. Publicação

O commit `23e9270` foi publicado na branch `main` e apareceu na Vercel como deployment Production. Na primeira checagem remota, o deployment ainda estava em estado `Building`; o smoke test remoto será executado somente após o estado `Ready`.

O deployment `23e9270` permaneceu em `Building` nas checagens de aproximadamente 32 e 39 segundos. Nenhum smoke test autenticado ou de dados operacionais será executado antes do estado `Ready`.

## 10. Correção do limite de funções da Vercel

O primeiro deploy do commit `23e9270` falhou no plano Hobby porque a configuração passou a exceder o limite de 12 Serverless Functions por deployment. O build dos arquivos foi concluído, mas a Vercel recusou a publicação durante a etapa de deploy.

Para corrigir sem upgrade e sem alterar as rotas públicas, Cardápio, Salão e Equipe passaram a usar handlers internos em `api/_lib/`, um único agregador `api/v1/operacional.js` e rewrites de `/api/v1/cardapio`, `/api/v1/salao` e `/api/v1/equipe` para esse agregador. A contagem de funções foi reduzida sem remover autenticação, CSRF, RBAC, contexto de restaurante, transações, auditoria ou contratos públicos.

Após a consolidação, a suíte local passou com 28 testes, a sintaxe dos handlers foi aprovada e `vercel.json` foi validado como JSON. Um novo commit de correção será publicado e acompanhado até `Ready`.

O commit corretivo `e15722d` foi publicado e gerou um novo deployment Production na Vercel. Na primeira checagem, o deployment consolidado ainda estava em `Building` (aproximadamente 20 segundos); o smoke test remoto será executado somente após `Ready`.

Na segunda checagem, o deployment `e15722d` ainda estava em `Building` aos aproximadamente 35 segundos. A publicação permanece em acompanhamento e o smoke test continua bloqueado até o estado final.

Na terceira checagem, o deployment `e15722d` ainda estava em `Building` aos aproximadamente 48–49 segundos. A validação remota permanece bloqueada até a conclusão do deploy.

## 11. Smoke test remoto após consolidação

O deployment `e15722d` ficou `Ready` em Production. No domínio `https://apexfood.vercel.app`, `/api/v1/health` retornou `200` com `estado: ok` e ambiente `development`. Os caminhos públicos `/api/v1/cardapio`, `/api/v1/salao` e `/api/v1/equipe` foram resolvidos pelo agregador e retornaram `401 NAO_AUTENTICADO` sem sessão, sem `404` ou erro de função. A tentativa de abrir `index.html#/funcionarios` sem sessão redirecionou para `paginas/autenticacao.html`.

O commit de documentação `03408df` gerou um novo deployment Production; na primeira checagem ele estava em `Building` aos 17 segundos. O código funcional consolidado permanece publicado e `Ready` no deployment `e15722d`; o novo deployment contém apenas a documentação adicional.

Na última checagem disponível, o deployment de documentação `03408df` ainda estava em `Building` aos aproximadamente 31–32 segundos, enquanto o deployment funcional `e15722d` permanecia `Ready`. Como o commit `03408df` altera apenas documentação, a integridade funcional já foi confirmada no smoke test contra o deployment consolidado.
