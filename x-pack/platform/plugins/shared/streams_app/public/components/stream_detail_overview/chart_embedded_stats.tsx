/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiFlexGroup, EuiFlexItem, formatNumber, useEuiTheme } from '@elastic/eui';
import type { ESQLSearchResponse } from '@kbn/es-types';
import { i18n } from '@kbn/i18n';
import type { Streams } from '@kbn/streams-schema';
import React from 'react';
import type { AsyncState } from 'react-use/lib/useAsync';
import { useDataStreamStats } from '../data_management/stream_detail_lifecycle/hooks/use_data_stream_stats';
import { formatBytes } from '../data_management/stream_detail_lifecycle/helpers/format_bytes';
import { useTimefilter } from '../../hooks/use_timefilter';
import { OverviewStatWithTotal } from './overview_stat';

interface ChartEmbeddedStatsProps {
  definition: Streams.ingest.all.GetResponse;
  /** Same histogram async state as the overview chart (shared `useStreamDocCountsFetch` + cache). */
  statsHistogramResult: AsyncState<ESQLSearchResponse>;
  /** Sum of `doc_count` over the histogram series for the selected range (from parent `allTimeseries`). */
  docCountInRange: number;
}

/**
 * Time-range document count + estimated storage, with all-time totals — shown beside the overview chart.
 */
export function ChartEmbeddedStats({
  definition,
  statsHistogramResult,
  docCountInRange,
}: ChartEmbeddedStatsProps) {
  const { euiTheme } = useEuiTheme();
  const { timeState } = useTimefilter();

  const rangeDocTitle = statsHistogramResult.loading
    ? '—'
    : statsHistogramResult.error
    ? '—'
    : formatNumber(docCountInRange, '0a');

  const { stats, isLoading: isStatsLoading } = useDataStreamStats({ definition, timeState });
  const canReadFailureStore = definition.privileges.read_failure_store;

  const mainDocsAllTime = stats?.ds.stats.totalDocs ?? 0;
  const mainSizeBytes = stats?.ds.stats.sizeBytes ?? 0;
  const failureDocsAllTime = stats?.fs?.stats?.count ?? 0;
  const failureSizeBytes = stats?.fs?.stats?.size ?? 0;

  // Histogram counts main + ::failures when the user can read the failure store
  const totalDocsForStorageAvg = canReadFailureStore
    ? mainDocsAllTime + failureDocsAllTime
    : mainDocsAllTime;
  const totalSizeBytesForStorage = canReadFailureStore
    ? mainSizeBytes + failureSizeBytes
    : mainSizeBytes;

  const bytesPerDoc =
    totalDocsForStorageAvg > 0 && totalSizeBytesForStorage > 0
      ? totalSizeBytesForStorage / totalDocsForStorageAvg
      : 0;
  const estimatedSizeBytesUncapped = bytesPerDoc * docCountInRange;
  const estimatedSizeBytesInRange =
    totalSizeBytesForStorage > 0
      ? Math.min(estimatedSizeBytesUncapped, totalSizeBytesForStorage)
      : estimatedSizeBytesUncapped;
  const isStorageLoading = isStatsLoading || statsHistogramResult.loading;
  const rangeStorageTitle =
    !isStorageLoading && !statsHistogramResult.error ? formatBytes(estimatedSizeBytesInRange) : '—';

  const showTotals = stats !== undefined && !isStatsLoading;
  const totalDocsLine = showTotals
    ? i18n.translate('xpack.streams.streamOverview.chartEmbeddedStats.totalDocsLine', {
        defaultMessage: 'Total {value}',
        values: { value: formatNumber(totalDocsForStorageAvg, '0a') },
      })
    : '—';

  const totalStorageLine = showTotals
    ? i18n.translate('xpack.streams.streamOverview.chartEmbeddedStats.totalStorageLine', {
        defaultMessage: 'Total {value}',
        values: { value: formatBytes(totalSizeBytesForStorage) },
      })
    : '—';

  const storageInfoTooltip = i18n.translate(
    'xpack.streams.streamOverview.chartEmbeddedStats.estimatedStorageTooltip',
    {
      defaultMessage: 'The approximate amount of data stored in the selected time range.',
    }
  );

  return (
    <EuiFlexItem
      grow={false}
      css={{ minWidth: euiTheme.size.xxl, maxWidth: 240 }}
      data-test-subj="streamsAppStreamOverviewChartEmbeddedStats"
    >
      <EuiFlexGroup direction="column" gutterSize="l" responsive={false}>
        <EuiFlexItem grow={false}>
          <OverviewStatWithTotal
            description={i18n.translate(
              'xpack.streams.streamOverview.chartEmbeddedStats.docCountLabel',
              {
                defaultMessage: 'Doc count',
              }
            )}
            rangeTitle={rangeDocTitle}
            totalLine={totalDocsLine}
            isLoading={statsHistogramResult.loading}
            dataTestSubj="streamsOverviewDocCount"
          />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <OverviewStatWithTotal
            description={i18n.translate(
              'xpack.streams.streamOverview.chartEmbeddedStats.estimatedStorageLabel',
              { defaultMessage: 'Estimated storage size' }
            )}
            rangeTitle={rangeStorageTitle}
            totalLine={totalStorageLine}
            isLoading={isStorageLoading}
            descriptionInfoTooltip={storageInfoTooltip}
            dataTestSubj="streamsOverviewStorageSize"
          />
        </EuiFlexItem>
      </EuiFlexGroup>
    </EuiFlexItem>
  );
}
