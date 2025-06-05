/**
 * Production Queue Processor with Batching and Dead Letter Queue
 * Manages work distribution with retry logic and error recovery
 */

const { createOperationalError, ErrorTypes } = require('./error-manager');

class QueueProcessor {
  constructor(options = {}) {
    this.name = options.name || 'queue-processor';
    this.batchSize = options.batchSize || 5;
    this.maxConcurrentBatches = options.maxConcurrentBatches || 3;
    this.processingInterval = options.processingInterval || 1000; // 1 second
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 2000; // 2 seconds
    
    this.queue = [];
    this.processingQueue = [];
    this.deadLetterQueue = [];
    this.activeBatches = 0;
    this.isProcessing = false;
    this.processingInterval = null;
    
    this.stats = {
      totalItems: 0,
      processedItems: 0,
      failedItems: 0,
      retriedItems: 0,
      deadLetterItems: 0,
      averageProcessingTime: 0,
      peakQueueSize: 0,
      batchesProcessed: 0
    };

    this.setupProcessingLoop();
  }

  setupProcessingLoop() {
    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing && this.shouldProcessBatch()) {
        await this.processBatch();
      }
    }, this.processingInterval);
  }

  async add(item, priority = 0, metadata = {}) {
    const queueItem = {
      id: this.generateId(),
      data: item,
      priority,
      metadata: {
        ...metadata,
        addedAt: Date.now(),
        attempts: 0,
        lastError: null
      }
    };

    this.insertByPriority(this.queue, queueItem);
    this.stats.totalItems++;
    this.stats.peakQueueSize = Math.max(this.stats.peakQueueSize, this.queue.length);

    console.log(`📥 Added to queue: ${queueItem.id} (queue size: ${this.queue.length})`);

    // Trigger immediate processing if we have capacity
    if (!this.isProcessing && this.shouldProcessBatch()) {
      setImmediate(() => this.processBatch());
    }

    return queueItem.id;
  }

  insertByPriority(queue, item) {
    let inserted = false;
    for (let i = 0; i < queue.length; i++) {
      if (item.priority > queue[i].priority) {
        queue.splice(i, 0, item);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      queue.push(item);
    }
  }

  shouldProcessBatch() {
    return (
      this.queue.length > 0 && 
      this.activeBatches < this.maxConcurrentBatches &&
      !this.isProcessing
    );
  }

  async processBatch() {
    if (this.queue.length === 0 || this.activeBatches >= this.maxConcurrentBatches) {
      return;
    }

    this.isProcessing = true;
    this.activeBatches++;

    // Extract batch items
    const batch = this.queue.splice(0, Math.min(this.batchSize, this.queue.length));
    const batchId = this.generateId();
    const startTime = Date.now();

    console.log(`⚙️ Processing batch ${batchId} with ${batch.length} items`);

    try {
      // Move items to processing queue
      batch.forEach(item => {
        item.metadata.processingStarted = Date.now();
        this.processingQueue.push(item);
      });

      // Process items concurrently within the batch
      const results = await Promise.allSettled(
        batch.map(item => this.processItem(item))
      );

      // Handle results
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const item = batch[i];
        
        // Remove from processing queue
        const processingIndex = this.processingQueue.indexOf(item);
        if (processingIndex !== -1) {
          this.processingQueue.splice(processingIndex, 1);
        }

        if (result.status === 'fulfilled') {
          this.handleSuccess(item, result.value);
        } else {
          await this.handleFailure(item, result.reason);
        }
      }

      const duration = Date.now() - startTime;
      this.updateProcessingTimeStats(duration);
      this.stats.batchesProcessed++;

      console.log(`✅ Completed batch ${batchId} in ${duration}ms`);

    } catch (error) {
      console.error(`❌ Batch ${batchId} failed:`, error);
      
      // Return items to queue for retry
      batch.forEach(item => {
        this.queue.unshift(item);
      });
    } finally {
      this.activeBatches--;
      this.isProcessing = false;
    }
  }

  async processItem(item) {
    // This method should be overridden by subclasses
    throw new Error('processItem method must be implemented by subclass');
  }

  handleSuccess(item, result) {
    this.stats.processedItems++;
    const processingTime = Date.now() - item.metadata.processingStarted;
    
    console.log(`✅ Processed item ${item.id} in ${processingTime}ms`);
    
    // Emit success event for monitoring
    this.emit('itemProcessed', { item, result, processingTime });
  }

  async handleFailure(item, error) {
    item.metadata.attempts++;
    item.metadata.lastError = error.message;
    
    console.warn(`❌ Item ${item.id} failed (attempt ${item.metadata.attempts}/${this.maxRetries}): ${error.message}`);

    if (item.metadata.attempts < this.maxRetries && this.shouldRetry(error)) {
      // Retry the item
      this.stats.retriedItems++;
      
      // Add delay before retry
      setTimeout(() => {
        this.insertByPriority(this.queue, item);
        console.log(`🔄 Retrying item ${item.id} after ${this.retryDelay}ms`);
      }, this.retryDelay * item.metadata.attempts); // Exponential backoff
      
    } else {
      // Move to dead letter queue
      this.moveToDeadLetterQueue(item, error);
    }
  }

  shouldRetry(error) {
    // Don't retry certain types of errors
    if (error.name === ErrorTypes.VALIDATION_ERROR || 
        error.name === ErrorTypes.AUTH_ERROR ||
        error.name === ErrorTypes.PARSING_ERROR) {
      return false;
    }

    // Retry network errors, timeouts, and rate limits
    return [
      ErrorTypes.NETWORK_ERROR,
      ErrorTypes.TIMEOUT_ERROR,
      ErrorTypes.RATE_LIMIT_ERROR,
      ErrorTypes.CIRCUIT_BREAKER_OPEN
    ].includes(error.name);
  }

  moveToDeadLetterQueue(item, error) {
    this.stats.failedItems++;
    this.stats.deadLetterItems++;
    
    item.metadata.failedAt = Date.now();
    item.metadata.finalError = error.message;
    
    this.deadLetterQueue.push(item);
    
    console.error(`💀 Item ${item.id} moved to dead letter queue: ${error.message}`);
    
    // Emit failure event for monitoring
    this.emit('itemFailed', { item, error });
  }

  updateProcessingTimeStats(batchTime) {
    if (this.stats.batchesProcessed === 0) {
      this.stats.averageProcessingTime = batchTime;
    } else {
      // Rolling average
      this.stats.averageProcessingTime = 
        (this.stats.averageProcessingTime * 0.9) + (batchTime * 0.1);
    }
  }

  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Event emitter methods (simplified)
  emit(event, data) {
    // In a full implementation, this would be a proper EventEmitter
    console.log(`📡 Event: ${event}`, JSON.stringify(data, null, 2));
  }

  getStats() {
    const successRate = this.stats.totalItems > 0 ? 
      (this.stats.processedItems / this.stats.totalItems) * 100 : 100;

    return {
      processor: this.name,
      successRate: successRate.toFixed(1),
      queueSize: this.queue.length,
      processingQueueSize: this.processingQueue.length,
      deadLetterQueueSize: this.deadLetterQueue.length,
      activeBatches: this.activeBatches,
      averageProcessingTime: Math.round(this.stats.averageProcessingTime),
      ...this.stats
    };
  }

  async getQueueItems(queueType = 'main', limit = 10) {
    let queue;
    switch (queueType) {
      case 'main':
        queue = this.queue;
        break;
      case 'processing':
        queue = this.processingQueue;
        break;
      case 'dead':
        queue = this.deadLetterQueue;
        break;
      default:
        throw new Error(`Unknown queue type: ${queueType}`);
    }

    return queue.slice(0, limit).map(item => ({
      id: item.id,
      priority: item.priority,
      attempts: item.metadata.attempts,
      addedAt: new Date(item.metadata.addedAt).toISOString(),
      lastError: item.metadata.lastError
    }));
  }

  async reprocessDeadLetterItem(itemId) {
    const itemIndex = this.deadLetterQueue.findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      throw new Error(`Item ${itemId} not found in dead letter queue`);
    }

    const item = this.deadLetterQueue.splice(itemIndex, 1)[0];
    
    // Reset metadata
    item.metadata.attempts = 0;
    item.metadata.lastError = null;
    item.metadata.failedAt = null;
    item.metadata.finalError = null;

    this.insertByPriority(this.queue, item);
    this.stats.deadLetterItems--;

    console.log(`🔄 Reprocessing dead letter item ${itemId}`);
  }

  async pause() {
    console.log(`⏸️ Pausing queue processor ${this.name}`);
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  async resume() {
    console.log(`▶️ Resuming queue processor ${this.name}`);
    if (!this.processingInterval) {
      this.setupProcessingLoop();
    }
  }

  async drain() {
    console.log(`🔄 Draining queue processor ${this.name}`);
    
    // Wait for all active batches to complete
    while (this.activeBatches > 0 || this.processingQueue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Process remaining items in queue
    while (this.queue.length > 0 && this.activeBatches < this.maxConcurrentBatches) {
      await this.processBatch();
    }

    console.log(`✅ Queue processor ${this.name} drained`);
  }

  async destroy() {
    console.log(`🛑 Destroying queue processor ${this.name}`);
    
    await this.pause();
    
    // Clear all queues
    this.queue.length = 0;
    this.processingQueue.length = 0;
    
    console.log(`✅ Queue processor ${this.name} destroyed`);
  }
}

module.exports = { QueueProcessor };