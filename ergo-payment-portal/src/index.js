'use strict';
import * as wasm from "ergo-lib-wasm-browser";
import JSONBigInt from 'json-bigint';
import { parseUnsignedTx } from "./parseUtils";
import { decodeString } from "./ergo-related/serializer";
import { currentHeight, getBoxesForAdress, getSenderAddress } from './ergo-related/explorer';
import Swal from 'sweetalert2'
import { TextEncoder } from 'text-decoding';


const NANOERG_TO_ERG = 1000000000;
const MIN_ERG_BOX_VALUE = 0.001 * NANOERG_TO_ERG;
const SIGUSD_TOKENID = "03faf2cb329f2e90d6d23b58d91bbb6c046aa143261cc21f52fbe2824bfcbf04";
const MIN_ERG_FEE = 0.001;
const MIN_FEE_SIGUSD = 0.01;
const FEE_PERCENT = 0.001; // 0.1%
//const MIN_ERG_FEE = 0;
//const MIN_FEE_SIGUSD = 0;
//const FEE_PERCENT = 0;
const PP_REF = "Ergo Payment Portal"; // stored in R5 register to identify the box of this dApp
const feeAddress = "9hDPCYffeTEAcShngRGNMJsWddCUQLpNzAqwM9hQyx2w6qubmab";

async function setStatus(msg, type) {
    const status = document.getElementById("status");
    status.innerHTML = msg;
    status.className = "alert alert-" + type;
}

async function logErrorStatus(e, msg) {
    const s = msg + `: ${JSON.stringify(e)}`;
    console.error(s, e);
    setStatus(s, "danger");
}

function computeFee(currency, amount) {
    // Compute dApp fee taken paid by the seller
    var minFee = MIN_ERG_FEE; // min Erg fee
    if (currency == 'SIGUSD') {
        minFee = MIN_FEE_SIGUSD; // min SIGUSD fee
    };
    var feeFloat = minFee;
    if (feeFloat < amount * FEE_PERCENT) { // 0.1%
        feeFloat = amount * FEE_PERCENT;
    };
    return feeFloat;
}

function triggerWaitAlert(msg, html) {
    Swal.fire({
        title: msg,
        html: html,
        allowOutsideClick: true,
        showConfirmButton: false,
        imageUrl: '../resources/Spin-1.5s-94px.svg',
        onBeforeOpen: () => {
            Swal.showLoading()
        },
    });
}

async function connectErgoWallet(ergAddress, currency, amount, ref) {
    triggerWaitAlert("Connection to the wallet...");

    ergo_request_read_access().then(function (access_granted) {
        const connectWalletButton = document.getElementById("connect-wallet");
        if (!access_granted) {
            console.log("ergo access refused");
            setStatus("Wallet access denied", "warning")
            connectWalletButton.onclick = connectErgoWallet;
        } else {
            console.log("ergo access given");
            setStatus("Wallet connected", "secondary");
            triggerWaitAlert("Retrieving " + currency + " balance...");

            if (currency == "ERG") {
                ergo.get_balance().then(async function (result) {
                    const walletAmount = parseFloat(parseFloat(result) / parseFloat(NANOERG_TO_ERG)).toFixed(3);
                    connectWalletButton.innerText = "Balance: " + walletAmount + " ERG";
                    Swal.close();
                });
            } else {
                ergo.get_utxos("1000000000000", SIGUSD_TOKENID).then(async function (result) {
                    var amountUSD = 0;
                    for (var i in result) {
                        for (var j in result[i].assets) {
                            if (result[i].assets[j].tokenId == SIGUSD_TOKENID) {
                                amountUSD += parseInt(result[i].assets[j].amount);
                            }
                        }
                    }
                    const walletAmount = parseFloat(parseFloat(amountUSD) / parseFloat(100)).toFixed(2);
                    connectWalletButton.innerText = "Balance: " + walletAmount + " SigUSD";
                    Swal.close();
                });
            };
        };
    });
}

function getAmountFloat(currency, amountStr) {
    try {
        const amountFloat = parseFloat(amountStr);
    } catch (e) {
        logErrorStatus(e, "Invalid Amount");
        return null;
    };
    const amountFloat = parseFloat(amountStr);
    if ((amountFloat <= 0.0999 && currency == 'ERG') || (amountFloat <= 0.999 && currency == 'SIGUSD')) {
        setStatus("Amount too small, mininum 0.1 ERG or 1 SIGUSD", "danger");
        return null;
    }
    return amountFloat;
}

