/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
/* eslint-disable linebreak-style */
'use strict';

const winston = require('winston');
const os = require('os');

var initialized = false;
var fromLocal;

exports.initializeLogging = () => {
	initialized = true;
	fromLocal = isLocal();

	winston.configure({
		level: 'info', // Set the default log level
		transports: [
			new winston.transports.Console(), // Log to console
			new winston.transports.Http({ host: fromLocal ? 'localhost' : 'ingest.obics.io',  
				port: 8000, 
				path: 'api/v1/ingest', 
				ssl: !fromLocal, 
				format: winston.format(info => ({
					...info,
					timestamp: undefined,
					time: Date.now(),
					level: {
						silly: 1,
						debug: 1,
						verbose: 2, 
						info: 3,
						warn: 4,
						error: 5,
						critical: 6,
					}[info.level] || 3,
					message: info.message,
				}))(),
				level: 'info',
				headers: {
					'x-api-key': '0f67a886-7f3b-4d60-a206-9673d584118f',
				}, 
				batchInterval: 1000,
				batch: true,
			}),
				
		],
	});
	
};
	

function log(logId, level, message, sessionID, requestID) {
	if (!initialized) {
		initializeLogging();
	}

	const f = level == 'Error' ? winston.error : level == 'Warn' ? winston.warn : winston.info;
	sessionID = 'aadert';
	f(message, { logId, SessionId: sessionID, CorrelationId: requestID });
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

			// eslint-disable-next-line no-restricted-syntax
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

function isLocal() {
	return isLocalIPAddress(getIPAddress());
}

function getIPAddress() {
	try {
		const networkInterfaces = os.networkInterfaces();

		for (const interfaceName in networkInterfaces) {
			const interfaces = networkInterfaces[interfaceName];

			for (const iface of interfaces) {
				if (iface.family === 'IPv4' && !iface.internal) {
					return iface.address;
				}
			}
		}
	} catch {
	}

	return 'IP address not found';
}

function isLocalIPAddress(ip) {
	// Convert the IP into an array of integers
	const octets = ip.split('.').map(Number);

	if (octets.length !== 4 || octets.some(octet => isNaN(octet) || octet < 0 || octet > 255)) {
			return false; // Invalid IP format
	}

	// Check for private IP ranges
	const [first, second] = octets;

	return (
			// 10.0.0.0 - 10.255.255.255
			first === 10 ||

			// 172.16.0.0 - 172.31.255.255
			(first === 172 && second >= 16 && second <= 31) ||

			// 192.168.0.0 - 192.168.255.255
			(first === 192 && second === 168) ||

			// Loopback address (127.0.0.0 - 127.255.255.255)
			first === 127
	);
}