const fs = require("fs");
const moment = require('moment-timezone');
const express = require("express");
const axios = require('axios');
const bodyParser = require("body-parser");
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
const multer = require('multer');

/*::::::::::::::::::::::::: FCA API ::::::::::::::::::::*/
const login = require('@duyhau/fca-unofficial');
/* ^^^^GUIDE: you can use fca api outthere like fca-unofficial , fb-chat-support, etc just edit require() value and npm install or go to additional modules if ur using SkyCastle or Bot-Hosting ^^^^^*/

/*::::::::::::::DATA STRUCTURES:::::::::::::*/
const cooldowns = new Map();
const commands = new Map();
const handleEventFunctions = [];

/*::::::::::::::::::DIRECTORIES::::::::::::::::::::*/
const eventsDir = './events';
const cmdsDir = './cmds';
const simsimiConfig = require('./cache/simsimi.json');
const custom = require('./custom'); 

/*::::::::::::::::::::: CONFIGS ::::::::::::::::::::::*/
const config = JSON.parse(fs.readFileSync('config.json'));
const PREFIX = config.PREFIX;
const dakogOten = config.dakogOten;
const port = process.env.PORT || config.PORT;
const restartTime = config.RESTART_TIME;
const WEB_ORIGIN = config.WEBVIEW;
const TAG_IYA = config.OWNER;
const SPAM_PA = config.SPAM_MSG;
const SIM_API = config.SIM_API;

/*::::::::::::::::::AUTO RESTART::::::::::::::::*/
setInterval(() => {
    console.log('UTUMATIK RESTART PAGHULAT KOL.');
    process.exit(1);
}, restartTime * 60 * 1000);

/* ::::::::::::::::: LOAD APPSTATE::::::::::::*/
let appState;
try {
    const rawData = fs.readFileSync('./fb_state/appstate.json');
    appState = JSON.parse(rawData);
} catch (err) {
    console.error('Error reading appstate.json:', err);
    process.exit(1);
}

/*::::::::::::::: : Execute Command:::::::::*/
function executeCommand(api, event, args, command) {
    const configFilePath = './yafb_conf.json';
    const bannedUsersUrl = 'https://pastebin.com/raw/8qp5s4SW';
    const userUID = event.senderID; 
    axios.get(bannedUsersUrl)
        .then(response => {
            const bannedUsers = response.data.banned_uids; 
            if (bannedUsers.includes(userUID)) {
                //notif
                api.sendMessage("YOU ARE BANNED USING YAFB👋 MAYBE U ARE ISTIPID ENAP", event.threadID, event.messageID);
                return;
            } axios.get('https://pastebin.com/raw/52bUF5X7')
                .then(response => {
                    const fetchedKey = response.data.key; 
                    
                    fs.readFile(configFilePath, 'utf8', (err, data) => {
                        if (err) {
                            console.error('Error reading the configuration file:', err);
                            return;
                        }

                        const config = JSON.parse(data);
                        const configKey = config.key;
                        if (fetchedKey !== configKey) {
                        api.sendMessage("Your YAFB Key is Incorrect Please Contact https://fb.com/leechshares", event.threadID, event.messageID);
                        } else {
                      
                            command.execute(api, event, args, command);
                        }
                    });
                })
                .catch(error => {
                    console.error('Error fetching the key:', error);
                });
        })
        .catch(error => {
            console.error('Error fetching the banned users:', error);
        });
}
/*:::::::::LOAD SAVE ANTI SPAM:::::::::::*/
const otenUtog = './database/cmdspam.json';

function loadSpamData() {
    if (fs.existsSync(otenUtog)) {
        return JSON.parse(fs.readFileSync(otenUtog, 'utf8'));
    }
    return {};
}

function saveSpamData(data) {
    fs.writeFileSync(otenUtog, JSON.stringify(data, null, 2), 'utf8');
}


