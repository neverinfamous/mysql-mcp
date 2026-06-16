import { z } from "zod";
import { BaseOutputSchema } from "./output-schemas.js";

// =============================================================================
// Descriptive Stats Output Schemas
// =============================================================================

export const DescriptiveStatsOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    column: z.string(),
    count: z.number(),
    mean: z.number().nullish(),
    median: z.number().nullish(),
    stddev: z.number().nullish(),
    variance: z.number().nullish(),
    min: z.number().nullish(),
    max: z.number().nullish(),
    range: z.number().nullish(),
    sum: z.number().nullish(),
  }).loose().optional(),
});

export const PercentilesOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    column: z.string(),
    percentiles: z.record(z.string(), z.union([z.number(), z.string()]).nullish()),
  }).loose().optional(),
});

export const DistributionOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    column: z.string(),
    skewness: z.number().nullish(),
    kurtosis: z.number().nullish(),
  }).loose().optional(),
});

export const TimeSeriesOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    timeColumn: z.string(),
    valueColumn: z.string(),
    data: z.array(
      z.object({
        period: z.string(),
        value: z.number().nullish(),
      })
    ).optional(),
  }).loose().optional(),
});

export const SampleOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    table: z.string().optional(),
    sampleSize: z.number().optional(),
    sample: z.array(z.record(z.string(), z.unknown())),
  }).loose().optional(),
});

// =============================================================================
// Comparative Stats Output Schemas
// =============================================================================

export const CorrelationOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    columnX: z.string().optional(),
    columnY: z.string().optional(),
    correlation: z.number().nullish(),
  }).loose().optional(),
});

export const RegressionOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    columnX: z.string().optional(),
    columnY: z.string().optional(),
    slope: z.number().nullish(),
    intercept: z.number().nullish(),
    rSquared: z.number().nullish(),
  }).loose().optional(),
});

export const HistogramOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    column: z.string(),
    buckets: z.array(
      z.object({
        bucket: z.number(),
        min: z.number(),
        max: z.number(),
        count: z.number(),
      })
    ).optional(),
    min: z.number().nullish(),
    max: z.number().nullish(),
    bucketWidth: z.number().nullish(),
  }).loose().optional(),
});

// =============================================================================
// Window Functions Output Schemas
// =============================================================================

export const WindowFunctionOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    rows: z.array(z.record(z.string(), z.unknown())),
  }).loose().optional(),
});

// =============================================================================
// Hypothesis Testing Output Schemas
// =============================================================================

export const TTestOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    column: z.string(),
    testType: z.string().optional(),
    hypothesizedMean: z.number().optional(),
    groupColumn: z.string().optional(),
    group1: z.union([z.string(), z.number()]).optional(),
    group2: z.union([z.string(), z.number()]).optional(),
    tStat: z.number().nullish(),
    degreesOfFreedom: z.number().nullish(),
    pValue: z.number().nullish(),
    isSignificant: z.boolean().optional(),
    results: z.record(z.string(), z.unknown()).optional(),
  }).loose().optional(),
});

// =============================================================================
// Outliers Output Schemas
// =============================================================================

export const OutliersOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    column: z.string(),
    method: z.string(),
    outlierCount: z.number(),
    totalCount: z.number(),
    outliers: z.array(z.record(z.string(), z.unknown())),
  }).loose().optional(),
});

// =============================================================================
// Advanced Stats Output Schemas
// =============================================================================

export const TopNOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    column: z.string(),
    topN: z.array(z.record(z.string(), z.unknown())).optional(),
    groups: z.array(z.record(z.string(), z.unknown())).optional(),
  }).loose().optional(),
});

export const DistinctOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    column: z.string(),
    count: z.number(),
    topValues: z.array(z.record(z.string(), z.unknown())).optional(),
  }).loose().optional(),
});

export const FrequencyOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    column: z.string(),
    distribution: z.array(
      z.object({
        value: z.unknown(),
        frequency: z.number(),
        percentage: z.number(),
      })
    ),
  }).loose().optional(),
});

export const SummaryOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    table: z.string(),
    summaries: z.array(z.record(z.string(), z.unknown())),
  }).loose().optional(),
});
