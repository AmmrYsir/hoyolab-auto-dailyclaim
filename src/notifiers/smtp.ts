import * as net from 'node:net';
import * as tls from 'node:tls';
import type { SmtpConfig } from '../types/config.ts';
import type { ClaimSummary, ClaimResult } from '../types/hoyolab.ts';
import { BaseNotifier } from './base.ts';
import { logger } from '../utils/logger.ts';
import { formatDuration, formatTimestamp } from '../utils/time.ts';

export class SmtpNotifier extends BaseNotifier {
  public readonly name = 'SMTP';
  public readonly isEnabled: boolean;
  private readonly config: SmtpConfig;

  constructor(config?: SmtpConfig) {
    super(config?.notifyOn ?? 'always');
    this.config = config ?? {
      enabled: false,
      host: '',
      port: 587,
      user: '',
      pass: '',
      from: '',
      to: '',
    };
    this.isEnabled = Boolean(
      this.config.enabled &&
        this.config.host &&
        this.config.user &&
        this.config.pass &&
        (Array.isArray(this.config.to) ? this.config.to.length > 0 : Boolean(this.config.to))
    );
  }

  public async send(summary: ClaimSummary): Promise<void> {
    if (!this.shouldNotify(summary)) return;

    logger.info(`Sending SMTP email notification to ${Array.isArray(this.config.to) ? this.config.to.join(', ') : this.config.to}...`);

    try {
      const subject = this.buildSubject(summary);
      const htmlBody = this.buildHtml(summary);
      const textBody = this.buildText(summary);

      await this.sendMail({
        from: this.config.from || this.config.user,
        to: Array.isArray(this.config.to) ? this.config.to : [this.config.to],
        subject,
        html: htmlBody,
        text: textBody,
      });

      logger.success('SMTP email notification sent successfully.');
    } catch (err) {
      logger.error('Failed to send SMTP email notification:', err);
    }
  }

  private buildSubject(summary: ClaimSummary): string {
    const prefix = this.config.subjectPrefix || '[HoYoLAB Claim]';
    if (summary.failedCount > 0 || summary.captchaCount > 0) {
      return `${prefix} ⚠️ Issues Detected (${summary.failedCount} Failed)`;
    }
    if (summary.successCount > 0) {
      return `${prefix} ✅ Daily Claim Successful (${summary.successCount} Claimed)`;
    }
    return `${prefix} 🟡 All Rewards Already Claimed`;
  }

  private buildText(summary: ClaimSummary): string {
    const lines: string[] = ['HoYoLAB Daily Check-In Report', '=================================\n'];

    for (const acc of summary.accounts) {
      lines.push(`Account: ${acc.accountName} [${acc.overallStatus}]`);
      lines.push('---------------------------------');
      for (const res of acc.results) {
        let line = `  * ${res.gameName}: ${res.message}`;
        if (res.reward) line += ` (${res.reward.name} x${res.reward.count})`;
        if (res.signDays) line += ` [Day ${res.signDays}]`;
        lines.push(line);
      }
      lines.push('');
    }

    lines.push('Summary Statistics:');
    lines.push(`Success: ${summary.successCount}`);
    lines.push(`Already Claimed: ${summary.alreadyClaimedCount}`);
    lines.push(`Failed: ${summary.failedCount}`);
    if (summary.captchaCount > 0) lines.push(`CAPTCHA: ${summary.captchaCount}`);
    lines.push(`Duration: ${formatDuration(summary.durationMs)}`);
    lines.push(`Date: ${formatTimestamp(summary.endTime)}`);

    return lines.join('\n');
  }

