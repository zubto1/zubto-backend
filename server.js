const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const SCRAPER_API_KEY = "254aa5de511e80f67e016d643d0caff5"; 

// 🟦 ScraperAPI fetch helper
async function loadHTML(url) {
  const apiURL = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}`;

  const res = await fetch(apiURL);
  return await res.text();
}

// 🟩 AMAZON extractor (Static)
function extractAmazon($) {
  const title =
    $("#productTitle").text().trim() ||
    $("meta[name='title']").attr("content");

  // Price (static sources)
  const price =
    $("span.a-price > span.a-offscreen").first().text().trim() ||
    $("meta[name='twitter:data1']").attr("content") ||
    $("meta[property='og:price:amount']").attr("content") ||
    $("span#priceblock_ourprice").text().trim() ||
    $("span#priceblock_dealprice").text().trim();

  const image =
    $("#landingImage").attr("src") ||
    $("meta[property='og:image']").attr("content");

  const description =
    $("#feature-bullets li span")
      .map((i, el) => $(el).text().trim())
      .get()
      .join(" | ") ||
    $("meta[name='description']").attr("content");

  return { title, price, image, description };
}

// 🟧 FLIPKART extractor (Static JSON)
function extractFlipkart($) {
  let title = $(".B_NuCI").text().trim();

  let price =
    $("._30jeq3").first().text().trim() ||
    $("meta[property='product:price:amount']").attr("content");

  let image =
    $("img._396cs4").attr("src") ||
    $("img._2r_T1I").attr("src") ||
    $("meta[property='og:image']").attr("content");

  // Try embedded JSON
  $("script").each((i, script) => {
    const text = $(script).html();
    if (text && text.includes('"title"') && text.includes('"image"')) {
      try {
        const json = JSON.parse(text);
        title = title || json.name;
        price = price || json.offers?.price;
        image = image || json.image;
      } catch {}
    }
  });

  const description = $("._1mXcCf p")
    .map((i, el) => $(el).text().trim())
    .get()
    .join(" | ");

  return { title, price, image, description };
}

// 🟪 AJIO extractor (Static)
function extractAjio($) {
  const title = $(".prod-sp").first().text().trim();

  const price =
    $(".prod-sp .price").first().text().trim() ||
    $("meta[property='product:price:amount']").attr("content");

  const image =
    $(".image-container img").attr("src") ||
    $("meta[property='og:image']").attr("content");

  const description = $(".prod-descp ul li")
    .map((i, el) => $(el).text().trim())
    .get()
    .join(" | ");

  return { title, price, image, description };
}

// 🟩 MYNTRA extractor (Static)
function extractMyntra($) {
  const title =
    $(".pdp-title").text().trim() +
    " " +
    $(".pdp-name").text().trim();

  const price =
    $(".pdp-price span").first().text().trim() ||
    $("meta[property='product:price:amount']").attr("content");

  const image =
    $(".image-grid-image").attr("src") ||
    $("meta[property='og:image']").attr("content");

  const description = $(".pdp-product-description-content p")
    .map((i, el) => $(el).text().trim())
    .get()
    .join(" | ");

  return { title, price, image, description };
}

// 🟦 SCRAPE ROUTE
app.get("/scrape", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.json({ error: "Missing URL" });

  try {
    const html = await loadHTML(url);
    const $ = cheerio.load(html);

    let result = {
      title: "Untitled Product",
      price: "",
      image: "",
      description: ""
    };

    if (url.includes("amazon")) result = extractAmazon($);
    else if (url.includes("flipkart")) result = extractFlipkart($);
    else if (url.includes("ajio")) result = extractAjio($);
    else if (url.includes("myntra")) result = extractMyntra($);

    res.json(result);
  } catch (err) {
    res.json({ error: "Scraping failed", details: err.message });
  }
});

// 🟧 HOME route
app.get("/", (req, res) => {
  res.send("🟢 Zubto Static Scraper is running");
});

app.listen(PORT, () => console.log(`🔥 Server running on ${PORT}`));