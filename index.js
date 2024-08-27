import express from "express";
import { KiteConnect, KiteTicker } from "kiteconnect";
import fs from "fs"; // Import the file system module
import {
  _fetchStrikePrice,
  sendEmailNotification,
  connectDB,
  upload,
  _getPE_CE_StrikePrice,
  _calculate_Profit,
} from "./functions.js";
import InstrumentsModel from "./models/InstrumentsModel.js";
import StockScriptNameModel from "./models/StockScriptNameModel.js";
import axios from "axios";
import csv from "csvtojson";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let ACCESS_TOKEN = "";

// https://kite.zerodha.com/connect/login?v=3&api_key=z47h5huqnppyjjv6
const apiKey = process.env.KITE_API_KEY || "z47h5huqnppyjjv6";

const apiSecret =
  process.env.KITE_API_SECRET || "ho94q1nc1r3hyo2bbj0udx2j7u5ckrpk";

const tokenFilePath = "./accessToken.json"; // Path to store the access token

const kc = new KiteConnect({ api_key: apiKey });

let ticker;
let lastTick = null;
let ceTick = null;
let peTick = null;

// let StockIT = 779521;
let StockIT = 8960258;
let CEIT = 25305090;
let PEIT = 38983170;

let tickDataStoreFromTXT = {};

var app = express();
app.use(express.json());
app.use(cors());
// Connect to MongoDB
connectDB();

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, "public")));

// Route for the main page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

async function init() {
  try {
    // Load the token from the file if it exists
    if (fs.existsSync(tokenFilePath)) {
      const data = fs.readFileSync(tokenFilePath);
      const tokenData = JSON.parse(data);

      kc.setAccessToken(tokenData.access_token);
      console.log("Loaded access token from file:", tokenData.access_token);
      ACCESS_TOKEN = tokenData.access_token;
      setupTicker(tokenData.access_token);

      // Optionally, you can verify the token by making a simple API call
      // await getProfile();
    } else {
      await generateSession();
    }
  } catch (err) {
    console.error("Error during initialization:", err);
  }
}

async function generateSession() {
  try {
    // You will still need to manually set the request token the first time
    const requestToken = "ghUQoZZsJEbiz929NYnLV3O3Pt57ryj1";
    const response = await kc.generateSession(requestToken, apiSecret);
    kc.setAccessToken(response.access_token);
    ACCESS_TOKEN = response.access_token;
    setupTicker(response.access_token);

    // Save the access token to a file
    fs.writeFileSync(tokenFilePath, JSON.stringify(response));
    console.log("Session generated and access token saved:", response);
  } catch (err) {
    console.error("Error generating session:", err);
    console.log(
      "https://kite.zerodha.com/connect/login?v=3&api_key=z47h5huqnppyjjv6"
    );
  }
}

function setupTicker(accessToken) {
  ticker = new KiteTicker({
    api_key: apiKey,
    access_token: accessToken,
  });

  ticker.connect();

  // ticker.on("connect", async () => {
  //   console.log("Connected to ticker.");

  //   const dataArray = await fetchAllDataFromJsonFile();

  //   let tokensTMP = [];

  //   dataArray.forEach((jsonItem) => {
  //     tokensTMP.push(jsonItem.stockInstumentToken);

  //     if (
  //       jsonItem.PEInstumentToken != 0 &&
  //       jsonItem.PEInstumentToken != undefined &&
  //       jsonItem.CEInstumentToken != 0 &&
  //       jsonItem.CEInstumentToken != undefined
  //     ) {
  //       tokensTMP.push(jsonItem.PEInstumentToken);
  //       tokensTMP.push(jsonItem.CEInstumentToken);
  //     }
  //   });

  //   ticker.subscribe(tokensTMP);
  //   ticker.setMode(ticker.modeFull, tokensTMP);
  // });

  ticker.on("connect", async () => {
    console.log("Connected to ticker.");

    const dataArray = await readFileLinesAsNumbersStock();

    ticker.subscribe(dataArray);
    ticker.setMode(ticker.modeFull, dataArray);
  });

  ticker.on("disconnect", (error) => {
    console.log("Disconnected from ticker:", error);
  });

  ticker.on("error", (error) => {
    console.log("Ticker error:", error);
  });

  ticker.on("close", (reason) => {
    console.log("Ticker closed:", reason);
  });

  ticker.on("order_update", (order) => {
    console.log("Order update:", order);
  });

  ticker.on("ticks", (ticks) => {
    //console.log(ticks);
    ticks.forEach((tick) => {
      // Use the instrument_token as the key and update with the latest tick data
      tickDataStoreFromTXT[tick.instrument_token] = tick;
    });
  });
}

