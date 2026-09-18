# 🚂 ڕێنمایی هۆستکردنی بۆت و داشبۆرد لەسەر Railway (Railway Hosting Guide)

ئەم ڕێنماییە هەنگاو بە هەنگاو فێرت دەکات چۆن بۆت و وێب داشبۆردەکەت لەسەر سێرڤەری **Railway (Railway.com)** بە خۆڕایی و بە شێوەی 24/7 هۆست بکەیت بەبێ ئەوەی کۆمپیوتەرەکەت کراوە بێت.

---

## 🔑 زانیارییە پێویستەکان (Environment Variables)
لەکاتی دروستکردنی پڕۆژە لە Railway، دەبێت ئەم 3 گۆڕاوە (Variables) دابنێیت:

| ناوی گۆڕاو (Variable Name) | بەهاکەی (Value) |
|---|---|
| `DISCORD_TOKEN` | تۆکنی بۆتەکەت لە Discord Developer Portal |
| `CLIENT_ID` | `1517630276325474365` |
| `GUILD_ID` | `1474907174558765177` |
| `PORT` | `3000` (یان Railway خۆی دایدەنێت) |

---

## 🚀 شێوازی یەکەم: لەڕێگەی GitHub و ماڵپەڕی Railway (ئاسانترین و باشترین ڕێگا)

### هەنگاوی 1: دانانی کۆدەکە لەسەر GitHub
1. بڕۆ بۆ ماڵپەڕی [GitHub.com](https://github.com) و ئەکاونتێک دروست بکە (یان بچۆ ژوورەوە).
2. کرتە بکە لەسەر **New Repository** و ناوێکی بۆ دابنێ (بۆ نموونە: `discord-master-bot`).
3. لە تێرمیناڵی کۆمپیوتەرەکەتدا ئەم فەرمانانە لێبدە بۆ ئەوەی کۆدەکەت بنێریتە سەر گیت هاب:
```bash
git init
git add .
git commit -m "Deploy Discord Bot & Dashboard to Railway"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

---

### هەنگاوی 2: بەستنەوە بە Railway
1. بڕۆ بۆ ماڵپەڕی **[Railway.com](https://railway.com)** و لەڕێگەی گیت هابەوە بچۆ ژوورەوە (**Login with GitHub**).
2. کرتە بکە لەسەر دوگمەی **New Project**.
3. هەڵبژاردنی **Deploy from GitHub repo** بکە.
4. پڕۆژەکەت هەڵبژێرە (`discord-master-bot`).

---

### هەنگاوی 3: دانانی Environment Variables
1. لەناو پڕۆژەکەت لە Railway، کرتە لەسەر خزمەتگوزارییەکەت (Service) بکە.
2. بڕۆ بۆ تابی **Variables**.
3. کرتە بکە لەسەر **New Variable** و ئەم نهێنییانە داخڵ بکە:
   - `DISCORD_TOKEN` = تۆکنی بۆتەکەت
   - `CLIENT_ID` = `1517630276325474365`
   - `GUILD_ID` = `1474907174558765177`

---

### هەنگاوی 4: کردنەوەی دۆمەینی وێب بۆ داشبۆردەکە (Public URL)
1. لەناو سێرڤیسەکەت لە Railway، بڕۆ بۆ تابی **Settings**.
2. دابەزە بۆ بەشی **Networking**.
3. دۆمەینەکە چالاکە: `https://ag-production-be8b.up.railway.app`
4. پیرۆزە! ئێستا بۆتەکەت 24/7 لەسەر دیسکۆرد کاردەکات و داشبۆردەکەشت بەو لینکە جیهانییە دەکرێتەوە! 🎉

---

## 💻 شێوازی دووەم: لەڕێگەی تێرمیناڵ و Railway CLI

ئەگەر دەتەوێت ڕاستەوخۆ لەناو کۆمپیوتەرەکەتەوە بە فەرمان بیخەیتە سەر Railway:

1. ئینستۆڵکردنی Railway CLI:
```bash
npm i -g @railway/cli
```

2. چوونە ژوورەوە:
```bash
railway login
```

3. دروستکردنی پڕۆژە و ئەپلۆدکردن:
```bash
railway init
railway up
```

4. دانانی گۆڕاوەکان لە تێرمیناڵدا:
```bash
railway variables set DISCORD_TOKEN="YOUR_TOKEN"
railway variables set CLIENT_ID="1517630276325474365"
railway variables set GUILD_ID="1474907174558765177"
```

5. دروستکردنی دۆمەینی وێب بۆ داشبۆرد:
```bash
railway domain
```
