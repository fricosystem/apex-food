# Fase 8 — Auditoria, Migração Controlada e Hardening

**Projeto:** APEX Food  
**Ambiente analisado:** Development (`apex-food-6c1cb`) e deploy público atual em `.vercel.app`  
**Status:** diagnóstico concluído; nenhuma migração ou alteração de dados executada automaticamente.

## 1. Resultado da auditoria inicial

O repositório está limpo após a publicação da Fase 7 e o branch `main` está sincronizado com `origin/main`. A arquitetura permanece baseada no shell único, fragments em `paginas/`, funções Vercel consolidadas e acesso ao Firestore exclusivamente pelo Firebase Admin SDK no backend.

O Firestore está documentado como `deny-by-default`, sem acesso direto previsto pelo navegador. O contrato multiestabelecimento mantém o isolamento por `idRestaurante`, a autorização global do Desenvolvedor separada dos papéis locais e as permissões efetivas calculadas server-side. Não foi encontrada rotina de migração, reconciliação ou relatório de integridade; essa é a principal lacuna funcional da Fase 8.

A auditoria operacional atual registra ação, recurso, ator, resultado, motivo, requisição e timestamps server-side, mas ainda não possui uma varredura padronizada de inconsistências nem uma política implementada de retenção e consulta de relatórios de migração. A auditoria global do Desenvolvedor já está separada em `registrosAuditoriaGlobais` e não deve ser misturada aos registros operacionais.

O preflight de Preview/Staging já bloqueia placeholders, origens inseguras, wildcard de CORS, projeto Development reutilizado, segredos curtos e rate limit sem HTTPS. Foi identificada uma inconsistência documental a ser corrigida: o script exige `APP_ENV=preview`, enquanto a matriz de ambientes descreve Preview/Staging com `APP_ENV=staging`. A Fase 8 deve escolher um único valor e manter script, documentação e testes alinhados.

A configuração documental do Firebase informa região `nam5`, zero índices compostos versionados, backups programados desativados e produção ainda não configurada. Esses itens não serão alterados automaticamente nesta fase, pois qualquer mudança de projeto, região, backup ou ambiente exige decisão operacional explícita e pode ter impacto de custo, retenção ou disponibilidade.

## 2. Matriz de hardening

| Controle | Estado atual | Tratamento da Fase 8 | Critério de aceite |
|---|---|---|---|
| Separação de ambientes | Development definido; Staging e Production não totalmente separados | Alinhar contrato `APP_ENV`, preflight, documentação e testes | Valores coerentes e bloqueio de projeto Development fora do ambiente permitido |
| Firestore direto pelo navegador | Bloqueado por regras `deny-by-default` | Preservar; adicionar teste de regressão documental | Nenhuma coleção operacional acessível diretamente pelo cliente |
| Sessão e CSRF | Cookie HttpOnly, verificação Firebase e token double-submit | Auditar TTL, rotação, mensagens e testes sem expor segredos | Falhas retornam contrato público mínimo e não registram tokens |
| App Check e origem | App Check configurável; CORS/origem validados | Exigir `enforce` no ambiente de produção quando homologado | Preview/Production não aceitam wildcard ou origem HTTP |
| Isolamento tenant-aware | Contexto HMAC e membro ativo validados | Criar relatório somente leitura de órfãos, vínculos inconsistentes e papéis desconhecidos | Nenhuma consulta de auditoria atravessa o escopo por acidente; relatório não altera dados |
| Papéis e permissões | Permissões locais centralizadas na Fase 7 | Verificar invariantes, papéis desativados e permissões inválidas | Desenvolvedor não aparece em papéis ou permissões locais |
| Auditoria | Registros operacionais e globais separados | Padronizar relatório de integridade, origem, resultado e retenção | Auditoria append-only, sem senha, token, CPF/CNPJ bruto ou payload bruto |
| Migração | Não há executor existente | Implementar modo padrão somente leitura e modo de aplicação explicitamente bloqueado | Execução padrão produz relatório e não escreve no Firestore |
| Backups e rollback | Backups programados não configurados no contrato | Documentar pré-condições e exigir decisão manual | Nenhuma alteração destrutiva sem backup, aprovação e plano de reversão |
| Limite de funções Vercel | Quatro funções em `api/v1`; limite de doze | Não criar novas funções públicas | Migração e relatórios ficam em scripts/helpers internos, não em novas rotas |

