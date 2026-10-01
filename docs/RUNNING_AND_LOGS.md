# Running the game and retrieving playtest data

## Development server

In the checkout you intend to serve, check `git branch --show-current` and `git status`, then:

```sh
npm install
npm run dev -- --host 0.0.0.0 --port 5180
```

For the WSL checkout from Windows PowerShell:

```powershell
wsl -d Ubuntu-24.04 -- bash -lc 'cd /home/sd/Code2/battler/edgebattler && npm run dev -- --host 0.0.0.0 --port 5180'
```

If Node uses nvm, load it in that shell or prepend its installed binary directory. The original checkout may be on a feature branch; check first. A separate worktree can serve main without switching another task's checkout. Port 5180 is an example; use Vite's printed address if occupied.

## Phone over Wi-Fi or Tailscale

On the same Wi-Fi, open `http://<reachable-computer-IP>:5180`. Bind to `0.0.0.0` and allow inbound access through applicable Windows/WSL firewalls. Administrator prompts require user approval; binding alone does not prove phone reachability.

With Tailscale in WSL and on the phone, run `tailscale ip -4` in WSL and open `http://<WSL-Tailscale-IP>:5180`. Both devices must be connected/permitted by tailnet rules. This reaches WSL directly without relying on Windows LAN forwarding. Discover environment-specific addresses rather than reusing old session IPs.

A production build (`npm run build`) served from `dist/`, including a Windows static server, can also be playable when reachable. `npm run preview -- --host 0.0.0.0 --port 5181` previews production; it does not enable development telemetry.

## What is saved

Development browser play enables `playLog()` in `src/game.js`, posting buffered entries to Vite's `/__log` endpoint and appending JSONL under `logs/play/` in the served checkout. Inspect newest files; correlate timestamps, seed, faction, flags and actions with the session. Current schema-4 logs record feature choices for replay. Pre-merge card-dealing logs may require the original revision.

Production/static builds disable that logger (`import.meta.env.DEV` false), and plain static servers lack `/__log` ingestion. HTTP request/server output is not a combat log. A phone game on that build cannot be retrieved from `logs/play/` without another capture/export mechanism.

The latest completed report is saved as `battler:last-result`: title, round, winner, per-unit report and aggregate stats. View Stats on the same phone/browser/origin. Changing host or port changes origin/storage. The report replaces the previous completion, is not full replay/campaign save, and cannot be fetched remotely from the server.

Future work: explicit production export/upload, capture status and device/session identity. This pass records the gap; it does not implement that pipeline or claim the last phone game's detailed logs were recovered.
