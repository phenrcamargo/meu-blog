---
title: "TDD com especificações e IA"
description: "Como separar a definição das regras de negócio da implementação ajuda a reduzir o viés de confirmação em testes gerados por IA."
pubDate: 2026-11-14
tags:
  - ai-driven-development
  - spec-driven-development
  - tdd
  - testing
---

# TDD com especificações e IA

Desenvolvimento orientado a testes (TDD) propõe um ciclo conhecido: escrever um teste que falha, implementar o comportamento necessário e, por fim, refatorar mantendo os testes verdes. Com ferramentas de IA, esse ciclo continua útil, mas surge um risco: se o mesmo agente interpreta os requisitos, escreve o código e cria os testes depois, pode acabar validando as próprias decisões em vez das regras de negócio.

O teste pode passar e ainda assim o produto estar errado. Isso acontece quando a implementação introduz uma interpretação equivocada e os testes são escritos para confirmar exatamente essa interpretação. O problema não é exclusivo da IA; é uma forma de viés de confirmação. A velocidade de geração de código apenas torna mais importante estabelecer uma fonte de verdade independente da implementação.

## Começar pela regra de negócio

Uma forma de reduzir esse risco é separar o entendimento do problema da construção da solução. Antes de implementar, reúna a especificação e as regras de negócio e transforme-as em uma pré-especificação clara. Ela deve registrar o comportamento esperado, os requisitos funcionais e não funcionais, as restrições e os casos relevantes, incluindo situações de erro e limites.

Esse documento não deve descrever o código que já existe. Ele expressa o que o sistema precisa fazer, com linguagem que possa ser conferida por quem conhece o domínio. Se uma regra estiver ambígua, a ambiguidade precisa aparecer e ser resolvida antes de servir de base para os testes. Caso contrário, a IA preencherá as lacunas com suposições próprias.

## Derivar os testes da especificação

Com a pré-especificação estabelecida, os testes são escritos para representar os comportamentos e as regras nela descritos. Cada caso deve ter uma razão rastreável: qual requisito verifica, qual entrada ou situação considera e qual resultado é esperado. Assim, a pergunta deixa de ser “o código faz o que o código parece querer fazer?” e passa a ser “o sistema cumpre esta regra?”.

Por exemplo, se uma especificação disser que um pedido só pode ser cancelado antes do envio, os testes devem cobrir tanto um pedido ainda não enviado quanto um já enviado. O resultado esperado vem da regra: o primeiro pode ser cancelado; o segundo, não. Os testes não devem inferir o comportamento observando como a implementação foi escrita.

## Revisão independente dos testes

Antes de começar a implementação de produção, um segundo agente pode revisar os testes usando um contexto separado, sem acesso às decisões e ao código de produção do primeiro agente. Sua tarefa é comparar os testes diretamente com a especificação: as regras estão cobertas? Os casos de fronteira foram considerados? As expectativas refletem o domínio ou apenas uma escolha técnica?

Se a revisão encontrar lacunas ou interpretações incorretas, os testes são corrigidos e passam por outra revisão independente. O ciclo continua até que haja confiança razoável de que eles verificam as regras documentadas. Um contexto separado ajuda a reduzir o viés compartilhado, mas não torna a revisão infalível: a qualidade ainda depende de uma especificação precisa e de uma análise cuidadosa.

## Proteger os testes aprovados

Depois da revisão, pode-se registrar um hash dos arquivos de teste em um arquivo de lock. Antes e durante a implementação, uma checagem compara os hashes atuais com os registrados e acusa alterações. Isso torna visível uma mudança nos testes depois que eles foram aprovados, evitando que uma implementação incompatível seja “consertada” enfraquecendo as expectativas sem revisão.

O lock não demonstra que os testes estão corretos nem impede, sozinho, toda alteração: ele apenas permite detectar diferenças nos arquivos cobertos pelo mecanismo. Se um teste precisar mudar porque a especificação foi corrigida ou um caso foi esclarecido, a mudança deve ser revisada à luz dessa regra e o lock atualizado de forma explícita. O hash é uma proteção de integridade, não substituto para revisão.

## Implementar e validar

Com os testes revisados e protegidos, implementa-se o código de produção para satisfazê-los. Primeiro, observa-se que os testes falham na ausência do comportamento; depois, a implementação é feita e a suíte é executada novamente. Se algo falhar, a investigação deve considerar tanto um defeito no código quanto uma falha ou mudança legítima na especificação. Alterar um teste exige voltar ao requisito que ele representa, não apenas fazê-lo passar.

O fluxo pode ser resumido assim:

1. Consolidar a especificação, as regras de negócio e os requisitos.
2. Escrever uma pré-especificação verificável, esclarecendo ambiguidades.
3. Criar testes derivados dos comportamentos especificados.
4. Revisar os testes em contexto independente e corrigir as lacunas encontradas.
5. Registrar os hashes dos testes aprovados e verificar o lock.
6. Implementar o código de produção e executar os testes.
7. Revisar qualquer mudança de teste contra a regra correspondente.

## O que essa abordagem garante

Separar a especificação, a criação dos testes e a implementação ajuda a evitar que uma única interpretação se valide sozinha. A revisão independente oferece uma segunda perspectiva, e o lock torna alterações nos testes detectáveis. Em conjunto, essas etapas criam evidências melhores de que a implementação atende às regras definidas.

Ainda assim, testes podem estar incompletos, a especificação pode não representar o domínio corretamente e um agente revisor também pode errar. Por isso, a validação humana das regras continua importante, especialmente em decisões de negócio ambíguas ou de alto impacto. A abordagem não elimina o julgamento: ela o torna explícito e o posiciona antes de o código influenciar a interpretação.

Esse processo é uma forma de TDD orientado pela especificação: primeiro define-se o comportamento que importa, depois se verifica de forma independente como testá-lo e só então se implementa. Com isso, o teste deixa de ser um espelho do código e passa a ser um compromisso verificável com as regras de negócio.
