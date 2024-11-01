'use strict';

const os = require('os');

// Define the Druid SQL endpoint
//const DIGITAL_OCEAN_DRUID_SQL_ENDPOINT_SANDBOX = 'http://142.93.105.195:8888/druid/v2/sql/task';
const DRUID_SQL_ENDPOINT_LOCAL = 'http://localhost:8888/druid/v2/sql/task';
const POLARIS_ENDPOINT_SANDOX = 'https://idlogio.eu-central-1.aws.api.imply.io/v1/projects/4227072b-838e-47a2-ad42-a1ac77aa177c/jobs';
const POLARIS_API_KEY='pok_Ay2rbiqWriOY5ZwD1vYB688GSYQF5Jh4Gdu1ZWoCfoo9WejP8pOcUMu3qU9tl6nfuQ';

const CLICK_HOUSE_URL = 'https://rq5fzdb7yv.eu-central-1.aws.clickhouse.cloud:8443';
const CLICK_HOUSE_CREDENTIALS='default:.2HwcLA8cNfKO';

const isSandbox = true; // false means local
var initialized = false;
var fromLocal;


const druidSqlEndpoint = isSandbox ? POLARIS_ENDPOINT_SANDOX : DRUID_SQL_ENDPOINT_LOCAL;

const logQueue = [];

const LOG_INTERVAL_MS = 1000;
function logBatch() {
	if (logQueue.length === 0) {
		setTimeout(() => {
			logBatch();
		}, LOG_INTERVAL_MS * 4);
		return;
	}

	const DOS_ATTACK_LIMIT = 1000;
	if (logQueue.length > DOS_ATTACK_LIMIT) {
		const length = logQueue.length;
		logQueue.length = 0;
		log('dos1', 'Error', `DOS attack detected. Log queue length=${length} higher than ${DOS_ATTACK_LIMIT}`, '', '');
	}

	const tableName = isSandbox ? (fromLocal ? "LogsLocal" : "Logs") : 'my_express1';
	const valuesCH = logQueue.map(log => `('${log.date}','${log.level}','${log.logId}','${log.message}','${log.correlationId}','${log.sessionId}')`).join(',');
	const sqlQueryClickHouse = `INSERT INTO ${tableName} (Time, Level, LogId, Message,  CorrelationId, SessionId) VALUES ${valuesCH}`;

	logQueue.length = 0;
	console.log('sqlQuery=', sqlQueryClickHouse);

	fetch(CLICK_HOUSE_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'text/plain',
			'Authorization': `Basic ${btoa(CLICK_HOUSE_CREDENTIALS)}`
		},
		body: sqlQueryClickHouse,
	})
		.then((response) => {
			console.log('Insert success:', response);
		}).catch((error) => {
			console.error('Error inserting data:', error.response ? error.response.data : error.message);
		}).finally(() => {
			console.log('Finished request');
			setTimeout(() => {
				logBatch();
			}, LOG_INTERVAL_MS);
		});
}

function log(logId, level, message, sessionID, requestID) {
	console.log(`---- logId=${logId} level=${level} message=${message} sessionID=${sessionID} requestID=${requestID}`);
	const date = new Date().toISOString().replace('T', ' ').replace('Z', '');
	if (!initialized) {
		initialized = true;
		const localIPAddress = getLocalIPAddress();
		fromLocal = localIPAddress.startsWith("10.");
		console.log("fromLocal=" + fromLocal)
		logQueue.push({ date, logId: "init", level: "Info", message: `idlogger initialized. local machine=${fromLocal}`, sessionId: sessionID, correlationId: requestID });

		setTimeout(() => {
			logBatch();
		}, LOG_INTERVAL_MS * 4);
	}

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

function getLocalIPAddress() {
	const networkInterfaces = os.networkInterfaces();
	
	for (const interfaceName in networkInterfaces) {
	  const interfaces = networkInterfaces[interfaceName];
	  
	  for (const iface of interfaces) {
		if (iface.family === 'IPv4' && !iface.internal) {
		  return iface.address;
		}
	  }
	}
	
	return 'IP address not found';
  }

  