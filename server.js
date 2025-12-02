const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const SCRAPER_API_KEY = "971bac6a367029d56ec4018cb37d9a9b";

app.get("/", (req, res) => res.send("Zubto scraper ready"));

app.get("/scrape", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL required" });

  try {
    const apiUrl = `http://api.scraperapi.com?api_key=\( {SCRAPER_API_KEY}&url= \){encodeURIComponent(url)}&country_code=in`;
    const response = await fetch(apiUrl);
    const html = await response.text();

    const $ = cheerio.load(html);

    const title = $("meta[property='og:title']").attr("content") ||
                  $("span.B_NuCI").text().trim() ||
                  $("title").text().split("|")[0].trim();

    const description = $("meta[property='og:description']").attr("content") ||
                        $("meta[name='description']").attr("content");

    let price = "Price not found";
    if (url.includes("flipkart.com")) {
      price = $("div.Nx9bqj.CxhGGd").text().trim() ||
              $("div._30jeq3._16Jk6d").text().trim() ||
              $("div.CxhGGd").text().trim() ||
              $("div._30jeq3").text().trim() ||
              html.match(/₹[0-9,]+/)?.[0] ||
              "Price not found";
    }
    if (url.includes("amazon.")) {
      price = $("span.a-offscreen").first().text().trim() || "Price not found";
    }

    const image = $("meta[property='og:image']").attr("content") ||
                  "https://via.placeholder.com/400x400.png?text=No+Image";

    res.json({ title, description, price, image });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

app.listen(PORT, () => console.log("Server running on port " + PORT));