import { findCard, type Post } from "@/lib/blog";
import { CardStage } from "./shop/ShopBits";

/**
 * A post's picture under the lamp (the blog in the shop pages' shell): the first card it talks about, as on its share
 * picture (og.png draws the same cards; that one is a PNG drawn on demand, too heavy for a page's hero). None: no stage.
 */
export async function postStage(post: Post | undefined) {
  if (!post) return undefined;
  for (const key of post.cards) {
    const found = await findCard(key);
    if (found?.card.img) return <CardStage src={found.card.img} alt={`${found.card.name} · ${found.setName}`} />;
  }
  return undefined;
}