async function getProfile() {
  try {
    const profile = await kc.getProfile();
    console.log("Profile:", profile);
  } catch (err) {
    console.error("Error getting profile:", err);
  }
}

function subscribe() {
  const tokens = [StockIT, CEIT, PEIT];
  ticker.subscribe(tokens);
  ticker.setMode(ticker.modeFull, tokens);
}

function onTicks(ticks) {
  console.log("I m here");
  for (let tikdata of ticks) {
    if (tikdata["instrument_token"] == CEIT) {
      ceTick = tikdata;
    }

    if (tikdata["instrument_token"] == PEIT) {
      peTick = tikdata;
    }

    if (tikdata["instrument_token"] == StockIT) {
      lastTick = tikdata;
    }
  }

  // Ensure that `lastTick` isn't overwritten by the last item in `ticks`
  // console.log("CE Tick:", ceTick);
  // console.log("PE Tick:", peTick);
  // console.log("StockIT Tick:", lastTick);
}

function onDisconnect(error) {
  console.log("Closed connection on disconnect", error);
}

function onError(error) {
  console.log("Closed connection on error", error);
}

function onClose(reason) {
  console.log("Closed connection on close", reason);
}

function onTrade(order) {
  console.log("Order update", order);
}

// Initialize the API calls
init();

// Endpoint to fetch the strike price based on last tick data
app.post("/fetch-strike-price", async function (req, res) {
  if (!lastTick) {
    return res.status(400).json({ error: "No tick data available" });
  }

  const strikePrice = lastTick.last_price;
  const PELastPrice = peTick.last_price;
  const CELastPrice = ceTick.last_price;
  console.log(strikePrice);
  _fetchStrikePrice(strikePrice, PELastPrice, CELastPrice);

  res.json({ strikePrice });
});

// cron job.......
app.get("/update-instruments", async (req, res) => {
  const csvUrl = "https://api.kite.trade/instruments";
  const csvFilePath = "./instruments.csv";

  try {
    // Step 1: Download the CSV file
    const response = await axios.get(csvUrl, { responseType: "stream" });
    const writer = fs.createWriteStream(csvFilePath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    // Step 2: Convert CSV to JSON
    const jsonArray = await csv().fromFile(csvFilePath);

    // Step 3: Delete existing data
    await InstrumentsModel.deleteMany({});

    // Step 4: Insert new data
    await InstrumentsModel.insertMany(jsonArray);

    // Step 5: Send notifications
    // await sendWhatsAppNotification();
    await sendEmailNotification();

    res.status(200).send("Instruments updated successfully!");
  } catch (err) {
    console.error("Error updating instruments:", err);
    res.status(500).send("Failed to update instruments");
  }
});

app.post("/upload-csv", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  try {
    const csvFilePath = req.file.path;

    //console.log(csvFilePath);
    // Convert CSV to JSON
    const jsonArray = await csv().fromFile(csvFilePath);
    //console.log(jsonArray);

    // Delete existing data
    await StockScriptNameModel.deleteMany({});

    // Insert new data
    await StockScriptNameModel.insertMany(jsonArray);

    // Send notifications
    // await sendWhatsAppNotification();
    //await sendEmailNotification();

    res.status(200).send("Stock Script Name updated successfully!");
  } catch (err) {
    console.error("Error updating stock name:", err);
    res.status(500).send("Failed to update stock name");
  }
});

// Endpoint to process and fetch tick data
// app.get("/list-result", async (req, res) => {
//   const tickDataStore = {};
//   const subscriptions = [];
//   const sendJson = [];

//   try {
//     const allScriptNames = await StockScriptNameModel.find();
//     if (!allScriptNames.length) {
//       return res.status(404).send("No script names found.");
//     }

