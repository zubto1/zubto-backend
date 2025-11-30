const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

const SCRAPER_API_KEY = "254aa5de511e80f67e016d643d0caff5";

// -------------------------
// Improved Price Formatter (No decimals)
// -------------------------
function cleanPrice(rawPrice) {
  if (!rawPrice) return null;

  const cleaned = rawPrice.replace(/[^0-9]/g, ""); // Remove everything except numbers
  if (!cleaned) return null;

  const number = parseInt(cleaned);
  if (isNaN(number)) return null;

  return `₹${number.toLocaleString("en-IN")}`;
}

// -------------------------
app.get("/", (req, res) => {
  res.send("🚀 Zubto Backend Running!");
});

// -------------------------
app.get("/scrape", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL Missing" });

  try {
    const scraperURL = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}`;
    const response = await fetch(scraperURL);
    const html = await response.text();
    const $ = cheerio.load(html);

    // ---------- Title ----------
    const title =
      $("meta[property='og:title']").attr("content") ||
      $("span.B_NuCI").text().trim() ||
      $("title").text().trim() ||
      "No title found";

    // ---------- Description ----------
    const description =
      $("meta[property='og:description']").attr("content") ||
      $("meta[name='description']").attr("content") ||
      "No description found";

    // ---------- Price (Updated Flipkart + Amazon) ----------
    let rawPrice =
      $("div.Nx9bqj.CxhGGd").first().text().trim() || // Flipkart main class
      $("div._30jeq3._16Jk6d").first().text().trim() || // Flipkart old
      $("span._30jeq3").first().text().trim() || // Mobile view
      $("[class*='price'] span").first().text().trim() || // deeper span
      $("div._16Jk6d").first().text().trim() || // New test layout
      $("#priceblock_ourprice").text().trim() || // Amazon
      $("#priceblock_dealprice").text().trim() || // Amazon deal
      $("#tp_price_block_total_price_ww").text().trim() || // Amazon total price fallback
      $("meta[property='product:price:amount']").attr("content") ||
      null;

    const price = cleanPrice(rawPrice);

    // ---------- Image ----------
    const image =
      $("meta[property='og:image']").attr("content") ||
      $("img").first().attr("src") ||
      "https://via.placeholder.com/400x300?text=No+Image";

    res.json({ title, description, price, image });

  } catch (err) {
    console.error("❌ Scraper Error:", err);
    res.status(500).json({ error: "Scraping failed" });
  }
});

// -------------------------
app.listen(PORT, () => console.log(`Server running on ${PORT}`));