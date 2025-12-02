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
    const scraperURL = `http://api.scraperapi.com?api_key=\( {SCRAPER_API_KEY}&url= \){encodeURIComponent(url)}&render=true`;
    console.log("🔍 Fetching from ScraperAPI:", scraperURL.substring(0, 100) + "..."); // Debug log
    const response = await fetch(scraperURL);
    
    if (!response.ok) {
      throw new Error(`ScraperAPI failed: \( {response.status} - \){response.statusText}`);
    }
    
    const html = await response.text();
    console.log("📄 HTML length:", html.length); // Debug log

    let $;
    try {
      $ = cheerio.load(html);
    } catch (loadErr) {
      console.error("❌ Cheerio load failed:", loadErr.message);
      return res.status(500).json({ error: "Failed to parse HTML" });
    }

    // Quick site detection for targeted extraction
    const isFlipkart = url.includes("flipkart.com");
    const isAmazon = url.includes("amazon.");
    console.log("🌐 Site detected:", isFlipkart ? "Flipkart" : isAmazon ? "Amazon" : "Other"); // Debug

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
    // Extract Price (Robust Version with Try-Catch)
    //-------------------------
    let price = "Price not found";
    try {
      if (isFlipkart) {
        // Flipkart: Try divs, then grab inner span text
        price =
          $("div._30jeq3._16Jk6d span").first().text().trim() ||
          $("div.Nx9bqj.CxhGGd span").first().text().trim() ||
          $("div.Udgv3w span").first().text().trim() ||
          $("div.CxhGGd span").first().text().trim() ||
          $("._25b18c span").first().text().trim() ||
          $("span._3qZ21b").first().text().trim() || // Common price span
          $("[class*='price'] span").first().text().trim() ||
          // Fallback: Find any text with ₹ symbol
          (() => {
            const rupeeTexts = \( ("span, div").filter((i, el) => \)(el).text().includes('₹')).map((i, el) => $(el).text().trim()).get();
            return rupeeTexts.find(text => /^\₹[\d,]+/.test(text)) || "";
          })() ||
          // Regex fallback on full body (last resort)
          html.match(/₹[\d,]+/g)?.[0] || "";
        
        if (price === "") price = "Price not found";
      } else if (isAmazon) {
        // Amazon: Direct selectors, no chaining issues
        const whole = $("span.a-price-whole").first().text().trim();
        const fraction = $("span.a-price-fraction").first().text().trim();
        const combined = whole && fraction ? `\( {whole} \){fraction}` : "";
        
        price =
          combined ||
          $("span.a-offscreen").first().text().trim() ||
          $("#priceblock_ourprice").text().trim() ||
          $("#priceblock_dealprice").text().trim() ||
          // Fallback for $ symbol
          (() => {
            const dollarTexts = \( ("span, div").filter((i, el) => \)(el).text().includes('\( ')).map((i, el) => \)(el).text().trim()).get();
            return dollarTexts.find(text => /^\$[\d,]+/.test(text)) || "";
          })() ||
          "";
        
        if (price === "") price = "Price not found";
      } else {
        // Generic
        price =
          $("[class*=price], [class*='Price']").first().text().trim() ||
          $("meta[property='product:price:amount']").attr("content") ||
          "Price not found";
      }
      console.log("💰 Extracted price:", price); // Debug
    } catch (priceErr) {
      console.error("❌ Price extraction failed:", priceErr.message);
      price = "Price extraction error";
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
    console.error("❌ Scraper Error:", error.message);
    res.status(500).json({ error: "Failed to fetch product data", details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});