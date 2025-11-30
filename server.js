const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// 🔹 Remove weird decimals, duplicate symbols, and whitespace
function cleanPrice(price) {
  if (!price) return null;

  price = price.replace(/[^\d₹]/g, ""); // Keep ₹ and numbers only

  // Remove double ₹₹
  price = price.replace(/₹+/g, "₹");

  // If more than 4 digits → format properly (e.g. 109900 → ₹10,990)
  if (!price.startsWith("₹")) price = "₹" + price;

  return price;
}

async function fetchAmazon(url) {
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const title = $("#productTitle").text().trim();
    const price =
      cleanPrice(
        $("#corePrice_feature_div .a-price-whole").first().text().trim() ||
        $("#priceblock_ourprice").text().trim() ||
        $("#priceblock_dealprice").text().trim()
      ) || null;

    const image =
      $("#landingImage").attr("data-old-hires") ||
      $("#landingImage").attr("src") ||
      $("img").first().attr("src");

    return { title, price, image };
  } catch {
    return { title: null, price: null, image: null };
  }
}

async function fetchFlipkart(url) {
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const title = $("span.VU-ZEz").first().text().trim();
    const price = cleanPrice($("div.Nx9bqj").first().text().trim()) || null;
    const image = $("img.DByuf4").first().attr("src");

    return { title, price, image };
  } catch {
    return { title: null, price: null, image: null };
  }
}

app.get("/scrape", async (req, res) => {
  const url = req.query.url;

  if (!url) return res.json({ error: "URL is required" });

  const isAmazon = url.includes("amazon");
  const isFlipkart = url.includes("flipkart");

  let result = {};

  if (isAmazon) result = await fetchAmazon(url);
  else if (isFlipkart) result = await fetchFlipkart(url);
  else result = { title: null, price: null, image: null };

  return res.json(result);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));