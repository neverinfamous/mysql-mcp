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
    totalCount: z.number().optional(),
    percentiles: z.record(z.string(), z.union([z.number(), z.string()]).nullish()),
  }).loose().optional(),
});

export const DistributionOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    column: z.string(),
    distribution: z.array(
      z.object({
        bucket: z.number(),
        rangeStart: z.number(),
        rangeEnd: z.number(),
        count: z.number(),
        bucketMin: z.union([z.number(), z.string()]).nullish(),
        bucketMax: z.union([z.number(), z.string()]).nullish(),
      }).loose()
    ).optional(),
    bucketCount: z.number().optional(),
    bucketSize: z.number().optional(),
    minValue: z.number().optional(),
    maxValue: z.number().optional(),
    skewness: z.number().nullish(),
    kurtosis: z.number().nullish(),
  }).loose().optional(),
});

export const TimeSeriesOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    timeColumn: z.string(),
    valueColumn: z.string(),
    interval: z.string().optional(),
    aggregation: z.string().optional(),
    count: z.number().optional(),
    dataPoints: z.array(
      z.object({
        period: z.string(),
        value: z.union([z.number(), z.string()]).nullish(),
      }).loose()
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
    column1: z.string().optional(),
    column2: z.string().optional(),
    correlation: z.number().nullish(),
    interpretation: z.string().optional(),
    sampleSize: z.number().optional(),
    column1Stats: z.object({
      mean: z.union([z.number(), z.string()]).nullish(),
      stddev: z.union([z.number(), z.string()]).nullish(),
    }).loose().optional(),
    column2Stats: z.object({
      mean: z.union([z.number(), z.string()]).nullish(),
      stddev: z.union([z.number(), z.string()]).nullish(),
    }).loose().optional(),
  }).loose().optional(),
});

export const RegressionOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    xColumn: z.string().optional(),
    yColumn: z.string().optional(),
    sampleSize: z.number().optional(),
    slope: z.number().nullish(),
    intercept: z.number().nullish(),
    rSquared: z.number().nullish(),
    equation: z.string().nullish(),
    interpretation: z.string().optional(),
  }).loose().optional(),
});

export const HistogramOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    exists: z.boolean(),
    table: z.string().optional(),
    column: z.string().optional(),
    schemaName: z.string().optional(),
    tableName: z.string().optional(),
    columnName: z.string().optional(),
    histogramType: z.string().optional(),
    bucketsSpecified: z.number().nullish(),
    samplingRate: z.number().nullish(),
    lastUpdated: z.string().optional(),
    actualBuckets: z.number().nullish(),
    updated: z.boolean().optional(),
    warning: z.string().optional(),
    hint: z.string().optional(),
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
    table: z.string().optional(),
    column: z.string(),
    testType: z.string().optional(),
    hypothesizedMean: z.number().optional(),
    groupColumn: z.string().optional(),
    group1: z.union([z.string(), z.number()]).optional(),
    group2: z.union([z.string(), z.number()]).optional(),
    groupBy: z.string().optional(),
    groups: z.array(z.record(z.string(), z.unknown())).optional(),
    count: z.number().optional(),
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
    stats: z.record(z.string(), z.unknown()).optional(),
    outlierCount: z.number(),
    totalCount: z.number(),
    outliers: z.array(z.record(z.string(), z.unknown())),
    truncated: z.boolean().optional(),
    totalOutliers: z.number().optional(),
  }).loose().optional(),
});

// =============================================================================
// Advanced Stats Output Schemas
// =============================================================================

export const TopNOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    column: z.string(),
    direction: z.string().optional(),
    count: z.number().optional(),
    rows: z.array(z.record(z.string(), z.unknown())).optional(),
    hint: z.string().optional(),
  }).loose().optional(),
});

export const DistinctOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    column: z.string(),
    count: z.number(),
    values: z.array(z.unknown()).optional(),
  }).loose().optional(),
});

export const FrequencyOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    column: z.string(),
    distinctValues: z.number().optional(),
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
