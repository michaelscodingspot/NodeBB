/* eslint-disable no-tabs */
/* eslint-disable spaced-comment */
/* eslint-disable no-mixed-spaces-and-tabs */
/* eslint-disable linebreak-style */
/* eslint-disable lines-around-directive */
'use strict';

const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express'); // optional, but often used with HTTP
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const {
	BatchSpanProcessor, // <-- bring in the BatchSpanProcessor
} = require('@opentelemetry/sdk-trace-base');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

// 1. Create a tracer provider
const provider = new NodeTracerProvider({
	resource: new Resource({
		[SemanticResourceAttributes.SERVICE_NAME]: 'nodebb', // Replace with your service name
	}),
});

// 2. Configure your exporter
const exporter = new OTLPTraceExporter({
	url: 'https://ingest.obics.io/api/otel/v1/traces', // 'http://localhost:5183/api/otel/v1/traces', For Jaeger: //'http://localhost:4318/v1/traces',
	headers: {
		'x-api-key': '0f67a886-7f3b-4d60-a206-9673d584118f', // sandbox key
	},
});

/**
 * 3. Option A: If you want the old SimpleSpanProcessor (sends each span immediately)
 *     provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
 *
 *    Option B: Use a BatchSpanProcessor (buffers + sends in batches)
 */
provider.addSpanProcessor(
	new BatchSpanProcessor(exporter, {
		// The following are optional defaults:
		maxExportBatchSize: 512, // Maximum spans per batch
		maxQueueSize: 2048, // Maximum queue size
		scheduledDelayMillis: 5000, // Interval between processing batches
		exportTimeoutMillis: 30000, // Timeout for export calls
	})
);

// 4. Register the provider so it becomes the global tracer provider
provider.register();

// 5. Register auto-instrumentations

registerInstrumentations({
	tracerProvider: provider,
	instrumentations: [
		// First, override the HTTP instrumentation so we can customize it
		new HttpInstrumentation({
			requestHook: (span, requestInfo) => {
				const headers = requestInfo.rawHeaders;
				const cookieIndex = headers.findIndex(header => header.toLowerCase() === 'cookie');
				if (cookieIndex !== -1 && cookieIndex + 1 < headers.length) {
					const cookieHeader = headers[cookieIndex + 1];
					const sidFull = cookieHeader.split('; ').find(cookie => cookie.startsWith('express.sid=')).substring(12);
					if (sidFull) {
						// console.log('!!! Cookie Header express.sidFull:', sidFull);
						const upToPeriod = sidFull.indexOf('.');
						if (upToPeriod > 0) {
							const sid = sidFull.substring(3, upToPeriod);
							span.setAttribute('session_id', sid);
							// console.log('!!! Cookie Header express.sid:', sid);
						}
					}
				}

				// Example: enrich with user ID and request ID from headers
				// if (headers['x-user-id']) {
				// 	span.setAttribute('user.id', headers['x-user-id']);
				// }
				// if (headers['x-request-id']) {
				// 	span.setAttribute('request.id', headers['x-request-id']);
				// }
			},
		}),

		// Add other instrumentations you want (excluding HTTP to avoid duplication)
		// new ExpressInstrumentation(),

		// And the rest from auto-instrumentations, but excluding HTTP explicitly
		getNodeAutoInstrumentations({
			// disable default HTTP instrumentation to avoid double registration
			'@opentelemetry/instrumentation-http': {
				enabled: false,
			},
		}),
	],
});