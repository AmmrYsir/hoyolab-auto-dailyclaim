<h1 align="center">
  HoYoLAB Auto Daily Claim
</h1>

<p align="center">
  <strong>Fast, secure, and zero-dependency automated daily check-in rewards claimer for HoYoverse games.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Bun-1.3+-FBF0DF?logo=bun&logoColor=black&style=flat-square" alt="Bun version">
  <img src="https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white&style=flat-square" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT License">
  <img src="https://img.shields.io/badge/Zero-Dependencies-blue?style=flat-square" alt="Zero Dependencies">
</p>

---

## 🎮 Supported Games

| Game | Identifier | Daily Rewards | Streak Tracking |
| :--- | :--- | :---: | :---: |
| **Genshin Impact** | `genshin` / `gi` | ✅ | ✅ |
| **Honkai: Star Rail** | `honkai_star_rail` / `star_rail` / `hsr` | ✅ | ✅ |
| **Zenless Zone Zero** | `zenless_zone_zero` / `zzz` | ✅ | ✅ |
| **Honkai Impact 3rd** | `honkai_3` / `hi3` | ✅ | ✅ |
| **Tears of Themis** | `tears_of_themis` / `tot` | ✅ | ✅ |

---

## ✨ Features

- **🚀 Ultra-Lightweight & Fast**: Built for [Bun](https://bun.com) with **zero external runtime dependencies**.
- **👥 Multi-Account Support**: Manage and claim rewards for multiple HoYoLAB accounts in a single run.
- **🎁 Reward & Streak Details**: Automatically retrieves claimed reward names (e.g. *Primogems x20*, *Stellar Jade x20*, *Polychrome x20*) and your monthly check-in streak day.
- **🛡️ Security & Privacy First**: Built-in credential sanitizer automatically masks tokens, cookies, webhooks, and passwords in logs, debug dumps, and notifications.
- **🤖 Anti-Detection Timing**: Configurable randomized jitter and delay intervals between requests to emulate natural user activity.
- **🔔 Multi-Channel Notifications**:
  - **Discord Webhook**: Rich Embeds with color-coded status, reward breakdowns, and error pings (`<@USER_ID>`).
  - **Telegram Bot**: Formatted HTML message with emoji status badges.
  - **SMTP Email**: Responsive HTML email templates with account tables and plain text fallbacks.
  - **Generic Webhook**: JSON payloads for Home Assistant, Slack, or custom automation pipelines.
  - **Terminal Console**: Elegant ANSI formatted summary table.
- **☁️ 100% Free Automation**: Ready-to-use GitHub Actions workflow, Docker container, and Cron setups.

---

## 🔑 How to Retrieve Your HoYoLAB Cookies

HoYoLAB uses `HttpOnly` security cookies. Follow these steps to obtain your `ltoken_v2` and `ltuid_v2`:

1. Open your browser and navigate to the [HoYoLAB Daily Check-In page](https://act.hoyolab.com/ys/event/signin-sea-v3/index.html?act_id=e202102251931481).
2. Log into your HoYoverse account.
3. Open your browser's Developer Tools by pressing `F12` (or `Ctrl+Shift+I` / `Cmd+Option+I`).
4. Select the **Application** tab (or **Storage** in Firefox).
5. On the left sidebar under **Cookies**, click on `https://act.hoyolab.com` or `https://hoyolab.com`.
6. Locate and copy the values for:
   - `ltoken_v2`
   - `ltuid_v2`
7. Combine them into the token string:
   ```text
   ltoken_v2=v2_CANARIAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX3406; ltuid_v2=26XXXXX20;
   ```

*(You can also copy the entire `Cookie` header from any network request under the **Network** tab).*

---

## ⚡ Quick Start

### 1. Install Bun
If you do not have Bun installed:
```bash
curl -fsSL https://bun.sh/install | bash
```

### 2. Clone & Install
```bash
git clone https://github.com/AmmrYsir/hoyolab-auto-dailyclaim.git
cd hoyolab-auto-dailyclaim
bun install
```

### 3. Configure
Copy the configuration template:
```bash
cp config.example.json config.json
```
Edit `config.json` with your credentials and notification settings.

### 4. Run
```bash
# Test without claiming
bun run start --dry-run

# Run check-in
bun run start
```

---

## ⚙️ Configuration Options

You can configure the application using either **`config.json`** or **environment variables (`.env`)**.

### `config.json` Example
```json
{
  "profiles": [
    {
      "accountName": "MyAccount",
      "token": "ltoken_v2=v2_CANARIA...; ltuid_v2=26...;",
      "genshin": true,
      "honkai_star_rail": true,
      "zenless_zone_zero": true,
      "honkai_3": false,
      "tears_of_themis": false
    }
  ],
  "delayRangeMs": [1500, 3000],
  "retryCount": 2,
  "requestTimeoutMs": 10000,
  "fetchRewardDetails": true,
  "discord": {
    "enabled": true,
    "webhookUrl": "https://discord.com/api/webhooks/...",
    "pingUserId": "20000080000000040",
    "notifyOn": "always"
  },
  "telegram": {
    "enabled": false,
    "botToken": "1234567890:AAA...",
    "chatId": "123456780",
    "notifyOn": "always"
  },
  "smtp": {
    "enabled": false,
    "host": "smtp.gmail.com",
    "port": 587,
    "user": "your_email@gmail.com",
    "pass": "your_app_password",
    "from": "your_email@gmail.com",
    "to": "recipient@example.com",
    "notifyOn": "always"
  }
}
```

### Notification Policies (`notifyOn` / `notify_mode`)
- `"always"` *(default)*: Sends notifications on every run.
- `"on_error"`: Sends notifications only if an account fails or triggers a CAPTCHA.
- `"on_claim"`: Sends notifications only when rewards are actively claimed.

---

## 📣 Notification Setup

<details>
<summary><b>💬 Discord Webhook Setup</b></summary>

1. In Discord, go to **Server Settings** → **Integrations** → **Webhooks** → **New Webhook**.
2. Copy the Webhook URL and paste it into `config.json` (`discord.webhookUrl`).
3. *(Optional)* To get pinged when an error occurs, copy your Discord User ID (User Settings → Advanced → Enable Developer Mode → Right-click your profile → Copy User ID) and set `pingUserId`.

</details>

<details>
<summary><b>✈️ Telegram Bot Setup</b></summary>

1. Message [@BotFather](https://t.me/botfather) on Telegram and send `/newbot` to create your bot and obtain your `botToken`.
2. Message [@IDBot](https://t.me/myidbot) and send `/getid` to get your `chatId`.
3. Fill `telegram.botToken` and `telegram.chatId` in `config.json`.

</details>

<details>
<summary><b>📧 SMTP Email Setup</b></summary>

1. Use your SMTP server credentials (e.g. Gmail App Passwords, Outlook, AWS SES, SendGrid).
2. Set `smtp.host`, `smtp.port` (`587` for STARTTLS, `465` for SSL), `smtp.user`, `smtp.pass`, and `smtp.to`.
3. For Gmail, generate an **App Password** at [Google Account Security](https://myaccount.google.com/apppasswords).

</details>

---

## 🚀 Deployment & Automation

### 1. GitHub Actions (100% Free 24/7)
This repository includes a pre-configured workflow in [`.github/workflows/daily-claim.yml`](file:///.github/workflows/daily-claim.yml).
1. Fork this repository.
2. In your repository, go to **Settings** → **Secrets and variables** → **Actions**.
3. Create repository secrets:
   - `HOYOLAB_CONFIG_JSON`: The entire contents of your `config.json` file.
4. The workflow will automatically run everyday at **06:00 UTC** (14:00 UTC+8).

### 2. Docker & Docker Compose
```bash
# Build and run with Docker Compose
docker compose up --build
```

### 3. Linux Cron Job
```bash
crontab -e
```
Add the following line to run everyday at 09:00 AM:
```cron
0 9 * * * cd /path/to/hoyolab-auto-dailyclaim && /home/user/.bun/bin/bun run start >> /path/to/claim.log 2>&1
```

---

## 💻 CLI Commands & Flags

```bash
# View all available CLI options
bun run start --help

# Validate configuration file without sending requests
bun run start --validate

# Dry-run check-in (queries status without claiming rewards)
bun run start --dry-run

# Run with a custom config file
bun run start --config /path/to/my-config.json

# Run unit and integration tests
bun test

# Run TypeScript typecheck
bun run typecheck
```

---

## 🛡️ Security Compliance

- **No Credential Logging**: All sensitive cookie keys (`ltoken_v2`, `ltuid_v2`, etc.), Discord Webhook secrets, Telegram tokens, and SMTP passwords are filtered through a central sanitizer before appearing in stdout, stderr, or external notifications.
- **Zero Third-Party Runtime Dependencies**: Pure TypeScript and native Bun APIs eliminate supply-chain attack vectors.
- **Direct Official Communication**: Outbound network requests only communicate directly with official HoYoverse endpoints (`*.hoyolab.com`) and your configured notification webhooks/servers.

---

## 🤖 Developer & Agent Documentation

- **[AGENTS.md](AGENTS.md)**: Architecture guidelines, coding standards, and workflow instructions for AI agents and human contributors.
- **[CLAUDE.md](CLAUDE.md)**: Concise quick-reference instructions for Claude / LLM assistants.

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
