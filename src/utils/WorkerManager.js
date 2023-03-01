"use strict";

// Force workers to be included
// import BinaryDecoderWorker from "../workers/BinaryDecoderWorker";
import LASLAZWorker from "../workers/LASLAZWorker";
import LASDecoderWorker from "../workers/LASDecoderWorker";

/**
 * The worker manager is responsible for creating and managing worker instances.
 */
class WorkerManager {
	constructor() {
		this.workers = [];

		for (var i = 0; i < 7; i++) {
			this.workers.push([]);
		}
	}

	/**
	 * Get a worker from the pool, if none available one will be created.
	 */
	getWorker(type) {
		if (this.workers[type].length > 0) {
			return this.workers[type].pop();
		}

		switch (type) {
			case 0:
				// return new BinaryDecoderWorker();
				throw new Error('BinaryDecoderWorker not implemented');
			case 1:
				return new LASLAZWorker();
			// return new Worker(new URL('../workers/LASLAZWorker.js', import.meta.url));
			// throw new Error('LASLAZWorker not implemented');
			case 2:
				return new LASDecoderWorker();
			// return new Worker(new URL('../workers/LASDecoderWorker.js', import.meta.url));
			// throw new Error('LASDecoderWorker not implemented');
			default:
				throw "Unknown worker requested";
		};
	}

	/**
	 * Return (reinsert) the worker into the pool.
	 */
	returnWorker(type, worker) {
		this.workers[type].push(worker);
	}

	/**
	 * Run a task immediatly.
	 */
	runTask(type, onMessage, message, transfer) {
		var self = this;

		var worker = this.getWorker(type);
		worker.onmessage = function (event) {
			onMessage(event);
			self.returnWorker(type, worker);
		};

		if (transfer !== undefined) {
			worker.postMessage(message, transfer);
		}
		else {
			worker.postMessage(message);
		}
	}
};

WorkerManager.BINARY_DECODER = 0;
WorkerManager.LAS_LAZ = 1;
WorkerManager.LAS_DECODER = 2;
WorkerManager.GREYHOUND = 3;
WorkerManager.DEM = 4;
WorkerManager.EPT_LAS_ZIP_DECODER = 5;
WorkerManager.EPT_BINARY_DECODER = 6;

export { WorkerManager };
