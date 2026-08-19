# Etapa 4 — Identidade administrativa server-side

**Status:** Concluída em Development. Adaptador seguro criado localmente e os secrets server-side foram declarados como adicionados à Vercel pelo responsável do projeto. Os valores não foram lidos, exibidos ou versionados.

## Resultado implementado

Foi criado o módulo:

```text
backend/firebase/admin.js
```

O módulo:

| Controle | Implementação |
|---|---|
| Execução | Restrito ao runtime Node/Vercel; não deve ser importado pelo frontend |
| Fail-closed | Interrompe a inicialização se qualquer variável obrigatória estiver ausente ou ainda for placeholder |
| Variáveis exigidas | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` |
| Chave privada | Normaliza apenas `\\n` para quebras de linha, sem imprimir ou persistir o valor |
| Instância | Reutiliza a instância Admin já inicializada para evitar múltiplas inicializações |
| Serviços expostos | `getAdminAuth()` e `getAdminDb()` para API server-side futura |
| Frontend | Nenhuma importação, bundle ou exposição de credencial |

## Identidade recomendada

A service account deve ser criada no projeto `apex-food-6c1cb` exclusivamente para o backend Development, com o menor conjunto de permissões possível. A chave privada não deve ser enviada por chat, commit, issue, arquivo do workspace ou variável pública da Vercel.

Quando a API estiver pronta, a credencial deverá ser armazenada como variáveis protegidas no ambiente **Development/Preview** da Vercel. A Production permanece sem configuração até autorização específica.

## Procedimento manual obrigatório

1. No Firebase Console, abrir **Configurações do projeto > Contas de serviço**.
2. Usar uma service account dedicada ao backend Development, ou criar uma conta dedicada no IAM do Google Cloud.
3. Gerar uma chave privada JSON somente se o fluxo de deploy exigir essa modalidade.
4. Armazenar o JSON localmente fora do repositório, com permissão restrita, apenas durante a extração dos três valores necessários.
5. Configurar na Vercel Development/Preview somente `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY`, além dos secrets de sessão e CSRF.
6. Apagar o arquivo JSON local após a configuração e revogar a chave se houver qualquer suspeita de exposição.
7. Nunca adicionar os valores reais ao `.env.example`, ao frontend, ao Git ou ao log de build.

## Situação externa desta etapa

A página de contas de serviço do Console foi acessada, mas permaneceu carregando e não exibiu uma chave pronta nem botão de geração nesta sessão. Nenhuma chave privada foi transferida para o workspace. O responsável do projeto confirmou que `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY` foram adicionados à Vercel para o ambiente Development/Preview.

Os valores não foram solicitados nem expostos nesta conversa. Como ainda não existe endpoint server-side da Etapa 7, a validação operacional dos secrets será feita posteriormente por um health check que não revele configuração interna.

## Critérios de aceite

A Etapa 4 foi considerada concluída para fins de avanço incremental porque o adaptador foi validado localmente e o responsável confirmou a configuração dos três secrets no ambiente Development/Preview da Vercel. A validação de conectividade será realizada junto ao endpoint de health check da Etapa 7, sem revelar detalhes. Nenhum segredo deve aparecer em respostas HTTP, logs, artefatos públicos ou no bundle do navegador.

**Próxima etapa condicionada à aprovação:** Etapa 5 — criar o Firestore Development em modo de produção e publicar regras deny-by-default.
