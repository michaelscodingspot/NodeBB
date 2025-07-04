/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
/* eslint-disable linebreak-style */
'use strict';

const winston = require('winston');
const os = require('os');

var initialized = false;
var fromLocal;

const initializeLogging = () => {
	if (initialized) {
		return;
	}

	initialized = true;
	fromLocal = isLocal();
	const host = fromLocal ? 'localhost' : 'ingest.obics.io';
	const port = fromLocal ? 5183 : undefined;
	const ssl =  !fromLocal;	
	const hostname = os.hostname();
	const env = fromLocal ? 'dev' : 'prod';
	console.log('hostname: ', hostname, 'target: ', host, 'port: ', port, 'ssl: ', ssl);
	winston.configure({
		severity: 'info', // Set the default log level
		format: winston.format.simple(),
		transports: [
			new winston.transports.Console(), // Log to console
			new winston.transports.Http({ 
				host,  
				port, 
				path: 'api/v1/ingest', 
				ssl, 
				format: winston.format(info => ({
					...info,
					timestamp: Date.now(),
					service: 'nodebb',
					host: hostname,
					env,
					severity: {
						silly: "TRACE",
						debug: "DEBUG",
						verbose: "TRACE", 
						info: "INFO",
						warn: "WARN",
						error: "ERROR",
						critical: "FATAL",
					}[info.level] || "INFO",
					message: info.message,
				}))(),
				headers: {
					'x-api-key': '0f67a886-7f3b-4d60-a206-9673d584118f'
				}, 
				batchInterval: 1000,
				batch: true,
			}),
				
		],
		handleExceptions: true,
		rejectionHandlers: [
			new winston.transports.Console(),
		],
		exceptionHandlers: [
			new winston.transports.Console(),
		],
	});

};
	
exports.initializeLogging = initializeLogging;

function log(event_id, level, message, req) {
	const sessionID = req && (req.sessionID ?? (req.session && req.session.id));
	// const requestID = req && req.requestID;
	
	initializeLogging();

	const f = level == 'Error' ? winston.error : level == 'Warn' ? winston.warn : winston.info;
	// sessionID = 'proddert2';
	f(message, { event_id, session_id: sessionID });
}

exports.logInfo = (event_id, message, req = undefined) => {
	
	log(event_id, 'Info', message, req);
};

exports.logWarn = (event_id, message, req = undefined) => {
	log(event_id, 'Warn', message, req);
};

exports.logError = (event_id, message, req = undefined) => {
	log(event_id, 'Error', message, req);
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
	// return false;
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

	return '67.67.67.67'; // not local IP
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