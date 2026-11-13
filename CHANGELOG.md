# Changelog

🇬🇧 English first, 🇩🇰 dansk nedenunder i hver version.

## 0.2.1

🇬🇧
- Hearts and playlists made on the server show up without restarting, e.g. from the Auto Artist Playlists plugin: the heart of the playing song is checked every 30 seconds and after each song, and the playlists in the sidebar are refreshed after a song ends

🇩🇰
- Hjerter og playlister, der laves på serveren, vises uden genstart, fx fra pluginet Auto Artist Playlists: hjertet på det nummer, der spiller, tjekkes hvert 30. sekund og efter hvert nummer, og playlisterne i sidepanelet opdateres, når et nummer slutter

## 0.2.0

🇬🇧
- Favourites: a new "Favoritter" page with your favourite songs, albums and artists
- Heart buttons on tracks, albums, artists, the "now playing" page and the player bar to add or remove favourites (synced with Jellyfin)
- Your playlists are listed in the sidebar and open with one click
- Playlists that Jellyfin hasn't marked as audio are shown now (before, only playlists marked "Audio" appeared)

🇩🇰
- Favoritter: en ny "Favoritter"-side med dine favoritsange, -albums og -kunstnere
- Hjerte-knapper på numre, albums, kunstnere, "Spiller nu"-siden og afspillerlinjen til at tilføje eller fjerne favoritter (synkroniseres med Jellyfin)
- Dine playlister vises i sidepanelet og åbnes med ét klik
- Playlister, som Jellyfin ikke har markeret som lyd, vises nu (før kom kun playlister markeret "Audio" med)

## 0.1.1

🇬🇧
- The volume slider follows how we hear loudness: low settings are now actually quiet (50 % is about -18 dB, 20 % about -42 dB) instead of almost as loud as full volume

🇩🇰
- Lydstyrke-slideren følger, hvordan øret opfatter lydstyrke: lave indstillinger er nu faktisk lave (50 % er cirka -18 dB, 20 % cirka -42 dB) i stedet for næsten lige så høje som fuld styrke

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
