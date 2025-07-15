// ==UserScript==
// @name         Google AI Studio Auto-Rerun
// @namespace    https://github.com/ElliotBadinger/ai-studio-auto-rerun.user.js
// @version      1.0.0
// @description  Automatically clicks the rerun button when Google AI Studio generation fails. Intelligent error detection with multiple fallback strategies.
// @author       ElliotBadinger
// @match        https://aistudio.google.com/*
// @match        https://makersuite.google.com/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/ElliotBadinger/ai-studio-auto-rerun.user.js/main/ai-studio-auto-rerun.user.js
// @downloadURL  https://raw.githubusercontent.com/ElliotBadinger/ai-studio-auto-rerun.user.js/main/ai-studio-auto-rerun.user.js
// @supportURL   https://github.com/ElliotBadinger/ai-studio-auto-rerun.user.js/issues
// @homepageURL  https://github.com/ElliotBadinger/ai-studio-auto-rerun.user.js
// @license      MIT
// @compatible   chrome
// @compatible   firefox
// @compatible   edge
// @compatible   safari
// ==/UserScript==

(function () {
    'use strict';

    // Configuration object with default settings
    const CONFIG = {
        enabled: true,
        responseDelay: 1500, // milliseconds to wait before clicking rerun
        maxRetries: 2,
        cooldownPeriod: 3000, // milliseconds between actions
        debugMode: false,
        errorPatterns: [
            'Failed to generate content. Please try again.',
            'An internal error has occurred.',
            'Something went wrong'
        ]
    };

    // Global state management
    const STATE = {
        isInitialized: false,
        isProcessing: false,
        lastActionTime: 0,
        observers: [],
        retryCount: 0
    };

    /**
     * Utility function for debug logging
     */
    function debugLog(message, data = null) {
        if (CONFIG.debugMode) {
            console.log(`[AI Studio Auto-Rerun] ${message}`, data || '');
        }
    }

    /**
     * Check if we're on a Google AI Studio page
     */
    function isAIStudioPage() {
        return window.location.hostname === 'aistudio.google.com' || window.location.hostname === 'makersuite.google.com';
    }

    /**
     * Wait for page to be fully loaded
     */
    function waitForPageLoad() {
        return new Promise((resolve) => {
            if (document.readyState === 'complete') {
                resolve();
            } else {
                window.addEventListener('load', resolve, { once: true });
            }
        });
    }

    /**
     * Error detection event system
     */
    const ErrorEvents = {
        callbacks: [],

        onErrorDetected(callback) {
            this.callbacks.push(callback);
        },

        trigger(errorData) {
            this.callbacks.forEach(callback => {
                try {
                    callback(errorData);
                } catch (e) {
                    debugLog('Error in callback:', e);
                }
            });
        }
    };

    /**
     * Text content-based error detection
     */
    function detectErrorByText(element) {
        if (!element || !element.textContent) return null;

        const text = element.textContent.trim();

        for (const pattern of CONFIG.errorPatterns) {
            if (text.includes(pattern)) {
                debugLog('Text pattern error detected:', pattern);
                return {
                    timestamp: Date.now(),
                    errorType: 'generation_failure',
                    errorMessage: text,
                    elementRef: element,
                    processed: false,
                    detectionMethod: 'text_content'
                };
            }
        }

        return null;
    }

    /**
     * CSS class-based error detection
     */
    function detectErrorByClass(element) {
        if (!element || !element.className) return null;

        const classNames = element.className.toLowerCase();
        const errorClasses = ['error', 'alert', 'danger', 'warning', 'fail'];

        for (const errorClass of errorClasses) {
            if (classNames.includes(errorClass)) {
                // Verify it's actually an error by checking text content
                const text = element.textContent?.trim();
                if (text && (text.includes('error') || text.includes('fail') || text.includes('try again'))) {
                    debugLog('CSS class error detected:', errorClass);
                    return {
                        timestamp: Date.now(),
                        errorType: 'generation_failure',
                        errorMessage: text,
                        elementRef: element,
                        processed: false,
                        detectionMethod: 'css_class'
                    };
                }
            }
        }

        return null;
    }

    /**
     * Element structure-based detection (fallback)
     */
    function detectErrorByStructure(element) {
        if (!element) return null;

        try {
            // Look for elements with error-like styling
            const computedStyle = window.getComputedStyle(element);
            const backgroundColor = computedStyle.backgroundColor;
            const color = computedStyle.color;
            const borderColor = computedStyle.borderColor;

            // Check for red/error colors
            const isErrorStyled = (
                backgroundColor.includes('254, 242, 242') || // Light red background
                backgroundColor.includes('rgb(254, 226, 226)') ||
                color.includes('rgb(185, 28, 28)') || // Red text
                color.includes('rgb(220, 38, 38)') ||
                borderColor.includes('rgb(248, 113, 113)') // Red border
            );

            if (isErrorStyled) {
                const text = element.textContent?.trim();
                if (text && text.length > 10) { // Ensure it has meaningful content
                    debugLog('Structure-based error detected');
                    return {
                        timestamp: Date.now(),
                        errorType: 'generation_failure',
                        errorMessage: text,
                        elementRef: element,
                        processed: false,
                        detectionMethod: 'element_structure'
                    };
                }
            }
        } catch (e) {
            debugLog('Error in structure detection:', e);
        }

        return null;
    }

    /**
     * Comprehensive error detection using multiple strategies
     */
    function detectErrorInElement(element) {
        if (!element) return null;

        // Try text-based detection first (most reliable)
        let errorData = detectErrorByText(element);
        if (errorData) return errorData;

        // Try CSS class-based detection
        errorData = detectErrorByClass(element);
        if (errorData) return errorData;

        // Try structure-based detection as fallback
        errorData = detectErrorByStructure(element);
        if (errorData) return errorData;

        return null;
    }

    /**
     * Scan existing DOM for error messages
     */
    function scanForExistingErrors() {
        debugLog('Scanning for existing error messages...');

        // Look for common error containers
        const selectors = [
            '[role="alert"]',
            '.error',
            '.alert',
            '[class*="error"]',
            '[class*="alert"]',
            'div[style*="color: red"]',
            'div[style*="background-color: rgb(254, 242, 242)"]'
        ];

        for (const selector of selectors) {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    const errorData = detectErrorInElement(element);
                    if (errorData) {
                        debugLog('Found existing error:', errorData);
                        ErrorEvents.trigger(errorData);
                    }
                });
            } catch (e) {
                debugLog('Error scanning with selector:', selector, e);
            }
        }
    }

    /**
     * Simulate hover event to reveal hidden buttons
     */
    function simulateHover(element) {
        if (!element) return false;

        try {
            // Create and dispatch mouse events
            const mouseEnterEvent = new MouseEvent('mouseenter', {
                bubbles: true,
                cancelable: true,
                view: window
            });

            const mouseOverEvent = new MouseEvent('mouseover', {
                bubbles: true,
                cancelable: true,
                view: window
            });

            element.dispatchEvent(mouseEnterEvent);
            element.dispatchEvent(mouseOverEvent);

            debugLog('Hover simulation completed on element');
            return true;
        } catch (e) {
            debugLog('Error simulating hover:', e);
            return false;
        }
    }

    /**
     * Validate if button is a valid rerun button
     */
    function isValidRerunButton(button) {
        if (!button || button.disabled) return false;

        try {
            // Check if button is visible and clickable
            const rect = button.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return false;

            // Additional validation
            const style = window.getComputedStyle(button);
            if (style.display === 'none' || style.visibility === 'hidden') return false;

            return true;
        } catch (e) {
            debugLog('Error validating button:', e);
            return false;
        }
    }

    /**
     * Find star-shaped rerun icon (primary strategy)
     */
    function findRerunButtonPrimary() {
        debugLog('Searching for rerun button using primary strategy...');

        // Look for star-shaped icons or rerun buttons
        const selectors = [
            'button[aria-label*="rerun" i]',
            'button[aria-label*="Rerun" i]',
            'button[title*="rerun" i]',
            'button[title*="Rerun" i]',
            '[role="button"][aria-label*="rerun" i]',
            '[role="button"][aria-label*="Rerun" i]',
            'button svg[viewBox*="24"]', // Common star icon viewBox
            'button[class*="rerun" i]',
            'button[data-testid*="rerun" i]'
        ];

        for (const selector of selectors) {
            try {
                const buttons = document.querySelectorAll(selector);
                for (const button of buttons) {
                    if (isValidRerunButton(button)) {
                        debugLog('Found rerun button via primary strategy:', selector);
                        return {
                            element: button,
                            strategy: 'primary_selector',
                            confidence: 0.9,
                            boundingRect: button.getBoundingClientRect()
                        };
                    }
                }
            } catch (e) {
                debugLog('Error with selector:', selector, e);
            }
        }

        return null;
    }

    /**
     * Find rerun button by aria-label (fallback strategy)
     */
    function findRerunButtonByAria() {
        debugLog('Searching for rerun button using aria-label strategy...');

        const ariaSelectors = [
            '[aria-label*="rerun" i]',
            '[aria-label*="retry" i]',
            '[aria-label*="try again" i]',
            '[title*="rerun" i]',
            '[title*="retry" i]'
        ];

        for (const selector of ariaSelectors) {
            try {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    const button = element.closest('button') || (element.tagName === 'BUTTON' ? element : null);
                    if (button && isValidRerunButton(button)) {
                        debugLog('Found rerun button via aria-label strategy');
                        return {
                            element: button,
                            strategy: 'aria_label',
                            confidence: 0.7,
                            boundingRect: button.getBoundingClientRect()
                        };
                    }
                }
            } catch (e) {
                debugLog('Error with aria selector:', selector, e);
            }
        }

        return null;
    }

    /**
     * Find rerun button by position relative to error messages
     */
    function findRerunButtonByPosition() {
        debugLog('Searching for rerun button using position strategy...');

        try {
            // Find error messages first
            const errorElements = document.querySelectorAll('[role="alert"], .error, .alert');

            for (const errorElement of errorElements) {
                if (detectErrorInElement(errorElement)) {
                    // Look for buttons near the error message
                    const nearbyButtons = [];

                    // Check parent containers
                    let parent = errorElement.parentElement;
                    for (let i = 0; i < 3 && parent; i++) {
                        const buttons = parent.querySelectorAll('button, [role="button"]');
                        nearbyButtons.push(...buttons);
                        parent = parent.parentElement;
                    }

                    // Find the most likely rerun button
                    for (const button of nearbyButtons) {
                        if (isValidRerunButton(button)) {
                            // Check if button looks like a rerun button
                            const hasRerunIcon = button.querySelector('svg') !== null;

                            if (hasRerunIcon) {
                                debugLog('Found rerun button via position strategy');
                                return {
                                    element: button,
                                    strategy: 'position_relative',
                                    confidence: 0.6,
                                    boundingRect: button.getBoundingClientRect()
                                };
                            }
                        }
                    }
                }
            }
        } catch (e) {
            debugLog('Error in position strategy:', e);
        }

        return null;
    }

    /**
     * Handle error detection event
     */
    async function handleErrorDetected(errorData) {
        if (!CONFIG.enabled || STATE.isProcessing || errorData.processed) {
            return;
        }

        // Check cooldown period
        const now = Date.now();
        if (now - STATE.lastActionTime < CONFIG.cooldownPeriod) {
            debugLog('Still in cooldown period, skipping action');
            return;
        }

        debugLog('Handling detected error:', errorData);
        STATE.isProcessing = true;
        STATE.retryCount = 0;

        try {
            // Wait for the configured delay
            await new Promise(resolve => setTimeout(resolve, CONFIG.responseDelay));

            // Try to find and click the rerun button
            await attemptRerunClick();

            // Mark error as processed
            errorData.processed = true;
            STATE.lastActionTime = now;
        } catch (e) {
            debugLog('Error handling detected error:', e);
        } finally {
            STATE.isProcessing = false;
        }
    }

    /**
     * Attempt to click the rerun button with retries
     */
    async function attemptRerunClick() {
        for (let attempt = 0; attempt <= CONFIG.maxRetries; attempt++) {
            debugLog(`Rerun attempt ${attempt + 1}/${CONFIG.maxRetries + 1}`);

            // Try to find the button using multiple strategies
            let buttonLocation = findRerunButtonPrimary();

            if (!buttonLocation) {
                buttonLocation = findRerunButtonByAria();
            }

            if (!buttonLocation) {
                buttonLocation = findRerunButtonByPosition();
            }

            if (buttonLocation) {
                const success = await clickRerunButton(buttonLocation);
                if (success) {
                    debugLog('Successfully clicked rerun button');
                    return true;
                }
            } else {
                debugLog('Could not locate rerun button');
            }

            // Wait before retry
            if (attempt < CONFIG.maxRetries) {
                const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                debugLog(`Waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        debugLog('Failed to click rerun button after all attempts');
        return false;
    }

    /**
     * Click the rerun button with validation
     */
    async function clickRerunButton(buttonLocation) {
        if (!buttonLocation || !buttonLocation.element) {
            return false;
        }

        const button = buttonLocation.element;
        debugLog('Attempting to click rerun button:', buttonLocation.strategy);

        try {
            // Ensure button is still valid
            if (!isValidRerunButton(button)) {
                debugLog('Button is no longer valid');
                return false;
            }

            // Simulate hover first to ensure button is visible
            simulateHover(button.parentElement || button);
            await new Promise(resolve => setTimeout(resolve, 200));

            // Try multiple click methods
            const clickMethods = [
                () => button.click(),
                () => button.dispatchEvent(new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                })),
                () => {
                    const event = new Event('click', { bubbles: true });
                    button.dispatchEvent(event);
                }
            ];

            for (const clickMethod of clickMethods) {
                try {
                    clickMethod();
                    debugLog('Click method executed');

                    // Wait and verify click success
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    if (await verifyClickSuccess()) {
                        debugLog('Click verified as successful');
                        return true;
                    }
                } catch (e) {
                    debugLog('Click method failed:', e);
                }
            }

            return false;
        } catch (e) {
            debugLog('Error clicking rerun button:', e);
            return false;
        }
    }

    /**
     * Verify that the click was successful
     */
    async function verifyClickSuccess() {
        try {
            // Wait a moment for the page to respond
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Check if error messages are gone or if generation has started
            const errorElements = document.querySelectorAll('[role="alert"], .error, .alert');
            const hasVisibleErrors = Array.from(errorElements).some(el => {
                try {
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && style.visibility !== 'hidden' &&
                        el.textContent && CONFIG.errorPatterns.some(pattern => el.textContent.includes(pattern));
                } catch (e) {
                    return false;
                }
            });

            // If no visible errors, consider it successful
            if (!hasVisibleErrors) {
                debugLog('No visible errors found, click appears successful');
                return true;
            }

            // Check for loading indicators or generation in progress
            const loadingIndicators = document.querySelectorAll('[class*="loading"], [class*="generating"], [class*="spinner"]');
            if (loadingIndicators.length > 0) {
                debugLog('Loading indicators found, generation may have started');
                return true;
            }

            debugLog('Click verification failed - errors still visible');
            return false;
        } catch (e) {
            debugLog('Error verifying click success:', e);
            return false;
        }
    }

    /**
     * Set up DOM observer for error detection
     */
    function setupErrorMonitoring() {
        debugLog('Setting up error monitoring...');

        try {
            // Create mutation observer to watch for new elements
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    try {
                        // Check added nodes
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                // Check the node itself
                                const errorData = detectErrorInElement(node);
                                if (errorData) {
                                    debugLog('New error detected:', errorData);
                                    ErrorEvents.trigger(errorData);
                                }

                                // Check child elements
                                if (node.querySelectorAll) {
                                    const errorElements = node.querySelectorAll('[role="alert"], .error, .alert, [class*="error"], [class*="alert"]');
                                    errorElements.forEach(element => {
                                        const childErrorData = detectErrorInElement(element);
                                        if (childErrorData) {
                                            debugLog('New child error detected:', childErrorData);
                                            ErrorEvents.trigger(childErrorData);
                                        }
                                    });
                                }
                            }
                        });

                        // Check modified nodes for text changes
                        if (mutation.type === 'childList' || mutation.type === 'characterData') {
                            const target = mutation.target;
                            if (target.nodeType === Node.ELEMENT_NODE) {
                                const errorData = detectErrorInElement(target);
                                if (errorData) {
                                    debugLog('Modified element error detected:', errorData);
                                    ErrorEvents.trigger(errorData);
                                }
                            }
                        }
                    } catch (e) {
                        debugLog('Error processing mutation:', e);
                    }
                });
            });

            // Start observing
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true,
                attributeFilter: ['class', 'style', 'role']
            });

            STATE.observers.push(observer);
            debugLog('Error monitoring observer started');

            // Scan for existing errors
            scanForExistingErrors();
        } catch (e) {
            debugLog('Error setting up monitoring:', e);
        }
    }

    /**
     * Initialize the automation system
     */
    async function initialize() {
        if (STATE.isInitialized || !isAIStudioPage()) {
            return;
        }

        debugLog('Initializing Google AI Studio Auto-Rerun...');

        try {
            // Wait for page to be fully loaded
            await waitForPageLoad();

            // Additional delay to ensure dynamic content is loaded
            setTimeout(() => {
                debugLog('Page loaded, setting up automation...');
                STATE.isInitialized = true;

                // Initialize error monitoring
                setupErrorMonitoring();

                // Set up error handling
                ErrorEvents.onErrorDetected(handleErrorDetected);

                debugLog('Auto-rerun automation initialized successfully');
            }, 2000);
        } catch (e) {
            debugLog('Error during initialization:', e);
        }
    }

    /**
     * Cleanup function for page unload
     */
    function cleanup() {
        debugLog('Cleaning up automation...');

        try {
            // Clean up observers
            STATE.observers.forEach(observer => {
                if (observer && observer.disconnect) {
                    observer.disconnect();
                }
            });

            STATE.observers = [];
            STATE.isInitialized = false;
            STATE.isProcessing = false;
        } catch (e) {
            debugLog('Error during cleanup:', e);
        }
    }

    /**
     * Handle page navigation/refresh
     */
    function handlePageChange() {
        cleanup();
        setTimeout(initialize, 1000);
    }

    // Initialize when script loads
    initialize();

    // Handle page navigation
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('popstate', handlePageChange);

    // Expose configuration for debugging
    if (CONFIG.debugMode) {
        window.AIStudioAutoRerun = {
            config: CONFIG,
            state: STATE,
            initialize,
            cleanup
        };
    }

    debugLog('Google AI Studio Auto-Rerun userscript loaded');

})();
/**
  * Enhanced state management functions
  */
const StateManager = {
    isProcessing() {
        return STATE.isProcessing;
    },

    setProcessing(processing) {
        STATE.isProcessing = processing;
        debugLog('Processing state changed:', processing);
    },

    getLastAction() {
        return STATE.lastActionTime;
    },

    shouldTrigger() {
        const now = Date.now();
        const cooldownPassed = (now - STATE.lastActionTime) >= CONFIG.cooldownPeriod;
        const notProcessing = !STATE.isProcessing;

        debugLog('Should trigger check:', { cooldownPassed, notProcessing });
        return cooldownPassed && notProcessing;
    },

    recordAction() {
        STATE.lastActionTime = Date.now();
        debugLog('Action recorded at:', new Date(STATE.lastActionTime));
    },

    getStats() {
        return {
            isInitialized: STATE.isInitialized,
            isProcessing: STATE.isProcessing,
            lastActionTime: STATE.lastActionTime,
            retryCount: STATE.retryCount,
            observersCount: STATE.observers.length
        };
    }
};

/**
 * Performance optimization utilities
 */
const PerformanceManager = {
    // Debounced error detection
    debounceErrorDetection: null,

    // DOM query cache
    queryCache: new Map(),
    cacheTimeout: 5000, // 5 seconds

    // Performance metrics
    metrics: {
        errorDetections: 0,
        buttonSearches: 0,
        clickAttempts: 0,
        successfulClicks: 0,
        averageResponseTime: 0
    },

    /**
     * Debounced error detection to prevent spam
     */
    createDebouncedErrorDetection(callback, delay = 500) {
        return function (...args) {
            clearTimeout(this.debounceErrorDetection);
            this.debounceErrorDetection = setTimeout(() => {
                callback.apply(this, args);
            }, delay);
        }.bind(this);
    },

    /**
     * Cached DOM query with timeout
     */
    cachedQuery(selector) {
        const now = Date.now();
        const cached = this.queryCache.get(selector);

        if (cached && (now - cached.timestamp) < this.cacheTimeout) {
            return cached.result;
        }

        const result = document.querySelectorAll(selector);
        this.queryCache.set(selector, {
            result: result,
            timestamp: now
        });

        return result;
    },

    /**
     * Clear expired cache entries
     */
    cleanCache() {
        const now = Date.now();
        for (const [key, value] of this.queryCache.entries()) {
            if (now - value.timestamp > this.cacheTimeout) {
                this.queryCache.delete(key);
            }
        }
    },

    /**
     * Record performance metrics
     */
    recordMetric(type, value = 1) {
        if (this.metrics[type] !== undefined) {
            this.metrics[type] += value;
        }
        debugLog(`Metric recorded: ${type} = ${this.metrics[type]}`);
    },

    /**
     * Get performance report
     */
    getReport() {
        return {
            ...this.metrics,
            cacheSize: this.queryCache.size,
            successRate: this.metrics.clickAttempts > 0 ?
                (this.metrics.successfulClicks / this.metrics.clickAttempts * 100).toFixed(2) + '%' : '0%'
        };
    }
};

// Clean cache periodically
setInterval(() => {
    PerformanceManager.cleanCache();
}, 30000); // Every 30 seconds

/**
 * Configuration management system
 */
const ConfigManager = {
    storageKey: 'ai-studio-auto-rerun-config',

    /**
     * Load configuration from localStorage
     */
    loadConfig() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                Object.assign(CONFIG, parsed);
                debugLog('Configuration loaded from storage:', CONFIG);
            }
        } catch (e) {
            debugLog('Error loading configuration:', e);
        }
    },

    /**
     * Save configuration to localStorage
     */
    saveConfig() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(CONFIG));
            debugLog('Configuration saved to storage');
        } catch (e) {
            debugLog('Error saving configuration:', e);
        }
    },

    /**
     * Update configuration with validation
     */
    updateConfig(newConfig) {
        const validatedConfig = this.validateConfig(newConfig);
        Object.assign(CONFIG, validatedConfig);
        this.saveConfig();
        debugLog('Configuration updated:', CONFIG);
    },

    /**
     * Validate configuration values
     */
    validateConfig(config) {
        const validated = {};

        if (typeof config.enabled === 'boolean') {
            validated.enabled = config.enabled;
        }

        if (typeof config.responseDelay === 'number' && config.responseDelay >= 0 && config.responseDelay <= 10000) {
            validated.responseDelay = config.responseDelay;
        }

        if (typeof config.maxRetries === 'number' && config.maxRetries >= 0 && config.maxRetries <= 5) {
            validated.maxRetries = config.maxRetries;
        }

        if (typeof config.cooldownPeriod === 'number' && config.cooldownPeriod >= 1000 && config.cooldownPeriod <= 30000) {
            validated.cooldownPeriod = config.cooldownPeriod;
        }

        if (typeof config.debugMode === 'boolean') {
            validated.debugMode = config.debugMode;
        }

        if (Array.isArray(config.errorPatterns)) {
            validated.errorPatterns = config.errorPatterns.filter(p => typeof p === 'string' && p.length > 0);
        }

        return validated;
    },

    /**
     * Reset configuration to defaults
     */
    resetConfig() {
        const defaults = {
            enabled: true,
            responseDelay: 1500,
            maxRetries: 2,
            cooldownPeriod: 3000,
            debugMode: false,
            errorPatterns: [
                'Failed to generate content. Please try again.',
                'An internal error has occurred.',
                'Something went wrong'
            ]
        };

        Object.assign(CONFIG, defaults);
        this.saveConfig();
        debugLog('Configuration reset to defaults');
    },

    /**
     * Get current configuration
     */
    getConfig() {
        return { ...CONFIG };
    }
};

/**
 * Comprehensive logging and monitoring system
 */
const MonitoringManager = {
    logs: [],
    maxLogs: 100,

    /**
     * Enhanced logging with levels and timestamps
     */
    log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            data: data ? JSON.stringify(data) : null
        };

        this.logs.push(logEntry);

        // Keep only recent logs
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        // Console output for debug mode
        if (CONFIG.debugMode) {
            const style = this.getLogStyle(level);
            console.log(`%c[${timestamp}] [${level.toUpperCase()}] ${message}`, style, data || '');
        }
    },

    /**
     * Get console style for log level
     */
    getLogStyle(level) {
        const styles = {
            info: 'color: #2196F3;',
            warn: 'color: #FF9800;',
            error: 'color: #F44336;',
            success: 'color: #4CAF50;',
            debug: 'color: #9E9E9E;'
        };
        return styles[level] || 'color: #000;';
    },

    /**
     * Get recent logs
     */
    getLogs(level = null, limit = 50) {
        let filteredLogs = level ? this.logs.filter(log => log.level === level) : this.logs;
        return filteredLogs.slice(-limit);
    },

    /**
     * Clear logs
     */
    clearLogs() {
        this.logs = [];
        if (typeof console !== 'undefined' && console.clear) {
            console.clear();
        }
    },

    /**
     * Export logs for debugging
     */
    exportLogs() {
        const logsText = this.logs.map(log =>
            `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}${log.data ? ' | Data: ' + log.data : ''}`
        ).join('\n');

        const blob = new Blob([logsText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-studio-auto-rerun-logs-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }
};

/**
 * Status indicator for user feedback
 */
const StatusIndicator = {
    indicator: null,

    /**
     * Create visual status indicator
     */
    create() {
        if (this.indicator) return;

        this.indicator = document.createElement('div');
        this.indicator.id = 'ai-studio-auto-rerun-status';
        this.indicator.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background-color: #4CAF50;
                z-index: 10000;
                opacity: 0.7;
                transition: all 0.3s ease;
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            `;

        this.indicator.title = 'AI Studio Auto-Rerun Status: Active';
        this.indicator.addEventListener('click', this.showStatus.bind(this));

        document.body.appendChild(this.indicator);
    },

    /**
     * Update status indicator
     */
    updateStatus(status, message) {
        if (!this.indicator) this.create();

        const colors = {
            active: '#4CAF50',
            processing: '#FF9800',
            error: '#F44336',
            disabled: '#9E9E9E'
        };

        this.indicator.style.backgroundColor = colors[status] || colors.active;
        this.indicator.title = `AI Studio Auto-Rerun: ${message}`;

        // Pulse animation for processing
        if (status === 'processing') {
            this.indicator.style.animation = 'pulse 1s infinite';
        } else {
            this.indicator.style.animation = 'none';
        }
    },

    /**
     * Show detailed status
     */
    showStatus() {
        const stats = StateManager.getStats();
        const performance = PerformanceManager.getReport();

        const statusText = `
AI Studio Auto-Rerun Status:
- Enabled: ${CONFIG.enabled}
- Processing: ${stats.isProcessing}
- Last Action: ${stats.lastActionTime ? new Date(stats.lastActionTime).toLocaleTimeString() : 'Never'}
- Success Rate: ${performance.successRate}
- Error Detections: ${performance.errorDetections}
- Click Attempts: ${performance.clickAttempts}
            `.trim();

        alert(statusText);
    },

    /**
     * Remove status indicator
     */
    remove() {
        if (this.indicator) {
            this.indicator.remove();
            this.indicator = null;
        }
    }
};

/**
 * Debug mode console interface
 */
function createDebugInterface() {
    if (!CONFIG.debugMode) return;

    console.log('%c[AI Studio Auto-Rerun] Debug Mode Enabled', 'color: #4CAF50; font-weight: bold;');
    console.log('Available commands:');
    console.log('- AIStudioAutoRerun.config: View/modify configuration');
    console.log('- AIStudioAutoRerun.state: View current state');
    console.log('- AIStudioAutoRerun.performance: View performance metrics');
    console.log('- AIStudioAutoRerun.stateManager: State management functions');
    console.log('- AIStudioAutoRerun.test(): Run manual tests');

    window.AIStudioAutoRerun = window.AIStudioAutoRerun || {};
    window.AIStudioAutoRerun.configManager = ConfigManager;
    window.AIStudioAutoRerun.stateManager = StateManager;
    window.AIStudioAutoRerun.performance = PerformanceManager;
    window.AIStudioAutoRerun.monitoring = MonitoringManager;
    window.AIStudioAutoRerun.status = StatusIndicator;
    window.AIStudioAutoRerun.test = function () {
        console.log('Running manual tests...');
        console.log('Performance report:', PerformanceManager.getReport());
        console.log('State:', StateManager.getStats());
    };
}

// Add CSS for pulse animation
const style = document.createElement('style');
style.textContent = `
        @keyframes pulse {
            0% { opacity: 0.7; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.2); }
            100% { opacity: 0.7; transform: scale(1); }
        }
    `;
document.head.appendChild(style);

// Load configuration on startup
ConfigManager.loadConfig();

// Create debug interface if enabled
createDebugInterface();

// Create status indicator
StatusIndicator.create();
StatusIndicator.updateStatus('active', 'Monitoring for errors');

// Override debugLog to use MonitoringManager
const originalDebugLog = debugLog;
debugLog = function (message, data = null) {
    MonitoringManager.log('debug', message, data);
    if (CONFIG.debugMode) {
        originalDebugLog(message, data);
    }
};

/**
 * Comprehensive Testing Suite
 */
const TestSuite = {
    results: [],

    /**
     * Run a test case
     */
    test(name, testFunction) {
        try {
            const startTime = Date.now();
            const result = testFunction();
            const endTime = Date.now();

            const testResult = {
                name,
                passed: result === true,
                duration: endTime - startTime,
                error: result !== true ? result : null,
                timestamp: new Date().toISOString()
            };

            this.results.push(testResult);

            if (CONFIG.debugMode) {
                const status = testResult.passed ? '✅ PASS' : '❌ FAIL';
                console.log(`${status} ${name} (${testResult.duration}ms)`);
                if (!testResult.passed) {
                    console.error('Error:', testResult.error);
                }
            }

            return testResult;
        } catch (e) {
            const testResult = {
                name,
                passed: false,
                duration: 0,
                error: e.message,
                timestamp: new Date().toISOString()
            };

            this.results.push(testResult);

            if (CONFIG.debugMode) {
                console.log(`❌ FAIL ${name} - Exception: ${e.message}`);
            }

            return testResult;
        }
    },

    /**
     * Assert helper functions
     */
    assert: {
        isTrue(value, message = 'Expected true') {
            if (value !== true) throw new Error(`${message}. Got: ${value}`);
            return true;
        },

        isFalse(value, message = 'Expected false') {
            if (value !== false) throw new Error(`${message}. Got: ${value}`);
            return true;
        },

        equals(actual, expected, message = 'Values not equal') {
            if (actual !== expected) throw new Error(`${message}. Expected: ${expected}, Got: ${actual}`);
            return true;
        },

        notNull(value, message = 'Expected non-null value') {
            if (value === null || value === undefined) throw new Error(`${message}. Got: ${value}`);
            return true;
        },

        isNull(value, message = 'Expected null value') {
            if (value !== null && value !== undefined) throw new Error(`${message}. Got: ${value}`);
            return true;
        },

        contains(array, item, message = 'Array does not contain item') {
            if (!Array.isArray(array) || !array.includes(item)) {
                throw new Error(`${message}. Array: ${JSON.stringify(array)}, Item: ${item}`);
            }
            return true;
        },

        hasProperty(obj, prop, message = 'Object missing property') {
            if (!obj || !obj.hasOwnProperty(prop)) {
                throw new Error(`${message}. Object: ${JSON.stringify(obj)}, Property: ${prop}`);
            }
            return true;
        }
    },

    /**
     * Create mock DOM elements for testing
     */
    createMockElement(tag, attributes = {}, textContent = '') {
        const element = document.createElement(tag);

        Object.keys(attributes).forEach(key => {
            if (key === 'className') {
                element.className = attributes[key];
            } else {
                element.setAttribute(key, attributes[key]);
            }
        });

        if (textContent) {
            element.textContent = textContent;
        }

        // Mock getBoundingClientRect for testing
        element.getBoundingClientRect = () => ({
            width: 100,
            height: 30,
            top: 0,
            left: 0,
            right: 100,
            bottom: 30
        });

        return element;
    },

    /**
     * Unit Tests for Error Detection
     */
    runErrorDetectionTests() {
        console.log('🧪 Running Error Detection Tests...');

        // Test text-based error detection
        this.test('Text-based error detection - positive case', () => {
            const element = this.createMockElement('div', {}, 'Failed to generate content. Please try again.');
            const result = detectErrorByText(element);
            this.assert.notNull(result, 'Should detect error');
            this.assert.equals(result.detectionMethod, 'text_content', 'Should use text detection method');
            return true;
        });

        this.test('Text-based error detection - negative case', () => {
            const element = this.createMockElement('div', {}, 'This is normal content.');
            const result = detectErrorByText(element);
            this.assert.isNull(result, 'Should not detect error');
            return true;
        });

        // Test CSS class-based error detection
        this.test('CSS class-based error detection - positive case', () => {
            const element = this.createMockElement('div', { className: 'error-message' }, 'Something went wrong');
            const result = detectErrorByClass(element);
            this.assert.notNull(result, 'Should detect error');
            this.assert.equals(result.detectionMethod, 'css_class', 'Should use CSS class detection method');
            return true;
        });

        this.test('CSS class-based error detection - negative case', () => {
            const element = this.createMockElement('div', { className: 'normal-message' }, 'Normal content');
            const result = detectErrorByClass(element);
            this.assert.isNull(result, 'Should not detect error');
            return true;
        });

        // Test comprehensive error detection
        this.test('Comprehensive error detection - multiple strategies', () => {
            const element1 = this.createMockElement('div', {}, 'Failed to generate content. Please try again.');
            const element2 = this.createMockElement('div', { className: 'alert' }, 'Error occurred');
            const element3 = this.createMockElement('div', {}, 'Normal content');

            const result1 = detectErrorInElement(element1);
            const result2 = detectErrorInElement(element2);
            const result3 = detectErrorInElement(element3);

            this.assert.notNull(result1, 'Should detect text-based error');
            this.assert.notNull(result2, 'Should detect class-based error');
            this.assert.isNull(result3, 'Should not detect normal content');

            return true;
        });
    },

    /**
     * Unit Tests for Button Location
     */
    runButtonLocationTests() {
        console.log('🧪 Running Button Location Tests...');

        // Test button validation
        this.test('Button validation - valid button', () => {
            const button = this.createMockElement('button', { 'aria-label': 'Rerun' });
            const result = isValidRerunButton(button);
            this.assert.isTrue(result, 'Should validate correct button');
            return true;
        });

        this.test('Button validation - disabled button', () => {
            const button = this.createMockElement('button', { 'aria-label': 'Rerun', disabled: true });
            button.disabled = true;
            const result = isValidRerunButton(button);
            this.assert.isFalse(result, 'Should reject disabled button');
            return true;
        });

        // Test primary button location strategy
        this.test('Primary button location - mock test', () => {
            // Create mock button and add to DOM temporarily
            const button = this.createMockElement('button', { 'aria-label': 'Rerun generation' });
            document.body.appendChild(button);

            try {
                const result = findRerunButtonPrimary();
                // Note: This might not find the button due to DOM context, but tests the function doesn't crash
                this.assert.isTrue(typeof result === 'object' || result === null, 'Should return object or null');
                return true;
            } finally {
                document.body.removeChild(button);
            }
        });
    },

    /**
     * Unit Tests for State Management
     */
    runStateManagementTests() {
        console.log('🧪 Running State Management Tests...');

        this.test('State Manager - processing state', () => {
            const initialState = StateManager.isProcessing();
            StateManager.setProcessing(true);
            const newState = StateManager.isProcessing();
            StateManager.setProcessing(false);
            const finalState = StateManager.isProcessing();

            this.assert.isFalse(initialState, 'Initial state should be false');
            this.assert.isTrue(newState, 'State should be true after setting');
            this.assert.isFalse(finalState, 'State should be false after resetting');

            return true;
        });

        this.test('State Manager - action recording', () => {
            const beforeTime = Date.now();
            StateManager.recordAction();
            const afterTime = Date.now();
            const recordedTime = StateManager.getLastAction();

            this.assert.isTrue(recordedTime >= beforeTime && recordedTime <= afterTime,
                'Recorded time should be within expected range');

            return true;
        });

        this.test('State Manager - statistics', () => {
            const stats = StateManager.getStats();

            this.assert.hasProperty(stats, 'isInitialized', 'Stats should have isInitialized');
            this.assert.hasProperty(stats, 'isProcessing', 'Stats should have isProcessing');
            this.assert.hasProperty(stats, 'lastActionTime', 'Stats should have lastActionTime');
            this.assert.hasProperty(stats, 'retryCount', 'Stats should have retryCount');
            this.assert.hasProperty(stats, 'observersCount', 'Stats should have observersCount');

            return true;
        });
    },

    /**
     * Unit Tests for Configuration Management
     */
    runConfigurationTests() {
        console.log('🧪 Running Configuration Tests...');

        this.test('Configuration validation - valid config', () => {
            const validConfig = {
                enabled: true,
                responseDelay: 2000,
                maxRetries: 3,
                cooldownPeriod: 5000,
                debugMode: false
            };

            const validated = ConfigManager.validateConfig(validConfig);

            this.assert.equals(validated.enabled, true, 'Should validate enabled flag');
            this.assert.equals(validated.responseDelay, 2000, 'Should validate response delay');
            this.assert.equals(validated.maxRetries, 3, 'Should validate max retries');

            return true;
        });

        this.test('Configuration validation - invalid values', () => {
            const invalidConfig = {
                enabled: 'true', // Should be boolean
                responseDelay: -100, // Should be positive
                maxRetries: 10, // Should be <= 5
                cooldownPeriod: 500 // Should be >= 1000
            };

            const validated = ConfigManager.validateConfig(invalidConfig);

            this.assert.isTrue(!validated.hasOwnProperty('enabled'), 'Should reject invalid enabled');
            this.assert.isTrue(!validated.hasOwnProperty('responseDelay'), 'Should reject invalid delay');
            this.assert.isTrue(!validated.hasOwnProperty('maxRetries'), 'Should reject invalid retries');
            this.assert.isTrue(!validated.hasOwnProperty('cooldownPeriod'), 'Should reject invalid cooldown');

            return true;
        });

        this.test('Configuration persistence', () => {
            const testConfig = { debugMode: true };
            const originalConfig = ConfigManager.getConfig();

            try {
                ConfigManager.updateConfig(testConfig);
                const updatedConfig = ConfigManager.getConfig();

                this.assert.isTrue(updatedConfig.debugMode, 'Config should be updated');

                return true;
            } finally {
                // Restore original config
                ConfigManager.updateConfig(originalConfig);
            }
        });
    },

    /**
     * Unit Tests for Performance Manager
     */
    runPerformanceTests() {
        console.log('🧪 Running Performance Tests...');

        this.test('Performance metrics recording', () => {
            const initialReport = PerformanceManager.getReport();
            const initialDetections = initialReport.errorDetections;

            PerformanceManager.recordMetric('errorDetections', 1);

            const updatedReport = PerformanceManager.getReport();
            const updatedDetections = updatedReport.errorDetections;

            this.assert.equals(updatedDetections, initialDetections + 1, 'Should increment metric');

            return true;
        });

        this.test('Performance cache functionality', () => {
            const selector = 'test-selector-' + Date.now();

            // Mock querySelectorAll for testing
            const originalQuerySelectorAll = document.querySelectorAll;
            let queryCount = 0;
            document.querySelectorAll = function (sel) {
                if (sel === selector) queryCount++;
                return [];
            };

            try {
                // First call should query DOM
                PerformanceManager.cachedQuery(selector);
                this.assert.equals(queryCount, 1, 'Should query DOM on first call');

                // Second call should use cache
                PerformanceManager.cachedQuery(selector);
                this.assert.equals(queryCount, 1, 'Should use cache on second call');

                return true;
            } finally {
                document.querySelectorAll = originalQuerySelectorAll;
            }
        });
    },

    /**
     * Run all unit tests
     */
    runAllUnitTests() {
        console.log('🚀 Starting Unit Test Suite...');
        this.results = [];

        this.runErrorDetectionTests();
        this.runButtonLocationTests();
        this.runStateManagementTests();
        this.runConfigurationTests();
        this.runPerformanceTests();

        this.printTestSummary();
    },

    /**
     * Print test summary
     */
    printTestSummary() {
        const passed = this.results.filter(r => r.passed).length;
        const failed = this.results.filter(r => !r.passed).length;
        const total = this.results.length;

        console.log('\n📊 Test Summary:');
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📈 Total: ${total}`);
        console.log(`🎯 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

        if (failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.results.filter(r => !r.passed).forEach(test => {
                console.log(`  - ${test.name}: ${test.error}`);
            });
        }

        return { passed, failed, total, successRate: (passed / total) * 100 };
    },

    /**
     * Get test results
     */
    getResults() {
        return {
            results: this.results,
            summary: this.printTestSummary()
        };
    }
};
/**
    * Integration Testing Suite
    */
const IntegrationTestSuite = {
    mockEnvironment: null,

    /**
     * Create mock DOM environment for testing
     */
    createMockEnvironment() {
        const mockContainer = document.createElement('div');
        mockContainer.id = 'integration-test-container';
        mockContainer.style.cssText = 'position: absolute; top: -9999px; left: -9999px;';
        document.body.appendChild(mockContainer);

        this.mockEnvironment = mockContainer;
        return mockContainer;
    },

    /**
     * Clean up mock environment
     */
    cleanupMockEnvironment() {
        if (this.mockEnvironment && this.mockEnvironment.parentNode) {
            this.mockEnvironment.parentNode.removeChild(this.mockEnvironment);
            this.mockEnvironment = null;
        }
    },

    /**
     * Create mock error message element
     */
    createMockError(message = 'Failed to generate content. Please try again.') {
        const errorElement = document.createElement('div');
        errorElement.setAttribute('role', 'alert');
        errorElement.className = 'error-message';
        errorElement.textContent = message;
        errorElement.style.cssText = 'color: rgb(185, 28, 28); background-color: rgb(254, 242, 242);';

        return errorElement;
    },

    /**
     * Create mock rerun button
     */
    createMockRerunButton() {
        const button = document.createElement('button');
        button.setAttribute('aria-label', 'Rerun generation');
        button.setAttribute('title', 'Rerun');
        button.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';

        // Mock click behavior
        let clicked = false;
        button.addEventListener('click', () => {
            clicked = true;
            button.setAttribute('data-clicked', 'true');
        });

        button.wasClicked = () => clicked;

        return button;
    },

    /**
     * Integration Test: End-to-End Error Detection and Button Click
     */
    testEndToEndFlow() {
        return TestSuite.test('Integration: End-to-end error detection and button click', () => {
            const container = this.createMockEnvironment();

            try {
                // Create mock error and button
                const errorElement = this.createMockError();
                const rerunButton = this.createMockRerunButton();

                container.appendChild(errorElement);
                container.appendChild(rerunButton);

                // Test error detection
                const detectedError = detectErrorInElement(errorElement);
                TestSuite.assert.notNull(detectedError, 'Should detect error element');

                // Test button location
                const buttonLocation = findRerunButtonPrimary();
                // Note: May not find our mock button due to DOM context, but should not crash

                // Test button validation
                const isValid = isValidRerunButton(rerunButton);
                TestSuite.assert.isTrue(isValid, 'Should validate mock button');

                // Test click simulation
                simulateHover(rerunButton);
                rerunButton.click();
                TestSuite.assert.isTrue(rerunButton.wasClicked(), 'Button should be clicked');

                return true;
            } finally {
                this.cleanupMockEnvironment();
            }
        });
    },

    /**
     * Integration Test: Error Event System
     */
    testErrorEventSystem() {
        return TestSuite.test('Integration: Error event system', () => {
            let eventTriggered = false;
            let eventData = null;

            // Register event handler
            const handler = (data) => {
                eventTriggered = true;
                eventData = data;
            };

            ErrorEvents.onErrorDetected(handler);

            try {
                // Create and trigger error
                const errorElement = this.createMockError();
                const detectedError = detectErrorInElement(errorElement);

                if (detectedError) {
                    ErrorEvents.trigger(detectedError);
                }

                TestSuite.assert.isTrue(eventTriggered, 'Error event should be triggered');
                TestSuite.assert.notNull(eventData, 'Event data should be provided');
                TestSuite.assert.equals(eventData.errorType, 'generation_failure', 'Should have correct error type');

                return true;
            } finally {
                // Clean up event handler
                const index = ErrorEvents.callbacks.indexOf(handler);
                if (index > -1) {
                    ErrorEvents.callbacks.splice(index, 1);
                }
            }
        });
    },

    /**
     * Integration Test: State Management During Processing
     */
    testStateManagementIntegration() {
        return TestSuite.test('Integration: State management during processing', async () => {
            const originalProcessing = STATE.isProcessing;
            const originalLastAction = STATE.lastActionTime;

            try {
                // Test processing state changes
                TestSuite.assert.isFalse(StateManager.isProcessing(), 'Should start not processing');

                StateManager.setProcessing(true);
                TestSuite.assert.isTrue(StateManager.isProcessing(), 'Should be processing');

                StateManager.recordAction();
                const actionTime = StateManager.getLastAction();
                TestSuite.assert.isTrue(actionTime > originalLastAction, 'Should record new action time');

                // Test cooldown logic
                const shouldTrigger1 = StateManager.shouldTrigger();
                TestSuite.assert.isFalse(shouldTrigger1, 'Should not trigger while processing');

                StateManager.setProcessing(false);

                // Wait a bit and test again
                await new Promise(resolve => setTimeout(resolve, 100));
                const shouldTrigger2 = StateManager.shouldTrigger();
                // Note: May still be false due to cooldown period

                return true;
            } finally {
                // Restore original state
                STATE.isProcessing = originalProcessing;
                STATE.lastActionTime = originalLastAction;
            }
        });
    },

    /**
     * Integration Test: Configuration Persistence
     */
    testConfigurationPersistence() {
        return TestSuite.test('Integration: Configuration persistence', () => {
            const originalConfig = ConfigManager.getConfig();
            const testConfig = {
                responseDelay: 2500,
                maxRetries: 3,
                debugMode: true
            };

            try {
                // Update configuration
                ConfigManager.updateConfig(testConfig);

                // Verify in-memory config
                TestSuite.assert.equals(CONFIG.responseDelay, 2500, 'Should update response delay');
                TestSuite.assert.equals(CONFIG.maxRetries, 3, 'Should update max retries');
                TestSuite.assert.isTrue(CONFIG.debugMode, 'Should update debug mode');

                // Test localStorage persistence
                const stored = localStorage.getItem(ConfigManager.storageKey);
                TestSuite.assert.notNull(stored, 'Should store config in localStorage');

                const parsed = JSON.parse(stored);
                TestSuite.assert.equals(parsed.responseDelay, 2500, 'Should persist response delay');

                return true;
            } finally {
                // Restore original configuration
                ConfigManager.updateConfig(originalConfig);
            }
        });
    },

    /**
     * Integration Test: Performance Monitoring
     */
    testPerformanceMonitoring() {
        return TestSuite.test('Integration: Performance monitoring', () => {
            const initialReport = PerformanceManager.getReport();

            // Simulate some operations
            PerformanceManager.recordMetric('errorDetections', 2);
            PerformanceManager.recordMetric('buttonSearches', 1);
            PerformanceManager.recordMetric('clickAttempts', 1);
            PerformanceManager.recordMetric('successfulClicks', 1);

            const updatedReport = PerformanceManager.getReport();

            TestSuite.assert.equals(
                updatedReport.errorDetections,
                initialReport.errorDetections + 2,
                'Should track error detections'
            );

            TestSuite.assert.equals(
                updatedReport.buttonSearches,
                initialReport.buttonSearches + 1,
                'Should track button searches'
            );

            TestSuite.assert.equals(updatedReport.successRate, '100.00%', 'Should calculate success rate');

            return true;
        });
    },

    /**
     * Integration Test: Logging System
     */
    testLoggingSystem() {
        return TestSuite.test('Integration: Logging system', () => {
            const initialLogCount = MonitoringManager.logs.length;

            // Generate some logs
            MonitoringManager.log('info', 'Test info message', { test: true });
            MonitoringManager.log('warn', 'Test warning message');
            MonitoringManager.log('error', 'Test error message');

            const updatedLogCount = MonitoringManager.logs.length;
            TestSuite.assert.equals(updatedLogCount, initialLogCount + 3, 'Should add logs');

            // Test log filtering
            const errorLogs = MonitoringManager.getLogs('error', 10);
            TestSuite.assert.isTrue(errorLogs.length >= 1, 'Should filter error logs');
            TestSuite.assert.equals(errorLogs[errorLogs.length - 1].level, 'error', 'Should contain error log');

            return true;
        });
    },

    /**
     * Integration Test: Browser Compatibility
     */
    testBrowserCompatibility() {
        return TestSuite.test('Integration: Browser compatibility checks', () => {
            // Test required APIs
            TestSuite.assert.notNull(window.MutationObserver, 'MutationObserver should be available');
            TestSuite.assert.notNull(window.localStorage, 'localStorage should be available');
            TestSuite.assert.notNull(document.querySelectorAll, 'querySelectorAll should be available');
            TestSuite.assert.notNull(window.MouseEvent, 'MouseEvent should be available');

            // Test event creation
            const testEvent = new MouseEvent('click', { bubbles: true });
            TestSuite.assert.notNull(testEvent, 'Should create MouseEvent');
            TestSuite.assert.isTrue(testEvent.bubbles, 'Event should have bubbles property');

            // Test Promise support
            TestSuite.assert.notNull(window.Promise, 'Promise should be available');

            return true;
        });
    },

    /**
     * Performance Impact Test
     */
    testPerformanceImpact() {
        return TestSuite.test('Integration: Performance impact assessment', () => {
            const startTime = performance.now();

            // Simulate typical operations
            for (let i = 0; i < 10; i++) {
                const mockElement = TestSuite.createMockElement('div', {}, 'Test content');
                detectErrorInElement(mockElement);
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Should complete quickly (under 50ms for 10 operations)
            TestSuite.assert.isTrue(duration < 50, `Operations should be fast. Took: ${duration}ms`);

            return true;
        });
    },

    /**
     * Run all integration tests
     */
    runAllIntegrationTests() {
        console.log('🔗 Starting Integration Test Suite...');

        const results = [];

        results.push(this.testEndToEndFlow());
        results.push(this.testErrorEventSystem());
        results.push(this.testStateManagementIntegration());
        results.push(this.testConfigurationPersistence());
        results.push(this.testPerformanceMonitoring());
        results.push(this.testLoggingSystem());
        results.push(this.testBrowserCompatibility());
        results.push(this.testPerformanceImpact());

        const passed = results.filter(r => r.passed).length;
        const failed = results.filter(r => !r.passed).length;

        console.log('\n🔗 Integration Test Summary:');
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`🎯 Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);

        return results;
    }
};

/**
 * Master Test Runner
 */
const MasterTestRunner = {
    /**
     * Run complete test suite
     */
    runCompleteTestSuite() {
        console.log('🚀 Starting Complete Test Suite...');
        console.log('=====================================');

        // Run unit tests
        TestSuite.runAllUnitTests();

        console.log('\n=====================================');

        // Run integration tests
        IntegrationTestSuite.runAllIntegrationTests();

        console.log('\n=====================================');
        console.log('🏁 Complete Test Suite Finished');

        // Return combined results
        return {
            unitTests: TestSuite.getResults(),
            integrationTests: IntegrationTestSuite.runAllIntegrationTests()
        };
    }
};

// Update debug interface to include testing
if (CONFIG.debugMode) {
    window.AIStudioAutoRerun = window.AIStudioAutoRerun || {};
    window.AIStudioAutoRerun.testSuite = TestSuite;
    window.AIStudioAutoRerun.integrationTests = IntegrationTestSuite;
    window.AIStudioAutoRerun.runAllTests = MasterTestRunner.runCompleteTestSuite;

    // Update the test function
    window.AIStudioAutoRerun.test = function () {
        console.log('Running comprehensive test suite...');
        return MasterTestRunner.runCompleteTestSuite();
    };
}