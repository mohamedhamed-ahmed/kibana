/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { css } from '@emotion/react';
import type { UseEuiTheme } from '@elastic/eui';

/** Match the listing page granularity so counts stay consistent across the app */
export const OVERVIEW_NUM_DATA_POINTS = 25;

export const statDividerCss = (euiTheme: UseEuiTheme['euiTheme']) => css`
  border-left: ${euiTheme.border.thin};
  padding-left: ${euiTheme.size.xl};
  margin-left: ${euiTheme.size.xl};
`;