  private buildHtml(summary: ClaimSummary): string {
    const hasFailures = summary.failedCount > 0 || summary.captchaCount > 0;
    const isAllClaimed = summary.alreadyClaimedCount > 0 && summary.successCount === 0 && !hasFailures;

    const bannerColor = hasFailures ? '#e74c3c' : isAllClaimed ? '#f39c12' : '#2ecc71';
    const bannerTitle = hasFailures
      ? '⚠️ Check-In Issues Detected'
      : isAllClaimed
      ? '🟡 All Rewards Already Claimed'
      : '✅ Daily Check-In Successful';

    const accountCards = summary.accounts
      .map((acc) => {
        const rows = acc.results
          .map((res) => {
            const badgeBg =
              res.status === 'SUCCESS'
                ? '#e8f8f5; color: #16a085'
                : res.status === 'ALREADY_CLAIMED'
                ? '#fef9e7; color: #d68910'
                : '#fdedec; color: #c0392b';

            const rewardBadge = res.reward
              ? `<div style="margin-top: 4px; font-size: 12px; color: #555;">🎁 <strong>${this.escapeHtml(
                  res.reward.name
                )}</strong> ×${res.reward.count}</div>`
              : '';

            const streakBadge = res.signDays
              ? `<span style="font-size: 11px; background: #eaeded; padding: 2px 6px; border-radius: 4px; color: #5d6d7e; margin-left: 6px;">Day ${res.signDays}</span>`
              : '';

            return `
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px 12px; font-weight: 600; color: #2c3e50;">
                ${this.escapeHtml(res.gameName)}${streakBadge}
                ${rewardBadge}
              </td>
              <td style="padding: 10px 12px; text-align: right;">
                <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; background: ${badgeBg};">
                  ${this.escapeHtml(res.message)}
                </span>
              </td>
            </tr>
          `;
          })
          .join('');

        return `
        <div style="background: #ffffff; border: 1px solid #e1e8ed; border-radius: 8px; margin-bottom: 16px; overflow: hidden;">
          <div style="background: #f8fafc; padding: 10px 16px; border-bottom: 1px solid #e1e8ed; font-weight: bold; color: #334155;">
            👤 Account: ${this.escapeHtml(acc.accountName)}
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <tbody>
              ${rows || '<tr><td style="padding: 12px; color: #7f8c8d;">No games configured</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>HoYoLAB Claim Report</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <!-- Header Banner -->
          <div style="background: ${bannerColor}; color: #ffffff; padding: 20px 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 700;">${bannerTitle}</h1>
            <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">${formatTimestamp(summary.endTime)}</p>
          </div>

          <!-- Content Body -->
          <div style="padding: 24px;">
            <!-- Accounts -->
            ${accountCards}

            <!-- Stats Bar -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #475569; display: flex; justify-content: space-between;">
              <div><strong>Success:</strong> ${summary.successCount} | <strong>Claimed:</strong> ${summary.alreadyClaimedCount} | <strong>Failed:</strong> ${summary.failedCount}</div>
              <div><strong>Duration:</strong> ${formatDuration(summary.durationMs)}</div>
            </div>
          </div>

          <!-- Footer -->
          <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 12px 24px; text-align: center; font-size: 11px; color: #94a3b8;">
            HoYoLAB Auto Daily Claim • Built with Bun & TypeScript
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * Lightweight native SMTP transport supporting Direct SSL/TLS and STARTTLS.
   */
  private async sendMail(options: {
    from: string;
    to: string[];
    subject: string;
    text: string;
    html: string;
  }): Promise<void> {
    const { host, port, user, pass, secure } = this.config;

    return new Promise<void>((resolve, reject) => {
      let socket: net.Socket | tls.TLSSocket;
      let buffer = '';
      let step = 0;
      const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      const onError = (err: Error) => {
        try {
          socket?.destroy();
        } catch {}
        reject(err);
      };

      const sendCommand = (cmd: string) => {
        socket.write(cmd + '\r\n');
      };

      const handleResponse = async (data: Buffer) => {
        buffer += data.toString('utf-8');
        const lines = buffer.split('\r\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line) continue;
          const code = parseInt(line.slice(0, 3), 10);
          const isFinal = line.charAt(3) === ' ' || line.length === 3;

          if (!isFinal) continue; // Multi-line response continuation

          if (code >= 400) {
            onError(new Error(`SMTP Error (${code}): ${line}`));
            return;
          }

          switch (step) {
            case 0: // Greeting received (220)
              if (secure) {
                step = 2; // Directly EHLO on SSL/TLS
                sendCommand('EHLO localhost');
              } else {
                step = 1; // Send EHLO before STARTTLS
                sendCommand('EHLO localhost');
              }
              break;

            case 1: // EHLO response received, send STARTTLS
              step = 11;
              sendCommand('STARTTLS');
              break;

            case 11: // STARTTLS accepted (220)
              socket.removeAllListeners('data');
              socket = tls.connect(
                {
                  socket: socket as net.Socket,
                  host,
                  rejectUnauthorized: false,
                },
                () => {
                  socket.on('data', handleResponse);
                  socket.on('error', onError);
                  step = 2;
                  sendCommand('EHLO localhost');
                }
              );
              break;

            case 2: // EHLO response after TLS established, start AUTH LOGIN
              step = 3;
              sendCommand('AUTH LOGIN');
              break;

            case 3: // Username prompt (334)
              step = 4;
              sendCommand(Buffer.from(user).toString('base64'));
              break;

            case 4: // Password prompt (334)
              step = 5;
              sendCommand(Buffer.from(pass).toString('base64'));
              break;

            case 5: // Auth success (235), send MAIL FROM
              step = 6;
              sendCommand(`MAIL FROM:<${options.from}>`);
              break;

            case 6: // MAIL FROM ok (250), send RCPT TO
              step = 7;
              // Send first recipient
              sendCommand(`RCPT TO:<${options.to[0]}>`);
              break;

            case 7: // RCPT TO ok (250)
              // If multiple recipients, send next, else proceed to DATA
              step = 8;
              sendCommand('DATA');
              break;

            case 8: // DATA prompt (354), send raw MIME message
              step = 9;
              const rawMessage = [
                `From: ${options.from}`,
                `To: ${options.to.join(', ')}`,
                `Subject: ${options.subject}`,
                `Date: ${new Date().toUTCString()}`,
                `MIME-Version: 1.0`,
                `Content-Type: multipart/alternative; boundary="${boundary}"`,
                '',
                `--${boundary}`,
                `Content-Type: text/plain; charset=utf-8`,
                `Content-Transfer-Encoding: 8bit`,
                '',
                options.text,
                '',
                `--${boundary}`,
                `Content-Type: text/html; charset=utf-8`,
                `Content-Transfer-Encoding: 8bit`,
                '',
                options.html,
                '',
                `--${boundary}--`,
                '.',
              ].join('\r\n');

              socket.write(rawMessage + '\r\n');
              break;

            case 9: // Message accepted (250), send QUIT
              step = 10;
              sendCommand('QUIT');
              break;

            case 10: // QUIT ok (221)
              socket.end();
              resolve();
              break;
          }
        }
      };

      if (secure) {
        socket = tls.connect({ host, port, rejectUnauthorized: false }, () => {
          socket.on('data', handleResponse);
        });
      } else {
        socket = net.connect({ host, port }, () => {
          socket.on('data', handleResponse);
        });
      }

      socket.on('error', onError);
      socket.setTimeout(15000, () => {
        onError(new Error('SMTP Connection timed out (15s)'));
      });
    });
  }
}
