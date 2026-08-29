# 🍷 Schorle Teller

Een simpele, mobielvriendelijke web-app om bij te houden hoeveel Schorles je drinkt op de Bad Dürkheim Wurstmarkt.

## Features

- Eén grote knop om een Schorle te loggen (met timestamp)
- Undo en reset
- Overzicht: totaal, aantal vandaag, laatste Schorle
- Prijs per Schorle instelbaar → totaal uitgegeven bedrag
- Geschiedenis gegroepeerd per dag
- Werkt volledig offline (PWA) en is te installeren op het beginscherm van zowel **Android** als **iOS**
- Solo-gebruik werkt zonder backend of account — alles lokaal op je telefoon (`localStorage`)
- **Groepen:** maak een groep aan, deel de code of link, en zie de live tussenstand van iedereen die meedoet (vereist eenmalige Supabase-koppeling, zie hieronder)
- **Meertalig:** Nederlands, Engels en Duits, te wisselen met de NL/EN/DE-knoppen rechtsboven (onthoudt je keuze, start standaard op de taal van je telefoon)

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

## Groepen instellen (eenmalig)

Groepen hebben een gedeelde database nodig zodat de tussenstand voor iedereen zichtbaar is. Dat regel je met een gratis [Supabase](https://supabase.com)-project — geen creditcard nodig.

1. Maak een gratis account op [supabase.com](https://supabase.com) en klik op **New project**.
2. Ga naar **SQL Editor** → **New query**, plak de inhoud van [`supabase/schema.sql`](supabase/schema.sql) en klik op **Run**. Dit maakt de tabellen, de tussenstand-view en de toegangsregels aan, en zet live-updates aan.
3. Ga naar **Project Settings** → **API**. Kopieer de **Project URL** en de **anon public** key.
4. Plak beide in [`js/supabase-config.js`](js/supabase-config.js):
   ```js
   window.SCHORLE_SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
   window.SCHORLE_SUPABASE_ANON_KEY = 'eyJ...';
   ```
5. Herlaad de app — de sectie "Groep" verschijnt nu boven de instellingen, met de knoppen "Groep aanmaken" en "Groep joinen".

**Hoe het werkt:** wie een groep aanmaakt krijgt een korte code (en een deelbare link). Anderen vullen alleen hun naam in om mee te doen — geen wachtwoord. De "+ Schorle"-knop telt dan mee in de groep, en de tussenstand van alle leden wordt live bijgewerkt zodra iemand drinkt. Zonder Supabase-configuratie blijft de app gewoon solo werken zoals hierboven beschreven.

> **Let op:** er is bewust geen inlogsysteem, dus de groepscode is de enige toegangsdrempel — deel 'm alleen met mensen die je vertrouwt. Groepsfuncties vereisen internetverbinding; solo-tellen blijft offline werken.

## Structuur

```
index.html               – de pagina
css/style.css             – styling
js/app.js                 – telling, opslag, weergave (solo + groep)
js/group.js                – groep aanmaken/joinen, tussenstand, live updates
js/i18n.js                  – vertalingen NL/EN/DE en taalwissel
js/supabase-config.js      – jouw Supabase-projectgegevens (zie boven)
manifest.json              – PWA-manifest (Android)
sw.js                      – service worker (offline gebruik)
icons/                     – app-iconen
supabase/schema.sql        – database-schema voor groepen (eenmalig uitvoeren)
```
