# Mietverwaltung

Einfache, buildfreie Web-App zur Mietverwaltung mit [Supabase](https://supabase.com)
als Backend (Auth + Datenbank) und statischem Hosting (z.B. GitHub Pages).

## Stack

- Plain HTML/CSS/JS, kein Build-Tool, keine npm-Abhängigkeiten
- Supabase JS Client per CDN eingebunden
- Supabase Auth (E-Mail/Passwort) für Login
- Postgres-Datenbank mit Row Level Security (RLS)

## Projektstruktur

```
index.html            Einstiegspunkt, Login + Immobilien-Übersicht
css/style.css          Styles
js/config.js            Supabase-URL und Anon-Key
js/supabaseClient.js     Initialisiert den Supabase-Client
js/app.js                App-Logik (Auth, CRUD für Immobilien)
supabase/schema.sql      Datenbankschema + RLS-Policies
```

## Setup

1. **Supabase-Projekt anlegen** unter https://supabase.com/dashboard
2. **Schema einspielen**: Inhalt von `supabase/schema.sql` im
   Supabase Dashboard unter *SQL Editor → New query* ausführen.
3. **Zugangsdaten eintragen**: In `js/config.js` die `url` und den
   `anonKey` des eigenen Projekts hinterlegen (Dashboard → Project
   Settings → API). Nur der **anon/public**-Key gehört hierhin, niemals
   der `service_role`- oder `secret`-Key!
4. **Lokal öffnen**: `index.html` direkt im Browser öffnen, oder mit
   einem einfachen lokalen Server (z.B. `npx serve .`) starten.

## Datenmodell

- `properties` (Immobilien) – gehört einem Nutzer (`user_id`)
- `units` (Wohnungen) – gehört zu einer Immobilie
- `tenants` (Mieter) – gehört zu einer Wohnung
- `payments` (Mietzahlungen) – gehört zu einem Mieter

Aktuell bildet die Oberfläche (`index.html`/`app.js`) nur **Immobilien**
(Anlegen/Auflisten/Löschen) ab. Wohnungen, Mieter und Zahlungen sind im
Schema bereits vorbereitet (inkl. RLS) und können nach demselben Muster
in der UI ergänzt werden.

## Sicherheit

Row Level Security ist auf allen Tabellen aktiv: Ein Nutzer sieht und
verändert ausschließlich Daten, die (direkt oder über die
Eigentümer-Kette Immobilie → Wohnung → Mieter → Zahlung) zu seinem
eigenen Account gehören.

## Deployment (optional)

Da die App komplett statisch ist, kann sie z.B. über GitHub Pages
gehostet werden: Repository-Einstellungen → Pages → Branch auswählen.
