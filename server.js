const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const SCRAPER_API_KEY = "971bac6a367029d56ec4018cb37d9a9b";

app.get("/", (req, res) => {
  res.send("Zubto Product Backend is running...");
});

app.get("/scrape", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  try {
    const scraperURL = `http://api.scraperapi.com?api_key=\( {SCRAPER_API_KEY}&url= \){encodeURIComponent(url)}&render=true`;
    const response = await fetch(scraperURL);
    if (!response.ok) throw new Error("ScraperAPI error");

    const html = await response.text();
    const $ = cheerio.load(html);

    const isFlipkart = url.includes("flipkart.com");
    const isAmazon = url.includes("amazon.");

    // Title
    const title =
      $("meta[property='og:title']").attr("content") ||
      $("span.B_NuCI").text().trim() ||
      $("title").text().trim() ||
      "No title found";

    // Description
    const description =
      $("meta[property='og:description']").attr("content") ||
      $("meta[name='description']").attr("content") ||
      "No description found";

    // Price - completely cleaned and fixed
    let price = "Price not found";

    if (isFlipkart) {
      price =
        $("div._30jeq3._16Jk6d span").text().trim() ||
        $("div.Nx9bqj.CxhGGd span").text().trim() ||
        $("div.CxhGGd span").text().trim() ||
        $("span._3qZ21b").text().trim() ||
        $( "span:contains('₹')").first().text().trim() ||
        html.match(/₹[0-9,]+/)?.[0] ||
        "Price not found";
    }

    if (isAmazon) {
      const whole = $("span.a-price-whole").first().text().trim();
      const fraction = $("span.a-price-fraction").first().text().trim();
      const offscreen = $("span.a-offscreen").first().text().trim();

      price = offscreen || (whole && fraction ? whole + fraction : whole) || "Price not found";
    }

    // Image
    const image =
      $("meta[property='og:image']").attr("content") ||
      $("img").first().attr("src") ||
      "https://via.placeholder.com/400x300?text=No+Image";

    res.json({ title, description, price, image });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Scraping failed" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));