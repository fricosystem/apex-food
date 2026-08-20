# Validação pública — Etapa 3 QR Code e sessão de mesa

- Commit de código validado: `e3ccae0`
- Domínio: `https://apexfood.vercel.app`
- O primeiro deployment do commit excedeu o limite de 12 Serverless Functions do Hobby; o endpoint foi consolidado em uma única função e publicado novamente.
- Funções serverless no clone: **12**
- Raiz após seguir redirects: **HTTP 200**
- Shell `etapa3-qr` na resposta final: **presente**
- Rota pública `/mesa`: **HTTP 200**
- Fragmento público físico: **HTTP 308 para URL limpa**, conforme regra do projeto
- CSS público da mesa: **HTTP 200**
- Shell público: **HTTP 200** e rota `href: '/mesa'` presente
- GET de sessão sem cookie: **HTTP 401**, código `SESSAO_MESA_NAO_ENCONTRADA`
- Validação de QR inválido: **HTTP 400**, código `QR_INVALIDO`
- POST administrativo sem CSRF/sessão: **HTTP 403**, código `CSRF_INVALIDO`
- Cookie de sessão emitido no smoke sem sessão: **nenhum**
- Console da rota `/mesa`: **sem saída e sem erros**

## Validação visual

A rota `/mesa` carregou o cartão público de Atendimento da mesa, com logo APEX Food, estado profissional de acesso não iniciado e botão de tentativa novamente. O sidebar e o header administrativo não apareceram nessa experiência, e não houve erro JavaScript no console.

## Escopo ainda não iniciado

O cardápio público, o carrinho, a criação de pedidos, a confirmação do garçom, a fila da cozinha, o retorno ao garçom e o encaminhamento ao caixa permanecem para as etapas seguintes, conforme aprovação sequencial do plano.