## 3. Regras de operação segura

A Fase 8 não executará provisionamento, alteração global, migração de dados, criação de índices, troca de região, ativação de backups ou mudança de ambiente sem uma aprovação operacional específica. O modo padrão de qualquer ferramenta de integridade será somente leitura, com saída em arquivo local e sem registrar dados pessoais completos.

Relatórios de inconsistência devem usar códigos de problema, contagens e identificadores opacos mínimos. CPF, CNPJ completo, email autorizado, UID do Desenvolvedor, tokens, cookies, chaves privadas e senhas não podem aparecer na saída, nos testes, nos logs ou nos documentos versionados.

A correção de um problema deverá ser separada da sua detecção. Primeiro será produzido um relatório idempotente; depois, cada classe de problema deverá ter uma política explícita de correção, retenção do valor anterior e auditoria. Nenhuma rotina deverá apagar snapshots históricos de pedidos ou inferir o papel de um usuário a partir de email.

## 4. Sequenciamento aprovado para a Fase 8

A próxima subfase implementará o relatório de integridade e migração em modo somente leitura, cobrindo restaurantes, índices fiscais, membros ativos, papéis locais, permissões e referências operacionais essenciais. Em seguida serão reforçados os invariantes e a auditoria. Por último serão executadas as validações de segurança, produção e documentação; a publicação ocorrerá somente depois de todos os testes passarem.

## 5. Pendências que dependem de decisão externa

A criação de um projeto Firebase Staging separado, a configuração de backups, a definição de retenção, a adoção de `APP_ENV=staging` ou `preview` como valor oficial, a ativação de App Check em `enforce` e qualquer promoção para Production continuam dependentes de configuração no Firebase/Vercel e aprovação operacional. O código desta fase não deve presumir que essas ações já foram realizadas.

## 6. Relatório de integridade implementado

O script `scripts/migracao/gerar-relatorio-integridade.js` foi criado com modo padrão somente leitura. Ele percorre restaurantes dentro de limite configurável, valida campos essenciais, índices fiscais, vínculos de membros, papéis locais, permissões e a coerência de `idRestaurante` em coleções operacionais selecionadas. A análise pura é testável sem credenciais e a rotina de acesso ao Firestore utiliza somente leituras (`get`). Não existe opção implícita de aplicação, exclusão ou atualização.

A execução autorizada, quando houver credenciais apropriadas no ambiente correto, deverá ser feita explicitamente, por exemplo:

```bash
node scripts/migracao/gerar-relatorio-integridade.js --limite=500 --saida=/caminho/seguro/relatorio-integridade.json
```

O arquivo de saída é criado com permissão restrita e contém o modo `somente_leitura`, contagens, códigos de problema, severidade, recurso e identificadores opacos mínimos. O relatório não deve ser publicado em URL, frontend, logs públicos ou commit; deve ser tratado como artefato operacional restrito.

Os testes da Fase 8 comprovam tenants coerentes sem problemas, detecção de inconsistências críticas, ausência de membro ativo, índice fiscal ausente, limites de varredura e ausência de escritas Firestore no script. A execução contra o projeto real permanece deliberadamente pendente de autorização operacional e não foi realizada nesta fase.

A auditoria também verifica a existência e o estado operacional dos usuários referenciados por membros, conflitos de documento fiscal entre estabelecimentos, índices inválidos e documentos operacionais sem `idRestaurante`. Problemas críticos são reportados por código e contagem; nenhuma chave fiscal, UID ou identificador de usuário é incluído na mensagem do problema.

## 7. Hardening HTTP e auditoria

As respostas JSON agora incluem `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy` restritiva e `Cross-Origin-Resource-Policy: same-origin`. O preflight CORS autorizado também declara `X-Firebase-AppCheck`, mantendo o suporte ao controle App Check em chamadas cross-origin permitidas.

Os registros operacionais e globais passaram a normalizar texto, identificadores, papéis e resultados antes da persistência. O formato de auditoria foi versionado para `1.1.0`; as coleções continuam separadas e as mensagens públicas não recebem detalhes internos.
