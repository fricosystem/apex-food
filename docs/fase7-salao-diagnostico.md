# Diagnóstico da Fase 7 — Salão e Reservas

## Objetivo

Implementar os fluxos de Salão e Reservas com dados do restaurante ativo, mantendo o shell único, a identidade visual escura com destaque laranja, os fragmentos HTML existentes e as URLs limpas.

## Estado encontrado

| Área | Estado atual | Trabalho previsto |
|---|---|---|
| Mapa de Mesas | Grid, filtros, indicadores e modal de detalhes já existem. O bridge inicia com dados estáticos e depois tenta consultar Mesas. A ação do modal ainda apenas exibe uma notificação local. | Iniciar o bridge com estado vazio fora de localhost, manter a leitura tenant-aware e conectar ações compatíveis ao contrato operacional. |
| Reservas | Calendário, filtros, indicadores, tabela e formulário já existem. A leitura consulta Reservas, mas o controller mantém data fixa, select de mesas fixo e ações de detalhes/status simuladas. | Usar data selecionada, mesas carregadas, criação persistida e atualização de status com auditoria. |
| Configuração de Mesas | Indicadores, busca, filtro, cards, modal, disponibilidade e QR Code já existem. A disponibilidade possui chamada remota; criação, edição, QR e submit ainda são avisos locais. | Implementar criação/edição de mesas e ações administrativas permitidas, sem alterar o layout. |
| API de Salão | Handler já lista `mesas`, `reservas` e `configuracao`, cria reservas e atualiza estados de reservas/mesas com transação e auditoria. | Completar somente os recursos necessários para configuração administrativa de mesas, preservando RBAC, DTOs e enumerações fechadas. |
| Cliente frontend | O cliente same-origin já possui operações de Salão utilizadas pelos bridges. | Estender apenas com funções necessárias para criação/edição de mesas e atualização de reservas, sem Firebase client ou armazenamento local. |

## Coleções e estados

As coleções canônicas permanecem em português e sob o restaurante ativo. O contrato da Fase 7 utilizará `mesas`, `reservas` e `eventosMesas`, além das subcoleções já existentes quando o pedido/comanda fornecer dados de ocupação.

Os estados de reserva permanecerão fechados: `aguardando`, `confirmada`, `chegou` e `cancelada`. Os estados de mesa permanecerão fechados conforme o helper operacional: `disponivel`, `ocupada` e `indisponivel`.

## Critérios de aceite

A Fase 7 será considerada concluída quando as três telas carregarem somente dados do restaurante ativo, exibirem estados vazios orientativos sem textos técnicos, persistirem as ações permitidas pelo servidor, validarem conflitos e transições no backend, preservarem auditoria e passarem pelos testes contratuais e de regressão.