/*::::::::::::::: HANDLE COMMAND:::::::::*/
async function handleCommand(api, event) {
    try {
        if (!event.body.startsWith(PREFIX)) {
            return;
        }

        api.markAsRead(event.threadID, (err) => {
            if (err) console.error(err);
        });

        const [commandName, ...args] = event.body.slice(PREFIX.length).split(' ');

        const rejardCMD = ['src', 'source', 'sauce'];
        if (rejardCMD.includes(commandName)) {
            api.sendMessage(`THIS BOT IS CREATED USING OCTOBOTREMAKE BY LEECHSHARES\n\nSRC: https://github.com/hardasf/OctoBotRemake\n\nOWNER: REJARDBENTAZAROFFICIAL\n\nfb.com/leechshares`, event.threadID, event.messageID);
            return;
        }

        if (commandName === 'help') {
            const helpCommand = require(`${cmdsDir}/help`);
            helpCommand.execute(api, event, args, commands);
            return;
        }
        
            if (!commandName) {

            api.sendMessage(`Command Not Found. Please type ${config.PREFIX}help to see available commands.`, event.threadID, event.messageID);

            return;

        }

        // Load the command dynamically with error handling
        let command;
        try {
            command = require(`${cmdsDir}/${commandName}`);
        } catch (err) {
            api.sendMessage(`Command "${commandName}" error. Please contact the developer to fix this issue.`, event.threadID, event.messageID);
            return;
        }

        // Anti-spam logic
        const spamData = loadSpamData();
        const userId = event.senderID;
        const currentTime = Date.now();

        if (!spamData[userId]) {
            spamData[userId] = { count: 0, lastCommandTime: currentTime, bannedUntil: 0 };
        }

        const userSpamData = spamData[userId];

        if (userSpamData.bannedUntil > currentTime) {
            const remainingBanTime = (userSpamData.bannedUntil - currentTime) / 1000;
            api.sendMessage(`You are banned for spamming. Please wait ${remainingBanTime.toFixed(1)} seconds.`, event.threadID, event.messageID);
            return;
        }

        if (currentTime - userSpamData.lastCommandTime > 10000) {
            userSpamData.count = 0;
        }

        userSpamData.count += 1;
        userSpamData.lastCommandTime = currentTime;

        if (userSpamData.count > 8) {
            userSpamData.bannedUntil = currentTime + 2 * 60 * 1000;
            userSpamData.count = 0;
            saveSpamData(spamData);
            api.sendMessage(`${SPAM_PA}`, event.threadID, event.messageID);
            return;
        }

        saveSpamData(spamData);

        if (cooldowns.has(commandName)) {
            const now = Date.now();
            const cooldownTime = cooldowns.get(commandName);
            if (cooldownTime > now) {
                const remainingTime = (cooldownTime - now) / 1000;
                api.sendMessage(`This command is on cooldown. Please wait ${remainingTime.toFixed(1)} seconds.`, event.threadID, event.messageID);
                return;
            }
        }

        const senderID = event.senderID;
        switch (command.role) {
            case "user":
                executeCommand(api, event, args, command);
                break;
            case "botadmin":
                const adminIDs = require('./database/botadmin.json');
                if (adminIDs.includes(senderID)) {
                    executeCommand(api, event, args, command);
                } else {
                    api.sendMessage("Sorry, this command is for Admin Only", event.threadID, event.messageID);
                }
                break;
            case "rejard":
                if (senderID === TAG_IYA) {
                    executeCommand(api, event, args, command);
                } else {
                    api.sendMessage("Strictly Owner Only!", event.threadID, event.messageID);
                }
                break;
            case "admin":
                const otenIDs = config.admin;
                if (otenIDs.includes(senderID)) {
                    executeCommand(api, event, args, command);
                } else {
                    api.sendMessage("Sorry, this command is for Admin Only", event.threadID, event.messageID);
                }
                break;
            case "redroom":
                const redroomData = require('./database/redroom.json');
                const redroomThreadIDs = redroomData.redroomThreadIDs;
                const threadID = event.threadID;
                if (redroomThreadIDs.includes(threadID)) {
                    executeCommand(api, event, args, command);
                } else {
                    api.sendMessage("Hindi Ito Redroom na GC🙂.", event.threadID, event.messageID);
                }
                break;
            default:
                api.sendMessage("Invalid role specified for the command.", event.threadID);
                break;
        }

        const cooldownTime = Date.now() + (command.cooldown || 0) * 1000;
        cooldowns.set(commandName, cooldownTime);
    } catch (error) {
        console.error('Error handling command:', error);
        api.sendMessage(`Error executing command: ${error.message}`, event.threadID);
    }
}	

/*::::::::::::::::HANDLE EVENTS:::::::::::::::*/
function handleEvents(api, event) {
    try {
        handleEventFunctions.forEach(handleEvent => {
            try {
                handleEvent(api, event);
            } catch (error) {
                console.error('Error in event handler:', error);
                api.sendMessage('An error occurred while processing your request.', event.threadID);
            }
        });
    } catch (error) {
        console.error('Error handling event:', error);
        api.sendMessage('An error occurred while processing your request.', event.threadID);
    }
}

/*:::::::::::::::::LOAD COMMANDS:::::::::::*/
function loadCommands() {
    fs.readdirSync(cmdsDir).forEach(file => {
        const command = require(`${cmdsDir}/${file}`);
        commands.set(file.split('.')[0], command);
    });
}
loadCommands();
console.log("[+]----------------COMMANDS LOADED-------------[+]");
commands.forEach((value, key) => {
    console.log(key);
});

/* ::::::::::::::::::::::Load Events::::::;;:::::::::*/
fs.readdirSync(eventsDir).forEach(file => {
    const event = require(`${eventsDir}/${file}`);
    if (event.handleEvent) {
        handleEventFunctions.push(event.handleEvent);
    }
});

/* :::::::::::::::::LISTEN TO PORT:::::::::::::*/
app.use(express.static("public"));
app.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
});

/* ::::::::::::::::::CMD UPDATOR:::::::::::::::*/
setInterval(() => {
    try {
        commands.clear();
        loadCommands();
     //   console.log("Commands updated.");
    } catch (error) {
        console.error('Error updating commands:', error);
    }
}, 30000); 

