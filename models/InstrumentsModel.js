import mongoose from "mongoose";

const InstrumentSchema = new mongoose.Schema(
  {
    instrument_token: { type: Number, required: true },
    exchange_token: { type: Number, required: true },
    tradingsymbol: { type: String, required: true },
    name: { type: String },
    last_price: { type: Number },
    expiry: { type: Date },
    strike: { type: Number },
    tick_size: { type: Number },
    lot_size: { type: Number },
    instrument_type: { type: String },
    segment: { type: String },
    exchange: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Instrument", InstrumentSchema);
