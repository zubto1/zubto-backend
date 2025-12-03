const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// 🟢 Replace with your real ScraperAPI key
const SCRAPER_API_KEY = "254aa5de511e80f67e016d643d0caff5"; 

app.get("/", (req, res) => {
  res.send("✅ Zubto Product Backend is running...");
});

// 🧩 Scraper route


app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});