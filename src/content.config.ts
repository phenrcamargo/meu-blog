import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
  loader: glob({
    base: "./src/content/blog",
    pattern: "**/*.{md,mdx}",
  }),

  schema: z.object({
    title: z.string(), //string
    description: z.string(), //string
    pubDate: z.coerce.date(), //Date
    tags: z.array(z.string()), //string[]
  }),
});

export const collections = {
  blog,
};