import { getCollection } from "astro:content";

export async function getSortedPostsByDate() {
  const posts = await getCollection("blog");

  const sortedPosts = posts.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );

  return sortedPosts;
}

export async function getLatestPost() {
  const posts = await getSortedPostsByDate();
  return posts.slice(0, 3);
}