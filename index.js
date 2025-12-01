const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const express = require("express");

// ENV TOKEN (Render will pass this)
const TOKEN = process.env.TOKEN;
const bot = new TelegramBot(TOKEN, { polling: true });

let data = {};

function saveData() {
  fs.writeFileSync("timedata.json", JSON.stringify(data, null, 2));
}

function loadData() {
  if (fs.existsSync("timedata.json")) {
    data = JSON.parse(fs.readFileSync("timedata.json"));
  }
}
loadData();

// Set bot commands
bot.setMyCommands([
  { command: "start", description: "Start your training timer" },
  { command: "stop", description: "Stop your training timer" },
  { command: "mystats", description: "Show your personal stats" },
  { command: "groupstats", description: "Show total group stats" }
]);

// ---- START TIMER ----
bot.onText(/\/start/, (msg) => {
  const user = msg.from.id;
  const name = msg.from.first_name;

  if (!data[user]) data[user] = { total: 0, start: null, week: 0 };

  data[user].start = Date.now();
  saveData();

  bot.sendMessage(msg.chat.id, `⏱ Timer started for ${name}!`);
});

// ---- STOP TIMER ----
bot.onText(/\/stop/, (msg) => {
  const user = msg.from.id;
  const name = msg.from.first_name;

  if (!data[user] || !data[user].start) {
    return bot.sendMessage(msg.chat.id, "⚠️ You didn't start the timer. Use /start.");
  }

  const durationMs = Date.now() - data[user].start;
  const mins = Math.floor(durationMs / 60000);
  const hrs = Math.floor(mins / 60);
  const leftMins = mins % 60;

  data[user].total += mins;
  data[user].week += mins;
  data[user].start = null;
  saveData();

  bot.sendMessage(
    msg.chat.id,
    `💪 ${name} trained for ${hrs} hr ${leftMins} min.\n🔥 Keep grinding!`
  );
});

// ---- MY STATS ----
bot.onText(/\/mystats/, (msg) => {
  const user = msg.from.id;
  const name = msg.from.first_name;

  const mins = data[user]?.total || 0;
  const hrs = Math.floor(mins / 60);
  const leftMins = mins % 60;

  bot.sendMessage(msg.chat.id, `📊 ${name}, your total: ${hrs} hr ${leftMins} min.`);
});

// ---- GROUP STATS ----
bot.onText(/\/groupstats/, async (msg) => {
  let reply = "📊 Group Stats:\n\n";

  for (let id in data) {
    let user = await bot.getChatMember(msg.chat.id, id).catch(() => null);
    if (!user) continue;

    const mins = data[id].total;
    const hrs = Math.floor(mins / 60);
    const leftMins = mins % 60;

    reply += `👤 ${user.user.first_name}: ${hrs} hr ${leftMins} min\n`;
  }
  bot.sendMessage(msg.chat.id, reply);
});

// ---- EXPRESS SERVER (IMPORTANT FOR RENDER) ----
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is alive!");
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
