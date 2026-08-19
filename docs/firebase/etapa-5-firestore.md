# Etapa 5 — Firestore Development

## Registro de inspeção inicial

O Firestore do projeto `apex-food-6c1cb` foi aberto no Console Firebase com a conta autorizada. Após o carregamento inicial, a área principal permaneceu com indicador de carregamento e não exibiu ainda botão de criação, banco existente, região ou regras. Nenhuma ação destrutiva ou criação foi executada nesta inspeção.

## Descoberta no Console

O projeto já possui um banco Cloud Firestore **`(default)`** criado e vazio. O Console informa:

| Propriedade | Valor observado |
|---|---|
| Banco | `(default)` |
| Local | `nam5` |
| Edição | Padrão |
| Configuração | Firestore nativo |
| Backups programados | Desativada |
| Atualizações em tempo real | Ativado |

A região existente é diferente da recomendação inicial `southamerica-east1`. Como a região de um banco existente não deve ser alterada de forma destrutiva, não foi criado um segundo banco nem executada qualquer alteração de região. A decisão segura para esta etapa é preservar o banco `(default)` em `nam5`; uma migração regional futura exigiria planejamento separado, nova base e estratégia de migração/rollback.

## Regras atuais

Na aba **Regras** do banco `(default)`, após o carregamento do editor, o Console exibiu exatamente a política deny-by-default:

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

O conteúdo corresponde ao arquivo versionado `firestore.rules`. A política já está publicada/ativa no banco observado; por isso, não foi feita uma edição redundante nem uma publicação adicional que pudesse alterar o estado sem necessidade.

## Validação no simulador

O Laboratório de testes de regras foi aberto no Console. O interruptor **Autenticado** foi confirmado desligado (`aria-checked=false`), portanto o próximo teste será anônimo. O tipo de operação está em `get` e o editor mantém a política deny-by-default.

O simulador foi configurado com o caminho não destrutivo `test/probe`; nenhum documento foi criado ou alterado durante a preparação do teste.

Resultado do simulador: **Leitura negada no simulador** para a operação `get`, no caminho `test/probe`, com autenticação desligada. Isso confirma que o acesso direto não autenticado ao Firestore está bloqueado pela regra ativa.

Para complementar a validação, o simulador foi alterado para a operação `create` no mesmo caminho `test/probe`, sem payload e com autenticação desligada. Nenhum documento real foi criado.

Resultado complementar do simulador: **Gravação negada no simulador** para a operação `create`, no caminho `test/probe`, com autenticação desligada. Nenhum documento de teste foi persistido.

Conclusão da validação: leituras e gravações diretas não autenticadas estão bloqueadas pela política ativa.

## Status da Etapa 5

A Etapa 5 foi concluída no ambiente **Development** por confirmação do banco existente e da política deny-by-default ativa. Nenhuma coleção de negócio, documento operacional ou índice composto foi criado. A etapa seguinte poderá definir o schema multi-tenant e o modelo de membership, mas não deverá abrir acesso direto antes de implementar e testar as regras correspondentes.

A validação de conectividade do Admin SDK continuará vinculada ao health check da Etapa 7, porque o Firestore Admin executa no backend e não é bloqueado por essas Rules. Backups e recuperação de desastres permanecem pendentes para uma etapa posterior, e o ambiente Production continua desativado.

## Referências

[1]: https://firebase.google.com/docs/firestore/security/get-started "Get started with Cloud Firestore Security Rules — Firebase"
[2]: https://firebase.google.com/docs/rules/simulator "Use the Security Rules simulator — Firebase"
[3]: https://firebase.google.com/docs/firestore/security/rules-conditions "Conditions for Cloud Firestore Security Rules — Firebase"
