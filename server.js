import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();
app.use(cors());

// ---- FIXED: Flipkart short URL expansion ----
async function expandURL(url) {
  try {
    const response = await axios.head(url, {
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    return response.request.res.responseUrl || url;

  } catch (err) {
    return url;
  }
}

// -------- Universal Scraper --------
async function scrapeProduct(url) {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    // STEP 1: OPEN URL (short link allowed)
    await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });

    // STEP 2: GET REAL URL after redirect
    const finalURL = page.url();

    // STEP 3: LOAD REAL PRODUCT PAGE
    await page.goto(finalURL, { waitUntil: "networkidle2", timeout: 45000 });

    // Get HTML
    const html = await page.content();
    const $ = cheerio.load(html);

    let title = null, price = null, image = null, description = null;

    // AMAZON
    if (finalURL.includes("amazon")) {
      title = $("#productTitle").text().trim();
      price =
        $("#priceblock_ourprice").text().trim() ||
        $("#priceblock_dealprice").text().trim() ||
        $(".a-price-whole").first().text().trim();
      image = $("#landingImage").attr("src");
      description = $("#feature-bullets ul li span")
        .map((i, el) => $(el).text().trim())
        .get()
        .join(" | ");
    }

    // FLIPKART
    if (finalURL.includes("flipkart")) {
      title = $(".B_NuCI").text().trim();
      price = $("._30jeq3").first().text().trim();
      image = $("img._396cs4").attr("src");
      description = $("._1mXcCf p")
        .map((i, el) => $(el).text().trim())
        .get()
        .join(" | ");
    }

    // AJIO
    if (finalURL.includes("ajio")) {
      title = $(".prod-sp h1").text().trim();
      price = $(".prod-price").first().text().trim();
      image = $(".image-container img").attr("src");
      description = $(".prod-descp ul li")
        .map((i, el) => $(el).text().trim())
        .get()
        .join(" | ");
    }

    // MYNTRA
    if (finalURL.includes("myntra")) {
      title = $(".pdp-title").text().trim() + " " + $(".pdp-name").text().trim();
      price = $(".pdp-price span").first().text().trim();
      image = $(".image-grid-image").attr("src");
      description = $(".pdp-product-description-content p")
        .map((i, el) => $(el).text().trim())
        .get()
        .join(" | ");
    }

    await browser.close();

    return {
      title: title || "Untitled Product",
      price: price || "N/A",
      image: image || null,
      description: description || "No description found",
      finalURL
    };

  } catch (err) {
    await browser.close();
    return {
      title: "Untitled Product",
      price: "N/A",
      image: null,
      description: "No description found",
      error: err.message
    };
  }
}

// -------- API Route --------
app.get("/scrape", async (req, res) => {
  const { url } = req.query;

  if (!url) return res.json({ error: "Missing URL" });

  const data = await scrapeProduct(url);
  res.json(data);
});

// Server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("🔥 Backend running on " + PORT));