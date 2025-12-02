const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;
const SCRAPER_API_KEY = "971bac6a367029d56ec4018cb37d9a9b";

// Simple in-memory cache (expires in 5 mins)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

app.get("/", (req, res) => res.send("Zubto scraper is alive"));

app.get("/scrape", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL required" });

  // Check cache first
  const cacheKey = url;
  if (cache.has(cacheKey)) {
    const { data, timestamp } = cache.get(cacheKey);
    if (Date.now() - timestamp < CACHE_TTL) {
      return res.json(data);
    }
  }

  try {
    // Try ScraperAPI first (without render=true to reduce blocks)
    let html = "";
    let usedScraperAPI = false;
    
    const apiUrl = `http://api.scraperapi.com?api_key=\( {SCRAPER_API_KEY}&url= \){encodeURIComponent(url)}&country_code=in`;
    let response = await fetch(apiUrl, { timeout: 20000 });
    
    if (response.ok) {
      html = await response.text();
      usedScraperAPI = true;
    }

    // If ScraperAPI gives block/error, fallback to direct fetch with stealth
    if (!response.ok || html.includes("Cloudflare") || html.includes("blocked") || html.length < 1000) {
      console.log("🔄 ScraperAPI blocked, trying direct fetch...");
      const directHeaders = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      };
      response = await fetch(url, { headers: directHeaders, timeout: 15000 });
      if (response.ok) {
        html = await response.text();
      } else {
        return res.status(502).json({ error: "Both ScraperAPI and direct fetch failed" });
      }
    }

    const $ = cheerio.load(html);

    // ==== TITLE ====
    const title = $("meta[property='og:title']").attr("content") ||
                  $("span.B_NuCI").text().trim() ||
                  $("title").text().split("|")[0].trim() ||
                  "No title";

    // ==== DESCRIPTION ====
    const description = $("meta[property='og:description']").attr("content") ||
                        $("meta[name='description']").attr("content") ||
                        "No description";

    // ==== PRICE ====
    let price = "Price not found";

    if (url.includes("flipkart.com")) {
      price = 
        $("div._30jeq3._16Jk6d").text().trim() ||
        $("div.Nx9bqj.CxhGGd").text().trim() ||
        $("div.CxhGGd").text().trim() ||
        $("span._3qZ21b").text().trim() ||
        $("div:contains('₹'), span:contains('₹')").first().text().trim() ||
        html.match(/₹\d[\d,]+/)?.[0] || 
        "Price not found";
    }

    if (url.includes("amazon.")) {
      const offscreen = $("span.a-offscreen").first().text().trim();
      if (offscreen) price = offscreen;
      else {
        const whole = $("span.a-price-whole").first().text().trim();
        const fraction = $("span.a-price-fraction").first().text().trim();
        price = whole && fraction ? whole + fraction : whole || "Price not found";
      }
    }

    // ==== IMAGE ====
    const image = $("meta[property='og:image']").attr("content") ||
                  $("img.q6DClP").attr("src") ||
                  $("img").first().attr("src") ||
                  "https://via.placeholder.com/400x400.png?text=No+Image";

    const result = { title, description, price, image };
    
    // Cache the result
    cache.set(cacheKey, { data: result, timestamp: Date.now() });

    res.json(result);

  } catch (err) {
    console.error("Scrape error:", err.message);
    res.status(500).json({ 
      error: "Scraping failed", 
      details: err.message 
    });
  }
});

app.listen(PORT, () => console.log(`Server live on port ${PORT}`));