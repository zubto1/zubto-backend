const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// 🟢 Replace with your real ScraperAPI key
const SCRAPER_API_KEY = "971bac6a367029d56ec4018cb37d9a9b"; 

app.get("/", (req, res) => {
  res.send("✅ Zubto Product Backend is running...");
});

// 🧩 Scraper route


app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});