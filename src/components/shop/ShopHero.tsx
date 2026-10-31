import type { ReactNode } from "react";
import s from "./Shop.module.css";

/**
 * The night hero of an Amazon page (« Sous la lampe »): the room at night under a dark veil, the lamp's glow, the product
 * standing on the desk's edge. On a phone: the head (title, date, countdown), the product, then the buy panel, its button
 * near 600 px; on a computer the product stands on the right.
 */
export function ShopHero({ head, stage, buy }: { head: ReactNode; stage?: ReactNode; buy?: ReactNode }) {
  return (
    <section className={s.hero}>
      <div className={stage ? `${s.wrap} ${s.heroWrap}` : `${s.wrap} ${s.heroWrap} ${s.flat}`}>
        <div className={s.head}>{head}</div>
        {stage}
        {stage && <div className={s.floor} />}
        {buy && (
          <div className={s.buyW}>
            <div className={s.buy}>{buy}</div>
          </div>
        )}
      </div>
    </section>
  );
}
