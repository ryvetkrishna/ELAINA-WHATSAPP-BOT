# Elaina WhatsApp Bot

Node.js + Baileys WhatsApp companion bot with a small web dashboard for QR and pairing-code linking.

## Requirements
- Node.js 20+
- A WhatsApp account you control
- A private `DASHBOARD_TOKEN`

## Run locally
1. Copy this project and run `npm install`.
2. Set `DASHBOARD_TOKEN` to a long random secret.
3. Run `npm start`.
4. Open `http://localhost:3000`, enter the token, and start the connection.
5. For QR: click **Show QR code** and scan it from WhatsApp → Linked devices.
6. For pairing code: enter your number with country code, digits only, then enter the generated code in WhatsApp → Linked devices → Link with phone number.

## Render
1. Push the project to your Git repository.
2. In Render choose **New → Blueprint** and select the repository containing `render.yaml`.
3. Set a strong `DASHBOARD_TOKEN` in the service environment.
4. The included Blueprint uses a paid service plan and a persistent disk at `/var/data` so the WhatsApp session can survive restarts.
5. Deploy, then open the service URL and enter the same token.

Render's filesystem is ephemeral unless persistent storage is configured. Do not remove the disk if you want to preserve the session.

## Docker / panel
Build and run the included Dockerfile. Configure:
- `DASHBOARD_TOKEN` = a long random secret
- `SESSION_DIR` = a persistent volume path, e.g. `/app/session`
- `PORT` = the port exposed by your panel (often provided automatically)

Mount a persistent volume at the `SESSION_DIR` path. Keep one running replica to avoid concurrent session conflicts.

## Commands
- `!menu`
- `!ping`
- `!alive`

## Security notes
- Do not commit `session/`, `.env`, or credentials.
- Do not expose the dashboard without a strong token and HTTPS.
- QR codes and pairing codes are temporary account-linking credentials; do not share them.
- This is an unofficial WhatsApp Web integration using Baileys. WhatsApp may change behavior and account use is subject to WhatsApp's terms.
