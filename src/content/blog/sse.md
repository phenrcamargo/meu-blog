---
title: "Server-Sent Events (SSE)"
description: "Como permitir que um servidor envie atualizações de forma contínua."
pubDate: 2026-08-12
tags:
  - artificial-intelligence
  - ai-driven-development
  - spec-driven-development
---

# Server-Sent Events (SSE)

> Notas baseadas no vídeo de Renato Augusto sobre comunicação em tempo real entre servidor e cliente.

## 1. O que é SSE?

Server-Sent Events (SSE) é um padrão web que permite que um servidor envie atualizações de forma contínua para um cliente através de uma única conexão HTTP, mantida aberta. Ao contrário de uma requisição HTTP tradicional (que termina assim que a resposta é entregue), a conexão SSE permanece ativa e o servidor pode ir "empurrando" novos dados sempre que quiser, sem que o cliente precise pedir de novo.

A comunicação é **unidirecional**: apenas do servidor para o cliente. Se o cliente precisar mandar algo para o servidor, isso é feito por uma requisição HTTP separada (um POST comum, por exemplo).

## 2. Comparando técnicas de comunicação em tempo real

| Técnica          | Direção                       | Como funciona                                                                     | Overhead                                 | Complexidade |
| ---------------- | ----------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------- | ------------ |
| **Polling**      | Cliente → Servidor (repetido) | Cliente pergunta "tem novidade?" em intervalos fixos                              | Alto (muitas requisições desnecessárias) | Baixa        |
| **Long Polling** | Cliente → Servidor (aguarda)  | Cliente faz a requisição e o servidor só responde quando há novidade (ou timeout) | Médio                                    | Média        |
| **WebSockets**   | Bidirecional                  | Conexão full-duplex, ambos os lados enviam a hora que quiserem                    | Baixo (após handshake)                   | Alta         |
| **SSE**          | Servidor → Cliente            | Conexão HTTP única, servidor envia eventos continuamente                          | Baixo                                    | Baixa        |

**Por que isso importa na prática:**

- **Polling** desperdiça recursos porque a maioria das requisições retorna "nada mudou".
- **Long Polling** é uma melhoria, mas ainda tem o overhead de reabrir a conexão a cada resposta.
- **WebSockets** resolve tudo isso e permite comunicação nos dois sentidos, mas exige um protocolo próprio (`ws://`), gerenciamento de estado de conexão mais complexo, e geralmente uma infraestrutura mais robusta (proxies, load balancers, etc. precisam suportar upgrade de protocolo).
- **SSE** é o meio-termo ideal quando você só precisa que o servidor "empurre" dados: é HTTP puro, simples de implementar, e já vem com reconexão automática embutida no navegador.

## 3. Por que usar SSE?

- **Baixo overhead**: usa uma única conexão HTTP/1.1 (ou HTTP/2, que resolve o limite de conexões simultâneas do navegador) e evita o custo de handshakes repetidos.
- **Simplicidade**: no cliente, é só instanciar um `EventSource`. No servidor, é uma resposta HTTP com um `Content-Type` especial, sem necessidade de bibliotecas de protocolo adicionais.
- **Reconexão automática**: se a conexão cair, o navegador tenta reconectar sozinho, sem você escrever lógica de retry manual.
- **Suporte nativo a IDs de evento**: o navegador guarda o último `id` recebido e o reenvia ao servidor (header `Last-Event-ID`) na reconexão, permitindo retomar de onde parou.

**Casos de uso ideais:**

- Notificações (ex: "novo pedido recebido")
- Dashboards com métricas em tempo real
- Atualização de status de processos (progresso de upload, processamento em fila)
- Feeds de dados (cotações, placares, logs ao vivo)

**Quando SSE NÃO é a escolha certa:** se o cliente também precisa enviar dados com frequência e baixa latência (chats, jogos, colaboração em tempo real tipo Google Docs), WebSockets é mais adequado, pois evita o overhead de abrir requisições HTTP extras para cada mensagem do cliente.

## 4. Como funciona o protocolo por baixo dos panos

O servidor responde com o header:

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

