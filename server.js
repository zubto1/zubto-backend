const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const SCRAPER_API_KEY = "971bac6a367029d56ec4018cb37d9a9b";

app.get("/", (req, res) => {
  res.send("✅ Zubto Product Backend is running...");
});

app.get("/scrape", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  try {

    // Force JS rendering + browser headers
    const scraperURL = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&render=true&keep_headers=true&url=${encodeURIComponent(url)}`;

    const response = await fetch(scraperURL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract Title
    const title =
      $("span.B_NuCI").text().trim() ||
      $("title").text().trim() ||
      "No title found";

    // Extract Price — updated selectors!!
    let price =
      $("div.Nx9bqj.CxhGGd").first().text().trim() || // New Flipkart price
      $("div._30jeq3._16Jk6d").first().text().trim() || // Old layout
      $("meta[property='product:price:amount']").attr("content") ||
      $("[class*=price]").first().text().trim() ||
      "Price not found";

    // Cleanup: remove "₹", commas, weird decimals
    price = price.replace(/[^\d₹]/g, "");

    // Extract Image
    const image =
      $("img._396cs4._2amPTt._3qGmMb").attr("src") ||
      $("meta[property='og:image']").attr("content") ||
      "https://via.placeholder.com/400x300?text=No+Image";

    res.json({ title, price, image });

  } catch (error) {
    console.error("❌ Scraper Error:", error);
    res.status(500).json({ error: "Failed to fetch product data" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server ready @ ${PORT}`);
});