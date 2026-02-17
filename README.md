# IPSC Match Scanner

Web-App, die den Matchkalender von `https://ipscmatch.de` stündlich scannt und Matches nach Level filtert sowie nach Datum oder Entfernung sortiert.

## Features
- Stündlicher Auto-Scan via Cron (`0 * * * *`)
- Manueller Scan per Button oder API
- Filter nach mehreren Leveln (z. B. `2,3,4`)
- Sortierung nach Datum oder Entfernung
- Individueller Ort für Distanzberechnung (Geocoding via Nominatim + Cache)

## Start
1. Abhängigkeiten installieren:
   ```bash
   npm install
   ```
2. Optional Konfiguration setzen:
   ```bash
   cp .env.example .env
   ```
3. Starten:
   ```bash
   npm start
   ```
4. Öffnen: `http://localhost:3000`

## API
- `POST /api/scan` startet einen Scan.
- `GET /api/status` zeigt Scan-Status.
- `GET /api/matches?level=2,3&sort=date|distance&origin=Muenchen`

## Hinweise

## Statische Bereitstellung (Webspace)

Wenn du nur klassischen Webspace ohne Node‑Prozess hast, kannst du die UI als statische Seite exportieren und hochladen:

1. Stelle sicher, dass `data/matches.json` vorhanden ist (lokal oder auf einem Server):
   ```bash
   # lokal: starte server und löse manuellen Scan aus
   npm start
   # in anderem Terminal:
   curl -X POST http://localhost:3000/api/scan
   ```

2. Erzeuge den statischen Export:
   ```bash
   npm run export
   # Ergebnis liegt in ./dist
   ```

3. Lade den Inhalt von `dist/` per FTP/SFTP auf deinen Webspace. Die Seite lädt `matches.json` von dort.

Hinweis: Der Scraper selbst muss irgendwo regelmäßig laufen (z. B. dein Rechner, ein VPS oder GitHub Actions), damit `data/matches.json` aktualisiert und erneut nach `dist/` exportiert wird. Alternativ kannst du die Datei manuell neu exportieren und hochladen.

## Docker / Synology (Container)

Wenn du die App als Container betreiben willst (z. B. auf einer Synology NAS oder einem VPS), gibt es zwei einfache Wege im Repo:


```bash
# Baue das Image
docker build -t matchkalender:latest .

# Starte (lokal) und mappe Port 3000
docker run -d --name matchkalender -p 3000:3000 -v $(pwd)/data:/app/data --restart unless-stopped matchkalender:latest
```


```bash
docker compose up -d --build
```

Hinweise für Synology:

Hinweis: Die optimierte Multi‑Stage `Dockerfile` ist jetzt im Repo (`Dockerfile`) und erzeugt kompaktere Produktions-Images. Baue das Image wie oben gezeigt.

Empfohlene Umgebungvariablen (docker-compose / Container):

Wenn du willst, erstelle ich ein `systemd` Service‑File, ein Multi‑stage Dockerfile (kleineres Image), oder ein GitHub Actions Workflow, das auf deine Synology per SSH/SFTP deployed. Welche Option bevorzugst du?

### Portainer Stack

Du kannst die App als Stack in Portainer deployen. Datei `portainer-stack.yml` ist im Repo hinzugefügt.

Vorgehen:
- In Portainer: Stacks → Add stack → Upload `portainer-stack.yml` oder Deploy from Git (Repo-URL).
- Wenn du Portainer aus dem Git-Repository deployst, baut Portainer das Image automatisch anhand des `build:`-Kontexts.
- Nach Deploy erreichst du die App unter `http://<nas-ip>:3000` (oder konfiguriere Reverse Proxy für HTTPS).

Hinweis: Das Stack verwendet ein Named Volume `data` für `matches.json` — so bleiben Daten persistent.
