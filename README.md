# Blog Pessoal

Blog pessoal construído com [Astro](https://astro.build), usado para registrar
notas de estudo sobre desenvolvimento de software (arquitetura, backend,
ferramentas, e o que mais for aprendido no caminho).

## Stack

- **Astro** — geração estática, com Content Layer API para as collections
- **Markdown** — cada post é um arquivo `.md` em `src/content/blog/`
- **Zod** — validação do frontmatter dos posts

## Estrutura do projeto

```text
├── src
│   ├── assets              # imagens e outros arquivos estáticos processados
│   ├── content
│   │   └── blog             # posts do blog (arquivos .md)
│   ├── content.config.ts    # definição e schema da collection "blog"
│   ├── layouts
│   │   └── BaseLayout.astro # layout compartilhado (header, footer, tipografia)
│   └── pages
│   │   ├── index.astro      # página inicial
│   │   ├── sobre.astro      # página "sobre mim"
│   │   ├── blog.astro       # listagem de posts
│   │   └── blog
│   │       └── [slug].astro # página de um post individual (rota dinâmica)
│   └── utils # código compartilhado entre várias páginas
└── package.json
```

## Como rodar o projeto

```bash
npm install
npm run dev
```

O site fica disponível em `http://localhost:4321`.

| Comando           | Ação                                   |
| ----------------- | -------------------------------------- |
| `npm install`     | Instala as dependências                |
| `npm run dev`     | Inicia o servidor de desenvolvimento   |
| `npm run build`   | Gera o site estático em `./dist/`      |
| `npm run preview` | Faz preview local do build de produção |

## Como escrever um novo post

1. Crie um arquivo `.md` dentro de `src/content/blog/`, por exemplo:

   ```text
   src/content/blog/meu-novo-post.md
   ```

2. Preencha o frontmatter seguindo o schema definido em `content.config.ts`:

   ````markdown
   ---
   title: "Título do post"
   description: "Uma descrição curta do que o post aborda."
   pubDate: 2026-08-18
   tags:
     - tag-um
     - tag-dois
   ---

   Conteúdo do post em Markdown normal: `#`/`##` para títulos, listas,
   ` ``` ` para blocos de código, `>` para citações, etc.
   ````

3. Salve o arquivo. Com o servidor de dev rodando, o post aparece
   automaticamente em `/blog` e fica acessível em `/blog/meu-novo-post`
   (o slug da URL é o nome do arquivo, sem a extensão `.md`).

Não é necessário escrever nenhum CSS: a tipografia (títulos, parágrafos,
listas, citações, blocos de código, links) já é aplicada automaticamente
pelo `BaseLayout.astro` a qualquer conteúdo dentro de um `<article>` ou de
uma `<div class="prose">`.

### Observações importantes

- O arquivo de configuração das collections **deve** ficar em
  `src/content.config.ts` (raiz de `src/`), não dentro de `src/content/`.
  Esse é um requisito do Astro a partir da versão 5 (Content Layer API).
- Se o servidor de dev não reconhecer um post recém-criado, tente reiniciá-lo
  (`Ctrl+C` e `npm run dev` novamente).
- Se aparecer o erro _"The collection does not exist or is empty"_ após
  apagar a pasta `.astro/`, confirme se `content.config.ts` está no local
  correto (`src/content.config.ts`) antes de reiniciar o servidor.

## Identidade visual

O design segue um conceito de "caderno de estudos de um dev":

- **Cores**: fundo em tom de papel (`#F1F2EC`), texto quase-preto
  (`#171A16`) e um verde-musgo (`#3F6B4E`) como acento único.
- **Tipografia**: Fraunces (serifada) para títulos, IBM Plex Sans para o
  corpo do texto, IBM Plex Mono para datas, tags e código.
- **Detalhes**: blocos de código em estilo "janela de terminal", tags como
  labels estilo git, e um "carimbo de log" (`// 2026.08.18`) antes de cada
  título de post.

Todos os tokens de cor e fonte estão centralizados em `:root` dentro de
`BaseLayout.astro`, então qualquer ajuste de identidade visual pode ser
feito em um único lugar.
