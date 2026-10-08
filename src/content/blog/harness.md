---
title: "O que eu entendi sobre Harness"
description: "Como o harness conecta um modelo de linguagem a ferramentas, contexto e verificações para formar um agente."
pubDate: 2026-08-18
tags:
  - spec-driven development
  - harness
  - ai
---

## O que é um harness?

Um modelo de linguagem recebe texto e produz texto. Para que ele consiga ler arquivos, executar ações, lembrar informações úteis entre etapas e conferir o próprio trabalho, é preciso algo ao redor dele. Esse conjunto é chamado de **harness**.

Uma analogia simples: o modelo é o motor; o harness é o carro, com direção, freios e painel. O motor gera a força, mas são as outras partes que permitem controlar para onde o carro vai e perceber o que está acontecendo. Do mesmo jeito, o harness conecta a saída do modelo ao mundo real.

## Qual problema ele resolve?

Um LLM sozinho não executa ações, não persiste memória por conta própria e não sabe se o resultado de uma tarefa está correto. Também tem uma janela de contexto limitada. Sem um harness, alguém precisa copiar as respostas do modelo, executar as ações manualmente e trazer os resultados de volta.

O harness automatiza esse ciclo de **pensar, agir e observar**, mantendo regras sobre o que o agente pode fazer e como validar o resultado. Por isso, dois agentes usando o mesmo modelo podem ter desempenhos bem diferentes: as ferramentas, o contexto e os mecanismos de controle fazem bastante diferença.

## As peças principais

Um harness costuma combinar alguns componentes:

- **Loop do agente:** chama o modelo repetidamente até a tarefa terminar.
- **Ferramentas (tools):** funções para ler arquivos, executar comandos ou consultar serviços.
- **Contexto e memória:** informações selecionadas para cada chamada ao modelo.
- **Permissões e sandbox:** limites para as ações que podem ser executadas.
- **Verificação:** checagens que ajudam a determinar se o resultado está correto.
- **Observabilidade:** logs e traces que mostram o que aconteceu em cada etapa.

Nem todo projeto precisa de uma infraestrutura enorme. O importante é entender o papel de cada peça e acrescentar complexidade conforme ela resolve um problema real.

## O loop do agente

O loop é o mecanismo que coordena as chamadas. Em linhas gerais, o harness monta o contexto, consulta o modelo e verifica a resposta. Se o modelo pedir uma ferramenta, o harness executa a ação autorizada, devolve o resultado e faz outra chamada. O ciclo termina quando o modelo apresenta uma resposta final.

Um exemplo simplificado em TypeScript:

```ts
async function runAgent(tarefa: string) {
  const mensagens: Msg[] = [{ role: "user", content: tarefa }];

  for (let passo = 0; passo < MAX_PASSOS; passo++) {
    const resposta = await modelo.chamar(mensagens, tools);
    mensagens.push(resposta);

    if (!resposta.toolCalls?.length) return resposta.content;

    for (const chamada of resposta.toolCalls) {
      const resultado = await executarTool(chamada);
      mensagens.push({
        role: "tool",
        toolCallId: chamada.id,
        content: resultado,
      });
    }
  }

  throw new Error("Limite de passos excedido");
}
```

O limite de passos é importante: sem ele, uma sequência de chamadas mal planejada pode continuar indefinidamente, consumindo tempo e recursos. O exemplo também esconde detalhes de tratamento de erros e validação, que uma implementação real precisa considerar.

## Ferramentas: dando mãos ao modelo

Uma ferramenta costuma ter um nome, uma descrição e um esquema que define os parâmetros aceitos. A descrição ajuda o modelo a decidir quando aquela ferramenta é apropriada; o esquema permite ao harness validar os argumentos antes de executar a ação.

```ts
const tools = [
  {
    name: "ler_arquivo",
    description: "Lê um arquivo de texto pelo caminho informado.",
    parameters: { caminho: { type: "string" } },
    execute: async ({ caminho }: { caminho: string }) =>
      fs.readFile(caminho, "utf-8"),
  },
];
```

