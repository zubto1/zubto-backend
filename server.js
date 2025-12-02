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
    const response = await fetch(scraperURL);
    const html = await response.text();
    const $ = cheerio.load(html);

    let title = "No title found";
    let description = "No description found";
    let price = "Price not found";
    let image = "https://via.placeholder.com/400x300?text=No+Image";

    // =============== UNIVERSAL TITLE ===============
    title =
      $("meta[property='og:title']").attr("content") ||
      $("title").text().trim() ||
      $("h1").first().text().trim();

    // =============== DESCRIPTION ===============
    description =
      $("meta[property='og:description']").attr("content") ||
      $("meta[name='description']").attr("content") ||
      $("meta[name='twitter:description']").attr("content") ||
      description;

    // =============== IMAGE ===============
    image =
      $("meta[property='og:image']").attr("content") ||
      $("meta[property='og:image:secure_url']").attr("content") ||
      $("img[data-testid='product-image']")?.attr("src") ||
      $("img").first().attr("src") ||
      image;

    // =============== FLIPKART PRICE LOGIC (2025 Working) ===============
    if (url.includes("flipkart.com")) {
      // Method 1: Look for the most common current price pattern (as of Dec 2025)
      const priceText = $("div[class*='Nx9bqj']").first().text().trim() || // Main price (big font)
                        $("div[class*='CxhGGd']").first().text().trim() || // Alternative big price
                        $("div[class*='hl05eU'] div[class*='Nx9bqj']").text().trim(); // New layout inside flex

      if (priceText && priceText.includes("₹")) {
        price = priceText;
      } else {
        // Method 2: Fallback - find any text containing ₹ and looks like a price
        const allText = $("body").text();
        const priceMatch = allText.match(/₹\s*[\d,]+(\.\d+)?/g);
        if (priceMatch) {
          // Get the largest one (usually current price, not MRP)
          const prices = priceMatch
            .map(p => parseFloat(p.replace(/[₹,]/g, "")))
            .filter(n => !isNaN(n));
          if (prices.length > 0) {
            const maxPrice = Math.max(...prices);
            price = "₹" + maxPrice.toLocaleString("en-IN");
          }
        }
      }
    }
    // =============== AMAZON PRICE LOGIC (Still Works Great) ===============
    else if (url.includes("amazon.in") || url.includes("amzn.")) {
      price =
        $("span.a-price-whole").first().text().trim() +
        ($("span.a-price-fraction").first().text().trim() || "") ||
        $("span.a-price").first().text().trim() ||
        $("div.a-section.a-spacing-none.aok-align-center span.a-price span.a-offscreen").first().text().trim() ||
        price;
      if (price && price.includes("₹")) price = price.trim();
    }
    // =============== FALLBACK: Any OpenGraph price ===============
    if (price === "Price not found") {
      price =
        $("meta[property='product:price:amount']").attr("content") ||
        $("meta[itemprop='price']").attr("content") ||
        price;
      if (price !== "Price not found") price = "₹" + parseFloat(price).toLocaleString("en-IN");
    }

    // Final cleanup
    if (typeof price === "string") {
      price = price.replace(/\s+/g, " ").trim();
      if (!price.includes("₹") && price !== "Price not found") {
        price = "₹" + price;
      }
    }

    res.json({
      success: true,
      title: title.substring(0, 200),
      description: description.substring(0, 500),
      price: price === "Price not found" ? null : price,
      image
    });

  } catch (error) {
    console.error("Scraper Error:", error.message);
    res.status(500).json({ error: "Failed to scrape product", details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});