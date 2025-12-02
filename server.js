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
      $("span.B_NuCI").text().trim() || // Flipkart title
      $("title").text().trim() ||
      "No title found";

    //-------------------------
    // Extract Description
    //-------------------------
    const description =
      $("meta[property='og:description']").attr("content") ||
      $("meta[name='description']").attr("content") ||
      "No description found";
    
    //-------------------------
    // Extract Price (Strong Version)
    //-------------------------
    let price = 
    $("div._30jeq3._16Jk6d").first().text().trim() ||  // Flipkart old price
    $("div.Nx9bqj.CxhGGd").first().text().trim() ||     // Flipkart 2025 new layout
    $("div.Udgv3w").first().text().trim() ||            // Sale price block
    $("div.CxhGGd").first().text().trim() ||            // Another new class
    $("._25b18c").first().text().trim() ||              // Mobile price layout
    $("[class*=price]").first().text().trim() ||        // Fallback with wildcard
    $("meta[property='product:price:amount']").attr("content") ||
    "Price not found";

    //-------------------------
    // Extract Image
    //-------------------------
    const image =
      $("meta[property='og:image']").attr("content") ||
      $("img").first().attr("src") ||
      "https://via.placeholder.com/400x300?text=No+Image";

    //-------------------------
    // Response
    //-------------------------
    res.json({ title, description, price, image });

  } catch (error) {
    console.error("❌ Scraper Error:", error);
    res.status(500).json({ error: "Failed to fetch product data" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});