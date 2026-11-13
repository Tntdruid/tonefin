# Changelog

🇬🇧 English first, 🇩🇰 dansk nedenunder i hver version.

## 0.1.0

🇬🇧
- First version of Tonefin: a portable Windows music player for Jellyfin
- Log in with server, username and password; the login is remembered (the password itself is never stored)
- Log in with Quick Connect instead: the app shows a code you approve in another Jellyfin app
- Browse albums, artists, songs and playlists, and search
- Play albums, artists and playlists with a queue, next/previous, pause, seeking, shuffle, "play next" and "add to queue"
- Album cover in the player bar and a "now playing" page with the queue
- Reports playback to Jellyfin (`Playing`, `Progress` every 10 seconds, `Stopped`) from the main process, retries failed reports, delivers missed stop reports later and announces playback again after sleep or network failures
- Shows in the sidebar whether reporting works, with a log file one click away
- Media keys and the Windows media overlay
- Keeps its settings, login and log in `Tonefin-data` next to the exe
- Falls back to MP3 transcoding for formats the player can't decode, and restarts a broken stream from the same position

🇩🇰
- Første version af Tonefin: en portable musikafspiller til Windows til Jellyfin
- Log ind med server, brugernavn og kodeord; login huskes (selve kodeordet gemmes aldrig)
- Eller log ind med Lyn-forbind: appen viser en kode, du godkender i en anden Jellyfin-app
- Gennemse albums, kunstnere, sange og playlister, og søg
- Afspil albums, kunstnere og playlister med kø, næste/forrige, pause, spoling, bland, "afspil som næste" og "tilføj til kø"
- Albumcover i afspillerlinjen og en "Spiller nu"-side med køen
- Rapporterer afspilning til Jellyfin (`Playing`, `Progress` hvert 10. sekund, `Stopped`) fra hovedprocessen, prøver fejlede rapporter igen, leverer manglende stop-rapporter senere og annoncerer afspilningen igen efter dvale eller netværksfejl
- Viser i sidepanelet, om rapporteringen virker, med logfilen et klik væk
- Medietaster og Windows' medieoverlay
- Gemmer indstillinger, login og log i `Tonefin-data` ved siden af exe'en
- Skifter til MP3-konvertering for formater, afspilleren ikke kan afkode, og genstarter en afbrudt lydstrøm fra samme sted
