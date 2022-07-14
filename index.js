const admin = require('firebase-admin');
const dataConvert = require('./dataConverts');
const {
    google
} = require('googleapis');
const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');
const hexToBinary = require('hex-to-binary');
const app = express();
const request = require("request");
const qs = require('qs');
const fetch = require('node-fetch');

app.use(bodyParser.json())
app.use(
    bodyParser.urlencoded({
        extended: true
    }),
);
app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);
    next();
});

const MESSAGING_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'
const SCOPES = [MESSAGING_SCOPE]

const serviceAccount = require('./dixell-iot-firebase-adminsdk-nfpki-4b5e36771d.json');
const {
    response
} = require('express')
const e = require('express')
const {
    default: bitwise,
    nibble
} = require('bitwise')
const databaseURLs = "https://dixell-live.firebaseio.com/";
const databaseStatus = "https://dixell-status.firebaseio.com/";
const databaseURL3 = "https://dixell-alarm.firebaseio.com/";
const URL = 'https://fcm.googleapis.com/v1/projects/dixell-iot/messages:send';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: databaseURLs
});
const app4 = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: databaseURL3
}, 'app4');
const appStatus = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: databaseStatus
}, 'appStatus')
/****************************************************************************** */
//Firestore on firebase
const db = admin.firestore();
//Database on firebase
const dbs = admin.database();
const dbr = admin.database(app4);
const dbStatus = admin.database(appStatus);
/*****************************************************************/
let objTicks = {};
let events = {};
let alm = {};
let deviceName = {};
/* Received firebase database */
/* ------------------------------------------------------------------------- */

//Library
async function nodeHttp(id) {
    try {
        return await axios.post('https://dixell.snapx.cloud/api/deviceByIDSQL', {
            id: id,
            owner: 'dixelladmin'
        }).then(response => response.data.lib ? JSON.parse(response.data.lib) : {})
    } catch (err) {
        console.log(err);
    }
}
//DeviceLists
async function deviceList() {
    return axios.post('https://dixell.snapx.cloud/api/deviceListString', {
        user: 'dixelladmin'
    }).then(response => response.data.list)
}
async function devicesName() {
    return await axios.get('http://34.126.84.222:1880/api/v1/devicesName').then((response) => {
        deviceName = response.data;
    })
}
devicesName()
setInterval(() => {
    devicesName()
}, 3600000);
//Status send to Notifications 
function statusSend() {
    let stSend = {};
    let ref = dbStatus.ref('/')
    ref.on('child_changed', function (snapshot) {

        let ts = true;

        if (objTicks[snapshot.ref_.path.pieces_[0]]) {
            ts = objTicks[snapshot.ref_.path.pieces_[0]] !== snapshot.val().st.ts.ticks && events[snapshot.ref_.path.pieces_[0]] !== snapshot.val().st.msgType;
        }
        objTicks[snapshot.ref_.path.pieces_[0]] = snapshot.val().st.ts.ticks;
        events[snapshot.ref_.path.pieces_[0]] = snapshot.val().st.msgType;
        // if (snapshot.val().st.msgType.includes("CONNECT_EVENT"))

        if (ts) {
            if (snapshot.val().st.msgType === "CONNECT_EVENT") {
                stSend = {
                    id: snapshot.ref_.path.pieces_[0],
                    deviceName: snapshot.val().st.deviceName,
                    accuracy: snapshot.val().geo.accuracy,
                    address: snapshot.val().geo.address,
                    status: "✅ Connected",
                    lastActivityTime: snapshot.val().st.lastActivityTime,
                    lastTime: snapshot.val().st.lastConnectTime
                }
                LineNotifiationsStatus(stSend);
            } else if (snapshot.val().st.msgType === "DISCONNECT_EVENT") {
                stSend = {
                    id: snapshot.ref_.path.pieces_[0],
                    deviceName: snapshot.val().st.deviceName,
                    accuracy: snapshot.val().geo.accuracy,
                    address: snapshot.val().geo.address,
                    status: "❌ Disconnected !!",
                    lastActivityTime: snapshot.val().st.lastActivityTime,
                    lastTime: snapshot.val().st.lastDisconnectTime
                }
                LineNotifiationsStatus(stSend);
            }
        }
    });
}
statusSend();

