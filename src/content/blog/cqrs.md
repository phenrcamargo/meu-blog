---
title: "CQRS: separando leituras e escritas"
description: "O que é CQRS, que tipo de problema resolve e como começar com exemplos simples."
pubDate: 2026-07-08
tags:
  - software-development
  - architecture
  - cqrs
---

Em muitas aplicações, o volume e o perfil das leituras são diferentes dos das escritas. Uma tela de acompanhamento pode fazer milhares de consultas para cada atualização de pedido, por exemplo. Essa assimetria pressiona o banco de formas distintas: as leituras querem consultas rápidas e formatos convenientes, enquanto as escritas precisam validar regras e persistir mudanças com segurança.

É comum tentar resolver a lentidão das consultas aumentando verticalmente os recursos do banco ou criando índices nas colunas mais consultadas. Essas medidas podem ajudar em casos específicos, mas não eliminam a diferença entre os padrões de leitura e escrita. Mais CPU e memória aumentam a capacidade geral, sem tornar consultas complexas mais simples; índices aceleram buscas, mas ocupam espaço e precisam ser atualizados a cada inserção, alteração ou remoção, adicionando custo às escritas. Quando os dois fluxos disputam o mesmo modelo e os mesmos recursos, otimizar um lado pode pressionar o outro.

O **CQRS** (_Command Query Responsibility Segregation_) propõe separar as responsabilidades de comando e consulta na arquitetura. Em uma implantação, isso pode significar um servidor ou serviço de escrita, responsável por validar e gravar mudanças, e um servidor ou serviço de leitura, preparado para responder às consultas. A fonte da verdade pode ser um banco relacional no lado de escrita, enquanto o lado de leitura usa um modelo próprio em uma tecnologia adequada ao acesso, como MongoDB, Cassandra ou Redis. A separação também pode começar apenas no código, sem servidores ou bancos distintos.

Essa arquitetura é diferente de simplesmente adicionar uma **read replica**. Uma réplica normalmente copia o banco de escrita para distribuir consultas, mantendo essencialmente o mesmo modelo de dados. No CQRS, o modelo de leitura pode ser transformado e organizado para as consultas da aplicação, inclusive em outro tipo de banco. Uma forma de manter essa projeção atualizada é usar captura de mudanças de dados (_Change Data Capture_, ou CDC): o Debezium captura as alterações do banco de escrita, publica eventos no Kafka e consumidores atualizam o modelo de leitura. Como esse processamento pode ocorrer depois da gravação, as leituras podem ficar temporariamente defasadas.

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

CQRS não significa obrigatoriamente ter um banco para escrita e outro para leitura, nem exige que os lados sejam servidores separados. Também não exige microsserviços, mensageria ou _Event Sourcing_. Essas técnicas podem ser combinadas com CQRS quando resolvem necessidades reais, mas adicionam operação e pontos de falha. Uma read replica pode distribuir carga de leitura, mas, por si só, não cria um modelo de leitura específico como o CQRS permite.

Vale começar pela separação lógica entre comandos e consultas. Se houver uma necessidade concreta, como leituras com alto volume, consultas difíceis de otimizar ou modelos de apresentação muito diferentes, aí faz sentido considerar projeções e infraestrutura adicional.

No fim, CQRS é uma forma de deixar claro que **mudar os dados** e **perguntar sobre eles** são trabalhos diferentes. Usado onde há essa diferença, ajuda cada lado a ficar mais simples. Aplicado em toda parte por padrão, pode virar só mais código para manter.
