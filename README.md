# NookDex · posts Instagram et TikTok

Branche à part (jamais déployée par Vercel). Règles et format des posts : `docs/social.md` sur `main`.

- `posts/<date>-<slug>/post.json` : un post (date, plateformes, légende, slides décrites en JSON). Écrits par la
  routine du dimanche, ou à la main.
- `renders/<id>/` : ses images (`slide-01.jpg`…) et sa vidéo TikTok (`tiktok.mp4`), dessinées par l'Action « Rendu des
  posts » ; `renders/index.json` : la liste lue par https://nookdex.com/studio.
- `assets/` : captures de l'appli et photos que les slides peuvent montrer.
