import { _requestParameters } from "./Constants.js";
import mongoose from "mongoose";
import nodemailer from "nodemailer";

import multer from "multer";
import path from "path";

// strike price selection
export const _fetchStrikePrice = async (
  _openPrice,
  PELastPrice,
  CELastPrice
) => {
  let roundUpPrice = _requestParameters.roundup;
  let pe_gap = _requestParameters.pe_gap;
  let ce_gap = _requestParameters.ce_gap;

  try {
    let openPrice = parseFloat(_openPrice);

    let roundPriceWithPercentagePE_GAP = openPrice * pe_gap + openPrice; // (700 * 0.03) + 700
    let roundPriceWithPercentageCE_GAP = openPrice * ce_gap + openPrice; // 700 - (700 * 0.03)

    let roundedPEOpen;
    let roundedCEOpen;

    if (roundPriceWithPercentagePE_GAP % roundUpPrice === 0) {
      roundedPEOpen = roundPriceWithPercentagePE_GAP;
      roundedCEOpen = roundPriceWithPercentageCE_GAP;
    } else if (roundPriceWithPercentagePE_GAP < roundUpPrice) {
      roundedPEOpen = roundPriceWithPercentagePE_GAP;
      roundedCEOpen = roundPriceWithPercentageCE_GAP;
    } else {
      let remainder = roundPriceWithPercentagePE_GAP % roundUpPrice;
      if (remainder < roundUpPrice / 2) {
        roundedPEOpen = roundPriceWithPercentagePE_GAP - remainder;
      } else {
        roundedPEOpen =
          roundPriceWithPercentagePE_GAP + (roundUpPrice - remainder);
      }
      let remainder1 = roundPriceWithPercentageCE_GAP % roundUpPrice;
      if (remainder1 < roundUpPrice / 2) {
        roundedCEOpen = roundPriceWithPercentageCE_GAP - remainder1;
      } else {
        roundedCEOpen =
          roundPriceWithPercentageCE_GAP + (roundUpPrice - remainder1);
      }
    }

    let item = {};
    item.open = _openPrice;
    item.CEOpenPrice = CELastPrice;
    item.PEOpenPrice = PELastPrice;
    item.PEstrikePrice = roundedPEOpen.toString();
    item.CEstrikePrice = roundedCEOpen.toString();

    // SS
    item.SS_ClosingPrice_0_point_25 = returnSSPoints(item, 0.0025);
    item.SS_ClosingPrice_0_point_5 = returnSSPoints(item, 0.005);
    item.SS_ClosingPrice_1_point_0 = returnSSPoints(item, 0.01);
    item.SS_ClosingPrice_3_point_0 = returnSSPoints(item, 0.03);
    item.SS_ClosingPrice_5_point_0 = returnSSPoints(item, 0.05);
    item.SS_ClosingPrice_7_point_5 = returnSSPoints(item, 0.075);
    item.SS_ClosingPrice_10_point_0 = returnSSPoints(item, 0.1);
    //console.log("############################################");
    // BS
    item.BS_ClosingPrice_0_point_25 = returnBSPoints(item, 0.0025);
    item.BS_ClosingPrice_0_point_5 = returnBSPoints(item, 0.005);
    item.BS_ClosingPrice_1_point_0 = returnBSPoints(item, 0.01);
    item.BS_ClosingPrice_3_point_0 = returnBSPoints(item, 0.03);
    item.BS_ClosingPrice_5_point_0 = returnBSPoints(item, 0.05);
    item.BS_ClosingPrice_7_point_5 = returnBSPoints(item, 0.075);
    item.BS_ClosingPrice_10_point_0 = returnBSPoints(item, 0.1);

    console.log(item);
  } catch (error) {
    console.error("Error processing item:", error);
    return null;
  }
};