let timestamps = "";
let alparse = [];
let time;
//Alarm send to Notifications
async function alarmSend() {
    alm = {};
    let obj = {};
    let fbSend = {};
    let list = await deviceList();
    for (let key of Object.values(list)) {
        //set deviceID Alarm
        alm = {
            id: key
        }
        //Read a Library
        await nodeHttp(key).then((lib) => {
            dbs.ref(key + '/d/al').on('child_changed', async (snapshot) => {
                let dataAl = {
                    al: {
                        [snapshot.ref_.path.pieces_[3]]: snapshot.val()
                    }
                }
                await dbs.ref(snapshot.ref_.path.pieces_[0] + '/d/ts').once('value', (snapshot) => {
                    timestamps = snapshot.val().ticks;
                });
                if (Object.keys(lib).length > 0) {
                    let resAlarm = dataConvert({ data: dataAl, lib: lib }).Alarms;
                    for (let [k, v] of Object.entries(resAlarm)) {
                        if (typeof v == "boolean") {
                            if (v) {
                                obj = {
                                    id: snapshot.ref_.path.pieces_[0],
                                    name: k,
                                    prop: {
                                        ack: false,
                                        ackTimestamp: "",
                                        seen: "",
                                        seenTimestamp: "",
                                        ackUser: ""
                                    },
                                    state: "  🆘 ACTIVE",
                                    timestamp: timestamps,
                                }
                                //Send To Firebase Database Alarm
                                fbSend = {
                                    id: snapshot.ref_.path.pieces_[0],
                                    name: k,
                                    prop: {
                                        ack: false,
                                        ackTimestamp: "",
                                        seen: "",
                                        seenTimestamp: "",
                                        ackUser: ""
                                    },
                                    state: true,
                                    timestamp: timestamps,
                                }
                                if (Object.keys(obj).length > 0) {
                                    SendToFirebase(fbSend);
                                    setDelay(obj)
                                    getTokenFromFirebase(obj.id, obj.name + "   ACTIVE");
                                }
                                alm[k] = v
                            } else {
                                if (alm[k]) {
                                    obj = {
                                        id: snapshot.ref_.path.pieces_[0],
                                        name: k,
                                        prop: {
                                            ack: false,
                                            ackTimestamp: "",
                                            seen: "",
                                            seenTimestamp: "",
                                            ackUser: ""
                                        },
                                        state: "  ✅ INACTIVE",
                                        timestamp: timestamps,
                                    }
                                    //Send To Firebase Database Alarm
                                    fbSend = {
                                        id: snapshot.ref_.path.pieces_[0],
                                        name: k,
                                        prop: {
                                            ack: false,
                                            ackTimestamp: "",
                                            seen: "",
                                            seenTimestamp: "",
                                            ackUser: ""
                                        },
                                        state: false,
                                        timestamp: timestamps,
                                    }
                                    if (Object.keys(obj).length > 0) {
                                        SendToFirebase(fbSend);
                                        setDelay(obj);
                                        getTokenFromFirebase(obj.id, obj.name + "   INACTIVE");
                                    }
                                    delete alm[k]
                                }
                            }
                        }
                    }
                }
            });
        });
    }
}
alarmSend();

//Set Delay
function setDelay(data) {
    let limit = 3;
    alparse.push(data);
    if (alparse.length === 1) {
        time = setTimeout(() => {
            LineNotifications(alparse);
            // console.log(alparse)
            alparse = [];
        }, 10000);
    }
    if (alparse.length === limit) {
        LineNotifications(alparse);
        // console.log(alparse)
        clearTimeout(time);
        console.log(`Clear Successfully`);
        alparse = [];
    }
}

