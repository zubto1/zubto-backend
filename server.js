const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// 🔑 Your ScraperAPI key
const SCRAPER_API_KEY = "254aa5de511e80f67e016d643d0caff5";


// 🔵 1. Expand Flipkart short URLs
async function expandFlipkartURL(shortURL) {
  try {
    const res = await fetch(shortURL, {
      redirect: "manual",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      },
    });

    const location = res.headers.get("location");
    return location || shortURL;
  } catch (err) {
    return shortURL;
  }
}


// 🔵 2. Scraper Function
async function scrapeProduct(finalURL) {
  try {
    const scraperURL = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(
      finalURL
    )}`;

    const response = await fetch(scraperURL);
    const html = await response.text();

    const $ = cheerio.load(html);

    // Title
    const title =
      $("meta[property='og:title']").attr("content") ||
      $("title").text().trim() ||
      $("h1").first().text().trim() ||
      "";

    // Description
    const description =
      $("meta[property='og:description']").attr("content") ||
      $("meta[name='description']").attr("content") ||
      $(".productDescription").text().trim() ||
      "";

    // Image
    const image =
      $("meta[property='og:image']").attr("content") ||
      $("img").first().attr("src") ||
      null;

    // Price - covers Amazon / Flipkart / Ajio / Myntra
    const priceSelectors = [
      "#priceblock_ourprice",
      "#priceblock_dealprice",
      ".a-price .a-offscreen",
      "._30jeq3",           // Flipkart
      "._16Jk6d",           // Flipkart
      ".prod-sp",           // Ajio
      ".price",             // Generic
      ".pdp-price",         // Myntra
      ".discounted-price"   // Ajio alt
    ];

    let price = "N/A";
    for (let s of priceSelectors) {
      let p = $(s).first().text().trim();
      if (p && p.length > 1) {
        price = p;
        break;
      }
    }

    return {
      title,
      price,
      image,
      description,
      finalURL,
    };
  } catch (err) {
    return {
      error: "Scraping failed",
      details: err.message,
    };
  }
}


// 🔵 3. Endpoint
app.get("/scrape", async (req, res) => {
  let { url } = req.query;
  if (!url) return res.json({ error: "URL is required" });

  // Expand Flipkart short link
  if (url.includes("dl.flipkart.com")) {
    url = await expandFlipkartURL(url);
  }

  const data = await scrapeProduct(url);
  res.json(data);
});


// Home route
app.get("/", (req, res) => {
  res.send("✅ Zubto Product Backend is running...");
});


// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});