import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import cheerio from "cheerio";

const app = express();
app.use(cors());

// Helper → extract text safely
const text = ($, sel) => $(sel).first().text().trim() || null;

// Helper → extract image
const img = ($, sel) => $(sel).first().attr("src") || $(sel).first().attr("data-src") || null;

// SCRAPER FUNCTION
async function scrapeProduct(url) {
  try {
    const html = await fetch(url).then(r => r.text());
    const $ = cheerio.load(html);

    let title =
      text($, "#productTitle") ||
      text($, ".B_NuCI") || 
      text($, ".pdp-title") ||
      text($, ".prod-name") ||
      "Untitled Product";

    let price =
      text($, "#priceblock_ourprice") ||
      text($, "#priceblock_dealprice") ||
      text($, ".a-price-whole") ||
      text($, "._30jeq3") ||
      text($, ".prod-sp") ||
      text($, ".prod-price") ||
      null;

    let image =
      img($, "#landingImage") ||
      img($, ".a-dynamic-image") ||
      img($, "._396cs4") ||
      img($, ".image-grid-image") ||
      img($, ".rilrtl-lazy-img") ||
      null;

    let description =
      text($, "#feature-bullets") ||
      text($, ".a-expander-content") ||
      text($, ".prod-description") ||
      null;

    return { title, price, image, description };
  } catch (err) {
    return {
      title: "Untitled Product",
      price: null,
      image: null,
      description: null
    };
  }
}

// API route
app.get("/scrape", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.json({ error: "Missing URL" });

  const data = await scrapeProduct(url);
  res.json(data);
});

// Start server
app.listen(10000, () => console.log("✔ Backend running on port 10000"));