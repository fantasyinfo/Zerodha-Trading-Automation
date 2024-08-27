import mongoose from "mongoose";

const StockScriptSchema = new mongoose.Schema(
  {
    scriptName: { type: String, required: true },
    month: { type: String, required: true },
    roundoff: { type: String, required: true },
    p1: { type: String, required: true },
    p2: { type: String, required: true },
    StockIT: { type: Number, required: false, default: 0 },
    CEIT: { type: Number, required: false, default: 0 },
    PEIT: { type: Number, required: false, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("StockScriptName", StockScriptSchema);