Uma ferramenta bem descrita e com parâmetros claros tende a ser mais útil do que várias opções ambíguas. O harness não deve confiar cegamente no que o modelo pede: ele valida os argumentos e aplica as permissões antes de chamar `execute`.

## Gerenciando o contexto

A janela de contexto é finita, então não dá para incluir tudo em toda chamada. O harness decide o que entra, o que pode sair e o que vale a pena resumir. É uma espécie de curadoria: contexto demais custa caro e pode distrair o modelo; contexto de menos pode deixá-lo sem informação essencial.

Algumas estratégias comuns são resumir partes antigas da conversa, guardar notas de memória em arquivos, carregar documentos sob demanda e limitar o tamanho das saídas das ferramentas. Por exemplo, em vez de incluir todos os arquivos de um projeto, o agente pode começar pela estrutura e ler apenas os arquivos relacionados à tarefa.

## Permissões, isolamento e segurança

Quando o agente só conversa, um erro pode ser apenas uma resposta ruim. Quando ele executa ações, o risco também é concreto: pode sobrescrever arquivos, expor dados ou rodar um comando perigoso. Por isso, o harness deve aplicar o princípio do menor privilégio: oferecer somente os acessos necessários para a tarefa.

Dependendo do impacto, pode ser adequado restringir comandos, usar um ambiente isolado ou pedir confirmação humana antes de uma ação sensível. Um controle bem simples poderia ser:

```ts
async function executarTool(chamada: ToolCall) {
  if (
    ACOES_SENSIVEIS.includes(chamada.name) &&
    !(await pedirConfirmacao(chamada))
  ) {
    return "Ação negada pelo usuário.";
  }

  return tools[chamada.name].execute(chamada.args);
}
```

Também é preciso prestar atenção a **prompt injection**. Uma página ou arquivo consultado pode conter texto que tenta dar instruções ao agente. Esse conteúdo deve ser tratado como dado a analisar, não como uma ordem que substitui as regras do sistema. O modelo pode ajudar a interpretar a situação, mas é o harness que precisa impor os limites de execução.

## Verificação e feedback

Agentes erram, e não basta perguntar ao próprio modelo se ele tem certeza. Um harness robusto pode checar o resultado com testes, compiladores, linters ou validações de esquema. Se uma verificação falhar, a saída pode voltar ao modelo como observação para que ele tente corrigir o problema.

Por exemplo, depois de uma edição de código, uma ferramenta pode executar os testes e retornar o código de saída e as mensagens de erro. O agente usa esse retorno para decidir o próximo passo. Quanto mais objetiva for a verificação, mais confiança podemos ter em automatizar a tarefa.

## Subagentes e orquestração

Em tarefas grandes, um agente principal pode delegar partes independentes a **subagentes**. Cada subagente recebe um contexto mais específico e pode ter ferramentas adequadas à sua parte. O agente principal recebe os resultados e os combina.

Isso pode reduzir o ruído no contexto principal e permitir trabalho em paralelo, mas também aumenta o número de chamadas, o custo e a dificuldade de entender de onde veio um erro. A delegação funciona melhor quando a subtarefa é realmente independente, por exemplo, pesquisar arquivos em áreas distintas e devolver um resumo claro.

## Construir um harness ou usar um pronto?

Para um caso comum, como automação ou pesquisa, um framework existente pode oferecer o loop e as integrações necessárias, permitindo chegar a uma solução mais rápido. Construir um harness próprio faz mais sentido quando há requisitos específicos de segurança, domínio, custo ou controle fino do contexto.

Em qualquer caminho, algumas armadilhas aparecem com frequência: adicionar ferramentas demais, criar prompts de sistema enormes, esquecer um limite de passos, não registrar logs ou deixar de verificar os resultados. Uma boa forma de começar é implementar o loop mínimo e acrescentar componentes quando uma necessidade concreta aparecer.

No fim, o modelo fornece a capacidade de interpretar e gerar respostas; o harness transforma essa capacidade em um agente que consegue agir de maneira coordenada. É a estrutura ao redor que define quais ferramentas estão disponíveis, que contexto chega ao modelo e como as ações são controladas e verificadas.
