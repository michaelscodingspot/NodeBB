/* eslint-disable linebreak-style */
/* eslint-disable indent */
/* eslint-disable no-tabs */
/* eslint-disable spaced-comment */
/* eslint-disable no-mixed-spaces-and-tabs */
/* eslint-disable lines-around-directive */
'use strict';

const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const {
	BatchSpanProcessor, // <-- bring in the BatchSpanProcessor
} = require('@opentelemetry/sdk-trace-base');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { context } = require('@opentelemetry/api');
const CacheManager = require('./lib/cache-manager');

const cache = new CacheManager();

// 1. Create a tracer  provider
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

class SessionEnrichingSpanProcessor {
	constructor(delegate) {
		this._delegate = delegate;
	}

	onStart(span) {
		const sid = cache.get(getTraceIdFromSpan(span));
		if (sid) {
			span.setAttribute('session_id', sid);
		}

		this._delegate.onStart(span, context);
	}

	onEnd(span) {
		this._delegate.onEnd(span);
	}

	shutdown() {
		return this._delegate.shutdown();
	}

	forceFlush() {
		return this._delegate.forceFlush();
	}
}


const batchSpanProcessor = new BatchSpanProcessor(exporter, {
	// The following are optional defaults:
	maxExportBatchSize: 512, // Maximum spans per batch
	maxQueueSize: 2048, // Maximum queue size
	scheduledDelayMillis: 5000, // Interval between processing batches
	exportTimeoutMillis: 30000, // Timeout for export calls
});

provider.addSpanProcessor(new SessionEnrichingSpanProcessor(batchSpanProcessor));

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
							cache.set(getTraceIdFromSpan(span), sid);
						}
					}
				}
			},
		}),

		// Add other instrumentations you want (excluding HTTP to avoid duplication)

		// And the rest from auto-instrumentations, but excluding HTTP explicitly
		getNodeAutoInstrumentations({
			// disable default HTTP instrumentation to avoid double registration
			'@opentelemetry/instrumentation-http': {
				enabled: false,
			},
		}),
	],
});

function getTraceIdFromSpan(span) {
	return span._spanContext.traceId;
}