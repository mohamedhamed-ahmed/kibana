/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiSpacer,
  EuiTitle,
  formatNumber,
  useEuiTheme,
} from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { Streams } from '@kbn/streams-schema';
import React, { useMemo } from 'react';
import useAsync from 'react-use/lib/useAsync';
import { useDataStreamStats } from '../data_management/stream_detail_lifecycle/hooks/use_data_stream_stats';
import { formatBytes } from '../data_management/stream_detail_lifecycle/helpers/format_bytes';
import { useStreamDetail } from '../../hooks/use_stream_detail';
import { useStreamDocCountsFetch } from '../../hooks/use_streams_doc_counts_fetch';
import { useTimefilter } from '../../hooks/use_timefilter';
import { esqlResultToTimeseries } from '../../util/esql_result_to_timeseries';
import { OverviewStat } from './overview_stat';
import { OVERVIEW_NUM_DATA_POINTS, statDividerCss } from './utils';

export function StatsCards() {
  const { definition } = useStreamDetail();

  if (!Streams.ingest.all.GetResponse.is(definition)) {
    return null;
  }

  return <StatsCardsContent definition={definition} />;
}

function StatsCardsContent({ definition }: { definition: Streams.ingest.all.GetResponse }) {
  const { euiTheme } = useEuiTheme();
  const dividerCss = statDividerCss(euiTheme);

  // timeState drives reactivity: when the time range changes this component re-renders,
  // getStreamHistogram() returns a fresh Promise (cache cleared by useStreamDocCountsFetch),
  // and useAsync re-fetches automatically.
  const { timeState } = useTimefilter();

  // Time-filtered document count via ESQL histogram — same pattern as the streams listing page
  const { getStreamHistogram } = useStreamDocCountsFetch({
    groupTotalCountByTimestamp: true,
    canReadFailureStore: definition.privileges.read_failure_store,
    numDataPoints: OVERVIEW_NUM_DATA_POINTS,
  });

  const histogramFetch = getStreamHistogram(definition.stream.name);
  const histogramResult = useAsync(() => histogramFetch, [histogramFetch]);

  const docCount = useMemo(() => {
    const timeseries = esqlResultToTimeseries({
      result: histogramResult,
      metricNames: ['doc_count'],
    });
    return timeseries.reduce(
      (acc, series) => acc + series.data.reduce((sum, item) => sum + (item.doc_count ?? 0), 0),
      0
    );
  }, [histogramResult]);

  const docCountTitle = histogramResult.loading
    ? '—'
    : histogramResult.error
    ? '—'
    : formatNumber(docCount, '0a');

  // Estimated storage size for the selected time range.
  // Formula: (all-time bytes / all-time docs) × time-filtered doc count.
  // Same assumption as the retention tab's ingestion rate projections: uniform average doc size.
  const { stats, isLoading: isStatsLoading } = useDataStreamStats({ definition, timeState });
  const bytesPerDoc =
    stats?.ds.stats.totalDocs && stats?.ds.stats.sizeBytes
      ? stats.ds.stats.sizeBytes / stats.ds.stats.totalDocs
      : 0;
  const estimatedSizeBytes = bytesPerDoc * docCount;
  const isStorageLoading = isStatsLoading || histogramResult.loading;
  const storageSizeTitle =
    !isStorageLoading && !histogramResult.error ? formatBytes(estimatedSizeBytes) : '—';

  return (
    <EuiPanel hasBorder paddingSize="m">
      <EuiTitle size="xs">
        <h2>
          {i18n.translate('xpack.streams.streamOverview.statsCards.title', {
            defaultMessage: 'Documents',
          })}
        </h2>
      </EuiTitle>
      <EuiSpacer size="m" />
      <EuiFlexGroup gutterSize="none" responsive={false}>
        <EuiFlexItem>
          <OverviewStat
            title={docCountTitle}
            description={i18n.translate(
              'xpack.streams.streamOverview.statsCards.totalDocumentCount',
              { defaultMessage: 'Total document count' }
            )}
            isLoading={histogramResult.loading}
            dataTestSubj="streamsOverviewDocCount"
          />
        </EuiFlexItem>
        <EuiFlexItem css={dividerCss}>
          <OverviewStat
            title={storageSizeTitle}
            description={i18n.translate(
              'xpack.streams.streamOverview.statsCards.estimatedStorageSize',
              { defaultMessage: 'Estimated storage size' }
            )}
            isLoading={isStorageLoading}
            dataTestSubj="streamsOverviewStorageSize"
          />
        </EuiFlexItem>
      </EuiFlexGroup>
    </EuiPanel>
  );
}
