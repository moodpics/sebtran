// Génère la version « Cinematography seule » du site (celle de sebastien-tran.com)
// à partir des sources de ce dépôt.   Usage :  node scripts/build-cinematographer.mjs [dossier-de-sortie]
// Sortie par défaut : ./dist-cine   (le workflow GitHub l'envoie sur moodpics/sebtran-CinematographerOnly)
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";

const OUT = path.resolve(process.argv[2] || "dist-cine");
const DOMAIN = "sebastien-tran.com";
const SRC_URL = "https://moodpics.github.io/sebtran/";
const read = f => fs.readFileSync(f, "utf8");
const write = (f, s) => { fs.mkdirSync(path.dirname(path.join(OUT, f)), { recursive: true }); fs.writeFileSync(path.join(OUT, f), s); };
// remplace exactement une fois ; si la source change et que le motif disparaît, le build échoue (jamais de sync silencieusement cassée)
const sub = (s, from, to, name) => {
  const hit = typeof from === "string" ? s.includes(from) : from.test(s);
  if (!hit) throw new Error(`Motif introuvable (${name}) — adapter scripts/build-cinematographer.mjs`);
  return s.replace(from, typeof to === "function" ? to : () => to);
};

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// 1. fichiers copiés tels quels
for (const f of ["style.css", "README.md", "apple-touch-icon.png", "favicon-32.png", "favicon.ico", "favicon.svg", "icon-512.png"]) {
  fs.copyFileSync(f, path.join(OUT, f));
}
write("CNAME", DOMAIN + "\n");

// 2. films.js : la liste « direction » est vidée
const filmsSrc = read("films.js");
const w = {}; vm.runInNewContext(filmsSrc, { window: w });
const cine = w.FILMS.cinematography;
let films = sub(filmsSrc, /("direction":\s*)\[[\s\S]*?\n  \](,\s*\n\s*"cinematography")/, (_, a, b) => `${a}[]${b}`, "films.js direction");
films = sub(films, "lists: 'cinematography' (DoP work) and 'direction' (films you directed).", "list: 'cinematography' (DoP work); 'direction' is intentionally empty on this cinematographer-only site.", "films.js header");
write("films.js", films);

// 3. app.js : texte de la sélection + les anciens liens #direction retombent sur cinematography
let app = read("app.js");
app = sub(app, "cinematography and direction.", "cinematography.", "app.js about");
app = sub(app, "location.hash.slice(1), hashMode", 'location.hash.slice(1).replace(/^direction/, "cinematography"), hashMode', "app.js hash");
write("app.js", app);

// 4. index.html
let html = read("index.html");
html = html.split(SRC_URL).join(`https://${DOMAIN}/`);
html = sub(html, /\s*<button[^>]*data-mode="direction">Director<\/button>/, "", "switch Director");
html = sub(html, /\s*<h3>Direction — [\s\S]*?<\/ul>/, "", "SEO direction");
html = html.split(" Also a director.").join("");
html = html.split(", also a director").join("");
// cache-busting : ?v= = empreinte du contenu, donc les navigateurs rechargent dès que le CSS/JS change
const stamp = f => crypto.createHash("sha1").update(fs.readFileSync(path.join(OUT, f))).digest("hex").slice(0, 8);
for (const f of ["style.css", "app.js", "films.js"]) html = html.replace(new RegExp(`(${f.replace(".", "\\.")}\\?v=)[^"']+`), (_, a) => a + stamp(f));
write("index.html", html);

// 5. llms.txt / sitemap.xml
let llms = read("llms.txt").split(SRC_URL).join(`https://${DOMAIN}/`);
llms = sub(llms, "Role: Director of photography (cinematographer); also director", "Role: Director of photography (cinematographer)", "llms role");
llms = sub(llms, /\n- \[Portfolio — direction\][^\n]*/, "", "llms direction");
llms = llms.split(" He also directs.").join("");
write("llms.txt", llms);
write("sitemap.xml", read("sitemap.xml").split(SRC_URL).join(`https://${DOMAIN}/`));

const note = "> ⚠️ **Dépôt généré automatiquement** depuis [moodpics/sebtran](https://github.com/moodpics/sebtran) (script `scripts/build-cinematographer.mjs`).\n> Ne rien modifier ici : toute modification sera écrasée au prochain push sur `sebtran`.\n\n";
write("README.md", note + read("README.md"));

console.log(`Version cinématographie générée dans ${OUT} (${cine.length} films)`);
