# Glass Remote

Eine Fernbedienung für die Spotify-App im Liquid-Glass-Look, gebaut als Web-App fürs iPhone. Die Musik läuft weiter in der offiziellen Spotify-App. Glass Remote zeigt nur an, was gerade läuft, und steuert die Wiedergabe über die Spotify Web API.

Technik: Vite, React 19, TypeScript und reines CSS. Es gibt kein Backend: Der Login läuft per Authorization Code Flow mit PKCE direkt im Browser.

## Schnellstart

Voraussetzung ist Node.js 20 oder neuer (LTS von [nodejs.org](https://nodejs.org)).

```bash
npm install
cp .env.example .env   # Client ID eintragen
npm run dev            # → http://127.0.0.1:5173/
```

**Demo ohne Spotify-Konto:** Unter `http://127.0.0.1:5173/?demo` läuft die App gegen einen simulierten Player mit Geräten, Queue und Lautstärke. Das funktioniert nur im Dev-Server; im Produktions-Build ist der Demo-Modus nicht enthalten.

> Spotify akzeptiert seit 2025 kein `localhost` mehr als Redirect-URI. Lokal deshalb immer über `http://127.0.0.1:5173/` arbeiten. Der Dev-Server ist entsprechend konfiguriert.

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Dev-Server auf 127.0.0.1:5173 |
| `npm run build` | Typecheck und Produktions-Build nach `dist/` |
| `npm run preview` | Build lokal ansehen (127.0.0.1:4173) |
| `npm run icons:custom` | Standard-Icon aus `assets/icon-chrome-source.jpg` erzeugen (macOS, nutzt `sips`) |
| `npm run icons` | App-Icons neu rendern (`scripts/generate-icons.mjs`, mit `-- --preview datei.png` als Vorschaubild) |

## Checkliste: Was du im Spotify-Dashboard einträgst

1. Auf [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) **Create app** wählen.
   - *Which API/SDKs*: **Web API** ankreuzen.
   - *Redirect URIs*: beide eintragen, jeweils exakt mit abschließendem `/`:
     - `http://127.0.0.1:5173/` (lokal)
     - deine HTTPS-Adresse, z. B. `https://<user>.github.io/<repo>/` oder `https://<projekt>.vercel.app/`
2. Die **Client ID** aus *Settings* kopieren. Sie ist kein Geheimnis, ein Client Secret brauchst du nicht.
3. Unter **User Management** die E-Mail deines Spotify-Kontos eintragen. Im Development Mode sind höchstens 5 Nutzer erlaubt.
4. Für die Steuerung brauchst du **Spotify Premium**. Seit Februar 2026 muss außerdem der Besitzer der App Premium haben, sonst funktioniert die App gar nicht.
5. Die Werte eintragen:

| Wo | `VITE_SPOTIFY_CLIENT_ID` | `VITE_REDIRECT_URI` |
| --- | --- | --- |
| lokal: `.env` | Client ID | `http://127.0.0.1:5173/` |
| GitHub: Settings → Secrets and variables → Actions → **Variables** | Client ID | `https://<user>.github.io/<repo>/` |
| Vercel: Project → Settings → Environment Variables | Client ID | `https://<projekt>.vercel.app/` |

Die Redirect-URI muss Zeichen für Zeichen mit dem Dashboard übereinstimmen. Lässt du `VITE_REDIRECT_URI` leer, nimmt die App ihre eigene Adresse.

## Deployment

### GitHub Pages (Workflow liegt bei)

1. Ein Repo anlegen und den Projektordner auf den Branch `main` pushen.
2. Unter **Settings → Pages → Source** die Option **GitHub Actions** wählen.
3. Unter **Settings → Secrets and variables → Actions → Variables** die Variablen `VITE_SPOTIFY_CLIENT_ID` und `VITE_REDIRECT_URI` anlegen.
4. Pushen. `.github/workflows/deploy.yml` baut die App und veröffentlicht sie. Weil `base: './'` relativ ist, funktioniert das auch unter `/<repo>/`.

### Vercel

1. Auf vercel.com **Add New → Project** wählen und das Repo importieren. Vite wird automatisch erkannt (Build: `npm run build`, Output: `dist`).
2. Die beiden Environment Variables setzen und deployen.
3. Die Vercel-URL als Redirect-URI im Spotify-Dashboard ergänzen.

## Auf dem iPhone installieren

1. Die HTTPS-Adresse in **Safari** öffnen.
2. Auf **Teilen** tippen, dann **Zum Home-Bildschirm**, dann **Hinzufügen**.
3. Die App **vom Home-Bildschirm** starten und dort auf **Mit Spotify verbinden** tippen. Den Login unbedingt in der installierten App testen, nicht nur in Safari.
4. Spotify auf einem Gerät öffnen und etwas abspielen. Glass Remote zeigt es dann an.

> **Icon zeigt nur ein „G“?** iOS 26 hat einen Fehler mit Icons aus dem Web-Manifest ([WebKit-Bug 256429](https://onbugs.webkit.org/show_bug.cgi?id=256429)): Die Vorschau stimmt, auf dem Home-Bildschirm landet aber der Anfangsbuchstabe. Das Manifest enthält deshalb bewusst keine `icons`, und iOS nimmt `apple-touch-icon.png`. Nach einer Icon-Änderung das alte Icon löschen und die Seite neu hinzufügen.

### Login-Fallback (iOS Standalone)

Safari und Home-Bildschirm-Apps haben unter iOS getrennten Speicher. Die App startet den Login deshalb im selben Fenster (`window.location.assign`), und die Redirect-URI führt zurück auf dieselbe Origin. Landet die Rückleitung trotzdem in Safari, meldet die App „Die Anmeldung ist in einem anderen Fenster gelandet …“. Dann so vorgehen:

1. In **Safari** die Seite öffnen und dort anmelden.
2. Geräte-Sheet öffnen (Pille oben links) und **Anmeldung für Home-Bildschirm-App kopieren** antippen.
3. Die **installierte App** öffnen und auf **Login klappt nicht? Anmeldung einfügen** tippen. Den Code einfügen, fertig.

Der Code enthält dein Refresh-Token. Teile ihn mit niemandem.

## Was die App macht

**Aufbau wie Spotify:** Unten liegt eine Tab-Leiste mit *Start · Suchen · Bibliothek*, darüber ein Mini-Player. Antippen öffnet den großen Player, Herunterziehen schließt ihn wieder.

- **Start:** Begrüßung, Kacheln deiner zuletzt genutzten Alben und Playlists, dazu die Bereiche „Zuletzt gehört“, „Deine Top-Künstler“, „Gerade oft gehört“ und „Deine Playlists“.
- **Suchen:** Titel, Künstler, Alben und Playlists, höchstens 10 Treffer pro Typ (Limit im Development Mode). Antippen spielt ab, „+“ hängt einen Titel an die Warteschlange.
- **Bibliothek:** Playlists, Top-Künstler und zuletzt gehörte Titel.
- **Gerätewahl:** Läuft nichts und es ist unklar, wo abgespielt werden soll, fragt die App „Wo abspielen?“ und merkt sich die Wahl. Fehlt das iPhone in der Liste, schläft die Spotify-App dort. Der Knopf „Spotify-App öffnen“ weckt sie auf.

- **Detailseiten:** Playlists, Alben und Künstler öffnen sich mit ihrer Titelliste, statt sofort abzuspielen. Zum Abspielen den großen ▶︎-Knopf, Zufall oder einen einzelnen Titel antippen. Bei fremden Playlists liefert Spotify im Development Mode keine Titel. Abspielen geht trotzdem. Künstlerseiten zeigen Alben und Singles, weil „Top-Titel“ im Development Mode entfernt wurde.
- **Darstellung (Zahnrad auf der Startseite):** Akzentfarbe (vom Cover oder fest), Hintergrund (Cover / Nur Farben / Schlicht), Glasstärke, Bewegung der Farbflecken und App-Icon. Die Einstellungen gelten pro Gerät. Ein neues App-Icon übernimmt iOS erst, wenn du die Seite neu zum Home-Bildschirm hinzufügst.

- **„…“-Menü bei jedem Titel und jeder Folge:** liken, zur Warteschlange, zu einer Playlist hinzufügen, aus der eigenen Playlist entfernen, Album bzw. Künstler anzeigen, teilen.
- **Playlists:** erstellen (Bibliothek → „+“ oder „Neue Playlist“ beim Hinzufügen), bearbeiten (Name, Beschreibung, öffentlich), löschen. Alben, fremde Playlists, Podcasts und Hörbücher lassen sich per Herz speichern bzw. folgen. Das Herz im großen Player liked den laufenden Titel.
- **Nicht möglich** (keine Web-API): Songtexte, Jam, Downloads, DJ, Radio/Empfehlungen, Freundesaktivität, Schlaf-Timer, Künstlern folgen, Playlist-Cover hochladen.

Start, Bibliothek und Bearbeiten brauchen zusätzliche Berechtigungen (siehe `PERSONAL_SCOPES` in `src/config.ts`). Sitzungen aus älteren Versionen sehen deshalb den Knopf „Neu mit Spotify verbinden“.


- **Polling:** Alle 1,5 s, solange Musik läuft, und alle 4 s im Leerlauf. Dazwischen zählt der Fortschritt lokal per `requestAnimationFrame` hoch. Ist die App im Hintergrund, pausiert das Polling (`visibilitychange`). Alle Development-Mode-Apps eines Kontos teilen sich ein Kontingent, deshalb ist das Intervall bewusst nicht kürzer.
- **Optimistische UI:** Play/Pause, Shuffle, Repeat, Seek und Lautstärke reagieren sofort. Ein optimistischer Wert gilt bis zu 3 s lang, bis der Poll ihn bestätigt. Schlägt der Befehl fehl, wird er zurückgenommen und sofort neu gepollt. Die Lautstärke wird gedrosselt gesendet, höchstens alle 300 ms.
- **Fehler:**
  - `401`: Token-Refresh und ein zweiter Versuch. Ist das Refresh-Token ungültig, erscheint wieder der Login.
  - `204` oder kein Gerät: der Leerzustand „Starte Spotify und spiele etwas ab“ mit Geräteauswahl.
  - `429`: `Retry-After` wird beachtet, `QUOTA_EXCEEDED` erkannt.
  - `403 PREMIUM_REQUIRED`: ein dauerhafter Hinweis.
  - `403` mit „nicht in User Management“: eine eigene Fehlerseite.
  - Netzwerkfehler: Toast und ein neuer Versuch.
- **Gesperrte Aktionen:** `actions.disallows` von Spotify deaktiviert die passenden Buttons, z. B. während Werbung.
- **Lautstärke:** Der Regler erscheint nur, wenn das Gerät `supports_volume` meldet. iPhones melden das meist nicht.

## Projektstruktur

```
src/
  auth/        PKCE, Token-Speicher, Refresh, Login-Übertragung
  api/         fetch-Wrapper mit Fehler-Mapping, Player-Endpunkte, Typen
  player/      Polling-Engine mit optimistischen Overrides, usePlayer-Hook
  components/  Glas-Buttons, Slider, Cover, Hintergrund, Sheet, Toasts
  screens/     Login, NowPlaying, Idle, Queue- und Geräte-Sheet
  lib/         Farbextraktion, Formatierung, Toast-Store
  styles/      tokens.css (Design-Tokens), glass.css (Material), app.css
  dev/demo.ts  simulierter Player (nur Dev)
sw/sw.js       Service Worker (App-Shell); beim Build mit Asset-Liste befüllt
```

Verwendete Endpunkte: `GET /me/player`, `PUT /me/player/play|pause`, `POST /me/player/next|previous`, `PUT /me/player/seek|shuffle|repeat|volume`, `GET /me/player/queue`, `GET /me/player/devices` und `PUT /me/player` (Transfer). Keiner davon ist von den Development-Mode-Änderungen 2026 betroffen.

## Design-Tokens (für Phase 2 / SwiftUI)

Alle Werte stehen in `src/styles/tokens.css` und sind nach SwiftUI-Begriffen benannt:

| CSS-Token | SwiftUI-Entsprechung |
| --- | --- |
| `--color-label-primary / -secondary / -tertiary` | `Color.primary`, `.secondary`, `Color(.tertiaryLabel)` |
| `--glass-fill-clear / -regular / -prominent` | `.glassEffect(.clear)`, `.glassEffect(.regular)`, `.glassEffect(.regular.tint(…))` |
| `--glass-tint-text / -thick` | dunklere Glasstufe für Text bzw. Sheets |
| `--radius-s/m/l/xl` (14/20/28/32) | `RoundedRectangle(cornerRadius:)` |
| `--space-2xs … xl` (4–32) | `padding` / `spacing` |
| `--control-size-s/m/l` (44/52/76) | Button-Frames |
| `--motion-spring-smooth` | `.spring(duration: 0.6, bounce: 0.03)` |
| `--motion-spring-bouncy` | `.spring(duration: 0.5, bounce: 0.1)` |
| `--motion-press-scale` (0.96) | `.scaleEffect` beim Drücken |

Liquid Glass ohne `backdrop-filter: url(#svg)`, das iOS-Safari nicht unterstützt: Die Lichtbrechung entsteht aus `backdrop-filter: blur() saturate()`, einem 1-px-Verlaufsrand per Maske, einem inneren Highlight-Schatten, einem Sheen-Verlauf und einem radialen Glanzpunkt. Textflächen bekommen eine dunkle Grundtönung. Zusätzlich wird ein Scrim über dem Hintergrund stärker, je heller das Cover ist (gemessene Luminanz), damit weißer Text WCAG AA hält.

Performance: Echte Blur-Flächen gibt es nur wenige (Hintergrund-Cover, Panel, zwei Top-Buttons, Sheet). Die Buttons im Panel haben keinen eigenen Blur. Die Farb-Blobs sind radiale Verläufe ohne Filter und werden nur per `transform` animiert. Der Fortschrittsbalken schreibt direkt ins DOM, statt React neu rendern zu lassen. `prefers-reduced-motion` schaltet die Blobs und Federeffekte ab.

## Grenzen dieser Version

- Kein Audio in der App (iOS-Browser unterstützen das Web Playback SDK nicht) und keine eigene Anzeige auf dem Sperrbildschirm.
- In der Queue kann man nicht auf einen Titel tippen, um ihn abzuspielen, weil die API das nicht anbietet.
- Spotify-Refresh-Tokens können nach einiger Zeit ablaufen. Dann erscheint einfach wieder der Login.
