# Fase 9 — Backup, Homologação e Rollback Seguro

**Projeto:** APEX Food  
**Aplicação:** Vercel + Firebase Authentication + Cloud Firestore + Firebase Admin SDK server-side  
**Ambiente atualmente classificado:** Development  
**Status:** procedimento preparado; nenhum backup, restauração, troca de projeto ou alteração de dados foi executado por este documento.

## 1. Escopo e separação de responsabilidades

Este runbook trata os dados operacionais do APEX Food no Firebase/Cloud Firestore, não apenas o código do GitHub. O código versionado, os fragments, as configurações públicas e o histórico de deployments da Vercel têm ciclo próprio de recuperação. Os dados de autenticação, perfis, restaurantes, membros, papéis, pedidos, caixa, avaliações e demais coleções do APEX Food precisam de uma estratégia de proteção no Firebase/Google Cloud.

O backup de código não substitui um backup do Firestore. Da mesma forma, uma cópia do Firestore não substitui o código, as variáveis da Vercel, o projeto Firebase correto, os domínios, as configurações de Auth/App Check e o histórico de deployment. Cada conjunto deve ser inventariado e validado separadamente.

> **Importante:** o backup de dados do serviço Manus mencionado nas orientações de agosto de 2026 é um fluxo separado do backup do Firebase do APEX Food. Não se deve tratar uma exportação de código ou de tarefa do Manus como cópia operacional do Firestore. A situação de uma conta Manus deve ser determinada pelo email e pela notificação oficial da própria conta, não por inferência.

## 2. Fatos técnicos confirmados

A documentação oficial do Firestore descreve backups agendados como cópias consistentes do banco em um ponto no tempo, contendo dados e configurações de índices. O backup permanece na mesma localização do banco de origem e não inclui políticas TTL; essas políticas precisam ser reaplicadas após uma restauração. O recurso exige o plano Blaze e gera cobrança de armazenamento e de restauração conforme o tamanho do backup. [1]

O Firestore permite até um agendamento diário e um semanal por banco, com retenção configurável. O horário exato do backup não é configurável; por isso, o processo não deve depender de um minuto exato para cumprir o RPO. [1]

A restauração de um backup grava os dados em um **novo banco Firestore**, aguarda a conclusão da operação e exige verificação posterior de IAM e reaplicação de políticas TTL. A política do APEX Food, portanto, não usará restauração destrutiva direta como primeira resposta: primeiro será restaurado um banco separado, validado e somente depois promovido mediante procedimento manual aprovado. [1]

## 3. Política por ambiente

| Ambiente | Projeto Firebase | Dados permitidos | Backup mínimo | Ação de restauração |
|---|---|---|---|---|
| Development | `apex-food-6c1cb` | Dados sintéticos e testes descartáveis; nunca dados de clientes | Exportação manual antes de testes destrutivos; sem presumir backup programado | Restaurar somente para outro projeto de teste ou recriar dados sintéticos |
| Preview/Staging | Projeto separado obrigatório antes de dados compartilhados | Dados sintéticos e tenant interno | Backup diário quando houver dados persistentes; cópia antes de cada homologação destrutiva | Restaurar para banco temporário, executar smoke tests e reconfigurar Preview apenas após aprovação |
| Production | Projeto exclusivo de produção | Dados reais de clientes e operação | Backup diário + backup semanal, retenção aprovada e, quando habilitado, PITR para incidentes de curta janela | Restaurar para banco novo, validar integridade e tráfego, congelar escrita e promover manualmente |

A existência de `backupsProgramados: false` na documentação atual significa que a política de produção ainda não está ativa. Essa configuração não será alterada automaticamente pelo código, pois exige plano de cobrança, papéis IAM, definição de retenção e aprovação do responsável pelo projeto.

## 4. Objetivos operacionais

O alvo recomendado para Production é um **RPO de até 24 horas** com backup diário e um **RTO definido pelo responsável operacional** antes do go-live. Para o Preview, o objetivo é reproduzir restauração e validação sem tocar o projeto Development. Os valores finais de retenção e RTO devem ser registrados em uma decisão operacional, porque dependem de custo, volume, criticidade e obrigação de retenção do negócio.

Nenhum backup deve ser considerado válido apenas por ter sido agendado. Deve existir uma verificação de que a cópia aparece no console, pertence ao projeto e banco esperados, possui data compatível e pode ser usada em um ensaio de restauração. Backups não devem ser excluídos para liberar espaço sem aprovação; a documentação oficial alerta que um backup excluído não pode ser recuperado. [1]

## 5. Checklist de configuração manual

