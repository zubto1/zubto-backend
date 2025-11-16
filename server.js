const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// Your ScraperAPI key
const SCRAPER_API_KEY = "254aa5de511e80f67e016d643d0caff5";

app.get("/", (req, res) => {
  res.send("✅ Zubto Product Backend is running...");
});

app.get("/scrape", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  try {
    const scraperURL = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&render=true&country=us&url=${encodeURIComponent(url)}`;
    const response = await fetch(scraperURL);
    const html = await response.text();
    const $ = cheerio.load(html);

    // ---- TITLE ----
    const title =
      $("meta[property='og:title']").attr("content") ||
      $("title").text() ||
      "No title found";

    // ---- DESCRIPTION ----
    const description =
      $("meta[property='og:description']").attr("content") ||
      $("meta[name='description']").attr("content") ||
      "No description found";

    // ---- IMAGE ----
    const image =
      $("meta[property='og:image']").attr("content") ||
      $("img").first().attr("src") ||
      "https://via.placeholder.com/400x300?text=No+Image";

    // ---- PRICE (Based on URL type) ----
    let price = "N/A";
    
    // ---------------------- AMAZON ----------------------
    if (url.includes("amazon")) {
      price =
        $("#priceblock_ourprice").text().trim() ||
        $("#priceblock_dealprice").text().trim() ||
        $(".a-price .a-offscreen").first().text().trim() ||
        $("span.a-price-whole").first().text().trim() ||
        $("#corePrice_feature_div .a-offscreen").first().text().trim() ||
        $("#tp_price_block_total_price_ww .a-offscreen").first().text().trim();
    }

    // ---------------------- FLIPKART ----------------------
    if (url.includes("flipkart")) {
      price =
        $("._30jeq3").first().text().trim() ||   // main product price
        $("._3I9_wc").first().text().trim();     // old price
    }

    // ---------------------- MEESHO ----------------------
    if (url.includes("meesho")) {
      price =
        $("h4").first().text().trim() ||
        $("meta[property='product:price:amount']").attr("content");
    }

    // ---------------------- AJIO ----------------------
    if (url.includes("ajio")) {
      price =
        $(".prod-price-section .price").first().text().trim() ||
        $(".price").first().text().trim();
    }

    // ---------------------- MYNTRA ----------------------
    if (url.includes("myntra")) {
      price =
        $(".pdp-price span").first().text().trim() ||
        $(".discounted-price").first().text().trim();
    }

    // Cleanup price format (optional)
    if (price) {
      price = price.replace(/[^0-9₹.,]/g, "");
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