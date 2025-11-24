const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// ⭐ Add your ScraperAPI key here ⭐
const SCRAPER_API_KEY = "263a13252d44362dfc8e75a90bfd9f14";

app.get("/", (req, res) => {
  res.send("🟢 Zubto Deals Backend Running...");
});

app.get("/scrape", async (req, res) => {
  const { url } = req.query;

  if (!url) return res.status(400).json({ error: "Missing URL" });

  try {
    // Use ScraperAPI
    const scraperURL = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(
      url
    )}`;

    const response = await fetch(scraperURL);
    const html = await response.text();
    const $ = cheerio.load(html);

    const title =
      $("meta[property='og:title']").attr("content") ||
      $("title").text().trim() ||
      null;

    const description =
      $("meta[property='og:description']").attr("content") ||
      $("meta[name='description']").attr("content") ||
      null;

    const image =
      $("meta[property='og:image']").attr("content") ||
      $("img").first().attr("src") ||
      null;

    let price = "Not Found";
    const site = url.toLowerCase();

    // ⭐ Price Extraction Rules ⭐
    if (site.includes("amazon")) {
      price =
        $("#priceblock_ourprice").text().trim() ||
        $("#priceblock_dealprice").text().trim() ||
        $(".a-price-whole").first().text().trim() ||
        $(".a-offscreen").first().text().trim() ||
        price;
    }

    if (site.includes("flipkart")) {
      price =
        $("._30jeq3._16Jk6d").first().text().trim() ||
        $("._30jeq3").first().text().trim() ||
        $("div._25b18c div").first().text().trim() ||
        price;
    }

    if (site.includes("ajio")) {
      price =
        $(".price").first().text().trim() ||
        $(".prod-sp").first().text().trim() ||
        price;
    }

    if (site.includes("myntra")) {
      price =
        $(".pdp-price").text().trim() ||
        $(".pdp-discount-price").first().text().trim() ||
        price;
    }

    return res.json({
      success: true,
      title,
      description,
      image,
      price,
      productURL: url,
    });
  } catch (err) {
    console.error("Scrape Error:", err.message);
    res.status(500).json({ error: "Scraping failed" });
  }
});

app.listen(PORT, () => console.log(`🟢 Server started on port ${PORT}`));