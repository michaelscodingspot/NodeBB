'use strict';
//const axios = require('axios');

// Define the Druid SQL endpoint
const DRUID_SQL_ENDPOINT = 'http://localhost:8888/druid/v2/sql/task';


const logQueue = [];
let initialized = false;

const LOG_INTERVAL = 12000;
function logBatch() {
        if (logQueue.length === 0) {
            setTimeout(() => {
                logBatch();
            }, LOG_INTERVAL * 4);
            return;
        }

        const values = logQueue.map((log) => {
            return `(TIMESTAMP '${log.date}', '${log.logId}', '${log.level}', '${log.message}', '${log.sessionId}', '${log.correlationId}')`
        }).join(', ');
        const sqlQuery =
`INSERT INTO my_express1
SELECT * FROM (
    VALUES
    ${values}
) AS t (__time, LogId, Level, Message, SessionId, CorrelationId)
    PARTITIONED BY DAY`;

        logQueue.length = 0;
        console.log('sqlQuery=', sqlQuery);

		fetch(DRUID_SQL_ENDPOINT, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({"query": sqlQuery})
		})
		.then((response) => {
			console.log('Insert success:', response);
		}).catch((error) => {
			console.error('Error inserting data:', error.response ? error.response.data : error.message);
		}).finally(() => {
			console.log('Finished request');
			setTimeout(() => {
				logBatch();
			}, LOG_INTERVAL);
		});
}

function log(logId, level, message) {
	console.log('logId=', logId, 'level=', level, 'message=', message);
	if (!initialized) {
		initialized = true;
		setTimeout(() => {
			logBatch();
		}, 5000);
	}

    const date = new Date().toISOString().replace('T', ' ').replace('Z', '');
    logQueue.push({date, logId, level, message, sessionId: '000', correlationId: '000'});
}

exports.logInfo = (logId, message) => {
	log(logId, "Info", message);
}

exports.logWarn = (logId, message) => {
	log(logId, "Warn", message);
}

exports.logError = (logId, message) => {
	log(logId, "Error", message);
}