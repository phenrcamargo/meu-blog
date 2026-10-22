---
title: "Humble Object: um frontend mais fácil de testar"
description: "Como separar a interface das decisões de apresentação para deixar o frontend testável e com responsabilidades claras."
pubDate: 2026-10-14
tags:
  - software-development
  - architecture
  - testing
  - frontend
---

Uma tela pode parecer simples: buscar pedidos, mostrar o resultado e permitir que a pessoa aplique um filtro. Mas, se o componente que renderiza essa tela também interpreta respostas da API, decide quais estados exibir, formata dados e implementa as regras do filtro, testar cada comportamento exige montar boa parte da interface. O teste fica lento, frágil e difícil de entender.

O padrão **Humble Object** ajuda a lidar com esse problema. A ideia é manter pequena e simples a parte do sistema que é difícil de testar, e mover o máximo possível das decisões para objetos ou funções que possam ser testados isoladamente. Martin Fowler descreve essa abordagem para interfaces, citando padrões como _Presentation Model_ e _Passive View_. ([Humble Object, Martin Fowler](https://martinfowler.com/bliki/HumbleObject.html))

“Humble” não quer dizer que o componente seja irrelevante ou que não deva ter testes. Quer dizer que sua responsabilidade é modesta: conectar a interface ao restante da aplicação. As decisões importantes ficam em código que não depende de navegador, ciclo de vida de componente ou bibliotecas de renderização.

## O que torna uma interface difícil de testar?

Código de interface costuma depender de recursos externos ao próprio código: elementos do DOM, eventos, estado mantido pelo framework, temporizadores, rede e APIs do navegador. Essas dependências são úteis para apresentar a aplicação, mas podem tornar testes unitários trabalhosos. Se uma regra de negócio ou de apresentação só pode ser verificada renderizando toda a tela, mudanças visuais pequenas podem quebrar testes que pretendiam validar outra coisa.

Considere uma lista de pedidos. O componente pode acabar decidindo o texto do estado vazio, filtrando pedidos e formatando os valores, além de cuidar da renderização:

```tsx
function ListaDePedidos({ pedidos }: { pedidos: Pedido[] }) {
  const [filtro, setFiltro] = useState("");
  const filtrados = pedidos.filter((pedido) =>
    pedido.cliente.toLowerCase().includes(filtro.toLowerCase()),
  );

  return (
    <section>
      <input
        value={filtro}
        onChange={(evento) => setFiltro(evento.target.value)}
      />
      {filtrados.length === 0 ? (
        <p>Nenhum pedido encontrado</p>
      ) : (
        filtrados.map((pedido) => (
          <article key={pedido.id}>
            <strong>{pedido.cliente}</strong>
            <span>
              {pedido.total.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </span>
          </article>
        ))
      )}
    </section>
  );
}
```

Esse exemplo não é automaticamente ruim. O problema aparece quando o componente acumula decisões que mudam por razões diferentes. Para testar a regra de filtro ou o estado vazio, o teste precisa passar pelo mecanismo de renderização e pela interação com o campo, mesmo que essas decisões não dependam da interface.

## Extraia as decisões para um modelo de apresentação

Um **modelo de apresentação** recebe os dados relevantes e produz um estado pronto para a interface exibir. Ele pode decidir quais pedidos aparecem, qual mensagem mostrar e como apresentar valores. Como é uma função comum, seus casos podem ser testados sem DOM:

```ts
type Pedido = {
  id: string;
  cliente: string;
  total: number;
};

type PedidoNaTela = {
  id: string;
  cliente: string;
  totalFormatado: string;
};

type EstadoDaLista = {
  pedidos: PedidoNaTela[];
  mensagemVazia: string | null;
};

function apresentarPedidos(pedidos: Pedido[], filtro: string): EstadoDaLista {
  const termo = filtro.trim().toLocaleLowerCase("pt-BR");
  const visiveis = pedidos.filter((pedido) =>
    pedido.cliente.toLocaleLowerCase("pt-BR").includes(termo),
  );

  return {
    pedidos: visiveis.map((pedido) => ({
      id: pedido.id,
      cliente: pedido.cliente,
      totalFormatado: pedido.total.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
    })),
    mensagemVazia: visiveis.length === 0 ? "Nenhum pedido encontrado" : null,
  };
}
```

Os testes desse modelo podem cobrir filtro sem distinção entre maiúsculas e minúsculas, espaços extras, lista vazia e formatação monetária. Cada caso verifica uma decisão explícita, sem precisar montar uma página. O componente fica responsável por encaminhar o valor digitado ao modelo e renderizar o resultado:

```tsx
function ListaDePedidos({ pedidos }: { pedidos: Pedido[] }) {
  const [filtro, setFiltro] = useState("");
  const estado = apresentarPedidos(pedidos, filtro);

  return (
    <section>
      <label>
        Buscar por cliente
        <input
          value={filtro}
          onChange={(evento) => setFiltro(evento.target.value)}
        />
      </label>
      {estado.mensagemVazia && <p>{estado.mensagemVazia}</p>}
      {estado.pedidos.map((pedido) => (
        <article key={pedido.id}>
          <strong>{pedido.cliente}</strong>
          <span>{pedido.totalFormatado}</span>
        </article>
      ))}
    </section>
  );
}
```

Agora a parte ligada ao framework continua cuidando do campo, dos eventos e da estrutura visual. Ela ainda precisa ser verificada, mas os testes de lógica não dependem dela. Um teste de componente pode confirmar que o campo atualiza a lista e que o conteúdo aparece com os elementos acessíveis esperados; os testes do modelo cobrem as combinações de regras com mais rapidez.

## Responsabilidades claras na camada de frontend

Uma divisão útil não depende de uma biblioteca específica. Em termos gerais, cada parte pode ter um papel claro:

- **Componente ou View:** mostra o estado recebido e encaminha interações. Lida com markup, acessibilidade e detalhes de integração com o framework.
- **Modelo de apresentação ou Presenter:** transforma dados em estado e textos apropriados para a tela. Decide, por exemplo, se há conteúdo, carregamento, erro ou estado vazio.
- **Serviço ou caso de uso:** coordena operações da aplicação, como carregar pedidos ou solicitar o cancelamento. Não precisa conhecer elementos visuais.
- **Domínio:** concentra regras do negócio que precisam valer independentemente de como os dados são exibidos.

Essa divisão é uma ferramenta para dar nomes e limites às razões de mudança. Uma regra de negócio não deve depender de um componente; a formatação de uma tela não deve ficar escondida em uma chamada de rede; e a View não precisa conhecer detalhes de persistência.

Em uma aplicação pequena, essas responsabilidades podem caber em poucos arquivos. O objetivo não é criar uma classe para cada função, mas evitar que o mesmo componente seja o lugar obrigatório para encontrar e testar todas as decisões.

## O que fica dentro do objeto humilde?

O componente ainda é o lugar certo para código que realmente depende da interface: associar eventos, controlar foco, conectar propriedades do framework, renderizar elementos e sincronizar uma interação com o estado visual. Esse código deve ser direto. Quando há uma sequência de decisões, conversões ou regras, vale perguntar se ela pode ser expressa fora do componente e coberta por testes mais simples.

Também não é necessário eliminar todo teste de interface. Testes de componente ou de ponta a ponta continuam importantes para verificar se as partes foram conectadas corretamente e se a pessoa consegue completar um fluxo real. O padrão ajuda a escolher o nível adequado: testar a lógica em isolamento e reservar a renderização para verificar integração e comportamento observável.

## Uma refatoração incremental

Quando um componente se torna difícil de testar, comece identificando uma decisão concreta, como selecionar opções, calcular um rótulo ou determinar o estado vazio. Extraia essa decisão para uma função ou modelo que receba dados como entrada e devolva um resultado explícito. Teste esse resultado diretamente e deixe o componente apenas consumir e exibir o estado.

Assim, a interface não precisa desaparecer nem virar uma camada genérica. Ela continua fazendo o trabalho para o qual existe: apresentar a aplicação e receber interações. O Humble Object torna esse limite visível e deixa a lógica que merece mais atenção fácil de entender, exercitar e evoluir.
