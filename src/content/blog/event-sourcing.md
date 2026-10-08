---
title: "O que eu entendi sobre Event Sourcing"
description: "Uma introdução prática ao Event Sourcing: eventos, reconstrução de estado, projeções e desafios."
pubDate: 2026-04-12
tags:
  - architecture
  - event-sourcing
  - ddd
---

## Do saldo ao extrato

Imagine uma conta bancária com saldo de R$ 70. Uma aplicação CRUD tradicional pode guardar apenas esse valor atual. É simples, mas não responde sozinho às perguntas: como a conta chegou a R$ 70? Quando entrou dinheiro? Por que o saldo diminuiu?

Com **Event Sourcing**, em vez de salvar apenas o estado atual, a aplicação registra a sequência de fatos que levou até ele. Para essa conta, poderíamos ter `ContaAberta`, `Depositado(100)` e `Sacado(30)`. O saldo atual é calculado aplicando esses eventos em ordem: R$ 100 menos R$ 30 resulta em R$ 70. É a diferença entre guardar só o saldo e ter o extrato completo.

Os eventos representam fatos que já aconteceram no domínio e são imutáveis: depois de gravados, não são editados nem apagados. Se algo precisa ser corrigido, registra-se um novo evento que represente a correção. Por isso, o armazenamento costuma ser append-only: novos eventos são acrescentados ao final.

## Qual problema isso resolve?

Em um CRUD convencional, um `UPDATE` substitui o valor anterior. Se o saldo passa de 100 para 70, o banco pode ficar apenas com 70. O histórico de mudanças precisa ser implementado à parte, e é fácil perder detalhes sobre quando e por que cada alteração ocorreu.

Event Sourcing mantém esse histórico como parte central do sistema. Isso facilita auditorias, investigações de bugs e análises temporais. Também permite reconstruir o estado de uma entidade como era em uma versão ou momento específico, desde que os eventos necessários estejam disponíveis.

Em termos simplificados, o CRUD guarda:

```text
contas
id     | saldo
abc123 | 70
```

Já um event store poderia guardar:

```text
ContaAberta       | conta abc123
Depositado        | conta abc123 | valor: 100
Sacado            | conta abc123 | valor: 30
```

O estado atual continua existindo na aplicação, mas passa a ser uma consequência dos eventos, não a única fonte da verdade.

## Como é um evento?

Um bom nome de evento descreve algo que aconteceu no negócio, geralmente no passado: `PedidoCriado`, `ItemAdicionado` ou `PagamentoConfirmado`. Nomes genéricos como `PedidoAtualizado` escondem o que realmente mudou e tornam mais difícil entender a história depois.

Além do tipo e dos dados específicos do evento, é comum guardar informações para identificá-lo, ordená-lo e rastreá-lo:

```ts
type Depositado = {
  id: string;
  aggregateId: string;
  type: "Depositado";
  version: number;
  occurredAt: string;
  data: { valor: number };
  metadata?: { usuarioId?: string };
};
```

`aggregateId` identifica a conta afetada e `version` indica a posição do evento na sequência daquela conta. A data e os metadados ajudam em auditoria e diagnóstico. O formato exato depende do domínio, mas vale lembrar: os dados do evento precisam fazer sentido mesmo quando alguém for consultá-los muito tempo depois.

## Event Store e Aggregate

O **Event Store** é o componente que persiste e recupera eventos, normalmente filtrando por entidade ou agregado. O **Aggregate** é o objeto de domínio que aplica regras, valida comandos e produz eventos. Por exemplo, uma conta não deve permitir um saque que deixe o saldo negativo.

O fluxo fica assim: chega um comando, o agregado verifica se ele é válido, gera um evento e o event store o persiste. Uma versão didática em TypeScript pode ser assim:

```ts
type EventoConta =
  | { type: "Depositado"; data: { valor: number } }
  | { type: "Sacado"; data: { valor: number } };

class Conta {
  saldo = 0;
  private novosEventos: EventoConta[] = [];

  depositar(valor: number) {
    if (valor <= 0) throw new Error("O valor deve ser positivo");
    this.registrar({ type: "Depositado", data: { valor } });
  }

  sacar(valor: number) {
    if (valor <= 0) throw new Error("O valor deve ser positivo");
    if (valor > this.saldo) throw new Error("Saldo insuficiente");
    this.registrar({ type: "Sacado", data: { valor } });
  }

  aplicar(evento: EventoConta) {
    if (evento.type === "Depositado") this.saldo += evento.data.valor;
    if (evento.type === "Sacado") this.saldo -= evento.data.valor;
  }

  private registrar(evento: EventoConta) {
    this.aplicar(evento);
    this.novosEventos.push(evento);
  }

  eventosPendentes() {
    return this.novosEventos;
  }
}
```

O exemplo não implementa armazenamento, versões ou concorrência: em uma aplicação real, a camada de repositório carregaria os eventos existentes, reconstruiria a conta e persistiria os novos eventos. O ponto importante é que o agregado não grava um novo saldo; ele valida uma ação e registra o fato correspondente.

## Reconstruindo o estado: replay

Para recuperar uma conta, carregamos seus eventos e aplicamos cada um em ordem. Esse processo é chamado de **replay**. Em programação, pode ser expresso como um `reduce`:

```ts
const conta = eventos.reduce((estado, evento) => {
  estado.aplicar(evento);
  return estado;
}, new Conta());

console.log(conta.saldo);
```

