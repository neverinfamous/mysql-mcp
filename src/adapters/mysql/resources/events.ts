/**
 * MySQL Resource - Events
 */
import type { MySQLAdapter } from '../MySQLAdapter.js';
import type { ResourceDefinition, RequestContext } from '../../../types/index.js';

export function createEventsResource(adapter: MySQLAdapter): ResourceDefinition {
    return {
        uri: 'mysql://events',
        name: 'Scheduled Events',
        title: 'MySQL Scheduled Events',
        description: 'Event Scheduler status and scheduled events overview',
        mimeType: 'application/json',
        annotations: {
            audience: ['user', 'assistant'],
            priority: 0.6
        },
        handler: async (_uri: string, _context: RequestContext) => {
            // Get scheduler status
            const schedulerResult = await adapter.executeQuery(
                "SHOW VARIABLES LIKE 'event_scheduler'"
            );
            const schedulerRow = schedulerResult.rows?.[0];
            const schedulerVal = schedulerRow?.['Value'];
            const schedulerStatus = typeof schedulerVal === 'string' ? schedulerVal : 'OFF';

            // Get all events
            const eventsResult = await adapter.executeQuery(`
                SELECT 
                    EVENT_SCHEMA as schema_name,
                    EVENT_NAME as name,
                    EVENT_TYPE as type,
                    STATUS as status,
                    EXECUTE_AT as execute_at,
                    INTERVAL_VALUE as interval_value,
                    INTERVAL_FIELD as interval_field,
                    LAST_EXECUTED as last_executed
                FROM information_schema.EVENTS
                ORDER BY EVENT_SCHEMA, EVENT_NAME
            `);

            return {
                schedulerEnabled: schedulerStatus === 'ON',
                schedulerStatus,
                eventCount: eventsResult.rows?.length ?? 0,
                events: eventsResult.rows ?? []
            };
        }
    };
}
