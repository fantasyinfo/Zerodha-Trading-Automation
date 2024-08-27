app.post("/fetch-strike-price", async function (req, res) {
  //   var requestBody = req.body;
  //   var roundUpPrice = parseInt(requestBody.roundup);

  //   var pe_gap = requestBody.pe_gap;
  //   var ce_gap = requestBody.ce_gap;

  // Define the sleep function
  //   function sleep(ms) {
  //     return new Promise((resolve) => setTimeout(resolve, ms));
  //   }

  try {
    // Fetch all weekly data
    let data = await Weekly.find();

    let netProfit = 0;
    let dateAndProfit = [];
    // Map through data to modify each item

    let roundedData = await Promise.all(
      data.map(async function (item) {
        try {
          //   var openPrice = parseFloat(item.open);

          //   var roundPriceWithPercentagePE_GAP = openPrice * pe_gap + openPrice; // (700 * 0.03) + 700
          //   var roundPriceWithPercentageCE_GAP = openPrice * ce_gap + openPrice; // 700 - (700 * 0.03)

          //   var roundedPEOpen;
          //   var roundedCEOpen;

          //   if (roundPriceWithPercentagePE_GAP % roundUpPrice === 0) {
          //     roundedPEOpen = roundPriceWithPercentagePE_GAP;
          //     roundedCEOpen = roundPriceWithPercentageCE_GAP;
          //   } else if (roundPriceWithPercentagePE_GAP < roundUpPrice) {
          //     roundedPEOpen = roundPriceWithPercentagePE_GAP;
          //     roundedCEOpen = roundPriceWithPercentageCE_GAP;
          //   } else {
          //     var remainder = roundPriceWithPercentagePE_GAP % roundUpPrice;
          //     if (remainder < roundUpPrice / 2) {
          //       roundedPEOpen = roundPriceWithPercentagePE_GAP - remainder;
          //     } else {
          //       roundedPEOpen =
          //         roundPriceWithPercentagePE_GAP + (roundUpPrice - remainder);
          //     }
          //     var remainder1 = roundPriceWithPercentageCE_GAP % roundUpPrice;
          //     if (remainder1 < roundUpPrice / 2) {
          //       roundedCEOpen = roundPriceWithPercentageCE_GAP - remainder1;
          //     } else {
          //       roundedCEOpen =
          //         roundPriceWithPercentageCE_GAP + (roundUpPrice - remainder1);
          //     }
          //   }

          // Convert item to plain object and add roundedPEOpen
          //   item = item.toObject();
          //   item.PEstrikePrice = roundedPEOpen.toString();
          //   item.CEstrikePrice = roundedCEOpen.toString();

          let [year0, month0, date0] = item.date.split(" ")[0].split("-");
          // Find expiryDate for the current item's date

          let expiryDate = await Dates.findOne({
            date: `${date0}-${month0}-${year0}`,
          });

          // console.log({
          //   date: `${date0}-${month0}-${year0}`,
          //   Expirydate: expiryDate,
          // });

          if (expiryDate) {
            item.expiryDate = convertToAPIDate18(expiryDate.expiryDate);
          }
          // PE (put) options fetching open price for open date

          let [year1, month1, date1] = item.date.split(" ")[0].split("-");
          item.date = `${year1}-${month1}-${date1}`; // temporray comment
          // item.date = `2024-03-01`;
          console.log("PE Stricke Price ", item.PEstrikePrice);

          let [date2, month2, year2] = expiryDate.expiryDate
            .split(" ")[0]
            .split("-");
          expiryDateReverse = `${year2}-${month2}-${date2}`;

          // console.log("From Date ", item.date);
          // console.log("To Date ", item.date);
          // console.log("Expiry Date ", expiryDateReverse);

          const _tmp = {
            interval: "5minute",
            fromDate: item.date + "T07:00:00.000Z",
            toDate: item.date + "T07:00:00.000Z",
            stockCode: item.stockcode,
            exchangeCode: "NFO",
            productType: "options",
            expiryDate: expiryDateReverse + "T07:00:00.000Z",
            right: "put",
            strikePrice: item.PEstrikePrice,
          };

          // console.log(_tmp);

          const takeTimeArr = [
            "09:15:00",
            "09:20:00",
            "09:25:00",
            "09:30:00",
            "09:35:00",
            "09:40:00",
            "09:45:00",
            "09:50:00",
            "09:55:00",
            "10:00:00",
            "10:05:00",
            "10:10:00",
            "10:15:00",
          ];
          // Assuming 'breeze' is your API client for historical data
          await breeze.getHistoricalData(_tmp).then((resp) => {
            if (resp && resp.Success && resp.Success.length > 0) {
              const res = resp.Success;
              // console.log(res);
              item.PEOpenPrice = res[0].open.toString();
              item.PEOpenvolume = 0;
              res.forEach((hd) => {
                const timePart = hd.datetime.split(" ")[1]; // Extract the time part from the datetime
                const datePart = hd.datetime.split(" ")[0]; // Extract the date part from the datetime

                if (
                  takeTimeArr.includes(timePart) &&
                  datePart === item.date &&
                  hd.volume != 0
                ) {
                  item.PEOpenvolume += parseInt(hd.volume); // Sum the volume
                } else {
                  console.log(
                    ` Date time not matched. time ${timePart} date ${datePart}  And my open date ${item.date}`
                  );
                }
              });
            } else {
              item.PEOpenPrice = "0";
            }
          });

          await sleep(2000);
          // PE (put) options fetching close price for expiry date
          const _tmp1 = {
            interval: "5minute",
            fromDate: expiryDateReverse + "T07:00:00.000Z",
            toDate: expiryDateReverse + "T07:00:00.000Z",
            stockCode: item.stockcode,
            exchangeCode: "NFO",
            productType: "options",
            expiryDate: expiryDateReverse + "T07:00:00.000Z",
            right: "put",
            strikePrice: item.PEstrikePrice,
          };

          // Assuming 'breeze' is your API client for historical data
          await breeze.getHistoricalData(_tmp1).then((resp) => {
            if (resp && resp.Success && resp.Success.length > 0) {
              const res = resp.Success;
              item.PEclosingPrice = res[res.length - 1].close.toString();
              item.PEClosevolume = res[res.length - 1].volume.toString();
              item.PEClosevolumeDate = res[res.length - 1].datetime.toString();
            } else {
              item.PEclosingPrice = "0";
            }
          });

          // Adding a sleep before the next call
          await sleep(2000);

          // CE (put) options fetching open price for open date
          const _tmp2 = {
            interval: "5minute",
            fromDate: item.date + "T07:00:00.000Z",
            toDate: item.date + "T07:00:00.000Z",
            stockCode: item.stockcode,
            exchangeCode: "NFO",
            productType: "options",
            expiryDate: expiryDateReverse + "T07:00:00.000Z",
            right: "call",
            strikePrice: item.CEstrikePrice,
          };

          // Assuming 'breeze' is your API client for historical data
          await breeze.getHistoricalData(_tmp2).then((resp) => {
            if (resp && resp.Success && resp.Success.length > 0) {
              const res = resp.Success;
              //console.log(res);
              item.CEOpenPrice = res[0].open.toString();
              // item.CEOpenvolume = res[0].volume.toString();

              item.CEOpenvolume = 0;
              res.forEach((hd) => {
                const timePart = hd.datetime.split(" ")[1]; // Extract the time part from the datetime
                const datePart = hd.datetime.split(" ")[0]; // Extract the date part from the datetime

                if (
                  takeTimeArr.includes(timePart) &&
                  datePart === item.date &&
                  hd.volume != 0
                ) {
                  item.CEOpenvolume += parseInt(hd.volume); // Sum the volume
                } else {
                  console.log(
                    ` Date time not matched. time ${timePart} date ${datePart}  And my open date ${item.date}`
                  );
                }
              });
            } else {
              item.CEOpenPrice = "0";
            }
          });

          await sleep(2000);

          // CE (put) options fetching close price for expiry date
          const _tmp3 = {
            interval: "5minute",
            fromDate: expiryDateReverse + "T07:00:00.000Z",
            toDate: expiryDateReverse + "T07:00:00.000Z",
            stockCode: item.stockcode,
            exchangeCode: "NFO",
            productType: "options",
            expiryDate: expiryDateReverse + "T07:00:00.000Z",
            right: "call",
            strikePrice: item.CEstrikePrice,
          };

          // Assuming 'breeze' is your API client for historical data
          await breeze.getHistoricalData(_tmp3).then((resp) => {
            if (resp && resp.Success && resp.Success.length > 0) {
              const res = resp.Success;
              // console.log(res[res.length - 1]);
              item.CEclosingPrice = res[res.length - 1].close.toString();
              item.CEClosevolume = res[res.length - 1].volume.toString();
              item.CEClosevolumeDate = res[res.length - 1].datetime.toString();
            } else {
              console.log("Error : ", resp);
              item.CEclosingPrice = "0";
            }
          });

          const CheckEndDate = takeClosingDateLessTime(
            item.CEClosevolumeDate,
            item.PEClosevolumeDate
          );

          item.lessThen2P0 = 0;

          // First, compare the dates and determine which comes first
          if (
            new Date(item.PEClosevolumeDate) < new Date(item.CEClosevolumeDate)
          ) {
            // PE comes first, so use PEclosingPrice
            item.checkClosingPriceViaTime = item.PEclosingPrice;
            if (item.PEclosingPrice < 0.2) {
              // If PEclosingPrice is less than 0.2, assign the later date (CEClosevolumeDate)
              item.lessThen2P0 = item.CEClosevolumeDate;
            } else {
              // Otherwise, assign the later date (PEClosevolumeDate)
              item.lessThen2P0 = item.PEClosevolumeDate;
            }
          } else {
            // CE comes first, so use CEclosingPrice
            item.checkClosingPriceViaTime = item.CEclosingPrice;
            if (item.CEclosingPrice < 0.2) {
              // If CEclosingPrice is less than 0.2, assign the later date (PEClosevolumeDate)
              item.lessThen2P0 = item.PEClosevolumeDate;
            } else {
              // Otherwise, assign the later date (CEClosevolumeDate)
              item.lessThen2P0 = item.CEClosevolumeDate;
            }
          }

          // check if item.lessThen2P0 = 0
          // console.log(item);
          // console.log("Item: ", item);
          await sleep(2000);

          // Save the updated item back to the database
          __filenameexpiryStock = await Stock.findOne({
            date: item.lessThen2P0,
          });

          if (__filenameexpiryStock) {
            item.equityClosingPrice = __filenameexpiryStock.close;
          }

          let c1 = item.equityClosingPrice - item.open;

          console.log("C1 ", c1);
          let c2 =
            item.CEOpenPrice -
            Math.max(item.equityClosingPrice - item.CEstrikePrice, 0);

          console.log("C2 ", c2);

          let c3 = Math.max(
            item.PEstrikePrice - item.equityClosingPrice - item.PEOpenPrice,
            -item.PEOpenPrice
          );

          console.log("C3 ", c3);
          // Calculate profit

          dateAndProfit.push({ date: item.date, profit: item.profit });

          if (item.PEOpenPrice == 0 || item.CEOpenPrice == 0) {
            await Weekly.findByIdAndDelete(item._id);
          } else {
            // net profit

            item.profit = c1 + c2 + c3;
            netProfit += item.profit;

            // new fields added...................

            item["SS_ClosingPrice_0_point_25"] = returnSSPoints(item, 0.0025);
            item["SS_ClosingPrice_0_point_5"] = returnSSPoints(item, 0.005);
            item["SS_ClosingPrice_1_point_0"] = returnSSPoints(item, 0.01);
            item["SS_ClosingPrice_3_point_0"] = returnSSPoints(item, 0.03);
            item["SS_ClosingPrice_5_point_0"] = returnSSPoints(item, 0.05);
            item["SS_ClosingPrice_7_point_5"] = returnSSPoints(item, 0.075);
            item["SS_ClosingPrice_10_point_0"] = returnSSPoints(item, 0.1);
            // ###########################################
            item["BS_ClosingPrice_0_point_25"] = returnBSPoints(item, 0.0025);
            item["BS_ClosingPrice_0_point_5"] = returnBSPoints(item, 0.005);
            item["BS_ClosingPrice_1_point_0"] = returnBSPoints(item, 0.01);
            item["BS_ClosingPrice_3_point_0"] = returnBSPoints(item, 0.03);
            item["BS_ClosingPrice_5_point_0"] = returnBSPoints(item, 0.05);
            item["BS_ClosingPrice_7_point_5"] = returnBSPoints(item, 0.075);
            item["BS_ClosingPrice_10_point_0"] = returnBSPoints(item, 0.1);

            const ssPoints = [
              item["SS_ClosingPrice_0_point_25"],
              item["SS_ClosingPrice_0_point_5"],
              item["SS_ClosingPrice_1_point_0"],
              item["SS_ClosingPrice_3_point_0"],
              item["SS_ClosingPrice_5_point_0"],
              item["SS_ClosingPrice_7_point_5"],
              item["SS_ClosingPrice_10_point_0"],
              item["BS_ClosingPrice_0_point_25"],
              item["BS_ClosingPrice_0_point_5"],
              item["BS_ClosingPrice_1_point_0"],
              item["BS_ClosingPrice_3_point_0"],
              item["BS_ClosingPrice_5_point_0"],
              item["BS_ClosingPrice_7_point_5"],
              item["BS_ClosingPrice_10_point_0"],
            ];

            const maxGain = Math.max(...ssPoints);
            const maxLoss = Math.min(...ssPoints);

            await Weekly.findByIdAndUpdate(item._id, item, { new: true });
            await Profit.create({
              netProfit,
              dateAndProfit: {
                date: item.date,
                profit: item.profit,
                PEOpenvolume: item.PEOpenvolume,
                CEOpenvolume: item.CEOpenvolume,
              },
              maxLoss,
              maxGain,
            });
          }

          // Adding a sleep before the next iteration
          await sleep(2000);

          return item;
        } catch (innerErr) {
          console.error("Error processing item:", item._id, innerErr);
          return null;
        }
      })
    );

    // Fetch the updated data from the database
    let updatedData = await Weekly.find();

    // Respond with the updated data
    res
      .status(200)
      .json({ updatedData, netProfit, dateAndProfit, status: 200 });
  } catch (err) {
    console.error("Error fetching data from Weekly:", err);
    res.status(500).json({ error: "Error fetching data from Weekly" });
  }
});