Se aplicarmos apenas os eventos até uma determinada versão ou data, podemos observar o estado naquele ponto da história. Replay também ajuda a depurar: em vez de tentar adivinhar como um bug aconteceu, dá para reproduzir o estado aplicando os eventos reais que levaram até ele, com os devidos cuidados para não expor dados de produção.

## Snapshots: uma ajuda para o desempenho

Reaplicar eventos é simples, mas pode ficar lento se um agregado tiver milhares ou milhões deles. Para evitar começar do zero toda vez, o sistema pode salvar **snapshots**, que são fotografias do estado em uma versão específica.

Na leitura, carrega-se o snapshot mais recente e aplicam-se apenas os eventos posteriores. Por exemplo, com um snapshot na versão 100, bastam os eventos da 101 em diante para reconstruir o estado atual. O snapshot é uma otimização: os eventos continuam sendo a fonte da verdade e permitem gerar outro snapshot se necessário.

## CQRS e projeções de leitura

Event Sourcing costuma ser combinado com **CQRS**, que separa comandos de escrita e consultas. Os eventos registrados podem alimentar uma ou mais **projeções**, modelos preparados para as perguntas que a aplicação precisa responder.

Uma projeção simples de saldo poderia processar eventos assim:

```ts
function projetarSaldo(
  evento: EventoConta & { aggregateId: string },
  saldos: Map<string, number>,
) {
  const atual = saldos.get(evento.aggregateId) ?? 0;

  if (evento.type === "Depositado") {
    saldos.set(evento.aggregateId, atual + evento.data.valor);
  } else {
    saldos.set(evento.aggregateId, atual - evento.data.valor);
  }
}
```

Uma projeção pode alimentar uma tabela SQL, um mecanismo de busca ou um cache, cada qual atendendo a um tipo de consulta. Se uma projeção quebrar ou o formato precisar mudar, ela pode ser reconstruída reprocessando os eventos desde o início. Isso exige que o processamento seja confiável e que a projeção lide com reentregas sem aplicar o mesmo evento duas vezes.

Como a atualização das projeções pode acontecer depois do registro do evento, algumas consultas podem ficar temporariamente atrasadas. Esse comportamento é chamado de **consistência eventual**. Para muitas telas ele é aceitável; para operações que precisam confirmar o saldo imediatamente, é importante escolher com cuidado de onde ler.

## Evolução e versionamento dos eventos

Eventos são imutáveis, mas o software e o negócio mudam. Imagine que uma versão nova de `PedidoCriado` passe a incluir a moeda. Os eventos antigos não terão esse campo, então o código precisa continuar sabendo interpretá-los.

Uma alternativa é manter campos novos opcionais. Outra é usar um **upcaster**: uma função que adapta o formato antigo para a representação esperada pelo código atual, sem alterar o evento armazenado. Em mudanças maiores, também é possível versionar os tipos, por exemplo `PedidoCriadoV2`.

```ts
function upcast(evento: any) {
  if (evento.type === "PedidoCriado" && !evento.data.moeda) {
    return { ...evento, data: { ...evento.data, moeda: "BRL" } };
  }

  return evento;
}
```

A regra de ouro é não editar os eventos já gravados. A adaptação acontece durante a leitura ou em uma migração cuidadosamente planejada, preservando a história original.

## Desafios e armadilhas

Event Sourcing traz um histórico poderoso, mas também mais peças para cuidar: event store, projeções, consumidores e estratégia de versionamento. Consultas ad hoc diretamente no event store podem ser trabalhosas; por isso, projeções costumam ser importantes. E, como consumidores podem receber o mesmo evento novamente, eles precisam ser idempotentes ou manter controle dos eventos já processados.

Também existe concorrência. Duas operações podem carregar a mesma versão de uma conta e tentar gravar eventos ao mesmo tempo. Um mecanismo comum é o **controle otimista de versão**: ao gravar, o sistema exige que a versão atual ainda seja a esperada. Se outro processo já gravou um evento, a operação falha e precisa recarregar o agregado antes de tentar novamente.

Há ainda uma questão delicada: privacidade e direito ao esquecimento. Um histórico imutável pode entrar em conflito com solicitações de exclusão de dados pessoais. Uma opção é evitar colocar dados pessoais diretamente nos eventos; outra, quando a arquitetura permite, é criptografar esses dados e apagar a chave associada (uma técnica conhecida como _crypto-shredding_). A solução precisa ser avaliada de acordo com as obrigações legais e com o desenho do sistema.

## Quando usar e quando evitar

Event Sourcing pode fazer sentido quando o histórico é parte importante do negócio: sistemas financeiros, de saúde, jurídico ou logística; fluxos de pedido e workflows que precisam de rastreabilidade; ou produtos que precisam analisar como os dados mudaram ao longo do tempo. Também é útil quando vários consumidores precisam reagir aos mesmos fatos.

Por outro lado, para um CRUD simples sem necessidade real de histórico, talvez seja complexidade a mais. A equipe precisa estar confortável com replay, projeções, consistência eventual e evolução dos eventos. Se todas as leituras exigem consistência imediata, o modelo de consulta também precisa ser planejado com atenção.

Não é necessário adotar Event Sourcing para o sistema inteiro. Uma boa regra prática é começar apenas pelos agregados que realmente se beneficiam de um histórico completo. Assim, você ganha rastreabilidade onde ela importa sem transformar cada cadastro simples em um projeto de arqueologia de eventos.
