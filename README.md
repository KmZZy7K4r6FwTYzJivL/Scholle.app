# 🍷 Schorle Teller

Een simpele, mobielvriendelijke web-app om bij te houden hoeveel Schorles je drinkt op de Bad Dürkheim Wurstmarkt.

## Features

- Eén grote knop om een Schorle te loggen (met timestamp)
- Undo en reset
- Overzicht: totaal, aantal vandaag, laatste Schorle
- Prijs per Schorle instelbaar → totaal uitgegeven bedrag
- Geschiedenis gegroepeerd per dag
- Werkt volledig offline (PWA) en is te installeren op het beginscherm van zowel **Android** als **iOS**
- Geen backend, geen account — alles wordt lokaal opgeslagen op je telefoon (`localStorage`)

## Gebruiken

Open `index.html` in een browser, of host de map (bv. GitHub Pages, Netlify, of een simpele static server):

```bash
python3 -m http.server 8080
```

en open `http://localhost:8080`.

### Installeren op je telefoon

- **Android (Chrome):** menu (⋮) → "App installeren" / "Toevoegen aan startscherm"
- **iOS (Safari):** deelknop (□↑) → "Zet op beginscherm"

Eenmaal geïnstalleerd werkt de app als een gewone app-icoon en functioneert hij offline, ideaal voor op de Wurstmarkt zelf.

## Structuur

```
index.html       – de pagina
css/style.css     – styling
js/app.js         – telling, opslag, weergave
manifest.json     – PWA-manifest (Android)
sw.js             – service worker (offline gebruik)
icons/            – app-iconen
```