export const _getPE_CE_StrikePrice = async (
  _openPrice,
  pe_gap,
  ce_gap,
  round_off
) => {
  const openPrice = parseFloat(_openPrice);
  const roundUpPrice = round_off;

  // Calculate the strike prices
  const roundPriceWithPercentagePE_GAP = openPrice * (1 + parseFloat(pe_gap));
  const roundPriceWithPercentageCE_GAP = openPrice * (1 + parseFloat(ce_gap));

  const roundToNearest = (value) => {
    const remainder = value % roundUpPrice;

    return remainder < roundUpPrice / 2
      ? value - remainder
      : value + (roundUpPrice - remainder);
  };

  return {
    PEStrikePrice: Math.round(roundToNearest(roundPriceWithPercentagePE_GAP)),
    CEstrikePrice: Math.round(roundToNearest(roundPriceWithPercentageCE_GAP)),
  };
};

export const _getPE_CE_StrikePrice_Short = async (
  _openPrice,
  pe_gap,
  ce_gap,
  round_off
) => {
  const openPrice = parseFloat(_openPrice);
  const roundUpPrice = round_off;

  // Calculate the strike prices
  const roundPriceWithPercentagePE_GAP = openPrice * (1 - parseFloat(pe_gap));
  const roundPriceWithPercentageCE_GAP = openPrice * (1 - parseFloat(ce_gap));

  const roundToNearest = (value) => {
    const remainder = value % roundUpPrice;

    return remainder < roundUpPrice / 2
      ? value - remainder
      : value + (roundUpPrice - remainder);
  };

  return {
    PEStrikePriceS: Math.round(roundToNearest(roundPriceWithPercentagePE_GAP)),
    CEstrikePriceS: Math.round(roundToNearest(roundPriceWithPercentageCE_GAP)),
  };
};

export const _calculate_Profit = async (item) => {
  //console.log(item);
  // SS
  item.SS_ClosingPrice_0_point_25 = await returnSSPoints(item, 0.0025);
  item.SS_ClosingPrice_0_point_5 = await returnSSPoints(item, 0.005);
  item.SS_ClosingPrice_1_point_0 = await returnSSPoints(item, 0.01);
  item.SS_ClosingPrice_3_point_0 = await returnSSPoints(item, 0.03);
  item.SS_ClosingPrice_5_point_0 = await returnSSPoints(item, 0.05);
  item.SS_ClosingPrice_7_point_5 = await returnSSPoints(item, 0.075);
  item.SS_ClosingPrice_10_point_0 = await returnSSPoints(item, 0.1);
  //console.log("############################################");
  // BS
  item.BS_ClosingPrice_0_point_25 = await returnBSPoints(item, 0.0025);
  item.BS_ClosingPrice_0_point_5 = await returnBSPoints(item, 0.005);
  item.BS_ClosingPrice_1_point_0 = await returnBSPoints(item, 0.01);
  item.BS_ClosingPrice_3_point_0 = await returnBSPoints(item, 0.03);
  item.BS_ClosingPrice_5_point_0 = await returnBSPoints(item, 0.05);
  item.BS_ClosingPrice_7_point_5 = await returnBSPoints(item, 0.075);
  item.BS_ClosingPrice_10_point_0 = await returnBSPoints(item, 0.1);

  return item;
};



export const _calculate_Profit_short = async (item) => {
  //console.log(item);
  // SS
  item.SS_ClosingPrice_0_point_25 = await returnSSPointsShort(item, 0.0025);
  item.SS_ClosingPrice_0_point_5 = await returnSSPointsShort(item, 0.005);
  item.SS_ClosingPrice_1_point_0 = await returnSSPointsShort(item, 0.01);
  item.SS_ClosingPrice_3_point_0 = await returnSSPointsShort(item, 0.03);
  item.SS_ClosingPrice_5_point_0 = await returnSSPointsShort(item, 0.05);
  item.SS_ClosingPrice_7_point_5 = await returnSSPointsShort(item, 0.075);
  item.SS_ClosingPrice_10_point_0 = await returnSSPointsShort(item, 0.1);
  //console.log("############################################");
  // BS
  item.BS_ClosingPrice_0_point_25 = await returnBSPointsShort(item, 0.0025);
  item.BS_ClosingPrice_0_point_5 = await returnBSPointsShort(item, 0.005);
  item.BS_ClosingPrice_1_point_0 = await returnBSPointsShort(item, 0.01);
  item.BS_ClosingPrice_3_point_0 = await returnBSPointsShort(item, 0.03);
  item.BS_ClosingPrice_5_point_0 = await returnBSPointsShort(item, 0.05);
  item.BS_ClosingPrice_7_point_5 = await returnBSPointsShort(item, 0.075);
  item.BS_ClosingPrice_10_point_0 = await returnBSPointsShort(item, 0.1);

  return item;
};


