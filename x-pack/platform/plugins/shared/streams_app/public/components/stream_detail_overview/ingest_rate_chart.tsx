/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  Axis,
  BarSeries,
  Chart,
  Position,
  ScaleType,
  Settings,
  Tooltip,
  TooltipStickTo,
  niceTimeFormatter,
} from '@elastic/charts';
import type { BrushEndListener, XYBrushEvent } from '@elastic/charts';
import {
  EuiComboBox,
  EuiFlexGroup,
  EuiFlexItem,
  EuiLoadingChart,
  EuiPanel,
  EuiSpacer,
  useEuiTheme,
} from '@elastic/eui';
import { useElasticChartsTheme } from '@kbn/charts-theme';
import { fieldSupportsBreakdown } from '@kbn/field-utils';
import { i18n } from '@kbn/i18n';
import { FieldIcon } from '@kbn/react-field';
import { getParentId, Streams } from '@kbn/streams-schema';
import React, { useCallback, useMemo, useState } from 'react';
import useAsync from 'react-use/lib/useAsync';
import { useStreamDataViewFieldTypes } from '../../hooks/use_stream_data_view_field_types';
import { useStreamDetail } from '../../hooks/use_stream_detail';
import { useStreamDocCountsFetch } from '../../hooks/use_streams_doc_counts_fetch';
import { useTimefilter } from '../../hooks/use_timefilter';
import { useTimeRangeUpdate } from '../../hooks/use_time_range_update';
import { esqlResultToTimeseries } from '../../util/esql_result_to_timeseries';
import { OVERVIEW_NUM_DATA_POINTS } from './utils';

const CHART_HEIGHT = 150;

export function IngestRateChart() {
  const { definition } = useStreamDetail();

  if (!definition) {
    return null;
  }

  return <IngestRateChartContent definition={definition} />;
}

