/** Shared location-tracking constants. */
export const TRACKING_INTERVAL_MINUTES = 5;
export const TRACKING_INTERVAL_SECONDS = TRACKING_INTERVAL_MINUTES * 60;

/**
 * Accept a ping slightly early so a browser timer that fires a few seconds
 * before the five-minute mark is not rejected.
 */
export const TRACKING_PING_TOLERANCE_SECONDS = 30;

/** Safety limit for one employee-history query. */
export const TRACKING_HISTORY_MAX_DAYS = 31;

/** Default side length of a heatmap cell on the ground. */
export const TRACKING_HEATMAP_DEFAULT_CELL_METERS = 50;