//     const ticker = new KiteTicker({
//       api_key: apiKey,
//       access_token: ACCESS_TOKEN,
//     });

//     console.log("Setting up KiteTicker connection...");

//     // Wrap the ticker events in a Promise
//     const tickerPromise = new Promise((resolve, reject) => {
//       ticker.on("connect", () => {
//         console.log("Connected to KiteTicker");
//         resolve();
//       });

//       ticker.on("disconnect", () => {
//         console.log("Disconnected from KiteTicker");
//         reject(new Error("Disconnected from KiteTicker"));
//       });

//       ticker.on("error", (err) => {
//         console.error("Error in KiteTicker connection:", err);
//         reject(err);
//       });

//       ticker.on("close", () => {
//         console.log("KiteTicker connection closed");
//       });

//       ticker.on("ticks", (ticks) => {
//         ticks.forEach((tick) => {
//           tickDataStore[tick.instrument_token] = tick;
//         });
//       });
//     });

//     // Manually connect to the ticker and wait for connection
//     ticker.connect();
//     await tickerPromise;

//     for (const stock of allScriptNames) {
//       const { scriptName, month, roundoff, p1, p2 } = stock;

//       const searchObj = {
//         name: scriptName,
//         tradingsymbol: { $regex: month, $options: "i" },
//         instrument_type: "FUT",
//       };

//       const instrumentDetails = await InstrumentsModel.findOne(searchObj);
//       if (instrumentDetails) {
//         const stockInstrumentToken = instrumentDetails.instrument_token;
//         console.log("Subscribing to instrument:", stockInstrumentToken);

//         subscriptions.push({
//           stock: stockInstrumentToken,
//           p1,
//           p2,
//           roundoff,
//           scriptName,
//           month,
//         });

//         ticker.subscribe([stockInstrumentToken]);
//         ticker.setMode(ticker.modeFull, [stockInstrumentToken]);
//       } else {
//         console.log("No instrument details found for:", searchObj);
//       }
//     }

//     // Increase wait time to ensure tick data arrives
//     await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 seconds

//     for (const token of subscriptions) {
//       const tickData = tickDataStore[token.stock];
//       if (tickData) {
//         let _openPriceFromStockTickData = tickData.last_price;
//         let PE_CE_Strike_price = await _getPE_CE_StrikePrice(
//           _openPriceFromStockTickData,
//           token.p1,
//           token.p2,
//           token.roundoff
//         );

//         const { PEStrikePrice, CEstrikePrice } = PE_CE_Strike_price;

//         // PE Instrument Token Processing
//         const searchObjPE = {
//           name: token.scriptName,
//           tradingsymbol: { $regex: token.month, $options: "i" },
//           instrument_type: "PE",
//           strike: PEStrikePrice,
//         };
//         // CE Instrument Token Processing
//         const searchObjCE = {
//           name: token.scriptName,
//           tradingsymbol: { $regex: token.month, $options: "i" },
//           instrument_type: "CE",
//           strike: CEstrikePrice,
//         };

//         const instrumentDetailsPE = await InstrumentsModel.findOne(searchObjPE);
//         const instrumentDetailsCE = await InstrumentsModel.findOne(searchObjCE);

//         if (instrumentDetailsPE && instrumentDetailsCE) {
//           const PEInstrumentToken = instrumentDetailsPE.instrument_token;
//           const CEInstrumentToken = instrumentDetailsCE.instrument_token;
//           console.log("Subscribing to CE instrument:", CEInstrumentToken);

//           ticker.subscribe([PEInstrumentToken, CEInstrumentToken]);
//           ticker.setMode(ticker.modeFull, [
//             PEInstrumentToken,
//             CEInstrumentToken,
//           ]);

//           // Wait for tick data to arrive
//           await new Promise((resolve) => setTimeout(resolve, 4000)); // 4 seconds

//           const tickDataForCE = tickDataStore[CEInstrumentToken];
//           const tickDataForPE = tickDataStore[PEInstrumentToken];

