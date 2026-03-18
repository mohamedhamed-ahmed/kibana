/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiFlexGroup, EuiFlexItem, EuiSuperDatePicker } from '@elastic/eui';
import { Streams } from '@kbn/streams-schema';
import React, { type ReactNode } from 'react';
import { useStreamDetail } from '../../hooks/use_stream_detail';
import { useTimeRange } from '../../hooks/use_time_range';
import { useTimeRangeUpdate } from '../../hooks/use_time_range_update';
import { useTimefilter } from '../../hooks/use_timefilter';
import { AboutPanel } from './about_panel';
import { DataQualityCard } from './data_quality_card';
import { StatsCards } from './stats_cards';
import { IngestRateChart } from './ingest_rate_chart';

interface OverviewSection {
  id: string;
  node: ReactNode;
  show: boolean;
}

function OverviewTimeFilter() {
  const { rangeFrom, rangeTo } = useTimeRange();
  const { updateTimeRange } = useTimeRangeUpdate();
  const { refresh } = useTimefilter();

  return (
    <EuiSuperDatePicker
      start={rangeFrom}
      end={rangeTo}
      onTimeChange={({ start, end }) => updateTimeRange({ from: start, to: end })}
      onRefresh={() => refresh()}
      width="full"
      showUpdateButton="iconOnly"
    />
  );
}

function StatsRow() {
  return (
    <EuiFlexGroup gutterSize="m" responsive={false}>
      <EuiFlexItem>
        <DataQualityCard />
      </EuiFlexItem>
      <EuiFlexItem>
        <StatsCards />
      </EuiFlexItem>
    </EuiFlexGroup>
  );
}

export function StreamOverview() {
  const { definition } = useStreamDetail();

  const isIngest = Streams.ingest.all.GetResponse.is(definition);

  const mainSections: OverviewSection[] = [
    { id: 'stats-quality', node: <StatsRow />, show: isIngest },
    { id: 'ingest-rate-chart', node: <IngestRateChart />, show: true },
    // Ticket 2
    // { id: 'systems', node: <SystemsPanel />, show: isIngest },
    // { id: 'attachments', node: <AttachmentList />, show: true },
  ];

  const sidebarSections: OverviewSection[] = [
    { id: 'time-filter', node: <OverviewTimeFilter />, show: true },
    { id: 'about', node: <AboutPanel />, show: true },
    // Ticket 2
    // { id: 'suggestions', node: <SuggestionsPanel />, show: true },
  ];

  return (
    <EuiFlexGroup alignItems="flexStart" gutterSize="m">
      <EuiFlexItem>
        <EuiFlexGroup direction="column" gutterSize="m">
          {mainSections
            .filter((s) => s.show)
            .map((s) => (
              <EuiFlexItem key={s.id} grow={false}>
                {s.node}
              </EuiFlexItem>
            ))}
        </EuiFlexGroup>
      </EuiFlexItem>

      <EuiFlexItem grow={false} style={{ width: 450 }}>
        <EuiFlexGroup direction="column" gutterSize="m">
          {sidebarSections
            .filter((s) => s.show)
            .map((s) => (
              <EuiFlexItem key={s.id} grow={false}>
                {s.node}
              </EuiFlexItem>
            ))}
        </EuiFlexGroup>
      </EuiFlexItem>
    </EuiFlexGroup>
  );
}
