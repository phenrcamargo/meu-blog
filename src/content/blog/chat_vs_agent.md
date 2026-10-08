---
title: "Chat vs Agent"
description: "As diferenças entre Chat e Agent, anotações após estudar um pouco sobre o assunto."
pubDate: 2026-09-18
tags:
  - artificial-intelligence
  - ai-driven-development
  - spec-driven-development
---

# Chat vs Agent

Quando o assunto é inteligência artificial, existem muitos termos e siglas que podem deixar até os mais experientes desenvolvedores um tanto quanto confusos. Dentro deste universo de termos, hoje falarei um pouco de chat e agent, o que cada um é e suas diferenças.

## Chat

Um chat nada mais é do que um modelo de LLM, que converte prompts em tokens, e com base em processos internos absolutamente complexos, faz uma previsão muito acurada do próximo token, gerando a sensação de raciocícnio e conversa. Estes modelos de IA são por padrão stateless, ou seja, não armazenam estado algum, eles recebem o prompt, geram uma resposta, e aguardam o próximo prompt. Uma coisa interessante de se observar é que para o modelo não há distinção entre prompt e resposta, o prompt enviado é continuado pela LLM que permanece prevendo o próximo token até completar a resposta, e isso é retornado como output.

### Mas se ele é stateless, como a conversa tem continuidade?

Junto ao prompt do usuário é enviado o que chamamos de `contexto`, ele contém dados da memória armazenados nos prompts anteriores, identificação do usuário, assuntos de interesse, histórico de conversa resumido, e dados do contexto da sessão atual. Isso permite ao LLM produzir respostas baseadas não somente no prompt atual, mas em uma série de informações, o que nos passa a impressão de que há estado armazenado no modelo

### O System prompt

Também existe algo chamado `system prompt`, que também é enviado junto ao prompt do usuário, e sua função é define regras, comportamento, limitações e instruções gerais da IA. Isso é muito útil para proteger segredos de negócio, para evitar que a IA os revele caso solicitado. Também é utilizado para que o modelo não revele dados de seu treinamento, ou informações internas sobre seu funcionamento.

## Agent

Um agent (ou agente) também usa um modelo de linguagem, mas não se limita a receber uma
mensagem e devolver uma resposta. Ele é um sistema que prepara o contexto, coordena o modelo
e, quando necessário, conecta suas respostas a ferramentas e a um ambiente de execução.

### A montagem do contexto

Antes de cada etapa, um componente do agente chamado `context builder` reúne as informações
disponíveis para a tarefa: arquivos e pastas referenciados, especificações, skills, memória e o
contexto da sessão. Ele verifica se esse material cabe na janela de contexto do modelo. Se couber,
segue para a montagem do contexto final. Se não, pode aplicar uma estratégia de compressão,
inclusive pedindo ao próprio modelo que resuma as informações relevantes.

O contexto final é então enviado ao orquestrador, também chamado de runtime do agente. Quando
uma nova tarefa não tem relação com a conversa atual, iniciar uma sessão separada pode evitar o
envio de informações antigas que não ajudam na tarefa e economizar tokens.

### O ciclo do agente

Com o contexto em mãos, o orquestrador consulta o modelo. A resposta pode ser o resultado final
para o usuário ou uma solicitação para usar uma ferramenta ou interagir com o ambiente, como
ler um arquivo, executar um comando no terminal ou chamar uma API. É o próprio modelo que
indica qual ação deve ser realizada e fornece as instruções necessárias, o agente coordena a
execução dessa ação.

Depois de uma chamada de ferramenta, o harness, que é a estrutura que envolve e coordena o modelo, observa o resultado.
Ele verifica se houve erro, se é preciso corrigir algo ou se existe uma próxima etapa. O resultado é incorporado ao contexto atualizado,
que passa novamente pela montagem e pela verificação de tamanho. Esse ciclo se repete até que o orquestrador produza uma resposta final.

Assim, enquanto um chat costuma encerrar cada rodada com uma resposta, um agente pode
alternar entre raciocinar, usar ferramentas e avaliar os resultados antes de responder. Isso permite
que ele execute tarefas em várias etapas, dentro dos recursos e das permissões disponíveis.
