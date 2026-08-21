# Etapa 22 — Contrato server-side consolidado da Equipe

## Recursos e mutações

A rota existente `/api/v1/equipe` continua concentrando as operações do módulo. Os aliases singulares `funcionario` e `escala` são normalizados para `funcionarios` e `escalas` antes da autorização e do despacho. Isso mantém os payloads atuais das telas sem abrir uma rota adicional.

| Operação | Recurso | Regra |
|---|---|---|
| GET | `funcionarios` | Retorna somente DTO público do restaurante ativo. |
| GET | `escalas` | Retorna escalas do restaurante ativo, com horários e status validados na origem. |
| GET | `comissoes` | Retorna comissões somente leitura, opcionalmente filtradas por período. |
| POST/PATCH | `funcionario` | Permite criar ou atualizar dados autorizados; o contato completo permanece privado. |
| POST/PATCH | `escala` | Permite criar ou atualizar escala após confirmar funcionário, jornada e ausência de conflito. |

## Validações consolidadas

Jornadas possuem duração entre 30 minutos e 16 horas. Jornadas que atravessam a meia-noite são normalizadas em minutos corridos, e o intervalo também pode ocorrer após a meia-noite. Conflitos são avaliados em janelas equivalentes de 24 horas para impedir sobreposição tanto em turnos diurnos quanto noturnos.

O período de comissão é opcional na consulta, mas quando informado deve ser texto limitado a 40 caracteres e formado por letras, números, espaços e separadores de período. A filtragem continua sendo feita no servidor antes da resposta.

A mutação de Equipe exige sessão HttpOnly, contexto do restaurante, papel autorizado, CSRF, origem válida e App Check conforme o ambiente. A gravação mantém autoria, versão e timestamps server-side, além da auditoria operacional.

## Privacidade

O DTO público não expõe `telefone`, `idRestaurante`, `criadoPor`, `atualizadoPor` nem qualquer dado da coleção `dadosPrivadosFuncionarios`. A interface recebe somente `telefoneMascarado` como `telefone` visual.

## Restrições de implantação

Nenhum arquivo novo foi criado em `api/v1`. A rota existente foi reutilizada e o projeto permanece com quatro funções serverless. O frontend continua sem Firebase client, localStorage, sessionStorage, tokens ou credenciais privadas.
