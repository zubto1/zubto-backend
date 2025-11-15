const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ⚠️ Put your ScraperAPI key here
const SCRAPER_API_KEY = "263a13252d44362dfc8e75a90bfd9f14";

// Fetch HTML using ScraperAPI (bypass blocks)
async function fetchHTML(url) {
    const apiURL = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&autoparse=false&url=${encodeURIComponent(
        url
    )}`;

    const response = await axios.get(apiURL);
    return response.data;
}

// Extract product data
async function scrapeProduct(url) {
    const html = await fetchHTML(url);
    const $ = cheerio.load(html);

    // Universal selectors for all sites
    const title =
        $("#productTitle").text().trim() ||           // Amazon
        $(".B_NuCI").text().trim() ||                // Flipkart
        $("h1.prod-name").text().trim() ||           // Ajio
        $("h1.pdp-title").text().trim() ||           // Myntra
        $("h1").first().text().trim();

    const image =
        $("#imgTagWrapperId img").attr("src") ||
        $("#landingImage").attr("src") ||
        $("img._2r_T1I").attr("src") ||
        $("img.DByuf4").attr("src") ||
        $("img#prodImageDefault").attr("src") ||
        $("img.pdp-image").attr("src") ||
        $("img").first().attr("src");

    const price =
        $("#priceblock_ourprice").text().trim() ||
        $("#priceblock_dealprice").text().trim() ||
        $("div._30jeq3").text().trim() ||
        $("div.Nx9bqj").text().trim() ||
        $("span.prod-sp").text().trim() ||
        $("span.pdp-price").text().trim() ||
        $("span").filter(function () {
            return $(this).text().includes("₹");
        }).first().text().trim();

    const description =
        $("#feature-bullets").text().trim() ||
        $("div._1mXcCf").text().trim() ||
        $("div.X3BRps").text().trim() ||
        $("div.details").text().trim() ||
        $("p.pdp-product-description-content").text().trim() ||
        $("p").first().text().trim();

    return { title, image, price, description };
}

// API endpoint
app.post("/scrape", async (req, res) => {
    const { url } = req.body;

    if (!url) return res.json({ error: "URL missing" });

    try {
        const data = await scrapeProduct(url);
        res.json(data);
    } catch (error) {
        res.json({ error: true, message: error.message });
    }
});

app.listen(3000, () => console.log("Scraper running on port 3000"));