
## use tutorial

### 1. install dependency, run only one time

    npm i ethers

    npm i minimist

### 2. fill the configs.json and receivers.json

### 3. get help info and run

    node TokenDistributor.js

## data struction

### 1. receivers.json

receivers.json is an array of receiver info with JSON format, and each receiver info is an array with 3 fields,

- the first one is receiver address, 
- the second one is value (human readable number), 
- and the last one is the nonce of sender address. 

example receivers.json

    [
        ["0x1234567890123456789012345678901234567890", 5, 0],
        ["0x1234567890123456789012345678901234567890", 5, 1]
    ]

### 2. configs.json

example configs.json

    {
        "privatekey": "0x1234567890123456789012345678901234567890123456789012345678901234",
        "chainid": 56,
        "rpc": "https://bsc-dataseed3.defibit.io",
        "gasprice": 5000000000,
        "explorerprefix": "https://etherscan.io/tx/",
        "native": {
            "gaslimit": 21000
        },
        "erc20": {
            "gaslimit": 73000,
            "erc20contractaddress": "0x1234567890123456789012345678901234567890"
        }
    }