E envia o corpo da resposta em um formato de texto simples, onde cada evento é separado por uma linha em branco:

```
event: notification
id: 42
data: {"message": "Novo pedido #123 recebido"}

event: notification
id: 43
data: {"message": "Pedido #123 foi cancelado"}
```

Campos possíveis:

- `data`: o conteúdo do evento (pode ser texto simples ou JSON)
- `event`: nome do tipo de evento (opcional; permite o cliente escutar tipos diferentes)
- `id`: identificador do evento (usado na reconexão via `Last-Event-ID`)
- `retry`: tempo em milissegundos que o navegador deve esperar antes de tentar reconectar

## 5. Implementação no Frontend (EventSource)

O navegador oferece a API `EventSource`, que já lida com a conexão, o parsing dos eventos e a reconexão automática:

```jsx
const eventSource = new EventSource("/api/notifications/subscribe/user-123");

eventSource.addEventListener("notification", (event) => {
  const data = JSON.parse(event.data);
  console.log("Nova notificação:", data.message);
});

eventSource.onerror = (err) => {
  console.error("Erro na conexão SSE:", err);
  // o EventSource já tenta reconectar sozinho aqui
};
```

## 6. Implementação no Backend com Java

Em Java, existem duas abordagens principais dependendo se seu projeto usa Spring MVC (stack tradicional, bloqueante) ou Spring WebFlux (stack reativa, não-bloqueante).

### 6.1. Spring MVC com `SseEmitter`

O `SseEmitter` é a classe do Spring dedicada a manter uma conexão SSE aberta e enviar eventos manualmente.

```java
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    // Em produção isso deveria estar num serviço dedicado (veja seção 7)
    private final Map<String, SseEmitter> emitters = new ConcurrentHashMap<>();

    @GetMapping(value = "/subscribe/{userId}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribe(@PathVariable String userId) {
        // timeout 0L = sem expiração automática
        SseEmitter emitter = new SseEmitter(0L);

        emitters.put(userId, emitter);

        emitter.onCompletion(() -> emitters.remove(userId));
        emitter.onTimeout(() -> emitters.remove(userId));
        emitter.onError(ex -> emitters.remove(userId));

        return emitter;
    }

    public void notificarUsuario(String userId, String mensagem) {
        SseEmitter emitter = emitters.get(userId);
        if (emitter == null) {
            return;
        }
        try {
            emitter.send(SseEmitter.event()
                    .id(UUID.randomUUID().toString())
                    .name("notification")
                    .data(mensagem));
        } catch (IOException e) {
            // conexão já não é mais válida (ex: aba fechada)
            emitters.remove(userId);
        }
    }
}
```

Pontos de atenção específicos do Spring MVC: como ele roda sobre o modelo bloqueante do Servlet, cada `SseEmitter` aberto consome uma thread do pool enquanto a conexão estiver viva. Isso significa que esse modelo escala bem até certo ponto, mas não é ideal para dezenas de milhares de conexões simultâneas, nesse cenário, WebFlux é mais indicado.

### 6.2. Spring WebFlux com `Flux<ServerSentEvent>`

Se o projeto já é reativo, o WebFlux permite emitir eventos como um `Flux`, de forma não-bloqueante:

```java
@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<String>> streamMetrics() {
        return Flux.interval(Duration.ofSeconds(2))
                .map(tick -> ServerSentEvent.<String>builder()
                        .id(String.valueOf(tick))
                        .event("metric-update")
                        .data(gerarMetricaAtual())
                        .build());
    }

    private String gerarMetricaAtual() {
        return String.valueOf(ThreadLocalRandom.current().nextInt(100));
    }
}
```

Aqui, cada conexão aberta não bloqueia uma thread dedicada, o Netty (servidor padrão do WebFlux) lida com isso de forma assíncrona, o que escala muito melhor para muitos clientes conectados ao mesmo tempo.

## 7. Arquitetura Distribuída: Redis Pub/Sub + SSE

Em um sistema com múltiplas instâncias (microsserviços, várias réplicas atrás de um load balancer), guardar os `SseEmitter` em um `Map` local não funciona: se o usuário A está conectado na instância 1, mas o evento que precisa ser enviado a ele é gerado pela instância 2, a instância 2 não tem acesso direto ao emitter de A.

