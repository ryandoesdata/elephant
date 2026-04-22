// JSDoc types for the MemorizeIt! app

/**
 * @typedef {Object} PieceProgress
 * @property {number} totalSegmentsInitial
 * @property {number} activeSegments
 * @property {number} masteredSegments
 * @property {boolean} isComplete
 */

/**
 * @typedef {Object} Piece
 * @property {number} id
 * @property {string} title
 * @property {string} composer
 * @property {string|null} movement
 * @property {number} totalMeasures
 * @property {number} segmentSize
 * @property {PieceProgress} progress
 */

/**
 * @typedef {Object} Segment
 * @property {number} id
 * @property {number} measureStart
 * @property {number} measureEnd
 * @property {string} label
 * @property {boolean} isMastered
 * @property {number} repetitions
 * @property {number} intervalDays
 * @property {string|null} dueAt
 * @property {string|null} lastReviewedAt
 */

/**
 * @typedef {Object} SessionCard
 * @property {number} cardId
 * @property {number} segmentId
 * @property {number} measureStart
 * @property {number} measureEnd
 * @property {string} label
 * @property {boolean} isDue
 * @property {boolean} isNew
 * @property {number} repetitions
 * @property {number} intervalDays
 * @property {number} easinessFactor
 */

/**
 * @typedef {Object} SessionQueue
 * @property {SessionCard[]} cards
 * @property {number} totalDue
 * @property {number} totalNew
 */

/**
 * @typedef {Object} MergeEvent
 * @property {boolean} occurred
 * @property {{ segmentId: number, measureStart: number, measureEnd: number, label: string }|undefined} newSegment
 * @property {Array<{ segmentId: number, label: string }>|undefined} absorbedSegments
 */

/**
 * @typedef {Object} ReviewResponse
 * @property {{ cardId: number, newIntervalDays: number, easinessFactor: number, repetitions: number, dueAt: string, isMastered: boolean }} card
 * @property {MergeEvent} mergeEvent
 */
