// ==UserScript==
// @name         Google AI Studio Auto-Rerun
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Automatically clicks rerun button when AI Studio generation fails
// @author       You
// @match        https://aistudio.google.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    
    let lastClickTime = 0;
    const COOLDOWN_MS = 3000; // 3 second cooldown between clicks
    
    // Error message patterns to detect
    const errorPatterns = [
        'Failed to generate content',
        'Please try again',
        'An internal error has occurred',
        'Something went wrong',
        'Generation failed'
    ];
    
    function log(message) {
        console.log(`[AI Studio Auto-Rerun] ${message}`);
    }
    
    function isErrorMessage(element) {
        const text = element.textContent || element.innerText || '';
        return errorPatterns.some(pattern => text.includes(pattern));
    }
    
    function simulateHover(element) {
        const hoverEvent = new MouseEvent('mouseenter', {
            view: window,
            bubbles: true,
            cancelable: true
        });
        element.dispatchEvent(hoverEvent);
    }
    
    function findRerunButton() {
        // Strategy 1: Look for star icon with rerun tooltip
        const starButtons = document.querySelectorAll('button[title*="Rerun"], button[aria-label*="Rerun"]');
        for (const btn of starButtons) {
            if (btn.querySelector('svg') || btn.textContent.includes('★')) {
                return btn;
            }
        }
        
        // Strategy 2: Look for star-shaped SVG icons
        const svgElements = document.querySelectorAll('svg');
        for (const svg of svgElements) {
            const button = svg.closest('button');
            if (button && (button.title?.includes('Rerun') || button.getAttribute('aria-label')?.includes('Rerun'))) {
                return button;
            }
        }
        
        // Strategy 3: Look for buttons near "Rerun" text
        const rerunTexts = document.querySelectorAll('*');
        for (const el of rerunTexts) {
            if (el.textContent === 'Rerun') {
                const button = el.closest('button') || el.parentElement?.querySelector('button');
                if (button) return button;
            }
        }
        
        return null;
    }
    
    function clickRerunButton() {
        const now = Date.now();
        if (now - lastClickTime < COOLDOWN_MS) {
            log('Cooldown active, skipping click');
            return;
        }
        
        // First try to find the button
        let rerunButton = findRerunButton();
        
        if (!rerunButton) {
            // Try to reveal hidden buttons by hovering over message areas
            const messageAreas = document.querySelectorAll('[role="main"], .message-container, .chat-message');
            for (const area of messageAreas) {
                simulateHover(area);
            }
            
            // Wait for hover effects and try to find button again
            setTimeout(() => {
                const foundButton = findRerunButton();
                if (foundButton) {
                    performClick(foundButton);
                }
            }, 100);
        } else {
            performClick(rerunButton);
        }
    }
    
    function performClick(button) {
        try {
            // Simulate hover first to ensure button is visible
            simulateHover(button);
            
            // Click the button
            button.click();
            lastClickTime = Date.now();
            log('Rerun button clicked successfully');
            
            // Verify click worked by checking if error message disappears
            setTimeout(() => {
                const errorStillExists = document.querySelector('[role="alert"]') || 
                                       document.querySelector('.error-message') ||
                                       Array.from(document.querySelectorAll('*')).some(el => isErrorMessage(el));
                
                if (!errorStillExists) {
                    log('Click verified - error message cleared');
                } else {
                    log('Click may have failed - error message still present');
                }
            }, 1000);
            
        } catch (error) {
            log(`Error clicking rerun button: ${error.message}`);
        }
    }
    
    function handleErrorDetection() {
        log('Error detected, attempting to click rerun button');
        
        // Small delay to ensure UI is fully rendered
        setTimeout(() => {
            clickRerunButton();
        }, 1500);
    }
    
    // Main observer to watch for error messages
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // Check if the added element is an error message
                    if (isErrorMessage(node)) {
                        handleErrorDetection();
                        return;
                    }
                    
                    // Check if any child elements are error messages
                    const errorElements = node.querySelectorAll && node.querySelectorAll('*');
                    if (errorElements) {
                        for (const el of errorElements) {
                            if (isErrorMessage(el)) {
                                handleErrorDetection();
                                return;
                            }
                        }
                    }
                }
            });
        });
    });
    
    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });
    
    log('Auto-rerun script initialized and monitoring for errors');
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        observer.disconnect();
    });
    
})();
