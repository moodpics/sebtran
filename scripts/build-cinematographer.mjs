// Génère la version « domaine » du site (celle de sebastien-tran.com) à partir des sources de ce dépôt.
// Depuis nov. 2026 la version domaine est la DOUBLE PAGE complète : onglets Cinematographer + Director / DP.
// Seules différences avec le site complet : URLs et SEO au nom du domaine, CNAME, cache-busting.
// (Le nom du script et du dépôt cible « CinematographerOnly » est conservé pour ne pas casser le workflow.)
// Usage :  node scripts/build-cinematographer.mjs [dossier-de-sortie]
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";

const OUT = path.resolve(process.argv[2] || "dist-cine");
const DOMAIN = "sebastien-tran.com";
const SRC_URL = "https://moodpics.github.io/sebtran/";
const read = f => fs.readFileSync(f, "utf8");
const write = (f, s) => { fs.mkdirSync(path.dirname(path.join(OUT, f)), { recursive: true }); fs.writeFileSync(path.join(OUT, f), s); };
const toDomain = s => s.split(SRC_URL).join(`https://${DOMAIN}/`);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// 1. fichiers copiés tels quels (code complet : films, app, styles)
for (const f of ["style.css", "app.js", "films.js", "apple-touch-icon.png", "favicon-32.png", "favicon.ico", "favicon.svg", "icon-512.png", "icon-192.png", "site.webmanifest", "operandi-logo.png"]) {
  fs.copyFileSync(f, path.join(OUT, f));
}
write("CNAME", DOMAIN + "\n");
// anciennes adresses du site Wix (ex. /beauty) : redirection vers l'accueil + page 404 qui ramène à l'accueil
write("beauty/index.html", toDomain(read("beauty/index.html")));
write("404.html", read("404.html"));

// 2. index.html : URLs au nom du domaine + cache-busting (?v= = empreinte du contenu)
let html = toDomain(read("index.html"));
const stamp = f => crypto.createHash("sha1").update(fs.readFileSync(path.join(OUT, f))).digest("hex").slice(0, 8);
for (const f of ["style.css", "app.js", "films.js"]) html = html.replace(new RegExp(`(${f.replace(".", "\\.")}\\?v=)[^"']+`), (_, a) => a + stamp(f));
write("index.html", html);

// 3. llms.txt / sitemap.xml
write("llms.txt", toDomain(read("llms.txt")));
write("sitemap.xml", toDomain(read("sitemap.xml")));

const note = "> ⚠️ **Dépôt généré automatiquement** depuis [moodpics/sebtran](https://github.com/moodpics/sebtran) (script `scripts/build-cinematographer.mjs`).\n> Ne rien modifier ici : toute modification sera écrasée au prochain push sur `sebtran`.\n\n";
write("README.md", note + read("README.md"));

const w = {}; vm.runInNewContext(read("films.js"), { window: w });
console.log(`Version domaine (double page) générée dans ${OUT} (${w.FILMS.cinematography.length} films cinéma, ${w.FILMS.direction.length} films direction)`);