function copyURL() {
    /* Get the text field */
    var copyText = document.getElementById("payment-url");
    copyText.select();
    copyText.setSelectionRange(0, 99999); /* For mobile devices */
    navigator.clipboard.writeText(copyText.value);
    copyText.onclick = null;
    Swal.fire({
        icon: 'success',
        title: 'Payment URL copied to clipboard',
        timer: 1000,
        showConfirmButton: false
    });

}

async function generatePaymentURL(event) {
    // prevent submit
    event.preventDefault(event);
    const tokenForm = document.getElementById("token-form");
    // run the form validation
    tokenForm.reportValidity();
    if (!tokenForm.checkValidity()) {
        console.log("validation error");
        return false;
    };
    var generatedURL = window.location.protocol + '//' + window.location.host;
    for (const part of window.location.pathname.split('/')){
        if (part !== "" && part !== "/") {
            if (!part.includes(".htm")) {
                generatedURL = generatedURL + "/" + part
            }
        }
    }
    generatedURL = generatedURL + "/pay.html?";
    const address = document.getElementById("address").value;
    if (address.length != 51 && address.charAt(0) != '9') {
        setStatus("Invalid ERG address", "danger");
        return null;
    };
    generatedURL += "address=" + address;
    const currency = document.querySelector('input[name="currency"]:checked').value;
    generatedURL += "&currency=" + currency;
    const amount = document.getElementById("amount").value;
    const amountFloat = getAmountFloat(currency, amount);
    if (amountFloat == null || amountFloat == undefined) {
        return null;
    };
    generatedURL += "&amount=" + amount;
    const ref = document.getElementById("ref").value;
    if (ref != null && ref != "") {
        generatedURL += "&ref=" + encodeURIComponent(ref);
    }
    var paymentURLElem = document.getElementById("payment-url");
    paymentURLElem.value = generatedURL;
    paymentURLElem.onclick = copyURL;
    const fee = computeFee(currency, amountFloat);
    document.getElementById("fee").value = fee.toString() + " " + currency;
    var QRCode = require('qrcode')
    var canvas = document.getElementById('canvas')
    QRCode.toCanvas(canvas, generatedURL, function (error) {
        if (error) console.error(error)
        console.log('success!');
    });
    var res = document.getElementsByClassName("result");
    for (var i in res) {
        res[i].removeAttribute("hidden");
    };

    setStatus("Payment URL generated for address " + address, "secondary");
}

async function loadVoucherPage(ergAddress) {
    const boxes = await getBoxesForAdress(ergAddress);
    const container = document.getElementById("container");
    const csvArea = document.getElementById("csvArea");
    const jsonArea = document.getElementById("jsonArea");
    var csv = '"Payment reference","Amount ERG","Amount SigUSD","Sender address"\n';
    var jSonList = [];

    if (boxes.length > 0) {
        const voucherList = await extractVoucherList(boxes);

        for (var i in voucherList) {
            var html_row = "<td><h5 class=\"payment-ref\">" + voucherList[i][0] + "</h5></td>";
            html_row += "<td><h5 class=\"amount-erg\">" + voucherList[i][1] + "</h5></td>";
            html_row += "<td><h5 class=\"amount-sigusd\">" + formatTokenAmount(voucherList[i][2], 2) + "</h5></td>";
            html_row += "<td><h5 class=\"sender-address\">" + formatLongString(voucherList[i][3], 10) + "</h5></td>";
            var e = document.createElement('tr');
            e.innerHTML = html_row;
            container.appendChild(e);
            csv += '"' + voucherList[i].join('","') + '"\n';
            var myJson = {};
            myJson["ref"] = voucherList[i][0];
            myJson["amountERG"] = voucherList[i][1];
            myJson["amountSIGUSD"] = (parseFloat(voucherList[i][2]) / 100).toFixed(2);
            myJson["senderAddress"] = voucherList[i][3];
            jSonList.push(myJson);
        }
        csvArea.value = csv;
        jsonArea.value = JSON.stringify(jSonList, null, 2);
    }
}

async function extractVoucherList(boxes) {
    var voucherList = [];
    for (var i in boxes) {
        if ("R4" in boxes[i].additionalRegisters
            && "R5" in boxes[i].additionalRegisters) {
            if (boxes[i].additionalRegisters.R4.sigmaType == 'Coll[SByte]'
                && boxes[i].additionalRegisters.R5.sigmaType == 'Coll[SByte]') {
                const appRef = await decodeString(boxes[i].additionalRegisters.R5.serializedValue);
                if (appRef == PP_REF) {
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
                    voucherList.push([paymentRef, amountERG, amountSIGUSD, senderAddress]);
                }
            }
        }
    }
    return voucherList;
}