//           if (tickDataForCE && tickDataForPE) {
//             let item = {
//               open: _openPriceFromStockTickData,
//               CEOpenPrice: tickDataForCE.last_price,
//               PEOpenPrice: tickDataForPE.last_price,
//               PEstrikePrice: PEStrikePrice,
//               CEstrikePrice: CEstrikePrice,
//             };
//             // console.log(item);
//             await new Promise((resolve) => setTimeout(resolve, 1000)); // 2 seconds
//             const Result = await _calculate_Profit(item);
//             /// console.log(Result);
//             sendJson.push(Result);
//           }
//         } else {
//           console.log("No CE instrument details found for:", searchObjCE);
//         }
//       } else {
//         console.log("No tick data available for:", token);
//       }
//     }

//     res.status(200).json(sendJson);
//   } catch (err) {
//     console.error("Error processing /list-result endpoint:", err);
//     res.status(500).send("Failed to process list result.");
//   }
// });

app.get("/list-historical-result", async (req, res) => {
  try {
    const allScriptNames = await StockScriptNameModel.find();
    if (!allScriptNames.length) {
      return res.status(404).send("No script names found.");
    }

    // Process each script name and subscribe to its instrument token
    for (const stock of allScriptNames) {
      const { scriptName, month } = stock;

      const searchObj = {
        name: scriptName,
        tradingsymbol: { $regex: month, $options: "i" },
        instrument_type: "FUT",
      };

      const instrumentDetails = await InstrumentsModel.findOne(searchObj);
      if (instrumentDetails) {
        const stockInstrumentToken = instrumentDetails.instrument_token;

        console.log("Subscribing to instrument:", stockInstrumentToken);

        const fromt_to_date = "2024-08-23 09:15:00";
        const hisoricalData = KiteConnect.getHistoricalData(
          stockInstrumentToken,
          "5minute",
          fromt_to_date,
          fromt_to_date
        );

        if (hisoricalData) {
          console.log("Processing Historical data:", hisoricalData);
        } else {
          console.log(
            "No historical data available for:",
            stockInstrumentToken
          );
        }
      } else {
        console.log("No instrument details found for:", searchObj);
      }
    }

    res
      .status(200)
      .send("Subscription to instruments and processing successful.");
  } catch (err) {
    console.error("Error processing /list-result endpoint:", err);
    res.status(500).send("Failed to process list result.");
  }
});

