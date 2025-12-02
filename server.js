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

// Scraper route
app.get("/scrape", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  try {
    const scraperURL = `http://api.scraperapi.com?api_key=\( {SCRAPER_API_KEY}&url= \){encodeURIComponent(url)}`;
    const response = await fetch(scraperURL);
    const html = await response.text();

    const $ = cheerio.load(html);

    // Quick site detection for targeted extraction
    const isFlipkart = url.includes("flipkart.com");
    const isAmazon = url.includes("amazon.");

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
    // Extract Price (Enhanced Version)
    //-------------------------
    let price = "Price not found";

    if (isFlipkart) {
      // Flipkart: Try divs, then grab inner span text (key fix for nested prices)
      price =
        $("div._30jeq3._16Jk6d").first().find('span').first().text().trim() ||
        $("div.Nx9bqj.CxhGGd").first().find('span').first().text().trim() ||
        $("div.Udgv3w").first().find('span').first().text().trim() ||
        $("div.CxhGGd").first().find('span').first().text().trim() ||
        $("._25b18c").first().find('span').first().text().trim() ||
        $("span._3qZ21b").first().text().trim() || // Common price span
        $("[class*='price']").first().find('span').first().text().trim() ||
        // Fallback: Find any span with ₹ symbol (rupees)
        $("span:contains('₹')").first().text().trim() ||
        // Meta fallback
        $("meta[property='product:price:amount']").attr("content") ||
        "Price not found";
    } else if (isAmazon) {
      // Amazon: Specific selectors for rendered prices
      price =
        \( ("span.a-price-whole").first().text().trim() + \)("span.a-price-fraction").first().text().trim() ||
        $("span.a-offscreen").first().text().trim() ||
        $("#priceblock_ourprice").text().trim() ||
        $("#priceblock_dealprice").text().trim() ||
        ".a-price-symbol + .a-price-whole + .a-price-fraction".split(' ').reduce((el, sel) => \( (el).find(sel).first(), \)).text().trim() ||
        // Fallback for $ symbol
        \( ("span:contains(' \)')").first().text().trim() ||
        "Price not found";
    } else {
      // Generic fallback for other sites
      price =
        $("[class*=price], [class*='Price']").first().text().trim() ||
        $("meta[property='product:price:amount']").attr("content") ||
        "Price not found";
    }

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