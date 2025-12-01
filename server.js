const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY; // Set in Render

app.get("/", (req, res) => {
  res.send("Zubto Backend Running 🚀");
});

app.get("/scrape", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.json({ error: "Missing URL" });

  try {
    const scraperURL = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}`;
    const response = await fetch(scraperURL);
    const html = await response.text();
    const $ = cheerio.load(html);

    const title =
      $("meta[property='og:title']").attr("content") ||
      $("title").text().trim() ||
      "No title found";

    const description =
      $("meta[property='og:description']").attr("content") ||
      $("meta[name='description']").attr("content") ||
      "No description found";

    const image =
      $("meta[property='og:image']").attr("content") ||
      $("img").first().attr("src") ||
      null;

    let price = null;

    // Amazon
    if (url.includes("amazon")) {
      price =
        $("#priceblock_ourprice").text().trim() ||
        $("#priceblock_dealprice").text().trim() ||
        $(".a-price-whole").first().text().trim();
    }

    // Flipkart
    if (url.includes("flipkart")) {
      price = $("._30jeq3").first().text().trim();
    }

    // Myntra
    if (url.includes("myntra")) {
      price = $(".pdp-price").text().trim();
    }

    res.json({
      title,
      description,
      image,
      price: price || "N/A"
    });

  } catch (err) {
    res.json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log("🔥 Server started on port:", PORT);
});