const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// Replace with your actual ScraperAPI key
const SCRAPER_API_KEY = "254aa5de511e80f67e016d643d0caff5";

app.get("/", (req, res) => {
  res.send("✅ Zubto Product Backend is running...");
});

// 🧩 Scraper route with price extraction
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

    const image =
      $("meta[property='og:image']").attr("content") ||
      $("img").first().attr("src") ||
      "https://via.placeholder.com/400x300?text=No+Image";

    // Price extraction, checks multiple selectors for compatibility
    const priceSelectors = [
      "meta[property='product:price:amount']",
      "span#priceblock_ourprice",
      "span#priceblock_dealprice",
      "span.a-price-whole",
      "div._30jeq3._16Jk6d",
      "div.price",
      "span[data-testid='price']",
      "span[aria-label*='₹']",
      "div.product-price",
      "span.s1q9rs8r-0",
      "span.P3O9Ic"
    ];

    let price = "";
    for (const selector of priceSelectors) {
      price = $(selector).first().text().replace(/[

]+|[s]{2,}/g, ' ').trim();
      if (price) break;
    }
    if (!price) {
      price = $("meta[itemprop='price']").attr("content") ||
              $("meta[name='price']").attr("content") ||
              "No price found";
    }

    res.json({ title, description, image, price });
  } catch (error) {
    console.error("❌ Scraper Error:", error);
    res.status(500).json({ error: "Failed to fetch product data" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});