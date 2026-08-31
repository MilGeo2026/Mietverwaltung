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
index.html                Einstiegspunkt, Login + Sidebar-Navigation
css/style.css              Styles
js/config.js                Supabase-URL und Anon-Key
js/supabaseClient.js         Initialisiert den Supabase-Client
js/app.js                    App-Logik (Auth, CRUD, Nebenkostenberechnung)
supabase/schema.sql          Basis-Datenbankschema + RLS-Policies
supabase/nebenkosten.sql     Zusatzschema für die Nebenkostenabrechnung
```

## Setup

1. **Supabase-Projekt anlegen** unter https://supabase.com/dashboard
2. **Schema einspielen**: Inhalt von `supabase/schema.sql` im
   Supabase Dashboard unter *SQL Editor → New query* ausführen, danach
   zusätzlich `supabase/nebenkosten.sql` (legt die Tabellen für die
   Nebenkostenabrechnung an und ergänzt `tenants` um eine Spalte).
3. **Zugangsdaten eintragen**: In `js/config.js` die `url` und den
   `anonKey` des eigenen Projekts hinterlegen (Dashboard → Project
   Settings → API). Nur der **anon/public**-Key gehört hierhin, niemals
   der `service_role`- oder `secret`-Key!
4. **Lokal öffnen**: `index.html` direkt im Browser öffnen, oder mit
   einem einfachen lokalen Server (z.B. `npx serve .`) starten.

## Datenmodell

- `properties` (Immobilien) – gehört einem Nutzer (`user_id`)
- `units` (Wohnungen) – gehört zu einer Immobilie
- `tenants` (Mieter) – gehört zu einer Wohnung, inkl. monatlicher
  Nebenkosten-Vorauszahlung (`advance_payment_monthly`)
- `payments` (Mietzahlungen) – gehört zu einem Mieter
- `cost_statements` (Nebenkostenabrechnungen) – gehört zu einer Immobilie,
  hat einen Zeitraum (`period_start`/`period_end`)
- `cost_items` (Kostenpositionen) – gehört zu einer Abrechnung, mit
  Umlageschlüssel (`sqm` = nach Wohnfläche, `unit` = gleichmäßig pro Wohnung)

Die Nebenkostenabrechnung verteilt jede Kostenposition anhand ihres
Umlageschlüssels auf alle Wohnungen der Immobilie und vergleicht das
Ergebnis je Wohnung mit der über den Zeitraum geleisteten Vorauszahlung
der zugehörigen Mieter (Nachzahlung/Guthaben).

## Sicherheit

Row Level Security ist auf allen Tabellen aktiv: Ein Nutzer sieht und
verändert ausschließlich Daten, die (direkt oder über die jeweilige
Eigentümer-Kette bis zur Immobilie) zu seinem eigenen Account gehören.

## Deployment (optional)

Da die App komplett statisch ist, kann sie z.B. über GitHub Pages
gehostet werden: Repository-Einstellungen → Pages → Branch auswählen.