function loadPaymentPage(ergAddress, currency, amount, ref) {
    const addressElem = document.getElementById("address");
    addressElem.value = ergAddress;
    const assetElem = document.getElementById("asset-label");
    assetElem.innerText = currency.toUpperCase();
    const amountElem = document.getElementById("amount");
    amountElem.value = amount;
    const refElem = document.getElementById("ref");
    refElem.value = ref;
    const sendButton = document.getElementById("send-transaction");
    sendButton.onclick = sendTransaction;
}

async function sendTransaction() {
    triggerWaitAlert("Getting inputs for the transaction...");
    const creationHeight = await currentHeight();
    const address = document.getElementById("address").value;
    const currency = document.getElementById("asset-label").innerText.toUpperCase();
    const amountFloat = parseFloat(document.getElementById("amount").value);
    const ref = document.getElementById("ref").value;
    const changeAddress = await ergo.get_change_address();

    const feeFloat = computeFee(currency, amountFloat);
    //console.log("inputs:", address, currency, amountFloat, ref, feeFloat);

    // Prepare total ergs and/or SIGUSD to send
    var globalNanoErgsToSendInt = BigInt(Math.round(amountFloat * NANOERG_TO_ERG));
    var tokens = new wasm.Tokens();
    if (currency == 'SIGUSD') {
        if (feeFloat > 0) {
            globalNanoErgsToSendInt = BigInt(2 * MIN_ERG_BOX_VALUE);
        } else {
            globalNanoErgsToSendInt = BigInt(MIN_ERG_BOX_VALUE);
        };
        tokens.add(new wasm.Token(
            wasm.TokenId.from_str(SIGUSD_TOKENID),
            wasm.TokenAmount.from_i64(wasm.I64.from_str(Math.round((amountFloat * 100)).toString()))
        ));
    };

    // Get the input boxes from the connected wallet
    const utxos = await getAllUtxos();
    const selector = new wasm.SimpleBoxSelector();
    const globalNanoErgsToSend = wasm.BoxValue.from_i64(wasm.I64.from_str(globalNanoErgsToSendInt.toString()));
    let boxSelection = {};
    try {
        boxSelection = selector.select(
            wasm.ErgoBoxes.from_boxes_json(utxos),
            wasm.BoxValue.from_i64(globalNanoErgsToSend.as_i64().checked_add(wasm.TxBuilder.SUGGESTED_TX_FEE().as_i64())),
            tokens);
    } catch (e) {
        let msg = "[Wallet] Error: "
        if (JSON.stringify(e).includes("BoxValue out of bounds")) {
            msg = msg + "Increase the Erg amount to process the transaction. "
        }
        logErrorStatus(e, msg);
        Swal.close();
        return null;
    }
    //console.log('boxSelection: ', boxSelection.boxes().len());

    // Prepare the output boxes
    const outputCandidates = wasm.ErgoBoxCandidates.empty();

    // Build the seller output box
    var ergsStr = Math.round((amountFloat - feeFloat) * NANOERG_TO_ERG).toString();
    var ergsAmountBoxValue = wasm.BoxValue.from_i64(wasm.I64.from_str(ergsStr));
    var sellerTokenAmount = 0;
    if (currency == 'SIGUSD') {
        ergsAmountBoxValue = wasm.BoxValue.from_i64(wasm.I64.from_str(MIN_ERG_BOX_VALUE.toString()));
    };
    //console.log('ergsStr', ergsStr);
    const sellerBoxBuilder = new wasm.ErgoBoxCandidateBuilder(
        ergsAmountBoxValue,
        wasm.Contract.pay_to_address(wasm.Address.from_base58(address)),
        creationHeight);
    if (currency == 'SIGUSD') {
        sellerTokenAmount = Math.round((amountFloat - feeFloat) * 100);
        sellerBoxBuilder.add_token(
            wasm.TokenId.from_str("03faf2cb329f2e90d6d23b58d91bbb6c046aa143261cc21f52fbe2824bfcbf04"),
            wasm.TokenAmount.from_i64(wasm.I64.from_str(BigInt(sellerTokenAmount).toString())
            ));
    }
    // Add the registers
    // R4 provided in input by the seller to identify the transaction from the generated link
    // R5 as a reference of the payment portal
    const byteArray = new TextEncoder().encode(ref);
    const encodedRef = new Uint8Array(byteArray.buffer);
    sellerBoxBuilder.set_register_value(4, wasm.Constant.from_byte_array(encodedRef));
    const ppRegister = new TextEncoder().encode(PP_REF);
    const encodedPpRegister = new Uint8Array(ppRegister.buffer);
    sellerBoxBuilder.set_register_value(5, wasm.Constant.from_byte_array(encodedPpRegister));
    //console.log('R4:', new TextDecoder().decode(sellerBoxBuilder.register_value(4).to_byte_array()));
    //console.log('R5:', new TextDecoder().decode(sellerBoxBuilder.register_value(5).to_byte_array()));
    try {
        outputCandidates.add(sellerBoxBuilder.build());
    } catch (e) {
        console.log(`building error: ${e}`);
        Swal.close();
        throw e;
    }

    // Build the fee output box
    if (feeFloat > 0) {
        const feeStrNano = Math.round((feeFloat * NANOERG_TO_ERG)).toString();
        var feeAmountBoxValue = wasm.BoxValue.from_i64(wasm.I64.from_str(feeStrNano));
        if (currency == 'SIGUSD') {
            feeAmountBoxValue = wasm.BoxValue.from_i64(wasm.I64.from_str(MIN_ERG_BOX_VALUE.toString()));
        };
        const feeBoxBuilder = new wasm.ErgoBoxCandidateBuilder(
            feeAmountBoxValue,
            wasm.Contract.pay_to_address(wasm.Address.from_base58(feeAddress)),
            creationHeight);
        if (currency == 'SIGUSD') {
            const feeNanoErgToSend = Math.round((feeFloat) * 100);
            feeBoxBuilder.add_token(
                wasm.TokenId.from_str("03faf2cb329f2e90d6d23b58d91bbb6c046aa143261cc21f52fbe2824bfcbf04"),
                wasm.TokenAmount.from_i64(wasm.I64.from_str(feeNanoErgToSend.toString())
                ));
        }
        try {
            outputCandidates.add(feeBoxBuilder.build());
        } catch (e) {
            console.log(`building error: ${e}`);
            Swal.close();
            throw e;
        }
    }

    // Create the transaction 
    const txBuilder = wasm.TxBuilder.new(
        boxSelection,
        outputCandidates,
        creationHeight,
        wasm.TxBuilder.SUGGESTED_TX_FEE(),
        wasm.Address.from_base58(changeAddress),
        wasm.BoxValue.SAFE_USER_MIN());
    const dataInputs = new wasm.DataInputs();
    txBuilder.set_data_inputs(dataInputs);
    const tx = parseUnsignedTx(txBuilder.build().to_json());
    //console.log(`tx: ${JSONBigInt.stringify(tx)}`);

    const correctTx = parseUnsignedTx(wasm.UnsignedTransaction.from_json(JSONBigInt.stringify(tx)).to_json());
    // Put back complete selected inputs in the same order
    correctTx.inputs = correctTx.inputs.map(box => {
        //console.log(`box: ${JSONBigInt.stringify(box)}`);
        const fullBoxInfo = utxos.find(utxo => utxo.boxId === box.boxId);
        return {
            ...fullBoxInfo,
            extension: {}
        };
    });
    //console.log(`correctTx: ${JSONBigInt.stringify(correctTx)}`);

    // Send transaction for signing
    setStatus("Awaiting transaction signing", "secondary");

    triggerWaitAlert('Awaiting transaction signing', 'Please review the transaction shown in the wallet and sign it to process the payment.<br/>The transactions on blockchain cannot be reverted nor cancelled.');

    processTx(correctTx).then(txId => {
        Swal.close();
        console.log('[txId]', txId);
        if (txId) {
            displayTxId(txId);
            Swal.fire({
                title: 'Transaction successfully sent, waiting for it reaches the explorer',
                icon: 'success',
                timer: 10000,
                timerProgressBar: true
            });
        }
    });
    return false;

}

