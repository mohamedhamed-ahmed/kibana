/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { BasicPrettyPrinter, Builder } from '@elastic/esql';

function fromWithIgnoredMetadata(source: string) {
  return Builder.command({
    name: 'from',
    args: [
      Builder.expression.source.index(source),
      Builder.option({
        name: 'METADATA',
        args: [Builder.expression.column({ args: [Builder.identifier({ name: '_ignored' })] })],
      }),
    ],
  });
}

function whereIgnoredIsNotNull() {
  return Builder.command({
    name: 'where',
    args: [Builder.expression.func.postfix('is not null', Builder.expression.column('_ignored'))],
  });
}

/** Total document count for the stream (and optional ::failures) in the active time range. */
export function buildDataQualityTotalDocCountEsql(source: string): string {
  return BasicPrettyPrinter.print(
    Builder.expression.query([
      Builder.command({
        name: 'from',
        args: [Builder.expression.source.index(source)],
      }),
      Builder.command({
        name: 'stats',
        args: [
          Builder.expression.func.binary('=', [
            Builder.expression.column('doc_count'),
            Builder.expression.func.call('COUNT', [Builder.expression.column('*')]),
          ]),
        ],
      }),
    ])
  );
}

/** Degraded-doc count: rows with non-null `_ignored` in the time range. */
export function buildDataQualityDegradedDocCountEsql(source: string): string {
  return BasicPrettyPrinter.print(
    Builder.expression.query([
      fromWithIgnoredMetadata(source),
      whereIgnoredIsNotNull(),
      Builder.command({
        name: 'stats',
        args: [
          Builder.expression.func.binary('=', [
            Builder.expression.column('degraded_doc_count'),
            Builder.expression.func.call('COUNT', [Builder.expression.column('*')]),
          ]),
        ],
      }),
    ])
  );
}

/** Distinct ignored-field values count in the time range. */
export function buildDataQualityIgnoredFieldsCountEsql(source: string): string {
  return BasicPrettyPrinter.print(
    Builder.expression.query([
      fromWithIgnoredMetadata(source),
      whereIgnoredIsNotNull(),
      Builder.command({
        name: 'stats',
        args: [
          Builder.expression.func.binary('=', [
            Builder.expression.column('ignored_fields_count'),
            Builder.expression.func.call('COUNT_DISTINCT', [Builder.expression.column('_ignored')]),
          ]),
        ],
      }),
    ])
  );
}

/** Ingest histogram: doc_count by @timestamp bucket. */
export function buildStreamIngestHistogramEsql(source: string, minIntervalMs: number): string {
  return BasicPrettyPrinter.print(
    Builder.expression.query([
      Builder.command({
        name: 'from',
        args: [Builder.expression.source.index(source)],
      }),
      Builder.command({
        name: 'stats',
        args: [
          Builder.expression.func.binary('=', [
            Builder.expression.column('doc_count'),
            Builder.expression.func.call('COUNT', [Builder.expression.column('*')]),
          ]),
          Builder.option({
            name: 'by',
            args: [
              Builder.expression.func.binary('=', [
                Builder.expression.column('@timestamp'),
                Builder.expression.func.call('BUCKET', [
                  Builder.expression.column('@timestamp'),
                  Builder.expression.literal.timespan(minIntervalMs, 'ms'),
                ]),
              ]),
            ],
          }),
        ],
      }),
    ])
  );
}
