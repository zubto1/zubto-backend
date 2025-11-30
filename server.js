const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// 🟢 Replace with your real ScraperAPI key
const SCRAPER_API_KEY = "254aa5de511e80f67e016d643d0caff5";

// -------------------------
// Helper: Clean Price (Updated)
// -------------------------
function cleanPrice(rawPrice) {
  if (!rawPrice) return null;

  // Remove commas, whitespace, ₹ symbol etc.
  const cleaned = rawPrice.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;

  const number = parseFloat(cleaned);
  if (isNaN(number)) return null;

  return `₹${number.toLocaleString("en-IN")}`;
}

// -------------------------
// Root Route
// -------------------------
app.get("/", (req, res) => {
  res.send("✅ Zubto Product Backend is running...");
});

// -------------------------
// Scraper Route
// -------------------------
app.get("/scrape", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  try {
    const scraperURL = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}`;
    const response = await fetch(scraperURL);
    const html = await response.text();

    const $ = cheerio.load(html);

    //-------------------------
    // Extract Title
    //-------------------------
    const title =
      $("meta[property='og:title']").attr("content") ||
      $("span.B_NuCI").text().trim() || // Flipkart
      $("title").text().trim() ||
      "No title found";

    //-------------------------
    // Extract Description
    //-------------------------
    const description =
      $("meta[property='og:description']").attr("content") ||
      $("meta[name='description']").attr("content") ||
      "No description available";

    //-------------------------
    // Extract Price (Updated)
    //-------------------------
    let rawPrice =
      $("div.Nx9bqj.CxhGGd").first().text().trim() || // Flipkart NEW
      $("div._30jeq3._16Jk6d").first().text().trim() || // Flipkart OLD
      $("span._30jeq3").first().text().trim() || // Mobile layout
      $("#priceblock_ourprice").text().trim() || // Amazon Our Price
      $("#priceblock_dealprice").text().trim() || // Amazon Deal Price
      $("[class*='price']").first().text().trim() || // Fallback class
      $("meta[property='product:price:amount']").attr("content") ||
      null;

    const price = cleanPrice(rawPrice);

    //-------------------------
    // Extract Image
    //-------------------------
    const image =
      $("meta[property='og:image']").attr("content") ||
      $("img").first().attr("src") ||
      "https://via.placeholder.com/400x300?text=No+Image";

    //-------------------------
    // Send Response
    //-------------------------
    res.json({ title, description, price, image });

  } catch (error) {
    console.error("❌ Scraper Error:", error);
    res.status(500).json({ error: "Failed to fetch product data" });
  }
});

// -------------------------
// Start Server
// -------------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});