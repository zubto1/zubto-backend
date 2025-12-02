const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;
const SCRAPER_API_KEY = "971bac6a367029d56ec4018cb37d9a9b";

app.get("/", (req, res) => res.send("Zubto scraper ready"));

app.get("/scrape", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL required" });

  try {
    const apiUrl = `http://api.scraperapi.com?api_key=\( {SCRAPER_API_KEY}&url= \){encodeURIComponent(url)}&country_code=in`;
    const response = await fetch(apiUrl, { timeout: 25000 });
    const html = await response.ok ? await response.text() : "";

    const $ = cheerio.load(html);

    // TITLE
    const title = $("meta[property='og:title']").attr("content") ||
                  $("span.B_NuCI").text().trim() ||
                  $("title").text().split("|")[0].trim() ||
                  "No title";

    // DESCRIPTION
    const description = $("meta[property='og:description']").attr("content") ||
                        $("meta[name='description']").attr("content") ||
                        "No description";

    // PRICE — super strict Flipkart selectors (tested Dec 2025)
    let price = "Price not found";
    if (url.includes("flipkart.com")) {
      price =
        // Main current price (most common right now)
        $("div.Nx9bqj.CxhGGd").first().text().trim() ||           // ₹33,300
        $("div._30jeq3._16Jk6d").first().text().trim() ||         // old big price
        $("div.CxhGGd").first().text().trim() ||                  // another new one
        $("div._30jeq3").first().text().trim() ||                 // backup
        // Last resort: any text that starts with ₹ and has numbers
        \( ("span, div").map((i, el) => \)(el).text()).get()
          .find(t => t.trim().match(/^₹[0-9,]+$/)) || 
        "Price not found";
    }

    // Amazon price (unchanged, works perfectly)
    if (url.includes("amazon.")) {
      const offscreen = $("span.a-offscreen").first().text().trim();
      price = offscreen || [
        $("span.a-price-whole").first().text().trim(),
        $("span.a-price-fraction").first().text().trim()
      ].join("") || "Price not found";
    }

    // IMAGE
    const image = $("meta[property='og:image']").attr("content") ||
                  "https://via.placeholder.com/400x400.png?text=No+Image";

    res.json({ title, description, price, image });

  } catch (err) {
    res.status(500).json({ error: "Failed", details: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));