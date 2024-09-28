'use strict';

// const axios = require('axios');

// Define the Druid SQL endpoint
const DRUID_SQL_ENDPOINT_LOCAL = 'http://localhost:8888/druid/v2/sql/task';
//const DRUID_SQL_ENDPOINT_SANDBOX = 'http://142.93.105.195:8888/druid/v2/sql/task';
//https://idlogio.app.imply.io/4227072b-838e-47a2-ad42-a1ac77aa177c/home/recent
const POLARIS_ENDPOINT_SANDOX = 'https://idlogio.eu-central-1.aws.api.imply.io/v1/projects/4227072b-838e-47a2-ad42-a1ac77aa177c/jobs';
const POLARIS_API_KEY='pok_Ay2rbiqWriOY5ZwD1vYB688GSYQF5Jh4Gdu1ZWoCfoo9WejP8pOcUMu3qU9tl6nfuQ';
const DRUID_DATA_SOURCE_LOCAL = 'my_express1';
const DRUID_DATA_SOURCE_SANDBOX = 'Logs';
const isSandbox = true; // false means local
const druidSqlEndpoint = isSandbox ? POLARIS_ENDPOINT_SANDOX : DRUID_SQL_ENDPOINT_LOCAL;
const druidDataSource = isSandbox ? DRUID_DATA_SOURCE_SANDBOX : DRUID_DATA_SOURCE_LOCAL;

const logQueue = [];
var initialized = false;

const LOG_INTERVAL = 12000;
function logBatch() {
	if (logQueue.length === 0) {
		setTimeout(() => {
			logBatch();
		}, LOG_INTERVAL * 4);
		return;
	}

	const values = logQueue.map(log => `(TIMESTAMP '${log.date}', '${log.logId}', '${log.level}', '${log.message}', '${log.sessionId}', '${log.correlationId}')`).join(', ');
	const sqlQuery =
`INSERT INTO ${druidDataSource}
SELECT * FROM (
    VALUES
    ${values}
) AS t (__time, LogId, Level, Message, SessionId, CorrelationId)
    PARTITIONED BY DAY`;

	logQueue.length = 0;
	console.log('sqlQuery=', sqlQuery);

	fetch(druidSqlEndpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Basic ${POLARIS_API_KEY}`
		},
		body: JSON.stringify({ 
			type: "sql",
			createTableIfNotExists: true,
			query: sqlQuery 
		}),
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

function log(logId, level, message, sessionID, requestID) {
	console.log(`---- logId=${logId} level=${level} message=${message} sessionID=${sessionID} requestID=${requestID}`);
	if (!initialized) {
	 initialized = true;
	 setTimeout(() => {
	logBatch();
	 }, 5000);
	}

	const date = new Date().toISOString().replace('T', ' ').replace('Z', '');
	logQueue.push({date, logId, level, message, sessionId: sessionID, correlationId: requestID});
}

exports.logInfo = (logId, message, req = undefined) => {
	log(logId, 'Info', message, req && req.sessionID, req && req.requestID);
};

exports.logWarn = (logId, message, req = undefined) => {
	log(logId, 'Warn', message, req && req.sessionID, req && req.requestID);
};

exports.logError = (logId, message, req = undefined) => {
	log(logId, 'Error', message, req && req.sessionID, req && req.requestID);
};

exports.stringifyTwoLevels = (obj) => {
	const maxDepth = 4;

	// Helper function to recursively walk through the object and track depth
	function recurse(currentObj, currentDepth) {
		if (currentDepth > maxDepth) {
			return '[Object]'; // If we've exceeded max depth, replace with placeholder
		}

		if (typeof currentObj === 'object' && currentObj !== null) {
			// If currentObj is an array, treat it as an array; otherwise, treat it as an object
			const result = Array.isArray(currentObj) ? [] : {};

			for (const key in currentObj) {
				if (Object.prototype.hasOwnProperty.call(currentObj, key)) {
					result[key] = recurse(currentObj[key], currentDepth + 1);
				}
			}
			return result;
		}

		return currentObj; // Return the value for non-objects
	}

	// Start recursion from depth 1
	const limitedObj = recurse(obj, 1);

	// Stringify the resulting object limited to two levels deep
	return JSON.stringify(limitedObj, null, 2); // Optional pretty print with 2 spaces
};