app.get("/list-result", async (req, res) => {
  const tickDataStore = {};
  const subscriptions = [];
  const sendJson = [];

  try {
    const allScriptNames = await StockScriptNameModel.find();
    if (!allScriptNames.length) {
      return res.status(404).send("No script names found.");
    }

    const ticker = new KiteTicker({
      api_key: apiKey,
      access_token: ACCESS_TOKEN,
    });

    console.log("Setting up KiteTicker connection...");

    // Wrap the ticker events in a Promise
    const tickerPromise = new Promise((resolve, reject) => {
      ticker.on("connect", () => {
        console.log("Connected to KiteTicker");
        resolve();
      });

      ticker.on("disconnect", () => {
        console.log("Disconnected from KiteTicker");
        reject(new Error("Disconnected from KiteTicker"));
      });

      ticker.on("error", (err) => {
        console.error("Error in KiteTicker connection:", err);
        reject(err);
      });

      ticker.on("close", () => {
        console.log("KiteTicker connection closed");
      });

      ticker.on("ticks", (ticks) => {
        ticks.forEach((tick) => {
          tickDataStore[tick.instrument_token] = tick;
        });
      });
    });

    // Manually connect to the ticker and wait for connection
    ticker.connect();
    await tickerPromise;

    for (const stock of allScriptNames) {
      const { scriptName, month, roundoff, p1, p2 } = stock;

      const searchObj = {
        name: scriptName,
        tradingsymbol: { $regex: month, $options: "i" },
        instrument_type: "FUT",
      };

      const instrumentDetails = await InstrumentsModel.findOne(searchObj);
      if (instrumentDetails) {
        const stockInstrumentToken = instrumentDetails.instrument_token;
        console.log("Subscribing to instrument:", stockInstrumentToken);

        subscriptions.push({
          stock: stockInstrumentToken,
          p1,
          p2,
          roundoff,
          scriptName,
          month,
        });

        ticker.subscribe([stockInstrumentToken]);
        ticker.setMode(ticker.modeFull, [stockInstrumentToken]);
      } else {
        console.log("No instrument details found for:", searchObj);
      }
    }

    // Increase wait time to ensure tick data arrives
    await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 seconds

    for (const token of subscriptions) {
      const tickData = tickDataStore[token.stock];
      if (tickData) {
        let _openPriceFromStockTickData = tickData.last_price;
        let PE_CE_Strike_price = await _getPE_CE_StrikePrice(
          _openPriceFromStockTickData,
          token.p1,
          token.p2,
          token.roundoff
        );

        const { PEStrikePrice, CEstrikePrice } = PE_CE_Strike_price;

        // PE Instrument Token Processing
        const searchObjPE = {
          name: token.scriptName,
          tradingsymbol: { $regex: token.month, $options: "i" },
          instrument_type: "PE",
          strike: PEStrikePrice,
        };
        // CE Instrument Token Processing
        const searchObjCE = {
          name: token.scriptName,
          tradingsymbol: { $regex: token.month, $options: "i" },
          instrument_type: "CE",
          strike: CEstrikePrice,
        };

        const instrumentDetailsPE = await InstrumentsModel.findOne(searchObjPE);
        const instrumentDetailsCE = await InstrumentsModel.findOne(searchObjCE);

        if (instrumentDetailsPE && instrumentDetailsCE) {
          const PEInstrumentToken = instrumentDetailsPE.instrument_token;
          const CEInstrumentToken = instrumentDetailsCE.instrument_token;
          console.log("Subscribing to CE instrument:", CEInstrumentToken);

          ticker.subscribe([PEInstrumentToken, CEInstrumentToken]);
          ticker.setMode(ticker.modeFull, [
            PEInstrumentToken,
            CEInstrumentToken,
          ]);

          // Wait for tick data to arrive
          await new Promise((resolve) => setTimeout(resolve, 4000)); // 4 seconds

          const tickDataForCE = tickDataStore[CEInstrumentToken];
          const tickDataForPE = tickDataStore[PEInstrumentToken];

          if (tickDataForCE && tickDataForPE) {
            let item = {
              open: _openPriceFromStockTickData,
              CEOpenPrice: tickDataForCE.last_price,
              PEOpenPrice: tickDataForPE.last_price,
              PEstrikePrice: PEStrikePrice,
              CEstrikePrice: CEstrikePrice,
            };
            // console.log(item);
            await new Promise((resolve) => setTimeout(resolve, 1000)); // 2 seconds
            const Result = await _calculate_Profit(item);
            /// console.log(Result);
            sendJson.push(Result);
          }
        } else {
          console.log("No CE instrument details found for:", searchObjCE);
        }
      } else {
        console.log("No tick data available for:", token);
      }
    }

    res.status(200).json(sendJson);
  } catch (err) {
    console.error("Error processing /list-result endpoint:", err);
    res.status(500).send("Failed to process list result.");
  }
});

// step 1 (store stock instument token only)
app.get("/subscribe-instruments-token", async (req, res) => {
  const tickDataStore = {};
  const subscriptions = [];
  const AllInstrumentTokens = [];
  const updates = [];

  // delete exiting txt and json file

  // txt
  clearFileContent("instrumentsStockToken.txt");
  // json
  await deleteFile("instrumentsToken.json");

  try {
    const allScriptNames = await StockScriptNameModel.find();
    if (!allScriptNames.length) {
      return res.status(404).send("No script names found.");
    }

    for (const stock of allScriptNames) {
      const { scriptName, month, roundoff, p1, p2 } = stock;
      const searchObj = {
        name: scriptName,
        tradingsymbol: { $regex: month, $options: "i" },
        instrument_type: "FUT",
      };

      const instrumentDetails = await InstrumentsModel.findOne(searchObj);
      if (instrumentDetails) {
        const stockInstrumentToken = instrumentDetails.instrument_token;

        //await appendToFileAsync(stockInstrumentToken.toString());
        await appendToFileAsyncStock(stockInstrumentToken.toString());

        AllInstrumentTokens.push(stockInstrumentToken);
        subscriptions.push({
          stock: stockInstrumentToken,
          p1,
          p2,
          roundoff,
          scriptName,
          month,
        });

        updates.push({
          stockName: scriptName,
          stockInstumentToken: stockInstrumentToken,
          PEInstumentToken: 0,
          CEInstumentToken: 0,
          PEStrikePrice: 0,
          CEstrikePrice: 0,
          month: month,
          p1,
          p2,
          roundoff,
        });
      } else {
        console.log("No instrument details found for:", searchObj);
      }
    }

    await updateJsonFile(updates);

    console.log("Subscribing to instruments...");
    res.status(200).json(AllInstrumentTokens);
  } catch (err) {
    console.error(
      "Error processing /subscribe-instruments-token endpoint:",
      err
    );
    res.status(500).send("Failed to process subscription.");
  }
});

