const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
require("dotenv").config(); // Only works locally. Render ignores this.

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// Load API key from Render Environment Variables
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

app.get("/", (req, res) => {
  res.send("✅ Zubto Product Backend is running...");
});

app.get("/scrape", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  try {
    const scraperURL = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}`;
    const response = await fetch(scraperURL);
    const html = await response.text();

    const $ = cheerio.load(html);

    const title =
      $("meta[property='og:title']").attr("content") ||
      $("title").text() ||
      "No title found";

    const description =
      $("meta[property='og:description']").attr("content") ||
      $("meta[name='description']").attr("content") ||
      "No description found";

    let image =
      $("meta[property='og:image']").attr("content") ||
      $("img").first().attr("src") ||
      "";

    // ⭐ FIX: Convert Amazon relative image URLs to full URLs
    if (image.startsWith("//")) {
      image = "https:" + image;
    }
    if (image.startsWith("/")) {
      image = "https://www.amazon.in" + image;
    }

    if (!image) {
      image = "https://via.placeholder.com/400x300?text=No+Image";
    }

    res.json({ title, description, image });
  } catch (error) {
    console.error("❌ Scraper Error:", error);
    res.status(500).json({ error: "Failed to fetch product data" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});