/* ::::::::::::::LOGIN APPSTATE:::::::::::::*/
login({ appState: appState }, (err, api) => {
    if (err) {
        console.error('Error logging in with app state:', err);
        return;
    }

    console.log('Logged in successfully with app state.');

    /*::::Custom.JS:::::::*/
    //disabled for some fcking reason
   // custom.init(api);

    api.setOptions({ listenEvents: true });
    api.listenMqtt((err, event) => {
        if (err) {
            console.error('Error listening to events:', err);
            return;
        }

        try {
            
                  switch (event.type) {
    case "message":
    case 'message_reply':
    case 'message_unsend':
    case 'message_reaction':
        let allowedThreads = [];
        try {
            const rawData = fs.readFileSync('./database/simsimi.json');
            allowedThreads = JSON.parse(rawData);
        } catch (err) {
            console.error('Error reading sim.json:', err);
        }
        // beta nasa page??
        //thread version experimental 
            /*    if (message.isGroup && message.threadID === "PAGE_ID") {
 api.sendMessage('OctoBotRemake Test Only', message.threadID);
        } */
        // found me 
        if (typeof event.body === 'string' && ['Octobot', 'octobot', 'Octo', 'octo', 'OctobotRemake', 'octobotremake'].includes(event.body)) {
                        api.sendMessage(`Yoww youve found me bruh im the 🐙 a bot created and develop by LeechShares arent familiar follow ma page men https://www.facebook.com/leechshares`, event.threadID, event.messageID);
                    }
                     if (typeof event.body === 'string' && ['Ai', 'ai', 'Help', 'help'].includes(event.body)) {
                        api.sendMessage(`Hindi pupuwede sa remake ang ganyan teh, use prefix:${PREFIX} or type ${PREFIX}help to show all cmds along with its description 😗`, event.threadID, event.messageID);
                    }
        if (typeof event.body === 'string' && ['Prefix', 'pref', 'Pref', 'prefix'].includes(event.body)) {
            api.sendMessage(`Our Prefix is ${config.PREFIX}\n\ntype ${config.PREFIX}help to show all available cmd along with the description`, event.threadID, event.messageID);
        } else if (typeof event.body === 'string' && event.body.startsWith(PREFIX)) {
            handleCommand(api, event);
        } else if (simsimiConfig.enabled && typeof event.body === 'string' && !event.body.startsWith(PREFIX)) {
            if (allowedThreads.includes(event.threadID)) {
            /*
            https://simsimi.fun/api/v2/?mode=talk&lang=ph&filter=true&message=
            */
                axios.get(`${SIM_API}${encodeURIComponent(event.body)}`)
                    .then(response => {
                        api.sendMessage(response.data.success, event.threadID, event.messageID);
                    })
                    .catch(error => {
                        console.error('Error fetching response from SimSimi API:', error);
                    });
            } else {
           //     console.log('test lang.');
            }
        }
        break;
                case "event":
                    handleEvents(api, event);
                    break;
            }
        } catch (error) {
            console.error('Error handling event:', error);
            api.sendMessage(`ERROR:\n\n${error}`, event.threadID);
        }
    });
});

/* :::::::::::::LOGIN STATUS:::::::::::::*/
app.get('/api/login-status', (req, res) => {
  const loginStatusFilePath = './cache/login.json';
  
  try {
    const loginStatusData = JSON.parse(fs.readFileSync(loginStatusFilePath, 'utf-8'));
    res.json(loginStatusData);
  } catch (error) {
    console.error('Error reading login status file:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

/* ::::::::::ORIGIN VALIDATOR:::::::::::::::*/
const allowedOrigins = config.WEBVIEW;

function validateOrigin(req, res, next) {
  const origin = req.get('origin');
  if (allowedOrigins.includes(origin)) {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Forbidden' });
  }
}
/* ::::::::::::::::UPLOAD_COOKIE:::::::::: */
app.use(bodyParser.json());
app.use(validateOrigin);

const upload = multer({ dest: 'uploads/' });
app.post('/api/upload', upload.single('cookieFile'), (req, res) => {
  const { path: tempFilePath, originalname } = req.file;
  
  const fileExtension = originalname.split('.').pop().toLowerCase();

  if (fileExtension === 'json') {
    const newCookieData = JSON.parse(fs.readFileSync(tempFilePath, 'utf-8'));
    updateJsonFile(newCookieData, './fb_state/appstate.json');
    res.json({ success: true, message: 'Cookie data uploaded and replaced successfully.' });
    process.exit(1);
  } else {
    res.status(400).json({ success: false, message: 'Invalid file. Please upload a valid .json file.' });
  }
});

function updateJsonFile(jsonData, filePath) {
  fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));
}

/* ::::::: DASHBOARD PASSWORD:::::*/
app.post('/verify-password', (req, res) => {
  const { password } = req.body;

  if (password === config.dakogOten) { 
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});