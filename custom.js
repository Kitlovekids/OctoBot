const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = JSON.parse(fs.readFileSync('config.json'));
const dbPath = path.join(__dirname, 'database', 'customsg.json');

function getPhilippineTime() {
    const now = new Date();
    const phTime = now.toLocaleString("en-US", { timeZone: "Asia/Manila" });
    return new Date(phTime);
}

// Load or create the database
function loadDatabase() {
    if (!fs.existsSync(dbPath)) {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        const initialData = { lastSent: null };
        fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
    }
    return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
}

let db = loadDatabase();

function saveDatabase() {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function sendHourlyMessage(api, message) {
    setInterval(() => {
        const now = getPhilippineTime();
        const lastSent = db.lastSent ? new Date(db.lastSent) : null;
        const eightHoursInMilliseconds = config.ADS_TIMER * 60 * 60 * 1000;

        if (!lastSent || now - lastSent >= eightHoursInMilliseconds) {
            api.getThreadList(100, null, ["INBOX"], (err, list) => {
                if (err) {
                    console.error('Error fetching thread list:', err);
                    return;
                }
                list.forEach(thread => {
                    api.sendMessage(message, thread.threadID, (err) => {
                        if (err) {
                            console.error(`Error sending message to thread ${thread.threadID}:`, err);
                        } else {
                            console.log(`Message sent to thread ${thread.threadID}`);
                        }
                    });
                });

                // Update the lastSent time in the database
                db.lastSent = now.toISOString();
                saveDatabase();
            });
        } else {
            //console.log('Not yet 8 hours since last message');
        }
    }, 17 * 60 * 1000); // Check every hour
}

function init(api) {
    const message = config.ADS;

    /* using fs 
    const message  = {
        body: `WELCOME TO YETANOTHERFBBOT`,
        attachment: fs.createReadStream('cache/logo1.png')
      };
    */
    
    sendHourlyMessage(api, message);
}

module.exports = {
    init
};