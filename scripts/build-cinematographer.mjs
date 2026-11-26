// Génère la version « Cinematography seule » du site (sans la partie Director / DP).
// Elle est publiée sur moodpics/sebtran-CinematographerOnly (https://moodpics.github.io/sebtran-CinematographerOnly/),
// uniquement pour pouvoir partager la page cinématographie seule. Le site officiel (sebastien-tran.com) est moodpics/sebtran.
// Usage :  node scripts/build-cinematographer.mjs [dossier-de-sortie]
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";

const OUT = path.resolve(process.argv[2] || "dist-cine");
const SRC_URL = "https://sebastien-tran.com/";                                   // adresses des sources (site officiel)
const CINE_URL = "https://moodpics.github.io/sebtran-CinematographerOnly/";       // adresses de la version cinéma seule
const read = f => fs.readFileSync(f, "utf8");
const write = (f, s) => { fs.mkdirSync(path.dirname(path.join(OUT, f)), { recursive: true }); fs.writeFileSync(path.join(OUT, f), s); };
const toCine = s => s.split(SRC_URL).join(CINE_URL);
// remplace exactement une fois ; si la source change et que le motif disparaît, le build échoue (jamais de sync silencieusement cassée)
const sub = (s, from, to, name) => {
  const hit = typeof from === "string" ? s.includes(from) : from.test(s);
  if (!hit) throw new Error(`Motif introuvable (${name}) — adapter scripts/build-cinematographer.mjs`);
  return s.replace(from, typeof to === "function" ? to : () => to);
};

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// 1. fichiers copiés tels quels (pas de CNAME : le domaine est sur moodpics/sebtran ; pas de projets/ : pages d'équipe, sur le site officiel)
for (const f of ["style.css", "apple-touch-icon.png", "favicon-32.png", "favicon.ico", "favicon.svg", "icon-512.png", "icon-192.png", "site.webmanifest", "operandi-logo.png", "nowness-picks.svg", "award-frejus.svg", "award-nikon.svg", "award-prix.svg", "award-sens.svg"]) {
  fs.copyFileSync(f, path.join(OUT, f));
}
write("beauty/index.html", toCine(read("beauty/index.html")));
write("404.html", read("404.html"));

// 2. films.js : la liste « direction » est vidée
const filmsSrc = read("films.js");
const w = {}; vm.runInNewContext(filmsSrc, { window: w });
const cine = w.FILMS.cinematography;
const films = sub(filmsSrc, /("direction":\s*)\[[\s\S]*?\n  \](,\s*\n\s*"cinematography")/, (_, a, b) => `${a}[]${b}`, "films.js direction");
write("films.js", films);

// 3. app.js : les anciens liens #direction retombent sur cinematography
const app = sub(read("app.js"), "location.hash.slice(1), hashMode", 'location.hash.slice(1).replace(/^direction/, "cinematography"), hashMode', "app.js hash");
write("app.js", app);

// 4. index.html : sans l'onglet Director / DP, adresses de cette version, non indexée (le site officiel reste la référence)
let html = toCine(read("index.html"));
html = sub(html, /\s*<button[^>]*data-mode="direction">[^<]*<\/button>/, "", "switch Director");
html = sub(html, /\s*<h3>Direction — [\s\S]*?<\/ul>/, "", "SEO direction");
html = sub(html, /<meta name="robots" content="[^"]*">/, '<meta name="robots" content="noindex, follow">', "robots");
// mentions « aussi réalisateur » retirées des textes (description, partage, données structurées, index crawlable)
for (const t of [[" Also a director / DP.", ""], [", and also directs.", "."], [" Il est aussi réalisateur.", ""]]) {
  html = sub(html, t[0], "", "texte " + t[0]).split(t[0]).join(t[1]);
}
const stamp = f => crypto.createHash("sha1").update(fs.readFileSync(path.join(OUT, f))).digest("hex").slice(0, 8);
for (const f of ["style.css", "app.js", "films.js"]) html = html.replace(new RegExp(`(${f.replace(".", "\\.")}\\?v=)[^"']+`), (_, a) => a + stamp(f));
write("index.html", html);

const note = "> ⚠️ **Dépôt généré automatiquement** depuis [moodpics/sebtran](https://github.com/moodpics/sebtran) (script `scripts/build-cinematographer.mjs`).\n> Version « Cinematography seule », à partager telle quelle. Le site officiel est `sebastien-tran.com` (dépôt `moodpics/sebtran`).\n> Ne rien modifier ici : toute modification sera écrasée à la prochaine synchro.\n\n";
write("README.md", note + read("README.md"));

console.log(`Version cinématographie seule générée dans ${OUT} (${cine.length} films)`);
