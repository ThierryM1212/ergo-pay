# Ergo Payment portal

## Introduction

dApp to ease Ergo and SigUSD payment integration using Yoroi wallet and the dApp connector.
Written in javascript with bootstrap v4.

It can be tried at https://paymentportal.ergo.ga/

## Installation

> git clone https://github.com/ThierryM1212/ergo-pay.git<br/>
> cd ergo-pay/ergo-payment-portal <br/>
> npm install <br/>
> npm start <br/>
<br/>
http://localhost:8080

## Build static page

This allows to deploy a static webpage for example in apache.

> npm run buildstatic

<br/>The static website is generated in the ./dist folder

<br/>In the generated bootstrap.js remove two rows to avoid error loading the wasm (for me at line 270):
```javascript
    /******/                                } else if(typeof WebAssembly.instantiateStreaming === 'function') {
    /******/                                        promise = WebAssembly.instantiateStreaming(req, importObject);
```

## Disable the fee

Uncomment the proper section in index.js
```javascript
const MIN_ERG_FEE = 0.001;
const MIN_FEE_SIGUSD = 0.01;
const FEE_PERCENT = 0.001; // 0.1%
//const MIN_ERG_FEE = 0;
//const MIN_FEE_SIGUSD = 0;
//const FEE_PERCENT = 0;
```