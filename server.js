const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// ScraperAPI Key
const apiKey = "263a13252d44362dfc8e75a90bfd9f14";

// Cache for 24 hours
const cache = {};
const CACHE_DURATION = 24 * 60 * 60 * 1000;

function normalizePrice(price) {
  if (!price) return null;
  // Remove ₹ and spaces
  price = price.replace(/[^\d]/g, "");
  return price;
}

async function scrape(url) {
  const cached = cache[url];
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log("Serving from cache:", url);
    return cached.data;
  }

  const apiUrl = `https://api.scraperapi.com/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render=true`;

  const response = await fetch(apiUrl);

  if (!response.ok) {
    throw new Error("ScraperAPI Limit Reached Or Error");
  }

  const body = await response.text();
  const $ = cheerio.load(body);

  let title =
    $("#productTitle").text().trim() ||
    $("span.B_NuCI").text().trim() ||
    null;

  let desc =
    $("#feature-bullets").text().trim() ||
    $("div._1mXcCf").text().trim() ||
    null;

  let image =
    $("#imgTagWrapperId img").attr("src") ||
    $("img._396cs4._2amPTt._3qGmMb").attr("src") ||
    null;

  // ⭐ AMAZON PRICE FIX
  let price =
    $("span.a-offscreen").first().text().trim() ||
    $("span.a-price-whole").first().text().trim();

  // ⭐ FLIPKART PRICE FIX
  if (!price) {
    price = $("div._30jeq3._16Jk6d").first().text().trim();
  }

  price = normalizePrice(price);

  // ⭐ Discount
  let discount =
    $("span.a-price.a-text-price .a-offscreen").first().text().trim() ||
    $("span._3Ay6Sb span").first().text().trim() ||
    null;

  if (discount) discount = discount.replace(/[^\d]/g, "");

  // ⭐ Rating
  let rating =
    $("span.a-icon-alt").first().text().trim() ||
    $("div._3LWZlK").first().text().trim() ||
    null;

  // ⭐ Reviews Count
  let reviews =
    $("#acrCustomerReviewText").first().text().trim() ||
    $("span._2_R_DZ span span").last().text().trim() ||
    null;

  const result = {
    url,
    title: title || "Not Available",
    description: desc || "Not Available",
    image: image || "Not Available",
    price: price || "Not Available",
    discount: discount || "Not Available",
    rating: rating || "Not Available",
    reviews: reviews || "Not Available",
  };

  cache[url] = { timestamp: Date.now(), data: result };
  return result;
}

app.get("/scrape", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL required" });

  try {
    const data = await scrape(url);
    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: "Failed to scrape. Maybe ScraperAPI credits finished?"
    });
  }
});

app.listen(PORT, () => console.log(`Server running on ${PORT}`));