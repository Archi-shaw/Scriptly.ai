// Test-only SMTP sink with an HTTP inbox, used by the end-to-end suite so that
// verification emails travel through the app's real SMTP code path.
import http from "node:http";
import { SMTPServer } from "smtp-server";

const smtpPort = Number(process.env.MAIL_SINK_SMTP_PORT ?? 2527);
const httpPort = Number(process.env.MAIL_SINK_HTTP_PORT ?? 4108);
let messages = [];

/** Minimal quoted-printable decoding so codes in the text part are readable. */
function decodeQuotedPrintable(value) {
  return value.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

const smtp = new SMTPServer({
  authOptional: true,
  disabledCommands: ["STARTTLS", "AUTH"],
  logger: false,
  onData(stream, session, callback) {
    let raw = "";
    stream.on("data", (chunk) => (raw += chunk.toString("utf8")));
    stream.on("end", () => {
      const decoded = decodeQuotedPrintable(raw);
      messages.push({
        to: session.envelope.rcptTo.map((r) => r.address.toLowerCase()),
        from: session.envelope.mailFrom?.address,
        subject: decoded.match(/^Subject: (.+)$/m)?.[1] ?? "",
        code: decoded.match(/Your code: (\d{6})/)?.[1] ?? null,
        receivedAt: Date.now(),
      });
      callback();
    });
  },
});

smtp.listen(smtpPort, "127.0.0.1", () => console.log(`[mail-sink] SMTP on ${smtpPort}`));

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/messages" && req.method === "DELETE") {
      messages = [];
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end('{"cleared":true}');
    }
    if (url.pathname === "/messages") {
      const to = url.searchParams.get("to")?.toLowerCase();
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(to ? messages.filter((m) => m.to.includes(to)) : messages));
    }
    res.writeHead(404);
    res.end();
  })
  .listen(httpPort, "127.0.0.1", () => console.log(`[mail-sink] inbox on http://127.0.0.1:${httpPort}/messages`));
