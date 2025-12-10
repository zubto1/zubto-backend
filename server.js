const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// 🔐 API key from Render Environment Variables (NO dotenv needed)
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

    let image = "";

    // 1️⃣ Main Amazon product image
    image = $("#landingImage").attr("src")
    || $("#landingImage").attr("data-old-hires")
    || $("img[data-old-hires]").attr("data-old-hires")
    || $("img[data-a-dynamic-image]").attr("data-a-dynamic-image")
    || "";
    
    // 2️⃣ If dynamic image returns JSON, extract first URL
    if (image && image.includes("{")) {
      try {
        const json = JSON.parse(image);
        const keys = Object.keys(json);
        if (keys.length > 0) image = keys[0];
      } catch {}
    }
    
    // ⭐ Fallback to meta image
    if (!image) {
      image = $("meta[property='og:image']").attr("content") || "";
    }
    
    // ⭐ Final fallback prevents Amazon tracking URLs
    if (!image || image.includes("fls-eu.amazon")) {
      image = "https://via.placeholder.com/400x300?text=No+Image";
    }
    
    // ⭐ Fix relative links
    if (image.startsWith("//")) {
      image = "https:" + image;
    }
    if (image.startsWith("/")) {
      image = "https://www.amazon.in" + image;
    }
    
    // Extra fallback domain
    if (!image.includes("http")) {
      image = "https://www.amzn.in" + image;
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