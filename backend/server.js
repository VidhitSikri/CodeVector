require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const Product = require("./models/Product");

const app = express();
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// WHY CURSOR-BASED PAGINATION?
//
// Offset pagination (SKIP/LIMIT) is broken when data changes:
//   - New items inserted at the top shift every page → duplicates on next page
//   - Items deleted → you skip items
//   - SKIP is also O(n) in MongoDB — slow on large collections
//
// Cursor-based pagination solves all of this:
//   - We remember WHERE we were (the last item's createdAt + _id)
//   - Each page asks: "give me items created BEFORE this cursor"
//   - Insertions at the top don't affect any existing cursor position
//   - The compound index (createdAt, _id) makes this O(log n)
// ---------------------------------------------------------------------------

const PAGE_LIMIT = 20;

// GET /api/products?category=Electronics&cursor=<base64-encoded-cursor>
app.get("/api/products", async (req, res) => {
  try {
    const { category, cursor } = req.query;

    // Build the base filter
    const filter = {};
    if (category && category !== "all") {
      filter.category = category;
    }

    // Decode cursor if provided
    if (cursor) {
      let cursorData;
      try {
        cursorData = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
      } catch {
        return res.status(400).json({ error: "Invalid cursor" });
      }

      const { createdAt, _id } = cursorData;

      // Fetch items that come AFTER the cursor position in our sort order
      // (i.e., older items — since we sort newest first)
      //
      // The condition is: createdAt < lastCreatedAt
      //               OR: (createdAt === lastCreatedAt AND _id < last_id)
      //
      // This handles the edge case where multiple products share the same
      // createdAt timestamp — _id acts as a tiebreaker.
      filter.$or = [
        { createdAt: { $lt: new Date(createdAt) } },
        {
          createdAt: new Date(createdAt),
          _id: { $lt: new mongoose.Types.ObjectId(String(_id)) },
        },
      ];
    }

    const products = await Product.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(PAGE_LIMIT + 1) // fetch one extra to know if there's a next page
      .lean();

    const hasNextPage = products.length > PAGE_LIMIT;
    if (hasNextPage) products.pop(); // remove the extra item

    // Build next cursor from the last item in this page
    let nextCursor = null;
    if (hasNextPage && products.length > 0) {
      const last = products[products.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({ createdAt: last.createdAt, _id: last._id })
      ).toString("base64");
    }

    res.json({
      products,
      nextCursor,
      hasNextPage,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/categories — return distinct category list
app.get("/api/categories", async (req, res) => {
  try {
    const categories = await Product.distinct("category");
    res.json(categories.sort());
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/stats — quick count stats
app.get("/api/stats", async (req, res) => {
  try {
    const total = await Product.estimatedDocumentCount();
    res.json({ total });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Connect to MongoDB then start server
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });
