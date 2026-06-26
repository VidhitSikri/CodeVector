const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String, required: true, index: true },
    price: { type: Number, required: true },
  },
  {
    timestamps: true, // auto-adds createdAt & updatedAt
  }
);

// Compound index for cursor-based pagination:
// We sort by createdAt DESC, _id DESC to get a stable, unique cursor.
// This index makes that query fast even on 200k+ docs.
productSchema.index({ createdAt: -1, _id: -1 });

// Same index but scoped per category for filtered queries
productSchema.index({ category: 1, createdAt: -1, _id: -1 });

module.exports = mongoose.model("Product", productSchema);
