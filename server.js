const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const SCRAPER_API_KEY = "254aa5de511e80f67e016d643d0caff5";

// Clean Price
function cleanPrice(rawPrice) {
  if (!rawPrice) return null;
  const numbers = rawPrice.match(/\d+(\.\d+)?/g);
  if (!numbers) return null;
  const number = parseFloat(numbers[0]);
  return `₹${number.toLocaleString()}`;
}

// Force desktop version + unblock redirect short links
async function fetchHTML(url) {
  const scraperURL =
    `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&device_type=desktop&url=${encodeURIComponent(url)}`;
  
  const response = await fetch(scraperURL);
  return await response.text();
}

app.get("/", (req, res) => {
  res.send("🚀 Zubto Scraper Backend Running!");
});

app.get("/scrape", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  try {
    const html = await fetchHTML(url);
    const $ = cheerio.load(html);

    const isAmazon = url.includes("amazon");
    const isFlipkart = url.includes("flipkart");

    // Product Title
    const title =
      $("meta[property='og:title']").attr("content") ||
      $("span.B_NuCI").text().trim() ||
      $("title").text().trim() ||
      "No title found";

    // Description
    const description =
      $("meta[property='og:description']").attr("content") ||
      $("div._1mXcCf").text().trim() ||
      $("meta[name='description']").attr("content") ||
      "No description found";

    // Price (Amazon & Flipkart)
    let rawPrice =
      $("#priceblock_ourprice").text().trim() ||
      $("#priceblock_dealprice").text().trim() ||
      $(".a-price .a-offscreen").first().text().trim() ||
      $("div._30jeq3._16Jk6d").first().text().trim() ||
      $("div.Nx9bqj.CxhGGd").first().text().trim() ||
      null;

    const price = cleanPrice(rawPrice);

    // MRP
    const mrp = cleanPrice(
      $("div._3I9_wc._2p6lqe").text().trim() || 
      $("#priceblock_ourprice").text()?.trim() ||
      null
    );

    // Discount
    const discount =
      $("div._3Ay6Sb span").first().text().trim() || // Flipkart
      $(".savingsPercentage").first().text().trim() || // Amazon
      null;

    // Ratings
    const rating =
      $("div._3LWZlK").first().text().trim() ||
      $(".a-icon-alt").first().text().trim() ||
      $("#acrPopover").attr("title") ||
      null;

    // Reviews Count
    const reviews =
      $("span._2_R_DZ").text().trim() || // Flipkart
      $("#acrCustomerReviewText").text().trim() ||
      null;

    // Product Image (best quality)
    const image =
      $("#landingImage").attr("src") ||
      $(".imgTagWrapper img").attr("data-old-hires") ||
      $("meta[property='og:image']").attr("content") ||
      $("img._396cs4").first().attr("src") ||
      $("img").first().attr("src") ||
      "https://via.placeholder.com/400x300?text=No+Image";

    res.json({
      url,
      title,
      description,
      price,
      mrp,
      discount,
      rating,
      reviews,
      image
    });

  } catch (err) {
    console.error("Scraping Error:", err);
    res.status(500).json({ error: "Failed to scrape product data" });
  }
});

app.listen(PORT, () => {
  console.log(`🔥 Scraper backend ready on port ${PORT}`);
});