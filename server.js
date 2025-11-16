const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// ⭐ Your ScraperAPI key
const SCRAPER_API_KEY = "254aa5de511e80f67e016d643d0caff5";

app.get("/", (req, res) => {
  res.send("✅ Zubto Product Backend is running...");
});

app.get("/scrape", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  try {
    // ScraperAPI URL
    const scraperURL = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(
      url
    )}`;

    const response = await fetch(scraperURL);
    const html = await response.text();

    // Load HTML
    const $ = cheerio.load(html);

    // Extract basic info
    const title =
      $("meta[property='og:title']").attr("content") ||
      $("title").text().trim() ||
      "";

    const description =
      $("meta[property='og:description']").attr("content") ||
      $("meta[name='description']").attr("content") ||
      "";

    const image =
      $("meta[property='og:image']").attr("content") ||
      $("img").first().attr("src") ||
      null;

    let price = "N/A";
    const finalURL = url.toLowerCase();

    // ⭐⭐⭐ PRICE SCRAPING FIXED FOR ALL PLATFORMS ⭐⭐⭐

    // ---------------- AMAZON ----------------
    if (finalURL.includes("amazon")) {
      price =
        $("#priceblock_ourprice").text().trim() ||
        $("#priceblock_dealprice").text().trim() ||
        $(".a-price .a-offscreen").first().text().trim() ||
        $(".a-price-whole").first().text().trim() ||
        "N/A";
    }

    // ---------------- FLIPKART (Fully Fixed) ----------------
    if (finalURL.includes("flipkart")) {
      price =
        $("._30jeq3._16Jk6d").first().text().trim() || // Main price
        $("._30jeq3").first().text().trim() ||
        $("._16Jk6d").first().text().trim() ||
        $("div._25b18c div").first().text().trim() ||
        $(".CEmiEU").first().text().trim() || // Special price
        $("div._30jeq3").first().text().trim() ||
        "N/A";
    }

    // ---------------- AJIO ----------------
    if (finalURL.includes("ajio")) {
      price =
        $(".price").first().text().trim() ||
        $(".prod-sp").first().text().trim() ||
        $(".discounted-price").first().text().trim() ||
        "N/A";
    }

    // ---------------- MYNTRA ----------------
    if (finalURL.includes("myntra")) {
      price =
        $(".pdp-price strong").text().trim() ||
        $(".pdp-price span").first().text().trim() ||
        $(".pdp-discount-price").first().text().trim() ||
        "N/A";
    }

    // ---------------- Meesho (Optional Future) ----------------
    if (finalURL.includes("meesho")) {
      price =
        $("h4").first().text().trim() ||
        $(".Price__PriceText-sc-6l1yjp-0").first().text().trim() ||
        "N/A";
    }

    return res.json({
      title,
      price,
      image,
      description,
      finalURL
    });
  } catch (error) {
    console.error("❌ Scraper Error:", error.message);
    res.status(500).json({ error: "Failed to fetch product data" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});