// step 2 (get last price and store PE/CE stock insutment token)
app.get("/list-result-from-file", async (req, res) => {
  const tickDataStore = {};
  const subscriptions = [];
  const sendJson = [];

  const PECEInstumentToken = [];
  try {
    const allScriptNames = await fetchAllDataFromJsonFile();
    if (!allScriptNames.length) {
      return res.status(404).send("No script names found.");
    }

    for (const token of allScriptNames) {
      const tickData = tickDataStoreFromTXT[token.stockInstumentToken];

      if (tickData) {
        let _openPriceFromStockTickData = tickData.last_price;
        let PE_CE_Strike_price = await _getPE_CE_StrikePrice(
          _openPriceFromStockTickData,
          token.p1,
          token.p2,
          token.roundoff
        );

        const { PEStrikePrice, CEstrikePrice } = PE_CE_Strike_price;

        // PE Instrument Token Processing
        const searchObjPE = {
          name: token.stockName,
          tradingsymbol: { $regex: token.month, $options: "i" },
          instrument_type: "PE",
          strike: PEStrikePrice,
        };
        // CE Instrument Token Processing
        const searchObjCE = {
          name: token.stockName,
          tradingsymbol: { $regex: token.month, $options: "i" },
          instrument_type: "CE",
          strike: CEstrikePrice,
        };

        const instrumentDetailsPE = await InstrumentsModel.findOne(searchObjPE);
        const instrumentDetailsCE = await InstrumentsModel.findOne(searchObjCE);

        if (instrumentDetailsPE && instrumentDetailsCE) {
          const PEInstrumentToken = instrumentDetailsPE.instrument_token;
          const CEInstrumentToken = instrumentDetailsCE.instrument_token;

          await appendToFileAsyncStock(PEInstrumentToken.toString());
          await appendToFileAsyncStock(CEInstrumentToken.toString());
          PECEInstumentToken.push({
            [token.stockInstumentToken]: {
              PEInstumentToken: PEInstrumentToken,
              CEInstumentToken: CEInstrumentToken,
              PEStrikePrice: PEStrikePrice,
              CEstrikePrice: CEstrikePrice,
            },
          });
        }
      } else {
        console.log("No tick data available for:", token);
      }
    }

    await updateTokensInJsonFile(PECEInstumentToken);
    //console.log(PECEInstumentToken);
    res.status(200).json(PECEInstumentToken);
  } catch (err) {
    console.error("Error processing /list-result endpoint:", err);
    res.status(500).send("Failed to process list result.");
  }
});

// new functionjs as per vinod
// step 3 get all data and return the result
app.get("/get-updated-always", async (req, res) => {
  try {
    const jsonData = await fetchAllDataFromJsonFile();
    if (!jsonData.length) {
      return res
        .status(404)
        .send("No Json Data Found, Please Run Step 1 & 2 First.");
    }

    // Use Promise.all to wait for all asynchronous operations to complete
    const sendJson = await Promise.all(
      jsonData.map(async (token) => {
        let item = {
          PEstrikePrice: token.PEStrikePrice,
          CEstrikePrice: token.CEstrikePrice,
        };

        // Iterate over the values of tickDataStoreFromTXT object
        for (const tick of Object.values(tickDataStoreFromTXT)) {
          // stocks
          if (tick.instrument_token == token.stockInstumentToken) {
            item.open = tick.last_price;
          }
          // pe
          if (tick.instrument_token == token.PEInstumentToken) {
            item.PEOpenPrice = tick.last_price;
          }
          // ce
          if (tick.instrument_token == token.CEInstumentToken) {
            item.CEOpenPrice = tick.last_price;
          }
        }

        let profits = [];
        if (item.open && item.PEOpenPrice && item.CEOpenPrice) {
          // Calculate the profits after processing all ticks
          profits = await _calculate_Profit(item);
        }

        if (profits) return { [token.stockName]: profits };
      })
    );

    res.status(200).json(sendJson);
  } catch (err) {
    console.error("Error processing /get-updated-always endpoint:", err);
    res.status(500).send("Failed to process list result.");
  }
});

