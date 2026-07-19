# toon-tools

Quatre outils autour de [TOON](https://github.com/toon-format/toon) (Token-Oriented
Object Notation), le format compact pensé pour réduire la consommation de tokens
des payloads envoyés à des LLM. Aucun de ces outils ne réimplémente l'encodeur/
décodeur TOON — tous s'appuient sur le package officiel `@toon-format/toon`.

| Outil | Ce qu'il fait |
|---|---|
| [`toon-cost-analyzer`](./toon-cost-analyzer) | CLI : mesure le vrai gain de tokens et de coût $ pour un fichier JSON donné, avant de migrer quoi que ce soit |
| [`toon-proxy`](./toon-proxy) | Reverse proxy Express : convertit à la volée les blocs JSON éligibles dans les prompts, sans toucher au code applicatif |
| [`toon-playground`](./toon-playground) | Page HTML unique, 100% navigateur : colle du JSON, vois le TOON et la jauge de compression en direct |
| [`toon-lint`](./toon-lint) | CLI de validation pour fichiers `.toon` : erreurs de parsing, tableaux de longueur incohérente, intégrité du round-trip |

**Démo en ligne** : <https://mnemoclaw.github.io/toon-tools/> (playground navigateur).

## Pourquoi ces quatre-là

Le format lui-même et son SDK sont déjà couverts par le projet officiel. Ce qui
manque, c'est l'outillage périphérique : savoir si la conversion vaut le coup
sur *ses* données (`toon-cost-analyzer`), l'adopter sans réécrire son code
(`toon-proxy`), l'expérimenter sans rien installer (`toon-playground`), et
sécuriser les fichiers `.toon` édités à la main (`toon-lint`).

## Installation

Chaque sous-dossier est un package Node indépendant :

```bash
cd toon-cost-analyzer && npm install
cd toon-lint && npm install
cd toon-proxy && npm install
```

`toon-playground` ne nécessite aucune installation — c'est un fichier `index.html`
autonome qui charge ses dépendances depuis un CDN (esm.sh). Utilisable en local
en double-cliquant sur le fichier, ou via la démo en ligne ci-dessus.

## License

MIT — voir [LICENSE](./LICENSE).