/* ----------------------------------------- */
async function SendToFirebase(fbSend) {
    let alarmAdd = await dbr.ref('/' + fbSend.id);
    alarmAdd.once('value', (snapshot) => {
        let v = Object.entries(snapshot.val());
        let len = v.length - 1;
        let val = Object.entries(snapshot.val())[len][1];
        try {
            if (fbSend) {
                alarmAdd.push(fbSend);
                // console.log(fbSend)
            }
        } catch (err) {
            console.log('Cannot convert undefined or null to object', err);
        }

    });
}

async function LineNotifications(data) {
    for (let i of data) {
        db.collection('linenotifyToken').where('device.' + i.id, "==", true).get().then((querySnapshot) => {
            querySnapshot.forEach((doc) => {
                if (doc.data().device[i.id] == true) {

                    let data = qs.stringify({
                        'message': "\n" + "From : " + deviceName[i.id] + "\n" + i.name + " : " + i.state
                    });
                    let config = {
                        method: 'post',
                        url: 'https://notify-api.line.me/api/notify',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Authorization': 'Bearer ' + doc.data().Token,
                            'Access-Control-Allow-Origin': '*'
                        },
                        data: data
                    };
                    axios(config)
                        .then(function (response) {
                            console.log(JSON.stringify(response.data));
                        })
                        .catch(function (error) {
                            console.log(error);
                        });
                }
            });
        });
    }
}

async function LineNotifiationsStatus(stSend) {
    await db.collection('linenotifyToken').where('device.' + stSend.id, "==", true).get().then((querySnapshot) => {
        querySnapshot.forEach((doc) => {
            if (doc.data().device[stSend.id] == true) {
                // let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                let date = new Date(stSend.lastTime);
                let datetime = date.toLocaleString('en-US', { timeZone: "Asia/Bangkok" });

                let data = qs.stringify({
                    'message': "\n" + "Device : " + stSend.status + "\n" +
                        "ID : " + stSend.deviceName + "\n" +
                        "NAME : " + deviceName[stSend.id] + "\n" +
                        "Accuracy :  " + stSend.accuracy + "  m." + "\n" +
                        "Address : " + stSend.address + "\n" +
                        "LastTime :  " + datetime
                });
                let config = {
                    method: 'post',
                    url: 'https://notify-api.line.me/api/notify',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': 'Bearer ' + doc.data().Token,
                        'Access-Control-Allow-Origin': '*'
                    },
                    data: data
                };
                axios(config)
                    .then(function (response) {
                        console.log(JSON.stringify(response.data));
                    })
                    .catch(function (error) {
                        console.log(error);
                    });
            }
        });
    });
}
// getTokenFromFirebase('8cb0fd20-9068-11eb-931a-7516415b8f59', 'test');
async function getTokenFromFirebase(key, k) {
    deviceToken = [];
    let alarms = {};

    let dataSnapshot = await db.collection('FCMToken')
        .where('key', '==', key)
        .get();

    dataSnapshot.forEach(doc => {
        alarms = {
            title: 'SnapX',
            image: 'https://sv1.picz.in.th/images/2021/03/04/omjgYQ.png',
            body: k,
        }
        init(
            doc.data().token,
            alarms,
        );
    });
}

function getAccessToken() {
    return new Promise(function (resolve, reject) {
        var key = serviceAccount
        var jwtClient = new google.auth.JWT(
            key.client_email,
            null,
            key.private_key,
            SCOPES,
            null
        )
        jwtClient.authorize(function (err, tokens) {
            if (err) {
                reject(err)
                return
            }
            resolve(tokens.access_token)
        })
    })
}
async function init(deviceToken, alarms) {
    const body = {
        message: {
            data: {
                key: 'value'
            },
            notification: alarms,
            webpush: {
                headers: {
                    Urgency: 'high'
                },
                notification: {
                    requireInteraction: 'true'
                }
            },
            token: deviceToken
        }
    }
    try {
        const accessToken = await getAccessToken();
        const {
            data
        } = await axios.post(URL, JSON.stringify(body), {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        })
        console.log('name: ', data.name)
    } catch (err) {
        console.log('err: ', err.message)
    }
}

app.get('/sendNoti', (req, res,) => {
    init(deviceToken.toString());
    res.json({
        status: true,
    })
})

const port = 9600;

app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`)
})