async function getAllUtxos() {
    const filteredUtxos = [];
    const utxos = await ergo.get_utxos();
    for (const utxo of utxos) {
        try {
            wasm.ErgoBox.from_json(JSONBigInt.stringify(utxo));
            filteredUtxos.push(utxo);
        } catch (e) {
            logErrorStatus(e, "[getAllUtxos] UTxO failed parsing:");
            return null;
        }
    }
    return filteredUtxos;
}

async function signTx(txToBeSigned) {
    try {
        return await ergo.sign_tx(txToBeSigned);
    } catch (e) {
        logErrorStatus(e, "[signTx] Error");
        return null;
    }
}

async function submitTx(txToBeSubmitted) {
    try {
        return await ergo.submit_tx(txToBeSubmitted);
    } catch (e) {
        logErrorStatus(e, "[submitTx] Error");
        return null;
    }
}

async function processTx(txToBeProcessed) {
    const msg = s => {
        console.log('[processTx]', s);
        setStatus(s, "secondary");
    };
    const signedTx = await signTx(txToBeProcessed);
    if (!signedTx) {
        console.error(`No signed transaction found`);
        return null;
    }
    msg("Transaction signed - awaiting submission");
    const txId = await submitTx(signedTx);
    if (!txId) {
        console.log(`No submitted tx ID`);
        return null;
    }
    msg("Transaction submitted ");
    return txId;
}

