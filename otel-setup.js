// otel-setup.js
'use strict';

const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { SimpleSpanProcessor } = require('@opentelemetry/sdk-trace-base');


// 1. Create a tracer provider
const provider = new NodeTracerProvider();

// 2. Configure your exporter
const exporter = new OTLPTraceExporter({
  // e.g. url: 'http://localhost:4318/v1/traces'
});

// 3. Add the span processor
provider.addSpanProcessor(new SimpleSpanProcessor(exporter));

// 4. Register the provider so it becomes the global tracer provider
provider.register();

// 5. Register auto-instrumentations
registerInstrumentations({
  tracerProvider: provider,
  instrumentations: [ getNodeAutoInstrumentations() ],
});

// No need to require loader.js here—Node will load this file first,
// and then load loader.js automatically afterward when we pass --require.
