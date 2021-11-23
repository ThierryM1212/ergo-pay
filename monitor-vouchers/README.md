Server for monitoring Ergo payment received from ErgoPay dApp

Tested with nodejs v16.12.0

# Installation and start

> npm install
> node monitor-payment-server.js

# Usage 
You can get the json list of the payments received to the ERG address 9xxxxxxxxxxxxxxxxxx, from the ErgoPay dApp requesting the following URL:
http://localhost:3030?address=9xxxxxxxxxxxxxxxxxx

It is intended to be deployed along with the application for which you want to integrate the Ergo or SigUSD payments or the code could be integrated in your website / application.

Sample json returned:

```json
[
  {
    "ref": "d10f610a-29f7-4180-ad6f-e37419ffdedd",
    "amountERG": "0.0010",
    "amountSIGUSD": "1.00"
  },
  {
    "ref": "d10f610a-29f7-4180-ad6f-e37419ffdedc",
    "amountERG": "0.2500",
    "amountSIGUSD": "0.00"
  },
  {
    "ref": "REF 7685-32",
    "amountERG": "0.0990",
    "amountSIGUSD": "0.00"
  },
  {
    "ref": "REF 7685-32",
    "amountERG": "0.0950",
    "amountSIGUSD": "0.00"
  }
]
```