app.get("/get-live-profit", async (req, res) => {
  const sendJson = [];
  try {
    const allScriptNames = await fetchAllDataFromJsonFile();
    if (!allScriptNames.length) {
      return res.status(404).send("No script names found.");
    }

    for (const token of allScriptNames) {
      const tickDataForCE = tickDataStoreFromTXT[token.PEInstumentToken];
      const tickDataForPE = tickDataStoreFromTXT[token.CEInstumentToken];
      const _openPriceFromStockTickData =
        tickDataStoreFromTXT[token.stockInstumentToken];

      if (tickDataForCE && tickDataForPE && _openPriceFromStockTickData) {
        // _openPrice, pe_gap, ce_gap, round_off;

        const { PEStrikePrice, CEstrikePrice } = await _getPE_CE_StrikePrice(
          _openPriceFromStockTickData.last_price,
          token.p1,
          token.p2,
          token.roundoff
        );

        let item = {
          open: _openPriceFromStockTickData.last_price,
          CEOpenPrice: tickDataForCE.last_price,
          PEOpenPrice: tickDataForPE.last_price,
          PEstrikePrice: PEStrikePrice,
          CEstrikePrice: CEstrikePrice,
        };
        // console.log(item);
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 2 seconds
        const Result = await _calculate_Profit(item);
        /// console.log(Result);
        sendJson.push(Result);
      }
    }

    res.status(200).json(sendJson);
  } catch (err) {
    console.error("Error processing /list-result endpoint:", err);
    res.status(500).send("Failed to process list result.");
  }
});
// Function to append data to file
function appendToFileAsync(data) {
  const filePath = path.join(__dirname, "instrumentsToken.txt");
  return new Promise((resolve, reject) => {
    // Read the file first
    fs.readFile(filePath, "utf-8", (err, fileContent) => {
      if (err) {
        if (err.code === "ENOENT") {
          // File does not exist, so we'll create it
          fs.appendFile(filePath, data + "\n", (err) => {
            if (err) {
              console.error("Error appending to file:", err);
              reject(err);
            } else {
              resolve();
            }
          });
        } else {
          console.error("Error reading file:", err);
          reject(err);
        }
      } else {
        // Check if data already exists in the file
        if (!fileContent.includes(data)) {
          // Data doesn't exist, so we append it
          fs.appendFile(filePath, data + "\n", (err) => {
            if (err) {
              console.error("Error appending to file:", err);
              reject(err);
            } else {
              resolve();
            }
          });
        } else {
          // Data already exists, so resolve without appending
          resolve();
        }
      }
    });
  });
}

function appendToFileAsyncStock(data) {
  const filePath = path.join(__dirname, "instrumentsStockToken.txt");
  return new Promise((resolve, reject) => {
    // Read the file first
    fs.readFile(filePath, "utf-8", (err, fileContent) => {
      if (err) {
        if (err.code === "ENOENT") {
          // File does not exist, so we'll create it
          fs.appendFile(filePath, data + "\n", (err) => {
            if (err) {
              console.error("Error appending to file:", err);
              reject(err);
            } else {
              resolve();
            }
          });
        } else {
          console.error("Error reading file:", err);
          reject(err);
        }
      } else {
        // Check if data already exists in the file
        if (!fileContent.includes(data)) {
          // Data doesn't exist, so we append it
          fs.appendFile(filePath, data + "\n", (err) => {
            if (err) {
              console.error("Error appending to file:", err);
              reject(err);
            } else {
              resolve();
            }
          });
        } else {
          // Data already exists, so resolve without appending
          resolve();
        }
      }
    });
  });
}