function displayTxId(txId) {
    const status = document.getElementById("status");
    const cr = document.createElement("br");
    const txTracker = document.createElement("a");
    txTracker.appendChild(document.createTextNode(`View transaction in explorer: ${txId}`));
    txTracker.href = `https://explorer.ergoplatform.com/en/transactions/${txId}`;
    txTracker.target = "_blank"
    status.appendChild(cr);
    status.appendChild(txTracker);
    status.className = "alert alert-secondary";
}

// return formatted token amount like 6,222,444.420
// amountInt: number of token as provided in utxo (to be divided by 10^decimals)
// decimalsInt: number of decimals of te token
export function formatTokenAmount(amountInt, decimalsInt) {
    if (decimalsInt > 0) {
        const numberAmount = (Number(amountInt) / Number(Math.pow(10, parseInt(decimalsInt)))).toFixed(parseInt(decimalsInt));
        var str = numberAmount.toString().split(".");
        str[0] = str[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return str.join(".");
    } else {
        return amountInt.replace(/\B(?=(\d{3})+(?!\d))/g, ",");;
    }
}

export function formatLongString(str, num) {
    if (str.length > 2 * num) {
        return str.substring(0, num) + "..." + str.substring(str.length - num, str.length);
    } else {
        return str;
    }
}

// INIT page
const currentLocation = window.location;
if (currentLocation.toString().includes("pay.html")) {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    var parameterValid = true;
    // ERG address
    const address = urlParams.get('address');
    if (address != null && address.length != 51 && address.charAt(0) != '9') {
        setStatus("Invalid ERG address", "danger");
        parameterValid = false;
    };
    // Currency
    const currency = urlParams.get('currency').toUpperCase();
    if (currency != 'ERG' && currency != 'SIGUSD') {
        setStatus("Invalid currency parameter '" + currency + "': Only ERG or SIGUSD are accepted", "danger");
        parameterValid = false;
    };
    // Amount
    const amount = urlParams.get('amount');
    const amountFloat = getAmountFloat(currency, amount);
    console.log("amountFloat", amountFloat);
    if (amountFloat == null || isNaN(amountFloat)) {
        setStatus("Invalid amount parameter: " + amount, "danger");
        parameterValid = false;
    };
    // Reference, optional
    const ref = urlParams.get('ref');
    if (parameterValid) {
        loadPaymentPage(address, currency, amount, ref);
        if (typeof ergo_request_read_access === "undefined") {
            var msg = "dApp connector not found, to use an ergo wallet extension ";
            msg += '<a href="https://github.com/ThierryM1212/SAFEW/releases" target="_blank">SAFEW</a>.';
            setStatus(msg, "warning");
            const sendButton = document.getElementById("send-transaction");
            sendButton.disabled = true;
        } else {
            console.log("Yorio ergo dApp found");
            window.addEventListener("ergo_wallet_disconnected", function (event) {
                const connectWalletButton = document.getElementById("connect-wallet");
                connectWalletButton.value = "Connect wallet";
                connectWalletButton.onclick = connectErgoWallet;
                setStatus("Ergo wallet disconnected", "warning");
                const container = document.getElementById("main");
                container.addAttribute("hidden");
            });
            connectErgoWallet(address, currency, amount, ref);
        }
    }
} else if (currentLocation.toString().includes("voucher.html")) {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const ergAddress = urlParams.get('address');
    if (ergAddress == null) {
        setStatus("Provide the ERG address to monitor", "secondary");
    } else {
        if (ergAddress.length != 51 || ergAddress.charAt(0) != '9') {
            setStatus("Invalid ERG address", "danger");
        } else {
            setStatus("List of the received payments from " + PP_REF + " for address <b>" + ergAddress + "</b>", "secondary");
            document.getElementById("result").removeAttribute("hidden");
            loadVoucherPage(ergAddress);
        }
    }
}
else { // generate URL page
    const generateButton = document.getElementById("generate-url");
    generateButton.onclick = generatePaymentURL;
    setStatus("Provide the inputs for the payment request URL", "secondary");
};





