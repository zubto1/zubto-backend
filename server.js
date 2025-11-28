const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// Your ScraperAPI key
const SCRAPER_API_KEY = "254aa5de511e80f67e016d643d0caff5";

/* Helper: Clean Price */
function cleanPrice(rawPrice) {
  if (!rawPrice) return null;
  const numbers = rawPrice.match(/\d+(\.\d+)?/g);
  if (!numbers) return null;
  const number = parseFloat(numbers[0]);
  const finalNumber = Number.isInteger(number) ? number.toString() : number.toFixed(2);
  return `₹${finalNumber}`;
}

/* Root route */
app.get("/", (req, res) => {
  res.send("✅ Zubto Product Backend is running...");
});

/* Scrape route */
app.get("/scrape", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  try {
    const scraperURL = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}`;
    const response = await fetch(scraperURL);
    
    const html = await response.text();
    const $ = cheerio.load(html);
    const isAmazon = url.includes("amazon");
    const isFlipkart = url.includes("flipkart");

    /* Title */
    const title =
      $("meta[property='og:title']").attr("content") ||
      $("span.B_NuCI").text().trim() || // Flipkart
      $("title").text().trim() ||
      "No title found";

    /* Description */
    const description =
      $("meta[property='og:description']").attr("content") ||
      $("div._1mXcCf").text().trim() || // Flipkart
      $("meta[name='description']").attr("content") ||
      "No description found";

    /* Price + MRP + Discount */
    let rawPrice =
      $("div._30jeq3._16Jk6d").first().text().trim() || 
      $("div.Nx9bqj.CxhGGd").first().text().trim() ||
      $(".a-price .a-offscreen").first().text().trim() ||
      $("meta[property='product:price:amount']").attr("content") ||
      null;

    const price = cleanPrice(rawPrice);

    const mrp =
      $("div._3I9_wc._2p6lqe").text().trim() || // Flipkart MRP
      $("#priceblock_ourprice").text().trim() || // Amazon
      $("#priceblock_saleprice").text().trim() ||
      null;

    const discount =
      $("div._3Ay6Sb span").first().text().trim() || // Flipkart
      $(".savingsPercentage").first().text().trim() || // Amazon
      null;

    /* Rating + Reviews */
    const rating =
      $("div._3LWZlK").first().text().trim() || // Flipkart
      $("#acrPopover").attr("title") ||
      $(".a-icon-alt").first().text().trim() ||
      null;

    const reviews =
      $("span._2_R_DZ span").last().text().trim() || // Flipkart
      $("#acrCustomerReviewText").text().trim() ||
      null;

    /* Image */
    const image =
      $("meta[property='og:image']").attr("content") ||
      $("img._396cs4._2amPTt._3qGmMb").attr("src") || // Flipkart desktop
      $("img._396cs4").attr("src") ||
      $("img").first().attr("src") ||
      "https://via.placeholder.com/400x300?text=No+Image";

    /* Send Response */
    res.json({
      url,
      title,
      description,
      price,
      mrp: mrp ? cleanPrice(mrp) : null,
      discount,
      rating,
      reviews,
      image
    });

  } catch (error) {
    console.error("❌ Scraper Error:", error);
    res.status(500).json({ error: "Failed to fetch product data" });
  }
});

/* Run server */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});