async function updateJsonFile(updates) {
  const filePath = path.join(__dirname, "instrumentsToken.json");

  try {
    let data = {};
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      data = JSON.parse(fileContent);
    }

    updates.forEach((newData) => {
      const key = `${newData.stockInstumentToken}`;
      data[key] = newData;
    });

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    console.log("Data successfully updated in file.");
  } catch (err) {
    console.error("Error updating JSON file:", err);
    throw err; // Rethrow the error to be caught in the caller
  }
}

async function updateTokensInJsonFile(newValues) {
  const filePath = path.join(__dirname, "instrumentsToken.json");

  try {
    // Read the existing data from the JSON file
    let data = {};
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      data = JSON.parse(fileContent);
    }

    // Update the data with new values
    newValues.forEach((item) => {
      const stockName = Object.keys(item)[0]; // Get the stock name from the object
      const newTokens = item[stockName]; // Get the new token values

      if (data[stockName]) {
        // Update only PEInstumentToken and CEInstumentToken
        data[stockName].PEInstumentToken = newTokens.PEInstumentToken;
        data[stockName].CEInstumentToken = newTokens.CEInstumentToken;
        data[stockName].PEStrikePrice = newTokens.PEStrikePrice;
        data[stockName].CEstrikePrice = newTokens.CEstrikePrice;
      }
    });

    // Write the updated data back to the JSON file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    console.log("Data successfully updated in file.");
  } catch (err) {
    console.error("Error updating JSON file:", err);
  }
}

function readFileLinesAsNumbers() {
  let filePath = path.join(__dirname, "instrumentsToken.txt");
  try {
    // Read the file content
    const fileContent = fs.readFileSync(filePath, "utf-8");

    // Split the content by newline characters
    const lines = fileContent.split(/\r?\n/);

    // Convert each line to a number and filter out invalid lines
    const numbers = lines
      .map((line) => line.trim()) // Remove any extra whitespace
      .filter((line) => line.length > 0) // Filter out empty lines
      .map(Number) // Convert strings to numbers
      .filter((num) => !isNaN(num)); // Remove NaN values (invalid lines)

    return numbers;
  } catch (err) {
    console.error("Error reading file:", err);
    return [];
  }
}

function readFileLinesAsNumbersStock() {
  let filePath = path.join(__dirname, "instrumentsStockToken.txt");
  try {
    // Read the file content
    const fileContent = fs.readFileSync(filePath, "utf-8");

    // Split the content by newline characters
    const lines = fileContent.split(/\r?\n/);

    // Convert each line to a number and filter out invalid lines
    const numbers = lines
      .map((line) => line.trim()) // Remove any extra whitespace
      .filter((line) => line.length > 0) // Filter out empty lines
      .map(Number) // Convert strings to numbers
      .filter((num) => !isNaN(num)); // Remove NaN values (invalid lines)

    return numbers;
  } catch (err) {
    console.error("Error reading file:", err);
    return [];
  }
}

async function fetchAllDataFromJsonFile() {
  const filePath = path.join(__dirname, "instrumentsToken.json");

  return new Promise((resolve, reject) => {
    fs.readFile(filePath, "utf-8", (err, fileContent) => {
      if (err) {
        console.error("Error reading JSON file:", err);
        return reject(err);
      }

      try {
        const data = JSON.parse(fileContent);
        const dataArray = Object.values(data); // Convert the object to an array of values
        resolve(dataArray);
      } catch (parseErr) {
        console.error("Error parsing JSON file:", parseErr);
        reject(parseErr);
      }
    });
  });
}

async function deleteFile(path) {
  fs.unlink(path, (err) => {
    if (err) {
      //console.error(Error deleting file: ${err});
      return;
    }
    return true;
  });
}

async function clearFileContent(filePath) {
  try {
    await fs.promises.writeFile(filePath, ""); // Access fs.promises for the promise-based API
    console.log("File content cleared successfully");
    return true;
  } catch (err) {
    console.error(`Error clearing file content: ${err}`);
    return false;
  }
}

// Usage example
const filePath = path.join(__dirname, "instumentsToken.txt");

var port = process.env.PORT || 5500;
app.listen(port, function () {
  console.log("Server is running on port " + port);
});
