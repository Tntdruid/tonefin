# Changelog

🇬🇧 English first, 🇩🇰 dansk nedenunder i hver version.

## 0.6.0

🇬🇧
- Self-update: when a new version is out, "Update now" downloads it from Tonefin's GitHub release, checks its SHA-256 against the checksum GitHub publishes, starts it and closes the old version. Your queue, login and settings are kept, and the old exe is removed. A file that doesn't match the checksum is deleted and never started.
- Self-update works in the portable exe. When running from source, the button opens the release page as before.

🇩🇰
- Selvopdatering: når der er en ny version, henter "Opdatér nu" den fra Tonefins GitHub-release, tjekker dens SHA-256 mod den checksum, GitHub oplyser, starter den og lukker den gamle version. Din kø, dit login og dine indstillinger bevares, og den gamle exe fjernes. En fil, der ikke passer med checksummen, slettes og startes aldrig.
- Selvopdatering virker i den portable exe. Kører appen fra kildekoden, åbner knappen release-siden som før.

## 0.5.0

🇬🇧
- Play on network players: the speaker button next to the volume slider finds DLNA/UPnP players on your network (receivers such as Denon, Marantz and Yamaha, TVs and speakers) and plays there. The player fetches the music straight from Jellyfin, in the original quality when it supports the format (e.g. FLAC), otherwise as MP3 made by Jellyfin.
- Tonefin keeps reporting to Jellyfin while playing on a network player, and the queue, next/previous, pause, seeking, repeat, media keys and taskbar buttons work as usual. Switching device continues the song where it was, as one continuous listen.
- The volume slider controls the network player's own volume, and Tonefin never changes it unless you move the slider. Closing Tonefin stops the network player.

🇩🇰
- Afspil på netværksafspillere: højttalerknappen ved lydstyrken finder DLNA/UPnP-afspillere på dit netværk (receivere som Denon, Marantz og Yamaha, tv og højttalere) og spiller der. Afspilleren henter musikken direkte fra Jellyfin, i original kvalitet når den kan formatet (fx FLAC), ellers som MP3 lavet af Jellyfin.
- Tonefin bliver ved med at rapportere til Jellyfin, mens der spilles på en netværksafspiller, og kø, næste/forrige, pause, spoling, gentag, medietaster og proceslinjeknapper virker som normalt. Et skift af enhed fortsætter sangen, hvor den var, som én sammenhængende lytning.
- Lydstyrkeskyderen styrer netværksafspillerens egen lydstyrke, og Tonefin ændrer den aldrig, medmindre du flytter skyderen. Når Tonefin lukkes, stopper netværksafspilleren.

## 0.4.1

🇬🇧
- The exe is now also built and tested on GitHub (GitHub Actions) for every release, as a first step towards signed releases. The app itself is unchanged.

🇩🇰
- Exe'en bygges og testes nu også på GitHub (GitHub Actions) ved hver release, som et første skridt mod signerede udgivelser. Selve appen er uændret.

## 0.4.0

🇬🇧
- Dark title bar that blends in with the app and shows what is playing. Windows' own minimise, maximise and close buttons (and Snap layouts) are kept.
- Previous, play/pause and next buttons on Tonefin's taskbar thumbnail
- Instant Mix: start an endless radio from a song, album, artist, playlist or what is playing. More similar songs are added before the queue runs out.
- Playlists from Tonefin: create playlists, add songs (also a whole album or the current song), remove songs, rename and delete playlists, and save the queue as a playlist
- Space no longer starts or pauses music while a dialog is open

🇩🇰
- Mørk titellinje, der flyder sammen med appen og viser, hvad der spiller. Windows' egne knapper til minimér, maksimér og luk (og Snap-layouts) er bevaret.
- Knapper til forrige, afspil/pause og næste på Tonefins miniaturebillede i proceslinjen
- Instant Mix: start en uendelig radio ud fra en sang, et album, en kunstner, en playliste eller det, der spiller. Flere lignende sange tilføjes, før køen løber tør.
- Playlister fra Tonefin: opret playlister, tilføj sange (også et helt album eller det aktuelle nummer), fjern sange, omdøb og slet playlister, og gem køen som playliste
- Mellemrumstasten starter eller pauser ikke længere musikken, mens en dialog er åben

## 0.3.1

🇬🇧
- Artist names are links to the artist's page: on "Now playing", in the player bar, in song lists and in the queue. Songs with several artists get a link per artist.

🇩🇰
- Kunstnernavne er links til kunstnerens side: på "Spiller nu", i afspillerlinjen, i sanglister og i køen. Numre med flere kunstnere får et link pr. kunstner.

## 0.3.0

🇬🇧
- Home page with recently added albums and recently and most played songs
- Albums can be sorted by name, artist, year, date added or randomly, and filtered by genre. The choice is remembered.
- Repeat: the whole queue or the current song. Each repeat counts as a new listen in Jellyfin.
- The queue and position are remembered: after a restart the song waits paused where you left off, and nothing is reported to Jellyfin until you press play
- Equal loudness using Jellyfin's audio normalization, per song or per album (Settings). Requires Jellyfin's "Audio Normalization" task to have run.
- Checks GitHub for new versions at startup and every 6 hours and shows a "new version" button in the sidebar (can be turned off in Settings)
- The app is now in English and Danish. It follows the Windows language, and you can switch under Settings.
- New Settings page

🇩🇰
- Forside med senest tilføjede albums og senest og mest afspillede sange
- Albums kan sorteres efter navn, kunstner, år, dato tilføjet eller tilfældigt og filtreres efter genre. Valget huskes.
- Gentag: hele køen eller det aktuelle nummer. Hver gentagelse tæller som en ny lytning i Jellyfin.
- Køen og positionen huskes: efter en genstart venter nummeret på pause, hvor du slap, og intet rapporteres til Jellyfin, før du trykker afspil
- Ens lydstyrke med Jellyfins lydstyrkenormalisering, pr. nummer eller pr. album (Indstillinger). Kræver, at Jellyfins opgave "Audio Normalization" har kørt.
- Tjekker GitHub for nye versioner ved opstart og hver 6. time og viser en "ny version"-knap i sidepanelet (kan slås fra i Indstillinger)
- Appen findes nu på engelsk og dansk. Den følger Windows' sprog, og du kan skifte under Indstillinger.
- Ny side med indstillinger

## 0.2.2

🇬🇧
- Songs are no longer stored in the cache, which could grow to hundreds of MB in `Tonefin-data`. The cache is capped at 50 MB, and a larger one is emptied when the app starts. Album covers are still cached.
- Security: the build tool's `minimatch` dependency is raised to 11.0.8 (Dependabot alert; it isn't part of the app itself)

🇩🇰
- Sange gemmes ikke længere i cachen, som kunne vokse til flere hundrede MB i `Tonefin-data`. Cachen må højst fylde 50 MB, og er den større, tømmes den, når appen starter. Albumcovers caches stadig.
- Sikkerhed: byggeværktøjets afhængighed `minimatch` er hævet til 11.0.8 (Dependabot-advarsel; den er ikke en del af selve appen)

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
