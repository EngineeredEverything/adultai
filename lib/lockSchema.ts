declare global {
  var locks:
    | {
        queue: LockQueue;
      }
    | undefined;
}

// Interface for a queued operation
interface QueuedOperation<T> {
  keys: string[];
  operation: () => Promise<T>;
  priority: number;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  processing: boolean;
}

// Interface for the lock queue
interface LockQueue {
  operations: QueuedOperation<any>[];
  activeKeys: Set<string>;
}

// Default global locks configuration
const defaultGlobalLocks = {
  queue: {
    operations: [],
    activeKeys: new Set(),
  } as LockQueue,
};

// Initialize or get existing locks
export const locks = globalThis.locks || defaultGlobalLocks;

globalThis.locks = locks;

/**
 * Processes a single operation in the lock queue
 * @param operation The operation to process
 * @returns A promise resolving to whether the operation was processed
 */
async function processQueue(operation: QueuedOperation<any>): Promise<boolean> {
  // Mark operation keys as active
  operation.keys.forEach((opKey) => locks.queue.activeKeys.add(opKey));
  operation.processing = true;

  try {
    // Execute the operation
    const result = await operation.operation();

    // Remove the operation from the queue
    locks.queue.operations = locks.queue.operations.filter(
      (op) => op !== operation
    );

    // Resolve the promise
    operation.resolve(result);
    return true;
  } catch (error) {
    // Reject with error
    operation.reject(error instanceof Error ? error : new Error(String(error)));
    return false;
  } finally {
    // Remove active keys and reset processing flag
    operation.keys.forEach((opKey) => locks.queue.activeKeys.delete(opKey));
    operation.processing = false;
  }
}

/**
 * Continuous queue processing cycle
 */
function processQueueCycle() {
  const operation = locks.queue.operations.find((op) => {
    return (
      !op.processing &&
      !op.keys.some((opKey) =>
        Array.from(locks.queue.activeKeys).some(
          (activeKey) =>
            activeKey.startsWith(opKey) || opKey.startsWith(activeKey)
        )
      )
    );
  });

  // Exit if no unprocessed, non-conflicting operations are found
  if (!operation) return;

  // Attempt to process the operation
  processQueue(operation).then((processed) => {
    if (processed) {
      // Continue processing if successful
      processQueueCycle();
    } else {
      // Gentle retry if not processed
      setTimeout(processQueueCycle, 0);
    }
  });
}

/**
 * Lock a schema for a specific operation
 * @param keys Key or keys to lock
 * @param operation Operation to perform
 * @param priority Priority of the operation
 * @returns Promise resolving to the operation result
 */
export async function lockSchema<T>(
  keys: string | string[],
  operation: () => Promise<T>,
  priority: number = 1
): Promise<T> {
  // Normalize keys to array
  const keyArray = Array.isArray(keys) ? keys : [keys];

  return new Promise((resolve, reject) => {
    // Create queued operation
    const queuedOperation: QueuedOperation<T> = {
      keys: keyArray,
      operation,
      priority,
      resolve,
      reject,
      processing: false,
    };

    // Add to operations queue
    locks.queue.operations.push(queuedOperation);

    // Sort by priority (highest first)
    locks.queue.operations.sort((a, b) => b.priority - a.priority);

    // Trigger queue processing
    processQueueCycle();
  });
}

/**
 * Lock multiple schemas for an operation
 * @param schemas Schemas and their keys to lock
 * @param operation Operation to perform
 * @param priority Priority of the operation
 * @returns Promise resolving to the operation result
 */
export async function lockMultipleSchemas<T>(
  schemas: { schema: string; keys: string[] }[],
  operation: () => Promise<T>,
  priority: number = 1
): Promise<T> {
  // Transform schemas into fully qualified keys
  const allKeys = schemas.flatMap((schema) =>
    schema.keys.map((key) => `${schema.schema}.${key}`)
  );

  return lockSchema(allKeys, operation, priority);
}
