const {ethers} = require("ethers")
const configs = require('./configs')
const fs = require('fs')
const sd = require('silly-datetime')

// ******************************************************* parameters *************************************************************

// constant string
const STR_NATIVE = "native"
const STR_SEND = "send"
const STR_ERC20 = "erc20"
const STR_TYPE_STRING = "string"
const STR_TYPE_NUMBER = "number"

// system parameters
let retryTimes = 6
let sleepTime = 3000

let configsFormat = {
    "privatekey": {
        "type": STR_TYPE_STRING,
        "length": 66,
        "prefix": "0x"
    }, 
    "chainid": {
        "type": STR_TYPE_NUMBER,
    }, 
    "rpc": {
        "type": STR_TYPE_STRING,
        "prefix": "http"
    }, 
    "gasprice": {
        "type": STR_TYPE_NUMBER,
    }, 
    "explorerprefix": {
        "type": STR_TYPE_STRING,
        "prefix": "http"
    },
    "native": {
        "gaslimit": {
            "type": STR_TYPE_NUMBER,
        } 
    },
    "erc20": {
        "gaslimit": {
            "type": STR_TYPE_NUMBER,
        }, 
        "erc20contractaddress": {
            "type": STR_TYPE_STRING,
            "length": 42,
            "prefix": "0x"
        }, 
    }
}

let distributeType = ""
let testMode = true
let zeroHelper = "0000000000000000000000000000000000000000000000000000000000000000"

let receiversPath = "./receivers.csv"
let csvRltTitle = "Address,Value,Nonce,TxHash\n"
let csvColumnsCount = 3

// wallet parameters
let chainProvider = new ethers.providers.JsonRpcProvider({url: configs.rpc})
let wallet = new ethers.Wallet(configs.privatekey)

// ******************************************************* functions *************************************************************

function curHumanTime(){
    return sd.format(new Date(), 'YYYY_MM_DD_HH_mm_ss')
}

function writeCsv(sendRltStr, filePath){
    try {
        fs.writeFileSync(filePath, sendRltStr)
    } catch (err) {
        console.error(`failed to write file ${filePath}, ${err}`)
    }
}

function loadCsvToJsonObj(filePath){
    let csvStr = ""
    try {
        csvStr = fs.readFileSync(`${filePath}`, 'utf8')
    } catch (err) {
        console.error(`failed to read file ${filePath}, ${err}`)
        return [false, null] 
    }

    let rlt = []
    let lines = csvStr.split("\n")

    for (let index = 1; index < lines.length; index++) {
        let curLine = lines[index]
        let fields = curLine.split(",")

        let fieldsRlt = checkRowFieldNotnulls(fields, csvColumnsCount)
        if(!fieldsRlt[0]){
            return [false, null]
        }

        rlt.push(fieldsRlt[1])
    }
    
    return [true, rlt] 
}

function checkRowFieldNotnulls(fields, fieldCount){
    let rlt = []
    if(fields.length < fieldCount){
        return [false, null]
    }
    for (let index = 0; index < fieldCount; index++) {
        let curField = fields[index]
        if(curField.trim() == ""){
            return [false, null]
        }
        rlt.push(curField.trim())
    }
    return [true, rlt]
}

function wait(ms) {
    return new Promise(resolve => setTimeout(() =>resolve(), ms));
}

function SetTx(rec){
    let Tx = {
        gasPrice: ethers.BigNumber.from(configs.gasprice),
        gasLimit: ethers.BigNumber.from(configs[distributeType].gaslimit),
        chainId: configs.chainid,
        nonce: ethers.BigNumber.from(rec[2]),
    }

    if(distributeType == STR_NATIVE){
        Tx.to = rec[0]
        Tx.value = ethers.utils.parseEther(`${rec[1]}`, "ether")
    }
    else if(distributeType == STR_ERC20){
        Tx.to = configs[STR_ERC20].erc20contractaddress
        Tx.value = ethers.BigNumber.from("0")

        let valStr = ethers.utils.parseUnits(`${rec[1]}`, configs[STR_ERC20].decimals).toHexString().slice(2)
        Tx.data = '0xa9059cbb000000000000000000000000' + rec[0].slice(2) + zeroHelper.slice(0, 64 - valStr.length) + valStr
    }
    return Tx
}

async function distributeCore(rec){
    let tx = SetTx(rec)
    let signedTx = await wallet.signTransaction(tx)

    let txParse = ethers.utils.parseTransaction(signedTx)
    console.log(`parsed signed tx is: \n${JSON.stringify(txParse)}`)
    console.log(`tx_hash: ${configs.explorerprefix}${txParse.hash}`)

    if(testMode){
        return [true, `${configs.explorerprefix}${txParse.hash}`]
    }

    for(let i = 0; i < retryTimes; i++){
        try{
            let receipt = await chainProvider.sendTransaction(signedTx);
            console.log(`receipt is: \n${JSON.stringify(receipt)}`)
            break
        }
        catch(err){
            console.log(`the ${i+1}-th try failed with error: ${err}`)
            await wait(1000)
            if(i == retryTimes - 1){
                return [false, ""]
            }
        }
    }

    return [true, `${configs.explorerprefix}${txParse.hash}`]
}

