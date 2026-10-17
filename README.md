# quota-band

Zeile über dem Prompt in Claude: 5h-Limit, Wochenlimit (mit Balken, Prozent und Reset-Countdown) und Kontext-Füllstand des aktuellen Chats.
Die Werte kommen direkt aus der laufenden Sitzung – kein Login, kein Cookie, keine Netzwerkabfrage.

## Installation (aus einem GitHub-Repo)

```
/plugin install quota-band --marketplace gknoepfle/claude-quota-band
```

Danach `y` zum Hinzufügen des Marketplace, dann den Scope wählen.

## Lokal ohne GitHub

Ordner entpacken, z. B. nach `C:\Users\<du>\claude-mods\quota-band`, und in der `settings.json` deines Claude-Konfigurationsordners eintragen:

```json
{ "env": { "CLAUDE_CODE_PLUGIN_DIRS": "C:\\Users\\<du>\\claude-mods\\quota-band" } }
```
