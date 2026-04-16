# Teste Técnico - Desenvolvedor

## O problema

Você precisa criar uma API que consulta CEP. Simples, certo?

Só que: você não controla as APIs externas. Elas caem, demoram, retornam erro. Seu serviço precisa continuar funcionando.

## APIs disponíveis

- ViaCEP: `https://viacep.com.br/ws/{cep}/json/`
- BrasilAPI: `https://brasilapi.com.br/api/cep/v1/{cep}`

## Requisitos

### Endpoint
`GET /cep/{cep}`

### Comportamento esperado
- Alterna entre as duas APIs (pode ser aleatório ou round-robin)
- Se uma falhar, tenta a outra automaticamente
- Retorna um contrato único, independente de qual API respondeu

### O que queremos ver

1. **Abstração** — Como você isola os providers externos? Se amanhã adicionarmos uma terceira API, o que muda no código?

2. **Resiliência** — O que acontece quando uma API demora 30 segundos? E quando as duas estão fora?

3. **Observabilidade** — Se der erro em produção, como a gente descobre o que aconteceu?

4. **Tratamento de erros** — Erros diferentes devem ter tratamentos diferentes. Timeout não é a mesma coisa que 404.

## Stack

NestJS + TypeScript. Fora isso, use o que fizer sentido.

## O que não estamos avaliando

- Frontend
- Banco de dados
- Deploy
- Cobertura de testes de 100%

## Como entregar

Fork este repositório, implemente, e envie o link para [matheus.morett@monest.com.br](mailto:matheus.morett@monest.com.br) com o assunto **Teste Dev - Monest**.

Se o repositório for privado, adicione `matheusmorett2` como colaborador.

---

## Implementação

### Como rodar

```bash
npm install
npm run start:dev
```

### Como testar

```bash
npm test          # testes unitários
npm run test:e2e  # testes end-to-end
```

### Endpoint

```
GET /cep/:cep
```

**Exemplo:**
```bash
curl http://localhost:3000/cep/01310100
```

```json
{
  "cep": "01310100",
  "logradouro": "Avenida Paulista",
  "bairro": "Bela Vista",
  "cidade": "São Paulo",
  "estado": "SP",
  "provider": "ViaCEP"
}
```

**Erros possíveis:**

| Status | Situação |
|--------|----------|
| 400 | CEP com formato inválido (não numérico ou diferente de 8 dígitos) |
| 404 | CEP não encontrado em nenhuma das APIs |
| 503 | Todas as APIs externas falharam |

---

### Decisões de design

#### Abstração — Provider Pattern

Cada API externa é encapsulada em um provider independente que implementa `CepProvider`:

```typescript
interface CepProvider {
  readonly name: string;
  fetchCep(cep: string): Promise<CepResponseDto>;
}
```

Para adicionar uma terceira API basta criar um novo arquivo de provider e registrá-lo no módulo — o `CepService` não muda.

#### Resiliência — Round-Robin + Fallback

O `CepService` alterna entre os providers via round-robin. Se o provider primário falhar com erro genérico (timeout, connection refused), a requisição é automaticamente repassada para o próximo.

Um 404 não aciona fallback — CEP inexistente é um fato, não uma falha de infraestrutura.

#### Resiliência — Circuit Breaker

O `CircuitBreakerService` rastreia falhas consecutivas por provider. Ao atingir o threshold (padrão: 5), um log de nível `error` é emitido com o evento `cep.provider.degraded`. O alerta é emitido uma única vez e resetado após o provider responder com sucesso.

#### Observabilidade — Pino

Logs estruturados em JSON via `nestjs-pino`. Eventos registrados em cada etapa:

| Evento | Nível |
|--------|-------|
| `cep.cache.hit` | info |
| `cep.cache.miss` | info |
| `cep.fetch.attempt` | info |
| `cep.fetch.success` | info |
| `cep.fetch.not_found` | info |
| `cep.fetch.error` | warn |
| `cep.fetch.fallback` | warn |
| `cep.fetch.all_failed` | error |
| `cep.provider.degraded` | error |

O campo `provider` em cada resposta indica qual API respondeu, sem precisar abrir logs.

#### Cache em memória

Respostas são cacheadas em memória por 1 hora (padrão). Evita chamadas repetidas para o mesmo CEP.

---

### Variáveis de ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PORT` | `3000` | Porta da aplicação |
| `HTTP_TIMEOUT_MS` | `5000` | Timeout por requisição HTTP (ms) |
| `CACHE_TTL_MS` | `3600000` | TTL do cache em memória (ms) |
| `CIRCUIT_OPEN_THRESHOLD` | `5` | Falhas consecutivas para disparar alerta de degradação |
| `LOG_LEVEL` | `info` | Nível mínimo de log (`debug`, `info`, `warn`, `error`) |
| `LOG_FILE` | — | Caminho para arquivo de log (ex: `logs/app.log`). Se definido, logs são gravados simultaneamente no terminal e no arquivo |
| `NODE_ENV` | — | Se `production`, desativa o `pino-pretty` (JSON puro no terminal) |

---

### Estrutura do projeto

```
src/
├── cep/
│   ├── cache/
│   │   └── cep-cache.service.ts
│   ├── circuit-breaker/
│   │   └── circuit-breaker.service.ts
│   ├── dto/
│   │   └── cep-response.dto.ts
│   ├── providers/
│   │   ├── cep-provider.interface.ts
│   │   ├── brasilapi.provider.ts
│   │   └── viacep.provider.ts
│   ├── cep.controller.ts
│   ├── cep.module.ts
│   └── cep.service.ts
├── common/
│   └── exceptions/
│       ├── all-providers-failed.exception.ts
│       └── cep-not-found.exception.ts
├── logger/
│   └── logger.module.ts
└── main.ts

test/
├── brasilapi.provider.spec.ts
├── cep-cache.service.spec.ts
├── cep.controller.spec.ts
├── cep.e2e-spec.ts
├── cep.service.spec.ts
└── circuit-breaker.service.spec.ts
```