function IngestRateChartContent({ definition }: { definition: Streams.all.GetResponse }) {
  const [breakdownField, setBreakdownField] = useState<string | undefined>(undefined);

  const { euiTheme } = useEuiTheme();
  const chartBaseTheme = useElasticChartsTheme();

  // Query streams have no failure store; only ingest streams carry the privilege flag.
  const canReadFailureStore = Streams.ingest.all.GetResponse.is(definition)
    ? definition.privileges.read_failure_store
    : false;
  const streamName = definition.stream.name;
  const isQueryStream = Streams.QueryStream.GetResponse.is(definition);

  // Query streams expose data via their $.prefixed ES|QL view, not via the plain stream name.
  const esqlSource = isQueryStream
    ? definition.stream.query.view // e.g. "$.logs.otel.query"
    : streamName; // e.g. "logs.otel"

  const fieldCapsSource = isQueryStream ? getParentId(streamName) ?? streamName : streamName;
  const { dataView } = useStreamDataViewFieldTypes(fieldCapsSource);

  const { timeState } = useTimefilter();
  const minInterval = Math.floor((timeState.end - timeState.start) / OVERVIEW_NUM_DATA_POINTS);
  const xFormatter = niceTimeFormatter([timeState.start, timeState.end]);

  const breakdownOptions = useMemo(
    () =>
      (dataView?.fields ?? [])
        .filter(fieldSupportsBreakdown)
        .filter((f) => f.name !== '@timestamp')
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((f) => ({ label: f.name, prepend: <FieldIcon type={f.type} size="s" /> })),
    [dataView]
  );

  const { getStreamHistogram } = useStreamDocCountsFetch({
    groupTotalCountByTimestamp: true,
    canReadFailureStore,
    numDataPoints: OVERVIEW_NUM_DATA_POINTS,
  });

  const histogramFetch = getStreamHistogram(esqlSource, breakdownField);
  const histogramResult = useAsync(() => histogramFetch, [histogramFetch]);

  const allTimeseries = useMemo(
    () =>
      esqlResultToTimeseries({
        result: histogramResult,
        metricNames: ['doc_count'],
      }),
    [histogramResult]
  );

  const showLegend = breakdownField !== undefined && allTimeseries.length > 1;

  const { updateTimeRange } = useTimeRangeUpdate();
  const onBrushEnd = useCallback<BrushEndListener>(
    (brushEvent) => {
      const { x } = brushEvent as XYBrushEvent;
      if (!x) return;
      const [min, max] = x;
      updateTimeRange({
        from: new Date(min).toISOString(),
        to: new Date(max).toISOString(),
      });
    },
    [updateTimeRange]
  );

  return (
    <EuiPanel hasBorder paddingSize="m">
      <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
        <EuiFlexItem grow={false} style={{ minWidth: 200 }}>
          <EuiComboBox
            placeholder={i18n.translate(
              'xpack.streams.streamOverview.timeSeriesChart.breakdown.placeholder',
              { defaultMessage: 'No breakdown' }
            )}
            options={breakdownOptions}
            selectedOptions={breakdownField ? [{ label: breakdownField }] : []}
            onChange={(selected) => setBreakdownField(selected[0]?.label)}
            singleSelection={{ asPlainText: true }}
            isClearable
            isLoading={!dataView}
            compressed
            data-test-subj="streamsAppTimeSeriesChartBreakdownSelector"
            aria-label={i18n.translate(
              'xpack.streams.streamOverview.timeSeriesChart.breakdown.ariaLabel',
              { defaultMessage: 'Select breakdown field' }
            )}
          />
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiSpacer size="m" />

      {histogramResult.loading && !histogramResult.value ? (
        <EuiFlexGroup justifyContent="center" alignItems="center" style={{ height: CHART_HEIGHT }}>
          <EuiFlexItem grow={false}>
            <EuiLoadingChart size="l" />
          </EuiFlexItem>
        </EuiFlexGroup>
      ) : (
        <Chart
          id={`streams-ingest-rate-${streamName}`}
          size={{ width: '100%', height: CHART_HEIGHT }}
        >
          <Settings
            showLegend={showLegend}
            legendPosition={Position.Bottom}
            xDomain={{ min: timeState.start, max: timeState.end, minInterval }}
            locale={i18n.getLocale()}
            baseTheme={chartBaseTheme}
            theme={{ barSeriesStyle: { rect: { widthRatio: 0.6 } } }}
            onBrushEnd={onBrushEnd}
            allowBrushingLastHistogramBin
          />
          <Tooltip
            stickTo={TooltipStickTo.Top}
            headerFormatter={({ value }) => xFormatter(value)}
          />
          <Axis
            id="x-axis"
            position={Position.Bottom}
            showOverlappingTicks
            tickFormat={xFormatter}
            gridLine={{ visible: false }}
          />
          <Axis
            id="y-axis"
            ticks={3}
            position={Position.Left}
            tickFormat={(value) => (value === null ? '' : String(value))}
          />
          {allTimeseries.map((serie) => (
            <BarSeries
              key={serie.id}
              id={serie.id}
              name={
                breakdownField
                  ? // Strip "fieldName:" prefix for a cleaner legend label
                    serie.label.startsWith(`${breakdownField}:`)
                    ? serie.label.slice(`${breakdownField}:`.length)
                    : serie.label
                  : i18n.translate(
                      'xpack.streams.streamOverview.timeSeriesChart.legend.ingestRate',
                      { defaultMessage: 'Ingest rate' }
                    )
              }
              color={breakdownField ? undefined : euiTheme.colors.success}
              xScaleType={ScaleType.Time}
              yScaleType={ScaleType.Linear}
              xAccessor="x"
              yAccessors={['doc_count']}
              data={serie.data}
              stackAccessors={breakdownField ? ['x'] : undefined}
              enableHistogramMode
            />
          ))}
        </Chart>
      )}
    </EuiPanel>
  );
}
