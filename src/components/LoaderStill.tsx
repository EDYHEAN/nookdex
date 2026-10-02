import { LOGO_IMG_SIZES, SCENE, logoSrcSet, sceneImg } from "@/lib/scene";
import { SITE_NAME } from "@/lib/site";
import styles from "./Loader.module.css";

const L = SCENE.logo;
const pct = (v: number, of: number) => `${(v / of) * 100}%`;

/**
 * The loader's picture as plain HTML, while the scripts download and start: it is the page's first big paint (a phone
 * used to wait seconds for the scripts before anything showed). The animated Loader then takes over on the same spot.
 */
export function LoaderStill() {
  const b = L.ball;
  const box = { x: b.x - b.r - 4, y: b.y - b.r - 4, s: b.r * 2 + 8 };
  return (
    <div className={styles.loader}>
      <div className={styles.art} style={{ aspectRatio: `${L.width} / ${L.height}` }}>
        <img
          className={styles.paper}
          src={sceneImg("logo-paper-1400.webp")}
          srcSet={logoSrcSet}
          sizes={LOGO_IMG_SIZES}
          fetchPriority="high"
          alt={SITE_NAME}
          draggable={false}
        />
        {/* no boil filter yet: its SVG comes with the app */}
        <img
          className={styles.ball}
          src={sceneImg("logo-ball.webp")}
          alt=""
          draggable={false}
          style={{ left: pct(box.x, L.width), top: pct(box.y, L.height), width: pct(box.s, L.width), filter: "none" }}
        />
      </div>
    </div>
  );
}
