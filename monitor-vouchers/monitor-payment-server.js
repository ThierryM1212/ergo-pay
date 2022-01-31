import {Serializer} from "@coinbarn/ergo-ts";
let ergolib = import('ergo-lib-wasm-nodejs');
import express from 'express';
import fetch from 'node-fetch';

const NANOERG_TO_ERG = 1000000000;
const APP_PORT = 3030;
const explorerV1Api = 'https://api.ergoplatform.com/api/v1';
const PP_REF = "Ergo Payment Portal";
const SIGUSD_TOKENID = "03faf2cb329f2e90d6d23b58d91bbb6c046aa143261cc21f52fbe2824bfcbf04";
const app = express();
const DEFAULT_LIMIT = "100";

// Get the boxes for the given address and returns the list of payment coming from "Ergo Payment Portal" with the reference and amounts
// http://localhost:3030?address=9ew97YCt7zQDwmLsytMAWGj2kockM11PFCnRvT2cz9LQaaB7uPG&limit=500

app.get('/', async function (req, res) {
  var limit = DEFAULT_LIMIT;
  if ("limit" in req.query) {
    limit = req.query.limit;
  }

  const boxes = await getBoxesForAdress(req.query.address, limit);
  var response = [];
  if (boxes.length > 0) {
    const voucherList = await extractVoucherList(boxes);
    for (var i in voucherList) {
      var myJson = {};
      myJson["ref"] = voucherList[i][0];
      myJson["amountERG"] = voucherList[i][1];
      myJson["amountSIGUSD"] = (parseFloat(voucherList[i][2])/100).toFixed(2);
      myJson["senderAddress"] = voucherList[i][3];
      response.push(myJson);
    }
  } 
  res.send(response);
})
console.log("Ergo Pay monitor server running on port: " + APP_PORT);
console.log("Sample URL: http://localhost:"+ APP_PORT +"?address=9ew97YCt7zQDwmLsytMAWGj2kockM11PFCnRvT2cz9LQaaB7uPG&limit=200");
app.listen(APP_PORT);

async function extractVoucherList (boxes) {
  var voucherList = [];
  for (var i in boxes) {
      if ("R4" in boxes[i].additionalRegisters 
          && "R5" in boxes[i].additionalRegisters) {
          if (boxes[i].additionalRegisters.R4.sigmaType == 'Coll[SByte]' 
                  && boxes[i].additionalRegisters.R5.sigmaType == 'Coll[SByte]') {
              const appRef = await decodeString(boxes[i].additionalRegisters.R5.serializedValue);
              if (appRef == PP_REF ) {
                  const txId = boxes[i].transactionId;
                  const senderAddress = await getSenderAddress(txId);
                  const paymentRef = await decodeString(boxes[i].additionalRegisters.R4.serializedValue);
                  const amountERG = (parseInt(boxes[i].value) / NANOERG_TO_ERG).toFixed(4);
                  var amountSIGUSD = 0;
                  for (var j in boxes[i].assets) {
                      if (boxes[i].assets[j].tokenId == SIGUSD_TOKENID) {
                          amountSIGUSD += boxes[i].assets[j].amount;
                      }
                  }
                  voucherList.push([paymentRef,amountERG,amountSIGUSD,senderAddress]);
              }
          }
      }
  }
  return voucherList;
}

async function getRequestV1(url) {
  return get(explorerV1Api + url).then(res => {
      return { data: res };
  });
}

async function getBoxesForAdress(addr, limit) {
  return getRequestV1(
      `/boxes/byAddress/${addr}?limit=${limit}`
  ).then(res => res.data.items);
}

async function getSenderAddress(txId) {
    return getRequestV1(
      `/transactions/${txId}`
  ).then(res => res.data.inputs[0].address);
}

function toHexString(byteArray) {
  return Array.from(byteArray, function(byte) {
      return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('')
}

async function decodeString(encoded) {
  return Serializer.stringFromHex(toHexString((await ergolib).Constant.decode_from_base16(encoded).to_byte_array()))
}

async function get(url, apiKey = '') {
  return await fetch(url, {
      headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          api_key: apiKey,
      },
  }).then(res => res.json());
}
