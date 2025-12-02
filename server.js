const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;
const SCRAPER_API_KEY = "971bac6a367029d56ec4018cb37d9a9b";   // ← your key

app.get("/", (req, res) => res.send("Zubto scraper is alive"));

app.get("/scrape", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL required" });

  try {
    // render=true forces JavaScript rendering (critical for Flipkart prices)
    const apiUrl = `http://api.scraperapi.com?api_key=\( {SCRAPER_API_KEY}&url= \){encodeURIComponent(url)}&render=true&country_code=in`;
    
    const response = await fetch(apiUrl, { timeout: 30000 });
    
    if (!response.ok) {
      const text = await response.text();
      console.log("ScraperAPI error page:", text.substring(0, 500));
      return res.status(502).json({ error: "ScraperAPI blocked or no credits" });
    }

    const html = await response.text();
    if (html.includes("Checking your browser") || html.includes("Cloudflare")) {
      return res.status(503).json({ error: "Blocked by Cloudflare" });
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

    // ==== PRICE (Flipkart + Amazon) ====
    let price = "Price not found";

    if (url.includes("flipkart.com")) {
      price = 
        $("div._30jeq3._16Jk6d").text().trim() ||           // old big price
        $("div.Nx9bqj.CxhGGd").text().trim() ||             // new 2025 price
        $("div.CxhGGd").text().trim() ||                    // another variant
        $("span._3qZ21b").text().trim() ||                  // common span
        $( "div:contains('₹'), span:contains('₹')" ).first().text().trim() ||
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
                  $("img.q6DClP").attr("src") ||     // Flipkart high-res
                  $("img").first().attr("src") ||
                  "https://via.placeholder.com/400x400.png?text=No+Image";

    res.json({ title, description, price, image });

  } catch (err) {
    console.error("Scrape error:", err.message);
    res.status(500).json({ 
      error: "Scraping failed", 
      details: err.message 
    });
  }
});

app.listen(PORT, () => console.log(`Server live on port ${PORT}`));