A solução é usar **Redis Pub/Sub** como intermediário: qualquer instância publica um evento num canal Redis, e todas as instâncias escutam esse canal e repassam o evento para os emitters que tiverem localmente.

```java
@Configuration
public class RedisConfig {

    @Bean
    public RedisMessageListenerContainer redisContainer(RedisConnectionFactory connectionFactory) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        return container;
    }
}
```

```java
@Service
public class NotificationRedisListener implements MessageListener {

    private final SseEmitterRegistry emitterRegistry;

    public NotificationRedisListener(SseEmitterRegistry emitterRegistry,
                                      RedisMessageListenerContainer container) {
        this.emitterRegistry = emitterRegistry;
        container.addMessageListener(this, new ChannelTopic("notifications"));
    }

    @Override
    public void onMessage(Message message, byte[] pattern) {
        String payload = new String(message.getBody(), StandardCharsets.UTF_8);
        emitterRegistry.broadcast(payload);
    }
}
```

Qualquer parte do sistema que precise notificar os usuários só publica no canal, sem se preocupar em saber onde o emitter está fisicamente conectado:

```java
@Service
public class NotificationPublisher {

    private final StringRedisTemplate redisTemplate;

    public NotificationPublisher(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public void publicar(String mensagem) {
        redisTemplate.convertAndSend("notifications", mensagem);
    }
}
```

## 8. Pontos de Atenção

### 8.1. Gerenciamento de conexões com Redis (padrão Singleton)

Um erro comum é criar uma nova conexão com o Redis a cada emitter ou a cada requisição. Isso rapidamente esgota o pool de conexões do Redis. A solução é garantir que exista **uma única instância** do listener/conexão compartilhada por toda a aplicação. No Spring, isso é natural, já que beans são singletons por padrão. O importante é não instanciar `RedisMessageListenerContainer` ou conexões manualmente fora do contexto do Spring:

```java
@Service
public class SseEmitterRegistry {

    // Map compartilhado, uma única instância (singleton bean do Spring)
    private final Map<String, SseEmitter> emitters = new ConcurrentHashMap<>();

    public void add(String userId, SseEmitter emitter) {
        emitters.put(userId, emitter);
    }

    public void remove(String userId) {
        emitters.remove(userId);
    }

    public void broadcast(String message) {
        emitters.forEach((userId, emitter) -> {
            try {
                emitter.send(SseEmitter.event().data(message));
            } catch (IOException e) {
                emitters.remove(userId);
            }
        });
    }
}
```

### 8.2. Encerramento de sessão

Quando o usuário fecha a aba ou perde a conexão, o servidor precisa detectar isso e limpar os recursos (senão você acumula emitters "mortos" na memória). No Spring, isso é feito registrando os callbacks `onCompletion`, `onTimeout` e `onError` no `SseEmitter`, como mostrado nos exemplos acima, e eles disparam automaticamente quando o cliente desconecta.

### 8.3. Limite de conexões do navegador

Em HTTP/1.1, os navegadores limitam a **6 conexões simultâneas por domínio**. Se sua aplicação abrir várias conexões SSE para o mesmo domínio (por exemplo, várias abas do mesmo usuário), esse limite pode ser atingido rapidamente, travando outras requisições. Migrar o backend para HTTP/2 resolve esse problema, já que o HTTP/2 multiplexa várias streams em uma única conexão TCP.

## 9. SSE ou WebSockets? Resumo da decisão

| Pergunta                                                                                     | Se a resposta for "sim" |
| -------------------------------------------------------------------------------------------- | ----------------------- |
| O cliente só precisa **receber** dados, sem enviar em tempo real?                            | SSE                     |
| Você quer aproveitar infraestrutura HTTP padrão (proxies, load balancers, CDNs)?             | SSE                     |
| Você precisa de comunicação nos dois sentidos com baixa latência (chat, jogos, colaboração)? | WebSockets              |
| Simplicidade de implementação e manutenção é prioridade?                                     | SSE                     |
