const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("./models/Product");

// -------------------------------------------------------------------
// Seed script: inserts 200,000 products in bulk (fast, not a loop).
// Uses MongoDB bulkWrite/insertMany in batches of 5,000 so we don't
// blow memory or hit the 16 MB BSON document limit per operation.
// -------------------------------------------------------------------

const TOTAL = 200_000;
const BATCH_SIZE = 5_000;

const CATEGORIES = [
  "Electronics",
  "Clothing",
  "Books",
  "Home & Garden",
  "Sports",
  "Toys",
  "Beauty",
  "Automotive",
  "Food & Grocery",
  "Office Supplies",
];

const ADJECTIVES = [
  "Premium", "Deluxe", "Ultra", "Pro", "Classic", "Slim", "Portable",
  "Smart", "Eco", "Lite", "Max", "Mini", "Turbo", "Flex", "Elite",
];

const NOUNS = [
  "Gadget", "Widget", "Kit", "Pack", "Set", "Bundle", "Edition",
  "Series", "Collection", "Unit", "Module", "Device", "Tool", "Gear",
];

function randomName() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `${adj} ${noun} ${num}`;
}

function randomPrice() {
  // Price between 1.00 and 999.99
  return Math.round((Math.random() * 998.99 + 1) * 100) / 100;
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function seed() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected.");

  // Drop existing products for a clean seed
  await Product.deleteMany({});
  console.log(`Cleared existing products. Inserting ${TOTAL.toLocaleString()} products...`);

  const start = new Date("2022-01-01");
  const end = new Date();

  let inserted = 0;

  while (inserted < TOTAL) {
    const batchCount = Math.min(BATCH_SIZE, TOTAL - inserted);

    const docs = Array.from({ length: batchCount }, () => {
      const createdAt = randomDate(start, end);
      return {
        name: randomName(),
        category: CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
        price: randomPrice(),
        createdAt,
        updatedAt: createdAt,
      };
    });

    // insertMany with ordered:false is the fastest bulk insert path in Mongoose
    await Product.insertMany(docs, { ordered: false });

    inserted += batchCount;
    process.stdout.write(`\r  Progress: ${inserted.toLocaleString()} / ${TOTAL.toLocaleString()}`);
  }

  console.log("\nDone! Seeded", TOTAL.toLocaleString(), "products.");
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
