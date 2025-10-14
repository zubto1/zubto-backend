import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import * as cheerio from "cheerio";

const app = express();
app.use(cors());

// Route: /preview?url=https://example.com
app.get("/preview", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: "Missing URL" });

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      },
    });
    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract meta tags
    const title =
      $('meta[property="og:title"]').attr("content") ||
      $("title").text() ||
      "No title found";

    const description =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      "No description found";

    const image =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      "https://via.placeholder.com/400x300?text=No+Image";

    res.json({ title, description, image });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
