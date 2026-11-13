<p align="center"><img src="assets/icon.png" width="160" alt="Jellyfin Music Player logo"></p>

<h1 align="center">Jellyfin Music Player</h1>

🇬🇧 [English](#english) · 🇩🇰 [Dansk](#dansk)

---

## English

A small music player for Windows that plays music from a Jellyfin server and **always reports playback back to Jellyfin**: "now playing", progress every 10 seconds, pause and stop. It was made because Jellyfin Media Player often stops reporting (after sleep or a network change), so plays and skips go missing in [Jellyfin Music Stats](https://github.com/Tntdruid/jellyfin-music-stats) and in Jellyfin's own dashboard. The app itself is in Danish.

- Log in with server address, username and password. The password is not stored; only the access token Jellyfin hands out, encrypted with Windows (DPAPI).
- Or log in with Quick Connect: the app shows a code, which you approve in Jellyfin in the browser or on your phone under **User menu → Quick Connect**
- Browse albums, artists, songs and playlists, and search
- Play an album, artist or playlist with a queue: next/previous, pause, seeking, shuffle, "play next" and "add to queue"
- Album cover and a "now playing" page with the queue
- Media keys and the Windows media overlay work
- Formats the built-in player can't decode are converted to MP3 by Jellyfin automatically

### How reporting stays reliable

Reporting runs in the app's main process, which is never throttled when the window is minimised.

- `POST /Sessions/Playing` when a track starts, `/Sessions/Playing/Progress` every 10 seconds and immediately on pause, resume, seek and volume changes, and `/Sessions/Playing/Stopped` when a track ends, is skipped or the app closes
- A report that fails is retried on the next tick. Stop reports that could not be delivered are queued and sent in order before anything else.
- After sleep, screen unlock or the network coming back, the app reports right away. If nothing got through for more than 4 minutes (Jellyfin drops idle sessions after about 5), playback is announced again with a fresh `Playing`.
- If the audio stream breaks, it is restarted from the same position
- The sidebar shows whether reporting works ("Rapporterer til Jellyfin") or not ("Jellyfin svarer ikke – prøver igen"). "Vis log" opens a log file.

### Running

Download `JellyfinMusicPlayer-<version>-portable.exe` and start it. It isn't code-signed, so Windows SmartScreen may ask you to confirm the first time (**More info → Run anyway**). Settings and the log are stored in `%APPDATA%\Jellyfin Music Player`.

### Development

Requires Node.js 20 or newer.

```bash
npm install
npm start          # run the app
npm test           # unit tests for the reporting
npm run dist       # build dist/JellyfinMusicPlayer-<version>-portable.exe
```

`node dev/mock-jellyfin.js` starts a fake Jellyfin on port 8097 with one album, for trying the app and watching exactly what it reports. `GET /__down?on=1` makes it drop reports to simulate a network failure, and `GET /__log` lists every report. Set `JMP_DATA_DIR` to keep test settings apart from your real ones.

---

## Dansk

En lille musikafspiller til Windows, der spiller musik fra en Jellyfin-server og **altid rapporterer afspilningen tilbage til Jellyfin**: "spiller nu", fremskridt hvert 10. sekund, pause og stop. Den er lavet, fordi Jellyfin Media Player tit holder op med at rapportere (efter dvale eller netværksskift), så lytninger og skips forsvinder i [Jellyfin Music Stats](https://github.com/Tntdruid/jellyfin-music-stats) og i Jellyfins eget kontrolpanel.

- Log ind med serveradresse, brugernavn og kodeord. Kodeordet gemmes ikke, kun den adgangsnøgle Jellyfin giver, krypteret med Windows (DPAPI).
- Eller log ind med Lyn-forbind: appen viser en kode, som du godkender i Jellyfin i browseren eller på telefonen under **Brugermenu → Lyn-forbind**
- Gennemse albums, kunstnere, sange og playlister, og søg
- Afspil et album, en kunstner eller en playliste med kø: næste/forrige, pause, spoling, bland, "afspil som næste" og "tilføj til kø"
- Albumcover og en "Spiller nu"-side med køen
- Medietaster og Windows' medieoverlay virker
- Formater, som den indbyggede afspiller ikke kan afkode, bliver automatisk konverteret til MP3 af Jellyfin

### Sådan forbliver rapporteringen pålidelig

Rapporteringen kører i appens hovedproces, som aldrig bliver sat ned i fart, når vinduet er minimeret.

- `POST /Sessions/Playing`, når et nummer starter, `/Sessions/Playing/Progress` hvert 10. sekund og straks ved pause, genoptagelse, spoling og ændret lydstyrke, og `/Sessions/Playing/Stopped`, når et nummer slutter, springes over, eller appen lukkes
- En rapport, der fejler, prøves igen ved næste tik. Stop-rapporter, der ikke kunne leveres, sættes i kø og sendes i rækkefølge før alt andet.
- Efter dvale, oplåsning af skærmen eller når netværket kommer tilbage, rapporterer appen med det samme. Er intet nået igennem i mere end 4 minutter (Jellyfin dropper inaktive sessioner efter cirka 5), annonceres afspilningen igen med en ny `Playing`.
- Går lydstrømmen i stykker, startes den igen fra samme sted
- Sidepanelet viser, om rapporteringen virker ("Rapporterer til Jellyfin") eller ej ("Jellyfin svarer ikke – prøver igen"). "Vis log" åbner en logfil.

### Kør den

Hent `JellyfinMusicPlayer-<version>-portable.exe` og start den. Den er ikke kodesigneret, så Windows SmartScreen beder dig måske bekræfte første gang (**Flere oplysninger → Kør alligevel**). Indstillinger og log gemmes i `%APPDATA%\Jellyfin Music Player`.

### Udvikling

Kræver Node.js 20 eller nyere.

```bash
npm install
npm start          # kør appen
npm test           # unit-tests af rapporteringen
npm run dist       # byg dist/JellyfinMusicPlayer-<version>-portable.exe
```

`node dev/mock-jellyfin.js` starter en falsk Jellyfin på port 8097 med ét album, så du kan prøve appen og se præcis, hvad den rapporterer. `GET /__down?on=1` får den til at droppe rapporter for at simulere netværksfejl, og `GET /__log` viser alle rapporter. Sæt `JMP_DATA_DIR` for at holde test-indstillinger adskilt fra dine rigtige.
