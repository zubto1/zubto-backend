const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// 🟢 Replace with your real ScraperAPI key
const SCRAPER_API_KEY = "254aa5de511e80f67e016d643d0caff5";

// -------------------------
// Helper: Clean Price
// -------------------------
function cleanPrice(rawPrice) {
  if (!rawPrice) return null;

  // Match numbers with optional decimal
  const numbers = rawPrice.match(/\d+(\.\d+)?/g);
  if (!numbers || numbers.length === 0) return null;

  // Take first number only
  const number = parseFloat(numbers[0]);

  // Remove decimal if integer
  const finalNumber = Number.isInteger(number) ? number.toString() : number.toFixed(2);

  return `₹${finalNumber}`;
}

// -------------------------
// Root route
// -------------------------
app.get("/", (req, res) => {
  res.send("✅ Zubto Product Backend is running...");
});

// -------------------------
// Scraper route (updated)
// -------------------------
app.get("/scrape", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  try {
    const scraperURL = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}`;
    const response = await fetch(scraperURL);
    const html = await response.text();

    const $ = cheerio.load(html);

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

    // Price (same logic)
    let rawPrice =
      $("div._30jeq3._16Jk6d").first().text().trim() ||
      $("div.Nx9bqj.CxhGGd").first().text().trim() ||
      $("div.Udgv3w").first().text().trim() ||
      $("div.CxhGGd").first().text().trim() ||
      $("._25b18c").first().text().trim() ||
      $("[class*=price]").first().text().trim() ||
      null;

    const price = cleanPrice(rawPrice);

    // Image
    const image =
      $("meta[property='og:image']").attr("content") ||
      $("img").first().attr("src") ||
      "https://via.placeholder.com/400x300?text=No+Image";

    // ⭐ Rating Stars
    const rating =
      $("span._2_R_DZ span").first().text().trim() ||   // Flipkart
      $("#acrPopover").attr("title") ||                 // Amazon
      $("span._3LWZlK").first().text().trim() ||        // Flipkart variant
      "No rating found";

    // 📝 Review Count
    const reviews =
      $("span._2_R_DZ").text().trim() ||                // Flipkart review text
      $("#acrCustomerReviewText").text().trim() ||      // Amazon "2,345 ratings"
      "No reviews found";

    // ⬇️ Discount Percentage
    const discount =
      $("div._3Ay6Sb span").first().text().trim() ||    // Flipkart discount
      $("span.savingsPercentage").first().text().trim() || // Amazon discount
      $("span._3I9_wc").first().text().trim() ||       // Flipkart strike price area
      "No discount found";

    // Return All
    res.json({
      title,
      description,
      price,
      image,
      rating,
      reviews,
      discount
    });

  } catch (error) {
    console.error("❌ Scraper Error:", error);
    res.status(500).json({ error: "Failed to fetch product data" });
  }
});

// -------------------------
// Start Server
// -------------------------
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

