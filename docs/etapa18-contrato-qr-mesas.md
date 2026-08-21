# Etapa 18 — Contrato de gestão dos QR Codes das mesas

## Objetivo

A Etapa 18 deve concluir e fortalecer a administração real dos QR Codes das mesas dentro do módulo existente de **Configuração de Mesas**. O operador autorizado poderá cadastrar mesas, visualizar o estado de cada QR Code, gerar um código para impressão, copiar o link público, imprimir o material da mesa, regenerar o código quando necessário e revogar um código comprometido ou substituído.

A implementação será incremental. O shell único, o header, o sidebar, o módulo de salão, o fluxo público `/mesa` e o endpoint consolidado `/api/v1/qrcode-mesa` serão preservados. Nenhuma nova função será criada em `api/v1/`.

## Estado atual reaproveitado

| Área | Contrato já existente |
| --- | --- |
| Persistência de mesas | Coleção `mesas` dentro do restaurante autenticado, com `nome`, `capacidade`, `area`, `estado`, `observacoes` e versionamento |
| Geração administrativa | `POST /api/v1/qrcode-mesa` com `acao: gerar` e `idMesa` |
| Revogação administrativa | `POST /api/v1/qrcode-mesa` com `acao: revogar` e `idMesa` |
| Imagem do QR | Data URL produzida no servidor com biblioteca determinística, sem serviço externo |
| Segurança | Sessão autenticada, papéis `proprietario`, `administrador` ou `gerente`, CSRF, App Check, rate limit e auditoria |
| Persistência do segredo | O token claro não é salvo; o hash fica na mesa e o token de idempotência permanece cifrado |
| Fluxo público | O QR abre `/mesa?qr=...`, valida o código, exige nome completo e inicia a sessão HttpOnly da mesa |
| Interface | Fragmento de Configuração de Mesas carregado no body pelo shell único |

## Regras de segurança

O frontend nunca escolherá o restaurante, não acessará o Firestore diretamente e não receberá `qrHash`, token de sessão ou credenciais administrativas. O restaurante será obtido exclusivamente da sessão operacional autenticada no servidor. Toda mutação continuará usando CSRF, App Check, idempotência, transação e auditoria.

A regeneração deverá invalidar o QR anterior por substituição do hash e da versão armazenados na mesa. A revogação deverá remover a validade pública do código sem apagar o histórico operacional. A URL pública e a imagem do QR só serão retornadas como resultado da operação administrativa autorizada; o valor persistido continuará protegido.

## Experiência esperada

A tela existente deverá mostrar claramente a situação de cada mesa: **QR Code ativo**, **QR Code não gerado** ou QR revogado quando aplicável. A ação de geração deverá informar o andamento e, ao concluir, abrir o modal com imagem, link público, cópia e impressão. A ação de regeneração deverá deixar explícito que o código anterior deixará de funcionar. A revogação deverá exigir confirmação acessível antes de invalidar o código.

A impressão será feita pelo navegador com uma página temporária contendo o nome da mesa, o QR Code e a orientação de escaneamento. Não será usado serviço externo de geração de QR. A cópia deverá usar a API de área de transferência quando disponível e manter uma alternativa de seleção do campo quando o navegador bloquear a permissão.

## Critérios de aceite

| Critério | Resultado esperado |
| --- | --- |
| Isolamento | Apenas mesas do restaurante da sessão autenticada aparecem e podem ser alteradas |
| Cadastro | Nova mesa continua sendo criada pelo handler real do Salão e pode receber QR posteriormente |
| Geração | Operador autorizado recebe uma imagem funcional e uma URL pública correspondente |
| Regeneração | Uma nova versão invalida o QR anterior e registra a operação |
| Impressão | O material impresso contém a mesa, o QR e a orientação para o cliente |
| Cópia | O link pode ser copiado sem persistência em `localStorage` ou `sessionStorage` |
| Revogação | O QR deixa de validar publicamente e a mesa permanece preservada |
| Idempotência | Repetição da mesma operação não cria resultados inconsistentes |
| Auditoria | Geração, regeneração e revogação possuem registro operacional no Firestore |
| Segurança pública | O QR público continua com App Check desabilitado somente no fluxo público aprovado, sem abrir acesso administrativo |
| Layout | A implementação permanece no fragmento atual, com bordas cinza claras e responsividade desktop, tablet e mobile |
| Limite de deploy | Nenhum arquivo novo em `api/v1/`; o endpoint consolidado continua sendo reutilizado |

## Validação obrigatória

Antes da publicação serão executados `node --check` nos arquivos alterados, a suíte completa `node --test`, o scanner `node scripts/seguranca/verificar-segredos.js`, a validação do JSON da Vercel, a conferência do limite de funções e `git diff --check` no clone de publicação. A produção será verificada sem executar mutações não solicitadas, incluindo rota limpa, API protegida e carregamento da página dentro do shell único.
