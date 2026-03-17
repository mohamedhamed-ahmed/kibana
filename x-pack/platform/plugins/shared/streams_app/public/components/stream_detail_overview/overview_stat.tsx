/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiStat, EuiText } from '@elastic/eui';
import React from 'react';

/**
 * Shared stat display for the stream Overview page panels.
 * Renders a value + a subdued description label, with consistent formatting.
 */
export function OverviewStat({
  title,
  description,
  isLoading,
  titleSize = 's',
  dataTestSubj,
}: {
  title: React.ReactNode;
  description: string;
  isLoading: boolean;
  titleSize?: 's' | 'm';
  dataTestSubj?: string;
}) {
  return (
    <EuiStat
      title={isLoading ? '—' : <span>{title}</span>}
      description={
        <EuiText size="s" color="subdued">
          {description}
        </EuiText>
      }
      isLoading={isLoading}
      titleSize={titleSize}
      data-test-subj={dataTestSubj}
    />
  );
}
