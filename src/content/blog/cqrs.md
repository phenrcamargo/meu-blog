---
title: "CQRS: separando leituras e escritas"
description: "O que é CQRS, que tipo de problema resolve e como começar com exemplos simples."
pubDate: 2026-07-08
tags:
  - software-development
  - architecture
  - cqrs
---

Em muitas aplicações, o mesmo modelo de dados atende a tudo: criar um pedido, alterar seu status, montar uma tela de resumo e gerar um relatório. No começo isso costuma funcionar bem. Mas com o tempo as regras de escrita podem ficar complexas, enquanto as consultas precisam juntar dados de vários lugares e responder rápido. Um único modelo acaba tentando resolver problemas bem diferentes.

É aí que entra o **CQRS**, sigla para _Command Query Responsibility Segregation_. O nome é comprido, mas a ideia central é direta: separar as operações que alteram o estado do sistema das operações que apenas consultam esse estado.

## Comandos e consultas

Um **comando** expressa uma intenção de mudar algo: `CriarPedido`, `CancelarPedido` ou `AlterarEndereco`. Ele pode validar regras de negócio e, se tudo estiver certo, modificar os dados. Comandos normalmente não retornam uma representação completa do objeto, podem apenas confirmar que a operação foi aceita ou informar o identificador criado.

Uma **consulta** pede informações sem alterar o estado: `BuscarPedido`, `ListarPedidosAbertos` ou `ConsultarResumoDeVendas`. Ela lê e retorna os dados necessários para a tela ou para outro consumidor.

Essa distinção é mais do que dar nomes diferentes a funções. Ela permite que cada caminho tenha uma implementação adequada ao seu trabalho: a escrita pode priorizar regras e consistência, enquanto a leitura pode priorizar simplicidade e velocidade.

## Ok, mas qual problema o CQRS resolve?

Imagine um sistema de pedidos. Para criar um pedido, é importante verificar estoque, preço e regras de desconto. Já a tela do cliente talvez precise mostrar, de uma vez, o nome dos produtos, o endereço de entrega, o status e o total. O modelo que representa bem as regras de escrita nem sempre é o formato mais conveniente para essa tela.

Sem separação, as consultas podem acumular junções e condicionais, e mudanças feitas para facilitar uma tela podem complicar as regras de negócio. O CQRS reduz esse acoplamento ao permitir modelos diferentes para escrever e ler. Não elimina toda a complexidade: ela passa a ser explícita e precisa ser mantida com cuidado.

## Começando simples: separar os caminhos no código

Não é preciso começar com bancos diferentes, filas ou microsserviços. Uma primeira versão pode usar o mesmo banco e até as mesmas tabelas, separando apenas os pontos de entrada e a lógica de comandos e consultas:

```ts
type CriarPedido = {
  clienteId: string;
  itens: Array<{ produtoId: string; quantidade: number }>;
};

async function criarPedido(comando: CriarPedido) {
  const itens = await carregarProdutos(comando.itens);
  validarEstoque(itens, comando.itens);

  return salvarPedido({
    clienteId: comando.clienteId,
    itens: calcularTotais(itens, comando.itens),
    status: "aberto",
  });
}

async function buscarPedido(pedidoId: string) {
  return banco.pedido.findUnique({
    where: { id: pedidoId },
    include: { itens: true, cliente: true },
  });
}
```

`criarPedido` representa o lado de escrita: valida a intenção e aplica as regras antes de persistir. `buscarPedido` representa o lado de leitura: busca e devolve os dados no formato útil para quem chamou. Mesmo usando o mesmo banco, os dois fluxos já podem evoluir com responsabilidades mais claras.

## Separando também os modelos de leitura

Se as consultas ficarem pesadas ou precisarem de um formato muito diferente, é possível criar uma projeção preparada para leitura. Por exemplo, uma tabela `pedido_resumo` pode guardar o número do pedido, nome do cliente, quantidade de itens, total e status. A tela consulta essa tabela diretamente, sem reconstruir o resumo a cada pedido.

Quando um pedido é criado ou atualizado, a aplicação também atualiza a projeção, diretamente ou por meio de um evento que um consumidor processa. Em uma versão simplificada:

```ts
async function aoPedidoCriado(evento: PedidoCriado) {
  await banco.pedidoResumo.create({
    data: {
      pedidoId: evento.pedidoId,
      clienteId: evento.clienteId,
      clienteNome: evento.clienteNome,
      total: evento.total,
      status: "aberto",
    },
  });
}

async function listarPedidosDoCliente(clienteId: string) {
  return banco.pedidoResumo.findMany({ where: { clienteId } });
}
```

Nesse desenho, o modelo de escrita continua cuidando das regras do pedido e o modelo de leitura guarda dados convenientes para as consultas. Como a projeção pode ser atualizada depois da gravação principal, pode haver um pequeno atraso até a leitura refletir a mudança. Esse comportamento é chamado de **consistência eventual**: por um curto período, a tela pode exibir o estado anterior.

## O que CQRS não exige

CQRS não significa obrigatoriamente ter um banco para escrita e outro para leitura. Também não exige microsserviços, mensageria ou _Event Sourcing_. Essas técnicas podem ser combinadas com CQRS quando resolvem necessidades reais, mas adicionam operação e pontos de falha.

Vale começar pela separação lógica entre comandos e consultas. Se houver uma necessidade concreta, como leituras com alto volume, consultas difíceis de otimizar ou modelos de apresentação muito diferentes, aí faz sentido considerar projeções e infraestrutura adicional.

No fim, CQRS é uma forma de deixar claro que **mudar os dados** e **perguntar sobre eles** são trabalhos diferentes. Usado onde há essa diferença, ajuda cada lado a ficar mais simples. Aplicado em toda parte por padrão, pode virar só mais código para manter.
