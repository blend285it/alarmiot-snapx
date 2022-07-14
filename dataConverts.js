const dataConverter = (config) => {

    let input = config.data || {},
        lib = config.lib || {},
        id = config.displayName ? config.displayName.toString() : "Unknown",
        showConsole = config.showLog === true ? config.showLog : false,
        timeCounter = config.countTime === true ? config.countTime : false;

    // console.log(input);
    // console.log(lib);

    let keyType = {
        di: {
            recType: 1,
            type: 'digital',
            des: "Digital Inputs"
        },
        os: {
            recType: 2,
            type: 'digital',
            des: "Output Status"
        },
        ds: {
            recType: 3,
            type: 'digital',
            des: "Device Status"
        },
        al: {
            recType: 4,
            type: 'digital',
            des: "Alarms"
        },
        ai: {
            recType: 10,
            type: 'analog',
            des: "Analog Inputs"
        },
        ao: {
            recType: 11,
            type: 'analog',
            des: "Analog outputs"
        },
        sp: {
            recType: 12,
            type: 'analog',
            des: "Set Point"
        },
        cm: {
            recType: 20,
            type: 'digital',
            des: "Commands"
        }
    };

    let fnCodeOperation = {
        "01": {
            multiply: 1,
            byte: false,
            word: true,
            dword: true,
        },
        "02": {
            multiply: 1,
            byte: false,
            word: true,
            dword: true,
        },
        "03": {
            multiply: 16,
            byte: false,
            word: false,
            dword: false,
        },
        "04": {
            multiply: 16,
            byte: false,
            word: false,
            dword: false,
        },
        "05": {
            multiply: 1,
            byte: false,
            word: true,
            dword: true,
        },
        "06": {
            multiply: 1,
            byte: false,
            word: true,
            dword: true,
        },
        "15": {
            multiply: 16,
            byte: false,
            word: false,
            dword: false,
        },
        "16": {
            multiply: 16,
            byte: false,
            word: false,
            dword: false,
        }
    }

    let output = {};

    // initial check
    try {

        if (timeCounter) console.time('DataConverter [ Time usage ] ');

        if (Object.keys(input).length === 0) throw "Input data not found";
        if (Object.keys(lib).length === 0) throw "Library not found";

        if (showConsole) console.groupCollapsed("DataConverter : Device [ " + id + " ] data output.");

        // get prototype infomation from library
        for (const [libKey, libData] of Object.entries(lib)) {

            // return library information
            if (!keyType[libKey]) {

                output[libKey] = libData;

                if (typeof libData !== "string") if (showConsole) console.warn("DataConverter :", "Device [ " + id + " ] category \"" + libKey + "\" does not matches to standard recType. Output data will return its own.");

            } else {

                // ckeck key type description
                if (keyType[libKey]) {

                    output[keyType[libKey].des] = {};

                } else {

                    output[libKey] = {};

                }

                // checking categpry form input
                if (input[libKey]) {
                    let dataType;

                    // checking category form input
                    if (keyType[libKey]) {

                        dataType = keyType[libKey].type;

                    } else {

                        if (showConsole) console.error("DataConverter :", "Device [ " + id + " ] category \"" + libKey + "\" does not matches to the standard type of data. Contact to the author to fixed it.");

                    }

                    if (showConsole) console.groupCollapsed("[" + libKey + "]", keyType[libKey].des || keyType[libKey])

                    // get address and value 
                    for (let [inputAdr, inputValue] of Object.entries(input[libKey])) {
                        // let inputDeviceNumber = inputAdr.split('_')[1];
                        inputAdr = inputAdr.split('_')[0];
                        inputValue = inputValue.v;

                        // loop for ckecking information
                        for (const [adr, info] of Object.entries(libData)) {

                            // calculate data by type
                            if (dataType === "analog") {

                                let name, gain, dec, offset, unit, result;
                                name = info.name;
                                gain = info.gain;
                                dec = info.dec;
                                offset = info.offset;
                                unit = info.unit.replace('ยฐ', "°");

                                // checking for existing data
                                if (adr === inputAdr) {

                                    if (showConsole) {
                                        console.groupCollapsed(name)
                                        console.log("Val ", inputValue)
                                    }

                                    // calculate negative value
                                    if (inputValue > 32767) {
                                        inputValue = inputValue - 65536;
                                    }

                                    // calculate data
                                    result = ((inputValue * gain) + offset).toFixed(dec) + " " + unit;

                                    output[keyType[libKey].des][name] = result;

                                    if (showConsole) {
                                        console.log("Cal ", inputValue)
                                        console.log("Gain", gain)
                                        console.log("Dec ", dec)
                                        console.log("Offs", offset)
                                        console.log("Unit", unit)
                                        console.log("Res ", result)
                                        console.groupEnd()
                                    }

                                } else if (!output[keyType[libKey].des][name]) {

                                    // if no data fron input
                                    output[keyType[libKey].des][name] = "No data"

                                }

                            } else if (dataType === "digital") {

                                let name, libCmdr, libMask, libVal, fnCode, bitLength, inputCmdr, calValue, result;
                                let inputBin;

                                inputCmdr = inputAdr;
                                libCmdr = libData[adr].cmdr;
                                name = libData[adr].name;
                                libMask = parseInt(libData[adr].mask, 16).toString(2)
                                libVal = parseInt(libData[adr].val, 16).toString(2)

                                // check if cmdr form match cmdr in library
                                if (libCmdr === inputCmdr) {

                                    fnCode = libCmdr.substring(0, 2);
                                    // 01 Read Coils
                                    // 02 Read Discrete Input
                                    // 03 Read Holding Registers
                                    // 04 Read Input Registers
                                    // 05 Write Single Coil
                                    // 06 Write Single Register
                                    // 15 Write Multiple Coils
                                    // 16 Write Multiple Registers

                                    bitLength = parseInt(libCmdr.substring(libCmdr.length - 4, libCmdr.length), 16) * fnCodeOperation[fnCode].multiply;

                                    // case 8 bit masking
                                    if (bitLength <= 8) {

                                        // if (bitLength < 8) console.warn("DataConverter :", "Device [ " + id + " ]" + " category \"" + libKey + " : " + name + "\" have a cmdr bitlength operation of " + bitLength + " bit. This will be in process of 16 bit operation.");

                                        if (fnCodeOperation[fnCode].byte) {

                                            calValue = inputValue.toString(2).padStart(8, '0').match(/.{1,4}/g);

                                            calValue = calValue.reverse().toString().replace(/,/g, "");

                                            inputBin = inputValue.toString(2).padStart(8, '0')

                                        } else {

                                            calValue = inputValue.toString(2).substring(inputValue.length - 8, inputValue.length).padStart(8, "0");

                                            inputBin = calValue

                                        }

                                        libMask = libMask.padStart(8, '0')
                                        libVal = libVal.padStart(8, '0')

                                    } else if (bitLength <= 16) {

                                        // if (bitLength < 16) console.warn("DataConverter :", "Device [ " + id + " ]" + " category \"" + libKey + " : " + name + "\" have a cmdr bitlength operation of " + bitLength + " bit. This will be in process of 16 bit operation.");

                                        if (fnCodeOperation[fnCode].word) {

                                            calValue = inputValue.toString(2).padStart(16, '0').match(/.{1,8}/g);

                                            calValue = calValue.reverse().toString().replace(/,/g, "");

                                            inputBin = inputValue.toString(2).padStart(16, '0')

                                        } else {

                                            calValue = inputValue.toString(2).substring(inputValue.length - 16, inputValue.length).padStart(16, "0");

                                            inputBin = calValue

                                        }

                                        libMask = libMask.padStart(16, '0')
                                        libVal = libVal.padStart(16, '0')

                                    } else if (bitLength <= 32) {

                                        // if (bitLength < 32) console.warn("DataConverter :", "Device [ " + id + " ]" + " category \"" + libKey + " : " + name + "\" have a cmdr bitlength operation of " + bitLength + " bit. This will be in process of 16 bit operation.");

                                        if (fnCodeOperation[fnCode].dword) {

                                            calValue = inputValue.toString(2).padStart(32, '0').match(/.{1,8}/g);

                                            calValue = calValue[1] + calValue[0] + calValue[3] + calValue[2]

                                            inputBin = inputValue.toString(2).padStart(32, '0')

                                        } else {

                                            calValue = inputValue.toString(2).substring(inputValue.length - 32, inputValue.length).padStart(32, "0");

                                            inputBin = calValue

                                        }

                                        libMask = libMask.padStart(32, '0')
                                        libVal = libVal.padStart(32, '0')

                                    } else {

                                        output[keyType[libKey].des][name] = "Bit operation over limit"

                                        console.error("DataConverter :", "Device [ " + id + " ] category \"" + libKey + "\" have a cmdr bitlength operation over limit [ " + bitLength + " ]");

                                    }

                                    // mask input value and bit masker from library
                                    result = (parseInt(calValue, 2) & parseInt(libMask, 2)).toString(2).padStart(libVal.length, "0");

                                    output[keyType[libKey].des][name] = result === libVal

                                    if (showConsole) {
                                        console.groupCollapsed(name)
                                        console.log("InputVal ", inputValue)
                                        console.log("FuncCode ", fnCode)
                                        console.log("BitLength", bitLength)
                                        console.log("InpBinRaw", inputBin)
                                        console.log("InpBinOpr", calValue)
                                        console.log("LibrMask ", libMask)
                                        console.log("Inp & Msk", result)
                                        console.log("LibrValue", libVal)
                                        console.log("OuputRes ", result === libVal)
                                        console.groupEnd()
                                    }

                                } else {

                                    // if cmdr not matches.
                                    if (output[keyType[libKey].des][name] === undefined) {
                                        output[keyType[libKey].des][name] = "No data"
                                    }

                                }

                            } else {

                                // if the data from input is not a standard type of controller
                                output[libKey] = "This category is not matches to the standard type of data. Contact to the author to fixed it."
                                console.warn("DataConverter :", "Device [ " + id + " ] category \"" + libKey + "\" does not matches to standard recType. Category name will display its own.");


                            }
                        }
                    }

                    if (showConsole) console.groupEnd();

                } else {

                    if (keyType[libKey]) {

                        output[keyType[libKey].des] = "No data";

                    } else {

                        output[libKey] = "No data";

                    }

                    if (showConsole) console.warn("DataConverter :", "Device [ " + id + " ] category \"" + libKey + "\" has no data found.");

                }
            }
        }

        if (showConsole) console.groupEnd();

    } catch (err) {

        if (showConsole) console.error("DataConverter : Device [ " + id + " ]", err + "!!");

    } finally {

        if (showConsole) {

            console.groupCollapsed("DataConverter : Device [ " + id + " ] have somethings missing in library.");

            //looking for over input data to report error
            for (const key of Object.keys(input)) {

                if (!lib[key]) console.error("input \"" + key + "\" was not found in library");

            }
        }

        if (showConsole) console.groupEnd();

        if (timeCounter) console.timeEnd('DataConverter [ Time usage ] ');

        return (output);
    }

}

module.exports = (dataConverter)