// function returnSSPoints(item, pointValue) {
//   let SSnewCalzp5 = item.open * (1 - pointValue);
//   let SSzp51 = SSnewCalzp5 - item.open;
//   let SSzp52 = item.CEOpenPrice - Math.max(SSnewCalzp5 - item.CEstrikePrice, 0);
//   let SSzp53 = Math.max(
//     item.PEstrikePrice - SSnewCalzp5 - item.PEOpenPrice,
//     -item.PEOpenPrice
//   );

//   return SSzp51 + SSzp52 + SSzp53;
// }

async function returnSSPoints(item, pointValue) {
  //console.log(item);
  let SSnewCalzp5 = item.open * (1 - pointValue);
  //console.log(`SSnewCalzp5 (${item.open} * (1 - ${pointValue})):`, SSnewCalzp5);

  let SSzp51 = SSnewCalzp5 - item.open;
  //console.log(`SSzp51 (${SSnewCalzp5} - ${item.open}):`, SSzp51);

  let SSzp52 = item.CEOpenPrice - Math.max(SSnewCalzp5 - item.CEstrikePrice, 0);
  // console.log(
  //   `SSzp52 (${item.CEOpenPrice} - Math.max(${SSnewCalzp5} - ${item.CEstrikePrice}, 0)):`,
  //   SSzp52
  // );

  let SSzp53 = Math.max(
    item.PEstrikePrice - SSnewCalzp5 - item.PEOpenPrice,
    -item.PEOpenPrice
  );
  // console.log(
  //   `SSzp53 (Math.max(${item.PEstrikePrice} - ${SSnewCalzp5} - ${item.PEOpenPrice}, -${item.PEOpenPrice})):`,
  //   SSzp53
  // );

  let result = SSzp51 + SSzp52 + SSzp53;
  // console.log(
  //   `Selling Final result with this ${pointValue} Point Value = (${SSzp51} + ${SSzp52} + ${SSzp53}):`,
  //   result
  // );

  return result;
}

async function returnBSPoints(item, pointValue) {
  let SSnewCalzp5 = item.open * (1 + pointValue);
  let SSzp51 = SSnewCalzp5 - item.open;
  let SSzp52 = item.CEOpenPrice - Math.max(SSnewCalzp5 - item.CEstrikePrice, 0);
  let SSzp53 = Math.max(
    item.PEstrikePrice - SSnewCalzp5 - item.PEOpenPrice,
    -item.PEOpenPrice
  );

  let result = SSzp51 + SSzp52 + SSzp53;
  // console.log(
  //   `Buying Final result with this ${pointValue} Point Value = (${SSzp51} + ${SSzp52} + ${SSzp53}):`,
  //   result
  // );
  return result;
}



// short

