---
title: "Dual Write: o problema da dupla escrita"
description: "Entenda por que gravar no banco e publicar um evento pode dar errado, e como o Transactional Outbox ajuda."
pubDate: 2026-09-23
tags:
  - software-development
  - best-practices
---

Imagine que, ao cadastrar uma pessoa, sua aplicação precise fazer duas coisas: salvar os dados no banco e publicar um evento para avisar outros serviços. Parece simples. O problema é que essas operações acontecem em sistemas diferentes, e não existe uma transação tradicional que garanta que as duas vão dar certo, ou até mesmo que as duas vão falhar como se fossem uma só.

Esse cenário é conhecido como **dual write**, ou dupla escrita. Se o cadastro for salvo, mas a publicação do evento falhar, os outros serviços nem ficam sabendo que a pessoa existe. Se o evento for publicado e a gravação no banco falhar, eles recebem uma notícia de algo que, na prática, nunca foi cadastrado. A aplicação acaba com dados fora de sincronia, e descobrir isso depois pode ser bem desagradável.

## Por que uma transação comum não resolve?

Uma tentativa comum é abrir uma transação no banco, inserir o cadastro e publicar o evento. Se alguma etapa der erro, a aplicação faz rollback. Só que o rollback desfaz as alterações no banco; ele não consegue “despublicar” um evento que já chegou ao Kafka, RabbitMQ ou a outro serviço.

Também existe o problema inverso: a aplicação pode publicar o evento e cair antes de confirmar a transação no banco. Nesse caso, quem consome o evento acredita que o cadastro foi concluído, mas o registro não foi persistido. A ordem das operações pode mudar qual falha aparece, mas não elimina a janela de inconsistência.

## A solução: Transactional Outbox

O **Transactional Outbox Pattern** resolve o problema registrando o evento no mesmo banco e na mesma transação que grava os dados principais. Além da tabela `users`, por exemplo, a aplicação mantém uma tabela de saída, como `users_outbox`.

Ao cadastrar uma pessoa, uma única transação grava tanto o novo registro em `users` quanto uma mensagem descrevendo o evento em `users_outbox`. Se a transação confirmar, os dois registros existem. Se houver erro, nenhum dos dois é gravado. A atomicidade é garantida pelo próprio banco, que é justamente onde ela funciona melhor.

A tabela de outbox vira uma caixa de saída: em vez de tentar publicar o evento diretamente durante o cadastro, a aplicação deixa a mensagem registrada ali para ser enviada depois. Assim, o serviço não precisa apostar que o banco e o sistema de mensagens vão estar disponíveis ao mesmo tempo.

## Quem envia as mensagens?

Um **outbox consumer** procura mensagens pendentes na tabela, envia cada uma ao destino apropriado e atualiza seu estado para indicar que foi processada. Ele pode ordenar a leitura pela data de criação para preservar a sequência dos eventos, quando essa ordem for importante para o domínio.

Esse consumidor precisa lidar com falhas: por exemplo, se enviar a mensagem funcionar, mas a aplicação cair antes de marcar a linha como processada, ela pode ser enviada novamente na próxima tentativa. Por isso, consumidores de eventos geralmente devem tolerar duplicatas, usando identificadores de evento ou operações idempotentes. A outbox evita perder a ligação entre a gravação e a intenção de publicar; o processamento continua precisando ser resiliente.

Também dá para automatizar a leitura das mudanças no banco com uma ferramenta de **CDC** (_Change Data Capture_), que captura alterações registradas no log do banco. O Debezium é uma opção comum: configurado para acompanhar a outbox, ele pode encaminhar os eventos para o Kafka ou outros destinos integrados.

O Transactional Outbox não transforma o banco e o broker em uma única transação mágica. Ele muda a estratégia: primeiro grava, de forma atômica, tanto os dados quanto a intenção de publicar, e só depois entrega essa mensagem com tentativas e tratamento de duplicatas. É um pequeno passo a mais na arquitetura que costuma evitar uma boa dor de cabeça quando os serviços começam a conversar entre si.