function parameterChecker(temConfigs, temConfigsFormat){
    for (let key in temConfigsFormat) {
        if(key == STR_ERC20 || key == STR_NATIVE){
            if(!temConfigs.hasOwnProperty(distributeType)){
                console.log(`ERROR, invalid configs.json parameters, key ${distributeType} not exists. \n`)
                return false
            }
            if(!parameterChecker(temConfigs[distributeType], temConfigsFormat[distributeType])){
                return false
            }
        }
        else{
            if(!temConfigs.hasOwnProperty(key)){
                console.log(`ERROR, invalid configs.json parameters, key ${key} not exists. \n`)
                return false
            }
            let keyFormat = temConfigsFormat[key]
            if( (keyFormat.type == STR_TYPE_STRING && typeof(temConfigs[key]) != STR_TYPE_STRING) || 
                (keyFormat.type == STR_TYPE_NUMBER && typeof(temConfigs[key]) != STR_TYPE_NUMBER))
            {
                console.log(`ERROR, invalid configs.json parameters, key ${key} type not valid, should be ${keyFormat.type}. \n`)
                return false
            }
            if(keyFormat.hasOwnProperty("length") && temConfigs[key].length != keyFormat.length){
                console.log(`ERROR, invalid configs.json parameters, length of key ${key} not valid, should be ${keyFormat.length}. \n`)
                return false
            }
            if(keyFormat.hasOwnProperty("prefix") && !temConfigs[key].startsWith(keyFormat.prefix)){
                console.log(`ERROR, invalid configs.json parameters, prefix of key ${key} not valid, should be ${keyFormat.prefix}. \n`)
                return false
            }
        }
    }
    return true
}

// ******************************************************* main *************************************************************

const helpStr = `\n\
Command examples: \n\n\
    distribute NATIVE token: node TokenDistributor.js --${STR_NATIVE} \n\
    distribute NATIVE token: node TokenDistributor.js --${STR_NATIVE} --send \n\
    \n\
    distribute ERC20 token: node TokenDistributor.js --${STR_ERC20} \n\
    distribute ERC20 token: node TokenDistributor.js --${STR_ERC20} --send \n\n\
Default is test mode, which means Tx not send to network. If everything ready, you can add parameter --send, to send Tx to network. \n\
`

let args = process.argv.slice(2)
let argsArr = require('minimist')(args)

// if parameter error
if( (!argsArr[STR_NATIVE] && !argsArr[STR_ERC20]) || 
    (argsArr[STR_NATIVE] && argsArr[STR_ERC20])){
    console.log(`ERROR, invalid command parameters, pls refer to following comand: `)
    console.log(helpStr)
    process.exit()
}

distributeType = argsArr[STR_NATIVE] ? STR_NATIVE : argsArr[STR_ERC20] ? STR_ERC20 : ""
testMode = !argsArr[STR_SEND]
console.log(`distribute ${distributeType} token \n`)

async function main(){
    if(!parameterChecker(configs, configsFormat)){
        return
    }

    let receiversRlt = loadCsvToJsonObj(receiversPath)
    if(!receiversRlt[0]){
        console.error(`fatal error in file ${receiversPath}`)
        return 
    }
    let receivers = receiversRlt[1]

    let sendRltStr = csvRltTitle

    // loop receivers and distribute token
    for (let index = 0; index < receivers.length; index++) {
        let rec = receivers[index]

        console.log(`------------ nonce ${rec[2]} address ${rec[0]} should paid ${rec[1]} ------------`)

        let distributeRlt = await distributeCore(rec)
        if(!distributeRlt[0]){
            console.log("fatal error, process exit.")
            break
        }
        sendRltStr += `${rec[0]},${rec[1]},${rec[2]},${distributeRlt[1]},\n`

        console.log(`------------ nonce ${rec[2]} address ${rec[0]} paid finished ------------`)

        console.log(`sleep ${sleepTime/1000}s`)
        await wait(sleepTime)
    }

    writeCsv(sendRltStr, receiversPath+`_result_${curHumanTime()}.csv`)
}

main().then(()=>{
    console.log(`Run Completed!\n`)
})

// ******************************************************* test *************************************************************


// let rec = ["0x1e58cd7ef5249689bfB37A82EE08345794F005cF", "0.42", 98]
// distributeCore(rec).then(()=>{
//     console.log(`Success!\n`)
// })


// let testConfigs = {
//     "privatekey": "0x1234567890123456789012345678901234567890123456789012345678901234",
//     "chainid": 56,
//     "rpc": "https://bsc-dataseed3.defibit.io",
//     "gasprice": 5000000000,
//     "native": {
//         "gaslimit": 21000
//     },
//     "erc20": {
//         "gaslimit": 73000,
//         "erc20contractaddress": "0x1234567890123456789012345678901234567890"
//     }
// }
// parameterChecker(testConfigs, configsFormat)

