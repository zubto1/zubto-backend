import express from "express";
import cors from "cors";
import puppeteer from "puppeteer";
import cheerio from "cheerio";

const app = express();
app.use(cors());

// Puppeteer safe launch for Render
async function launchBrowser() {
  return await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process"
    ]
  });
}

// Extractor function for all platforms
async function scrapeProduct(url) {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 25000
    });

    const html = await page.content();
    const $ = cheerio.load(html);

    // ---------- TITLE ----------
    const title =
      $("#productTitle").text().trim() ||            // Amazon
      $(".B_NuCI").text().trim() ||                  // Flipkart
      $("h1").first().text().trim() ||
      "Untitled Product";

    // ---------- PRICE ----------
    const price =
      $("#priceblock_ourprice").text().trim() ||     // Amazon
      $("#priceblock_dealprice").text().trim() ||
      $(".a-price .a-offscreen").first().text().trim() ||
      $("._30jeq3").text().trim() ||                 // Flipkart
      $(".prod-sp").text().trim() ||                 // Ajio
      null;

    // ---------- IMAGE ----------
    const image =
      $("#landingImage").attr("src") ||              // Amazon
      $("._396cs4").attr("src") ||                   // Flipkart
      $("img").first().attr("src") ||
      null;

    // ---------- DESCRIPTION ----------
    let description =
      $("#feature-bullets").text().trim() ||         // Amazon
      $(".a-expander-content").text().trim() ||
      null;

    if (description && description.length > 350) {
      description = description.substring(0, 350) + "...";
    }

    await browser.close();

    return { title, price, image, description };
  } catch (err) {
    await browser.close();
    return {
      title: "Untitled Product",
      price: null,
      image: null,
      description: null
    };
  }
}

// API Route
app.get("/scrape", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.json({ error: "Missing URL" });

  const info = await scrapeProduct(url);
  res.json(info);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Backend running at " + PORT));