Antes de habilitar backup em Preview ou Production, o responsável deve confirmar o projeto Firebase ativo, o banco `(default)`, a região, o plano Blaze, as contas IAM e o destino de operação. O papel de administração de agendamentos deve ser concedido somente a operadores necessários; leitura de backups e restauração devem ser papéis separados quando possível. [1]

No Google Cloud Console, abrir **Databases**, localizar o banco correto e acessar **Scheduled backups**. Configurar um agendamento diário e, quando aprovado, um semanal, com retenção definida. Registrar em local operacional restrito o nome do projeto, banco, região, data de ativação, retenção e responsável, sem copiar chaves privadas ou tokens para o repositório.

Depois da configuração, listar e descrever os agendamentos e confirmar a existência de pelo menos uma cópia válida. O código do APEX Food não deve conter chaves IAM, comandos com tokens, nomes de contas de serviço ou qualquer segredo de backup.

## 6. Homologação do relatório de integridade

A execução do relatório deve começar sempre pelo preflight e pela flag explícita de somente leitura:

```bash
node scripts/migracao/gerar-relatorio-integridade.js \
  --somente-leitura \
  --limite=500 \
  --saida=/caminho-restrito/relatorio-integridade.json
```

A execução é permitida somente quando `APP_ENV`, `FIREBASE_PROJECT_ID`, credenciais server-side, segredos de sessão e App Check estiverem configurados no ambiente aprovado. Em Preview, o projeto não pode ser `apex-food-6c1cb`. Em Production, `APP_CHECK_MODE` deve estar em `enforce`.

O relatório deve ser guardado fora do Git, com permissões restritas, e revisado por códigos de problema. O modo padrão não corrige, apaga, atualiza, cria documentos, altera índices nem reprocessa pedidos. A correção deve ser uma etapa posterior, com plano por classe de inconsistência, backup válido e autorização específica.

## 7. Procedimento de rollback de aplicação

Se uma nova versão da aplicação apresentar erro, primeiro interromper novas mudanças e registrar horário, deployment, ambiente e sintoma sem inserir dados pessoais em logs. Em seguida, usar o rollback manual do deployment anterior na Vercel, mantendo as variáveis do mesmo ambiente e confirmando que o projeto Firebase não foi trocado acidentalmente.

Depois do rollback da aplicação, executar smoke tests autenticados e públicos: sessão, `/`, `/mesa`, uma leitura operacional com o restaurante ativo, uma mutação sintética somente em Preview e a rota de saúde. Nenhum teste de mutação deve ser executado no projeto Development compartilhado ou em Production sem aprovação própria.

O rollback de código não desfaz gravações já feitas no Firestore. Por isso, operações de negócio precisam continuar idempotentes, transacionais e auditadas; quando houver corrupção de dados, seguir o procedimento de restauração do banco novo em vez de tentar apagar documentos em massa.

## 8. Procedimento de recuperação de dados

Em um incidente confirmado, congelar mutações do ambiente afetado por uma janela operacional aprovada, preservar logs e identificar o ponto de backup. Não apagar o backup de origem. Restaurar o backup para um novo banco, conforme o procedimento oficial do Firestore, aguardando a conclusão antes de testar o acesso. [1]

No banco restaurado, verificar IAM, App Check, índices, políticas TTL, coleções essenciais, contagens, papéis locais, vínculos de membros e invariantes do relatório. Executar o relatório de integridade em modo somente leitura contra o novo ambiente. Conferir que nenhum pedido histórico ou auditoria foi alterado indevidamente.

A promoção do banco restaurado exige mudança manual e coordenada das variáveis de ambiente da Vercel, revisão de origem permitida, sessão, cookies, domínio e configuração Firebase Web. Deve haver plano de retorno ao deployment e banco anteriores, janela de observação e responsável nomeado. A operação não deve ser embutida em uma rota pública do APEX Food.

## 9. Critérios de aceite da Fase 9

A Fase 9 será considerada operacionalmente homologada quando houver projeto separado para Preview, backup configurado no ambiente aprovado, cópia listável, ensaio de restauração documentado, relatório de integridade executado em modo somente leitura e revisão das inconsistências. Até que isso aconteça, o status permanece **preparado, não homologado**.

Nenhuma configuração de backup, restauração ou promoção foi executada automaticamente nesta fase. Essa separação é intencional para evitar alteração de cobrança, projeto, região, retenção ou dados reais sem uma aprovação manual específica.

## Referências

[1]: https://firebase.google.com/docs/firestore/backups — Firebase, “Back up and restore data | Firestore”.
[2]: https://firebase.google.com/docs/firestore/disaster-recovery — Firebase, “Disaster recovery planning”.
[3]: https://firebase.google.com/docs/firestore/manage-data/export-import — Firebase, “Export and import data”.
[4]: https://manus.im/backup — Manus, “Data Backup Tool”.
