/* eslint-disable linebreak-style */
/* eslint-disable lines-around-directive */
// otel-setup.js
'use strict';

const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { SimpleSpanProcessor } = require('@opentelemetry/sdk-trace-base');
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
	url: 'https://ingest.obics.io/api/otel/v1/traces', // 'http://localhost:5183/api/otel/v1/traces',
	headers: {
		'x-api-key': '0f67a886-7f3b-4d60-a206-9673d584118f', // sandbox key
	},
});

// 3. Add the span processor
provider.addSpanProcessor(new SimpleSpanProcessor(exporter));

// 4. Register the provider so it becomes the global tracer provider
provider.register();

// 5. Register auto-instrumentations
registerInstrumentations({
	tracerProvider: provider,
	instrumentations: [getNodeAutoInstrumentations()],
});

// No need to require loader.js here—Node will load this file first,
// and then load loader.js automatically afterward when we pass --require.
