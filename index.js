// MuscleMinutesBot – Full Version
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const express = require("express");

// Get your token from Render environment variables
const TOKEN = process.env.TOKEN;
const bot = new TelegramBot(TOKEN, { polling: true });

// Your supergroup ID here
const GROUP_ID = -1003381639418; // Replace with your actual group ID

let data = {};

// ---- Data Persistence ----
function saveData() {
  fs.writeFileSync("timedata.json", JSON.stringify(data, null, 2));
}

function loadData() {
  if (fs.existsSync("timedata.json")) {
    data = JSON.parse(fs.readFileSync("timedata.json"));
  }
}
loadData();

// ---- Bot Commands ----
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

  if (!data[user]) data[user] = { total: 0, start: null, week: 0, lastTrained: null, name };

  data[user].start = Date.now();
  data[user].name = name; // save name for reminders
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

  // Save last trained date for daily reminder
  data[user].lastTrained = new Date().toLocaleDateString();
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

  let mins = data[user]?.total || 0;

  // If user has started but not stopped, include current session
  if (data[user]?.start) {
    const durationMs = Date.now() - data[user].start;
    mins += Math.floor(durationMs / 60000);
  }

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

    let mins = data[id].total;

    // Include in-progress session
    if (data[id].start) {
      mins += Math.floor((Date.now() - data[id].start) / 60000);
    }

    const hrs = Math.floor(mins / 60);
    const leftMins = mins % 60;

    reply += `👤 ${user.user.first_name}: ${hrs} hr ${leftMins} min\n`;
  }

  bot.sendMessage(msg.chat.id, reply);
});


// ---- EXPRESS SERVER (Render keeps bot alive) ----
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is alive!");
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});

// ---- DAILY PERSONALIZED REMINDER (8 AM) ----
// Except TUESDAY (weekly holiday)
setInterval(() => {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const day = now.getDay(); // 0 = Sunday, 2 = Tuesday

  if (hour === 8 && minute === 0 && day !== 2) {
    const today = now.toLocaleDateString();

    for (let userId in data) {
      if (data[userId].lastTrained !== today) {
        bot.sendMessage(
          GROUP_ID,
          `👋 Hey <a href="tg://user?id=${userId}">${data[userId].name}</a>, your bros are way ahead! Why not jump in and log your grind? 💪`,
          { parse_mode: "HTML" }
        );
      }
    }
  }
}, 60000);

// ---- WEEKLY LEADERBOARD (Every Tuesday) ----
setInterval(() => {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const day = now.getDay(); // 0 = Sunday, 2 = Tuesday

  if (day === 2 && hour === 9 && minute === 0) { // 9 AM on Tuesday
    let board = "🏆 Weekly Leaderboard:\n\n";

    for (let id in data) {
      const mins = data[id].week || 0;
      const hrs = Math.floor(mins / 60);
      const leftMins = mins % 60;

      board += `👤 ${data[id].name}: ${hrs} hr ${leftMins} min\n`;
      data[id].week = 0; // reset weekly stats
    }

    saveData();
    bot.sendMessage(GROUP_ID, board);
  }
}, 60000);

