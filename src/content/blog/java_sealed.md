---
title: "Sealed classes e interfaces no Java"
description: "Como restringir os subtipos de uma hierarquia e deixar regras de domínio mais explícitas com sealed."
pubDate: 2026-10-08
tags:
  - java
  - software-development
  - architecture
---

Você já ouviu falar de _sealed classes_ e _sealed interfaces_ no Java? Talvez sim, talvez não. Elas estão disponíveis há algumas versões e, ainda assim, passam meio despercebidas. Uma pena, porque resolvem de forma bem direta um problema comum de modelagem: quando uma hierarquia deve ter um conjunto conhecido de subtipos.

## O que significa `sealed`?

Por padrão, uma classe ou interface pública pode ser estendida ou implementada por outros tipos, desde que as regras normais de acesso permitam. Isso é ótimo quando queremos uma API aberta à extensão. Mas nem sempre é essa a intenção.

Com `sealed`, declaramos explicitamente quais tipos podem estender uma classe ou implementar uma interface. Por exemplo, se no nosso domínio um pagamento só pode ser feito por cartão, Pix ou boleto, podemos representar essa regra no próprio código:

```java
public sealed interface Pagamento
        permits Cartao, Pix, Boleto {
}

public record Cartao(String numeroFinal) implements Pagamento {}
public record Pix(String chave) implements Pagamento {}
public record Boleto(String codigo) implements Pagamento {}
```

Agora, uma classe `PagamentoAleatorio` não pode simplesmente implementar `Pagamento`. O compilador rejeita um subtipo que não esteja na lista `permits`. A regra deixa de existir apenas na documentação ou na convenção da equipe e passa a fazer parte da declaração da hierarquia.

## O que os subtipos precisam declarar?

Cada subtipo permitido precisa dizer como a hierarquia continua. Ele pode ser `final`, impedindo novas subclasses; `sealed`, listando os próximos subtipos permitidos; ou `non-sealed`, reabrindo a hierarquia naquele ramo.

No exemplo anterior, os `record`s são implicitamente `final`, então não precisam de uma declaração adicional. Uma hierarquia de classes poderia ser escrita assim:

```java
public sealed abstract class Pagamento
        permits Cartao, Pix {
}

public final class Cartao extends Pagamento {
}

public non-sealed class Pix extends Pagamento {
}
```

Nesse caso, `Cartao` encerra seu ramo, enquanto `Pix` permite que outras classes o estendam. Se a intenção for manter todos os ramos fechados, `non-sealed` não deve ser usado.

Há também uma regra de organização: os subtipos permitidos precisam estar no mesmo módulo nomeado da classe selada; em um módulo sem nome, precisam estar no mesmo pacote. Isso deixa o conjunto de implementações sob controle do módulo ou pacote que define a abstração.

## Por que isso ajuda no domínio?

Se as formas de pagamento são realmente limitadas, uma interface aberta pode permitir combinações que o negócio não reconhece. Isso espalha verificações defensivas pelo código e pode fazer um caso inesperado aparecer só durante a execução.

Uma hierarquia selada documenta a decisão de design e ajuda a evitar subtipos acidentais. Também facilita entender o domínio: ao ler `Pagamento`, já dá para descobrir quais são as alternativas válidas. É especialmente útil para resultados de operações, estados de workflow, mensagens de domínio e outras categorias com um conjunto deliberadamente fechado de casos.

## Combinando com `switch`

Com uma hierarquia selada, o compilador conhece os subtipos permitidos. Nas versões modernas do Java, isso combina bem com _pattern matching_ em `switch`, permitindo tratar cada alternativa sem um `default` genérico:

```java
static String descrever(Pagamento pagamento) {
    return switch (pagamento) {
        case Cartao cartao -> "Cartão final " + cartao.numeroFinal();
        case Pix pix -> "Pix para " + pix.chave();
        case Boleto boleto -> "Boleto " + boleto.codigo();
    };
}
```

Como o conjunto de tipos é conhecido, o compilador pode verificar se todos os casos foram tratados. Se um novo tipo permitido for adicionado, os `switch` que ficaram incompletos podem ser identificados na compilação, em vez de descobrir o esquecimento só quando aquele caminho for executado. Esse exemplo usa _pattern matching for switch_, disponível como recurso final a partir do Java 21.

## Quando usar e quando deixar aberto

Use `sealed` quando a lista de subtipos faz parte das regras do domínio e você quer que ela seja controlada. Isso pode deixar a API mais segura, o código mais explícito e a manutenção mais previsível.

Já uma abstração pensada para receber implementações de terceiros, plugins ou extensões futuras provavelmente deve continuar aberta. Fechar uma hierarquia também é uma decisão de compatibilidade: adicionar um subtipo novo pode exigir que consumidores atualizem seus `switch` e tratem o novo caso.

No fim, `sealed` não é uma solução avançada ou complicada. É Java puro para dizer ao compilador: “estas são as alternativas possíveis; se isso mudar, me avise”. Se o domínio tem regras bem definidas e o código vai crescer com o tempo, vale experimentar. Às vezes o Java parece verboso porque a gente ainda não está usando as ferramentas que ele já oferece.