async function returnSSPointsShort(item, pointValue) {
  // console.log('######### Start of Input ############')
  // console.log('Item ',item);
  let SSnewCalzp5 = item.open * (1 - pointValue);
  // console.log(`SSnewCalzp5 (${item.open} * (1 - ${pointValue})):`, SSnewCalzp5);

  let SSzp51 =   item.open - SSnewCalzp5;
  // console.log(`SSzp51 (${item.open} - ${SSnewCalzp5}):`, SSzp51);

  let SSzp52 =  Math.max(SSnewCalzp5 - item.CEstrikePrice, 0) - item.CEOpenPrice;
  // console.log(
  //   `SSzp52 ( Math.max(${SSnewCalzp5} - ${item.CEstrikePrice}, 0) ${item.CEOpenPrice} -):`,
  //   SSzp52
  // );

  let SSzp53 =item.PEOpenPrice - Math.max( item.PEstrikePrice - SSnewCalzp5,0);
  // console.log(
  //   `SSzp53 ${item.PEOpenPrice} - Math.max( ${item.PEstrikePrice} - ${SSnewCalzp5}}, 0)`
  // );

  // console.log('S3 ', SSzp53)
  let result = SSzp51 + SSzp52 + SSzp53;
  // console.log(
  //   `Selling Final result with this ${pointValue} Point Value = (${SSzp51} + ${SSzp52} + ${SSzp53}):`,
  //   result
  // );

  // console.log('######### END of Input ############')
  return result;
}


async function returnBSPointsShort(item, pointValue) {
 // console.log('######### Start of Input ############')
  // console.log('Item ',item);
  let SSnewCalzp5 = item.open * (1 + pointValue);
  // console.log(`SSnewCalzp5 (${item.open} * (1 - ${pointValue})):`, SSnewCalzp5);

  let SSzp51 =   item.open - SSnewCalzp5;
  // console.log(`SSzp51 (${item.open} - ${SSnewCalzp5}):`, SSzp51);

  let SSzp52 =  Math.max(SSnewCalzp5 - item.CEstrikePrice, 0) - item.CEOpenPrice;
  // console.log(
  //   `SSzp52 ( Math.max(${SSnewCalzp5} - ${item.CEstrikePrice}, 0) ${item.CEOpenPrice} -):`,
  //   SSzp52
  // );

  let SSzp53 =item.PEOpenPrice - Math.max( item.PEstrikePrice - SSnewCalzp5,0);
  // console.log(
  //   `SSzp53 ${item.PEOpenPrice} - Math.max( ${item.PEstrikePrice} - ${SSnewCalzp5}}, 0)`
  // );

  // console.log('S3 ', SSzp53)
  let result = SSzp51 + SSzp52 + SSzp53;
  // console.log(
  //   `Selling Final result with this ${pointValue} Point Value = (${SSzp51} + ${SSzp52} + ${SSzp53}):`,
  //   result
  // );

  // console.log('######### END of Input ############')
  return result;
}



export const sendEmailNotification = async () => {
  let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "fantasyinfo.php@gmail.com",
      pass: "apwfrcrkbdzfvhur",
    },
  });

  let mailOptions = {
    from: "fantasyinfo.php@gmail.com",
    to: "cavinodpatil@gmail.com", // Corrected email address
    subject: "Cron Job Finished",
    text: "The cron job for updating instruments has finished successfully.",
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Email notification sent!");
  } catch (error) {
    console.error("Failed to send email notification:", error);
  }
};

// Exported WhatsApp Notification Function
export const sendWhatsAppNotification = async () => {
  // Implement Twilio API or any other WhatsApp API to send the notification
  console.log("WhatsApp notification sent!");
};

export const connectDB = async () => {
  const mongoURI =
    "mongodb+srv://vinodpatilipcc:jX6pfbg1fX7xji7i@vinod.8ufxus3.mongodb.net/zerodha";
  try {
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // Optional: additional options can be added here
    });
    console.log("MongoDB connected successfully");
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
    process.exit(1); // Exit process with failure
  }
};

export const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, "./uploads"); // Save uploaded files in the 'uploads' folder
    },
    filename: (req, file, cb) => {
      cb(null, file.originalname);
    },
  }),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    if (ext !== ".csv") {
      return cb(new Error("Only CSV files are allowed"), false);
    }
    cb(null, true);
  },
});
