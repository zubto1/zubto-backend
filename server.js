import express from "express";
import cors from "cors";
import puppeteer from "puppeteer";

const app = express();
app.use(cors());

// 🔹 Puppeteer launch settings for Render FREE
async function launchBrowser() {
  return await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
      "--single-process"
    ]
  });
}

// 🔍 Scrape basic product info
async function scrapeProduct(url) {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    const data = await page.evaluate(() => {
      const get = (selector) =>
        document.querySelector(selector)?.textContent?.trim() || null;

      const title =
        get("#productTitle") ||
        get(".a-size-large") ||
        get(".B_NuCI") || // Flipkart
        "Untitled Product";

      const price =
        get("#priceblock_ourprice") ||
        get("#priceblock_dealprice") ||
        get(".a-price-whole") ||
        get("._30jeq3") || // Flipkart
        null;

      const image =
        document.querySelector("#landingImage")?.src ||
        document.querySelector("img")?.src ||
        null;

      return { title, price, image };
    });

    await browser.close();
    return data;
  } catch (err) {
    await browser.close();
    return {
      title: "Untitled Product",
      price: null,
      image: null
    };
  }
}

// 📦 API route
app.get("/scrape", async (req, res) => {
  const { url } = req.query;

  if (!url) return res.json({ error: "Missing URL" });

  const info = await scrapeProduct(url);
  res.json(info);
});

app.listen(10000, () => console.log("Server running on port 10000"));