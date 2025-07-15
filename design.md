# Design Document

## Overview

The Google AI Studio Auto-Rerun system will be implemented as a browser userscript (compatible with Tampermonkey/Greasemonkey) that monitors the Google AI Studio interface for generation errors and automatically triggers the rerun functionality. The system uses DOM observation, intelligent error detection, and robust element location strategies to provide reliable automation.

## Architecture

### Core Components

1. **Error Monitor**: Observes DOM changes and detects error conditions
2. **Button Locator**: Finds and interacts with the rerun button using multiple strategies
3. **State Manager**: Tracks automation state and prevents duplicate actions
4. **Configuration Manager**: Handles user preferences and timing settings

### System Flow

```
Page Load → Initialize Monitor → Watch for Errors → Detect Error → Locate Button → Click Button → Reset State
```

## Components and Interfaces

### Error Monitor Component

**Purpose**: Continuously monitor the page for error indicators

**Key Methods**:
- `startMonitoring()`: Initialize DOM observers and error detection
- `detectError()`: Check for specific error patterns
- `onErrorDetected(callback)`: Register error event handlers

**Error Detection Strategy**:
- Monitor for elements with error-related classes or text content
- Watch for the specific "Failed to generate content" message
- Detect red error styling and alert components
- Use MutationObserver for dynamic content changes

### Button Locator Component

**Purpose**: Reliably find and interact with the rerun button

**Key Methods**:
- `findRerunButton()`: Locate button using multiple strategies
- `simulateHover()`: Trigger hover state to reveal button
- `clickButton()`: Execute click with validation
- `verifyClick()`: Confirm action was successful

**Location Strategies**:
1. **Primary**: Look for star-shaped icon within chat area
2. **Secondary**: Search by aria-labels or data attributes
3. **Fallback**: Use position-based detection relative to error messages
4. **Hover Simulation**: Trigger mouse events to reveal hidden buttons

### State Manager Component

**Purpose**: Prevent duplicate actions and manage automation state

**Key Methods**:
- `isProcessing()`: Check if automation is currently active
- `setProcessing(state)`: Update processing state
- `getLastAction()`: Track timing of recent actions
- `shouldTrigger()`: Determine if conditions are met for action

**State Tracking**:
- Last error detection timestamp
- Current processing status
- Click attempt counter
- Cooldown periods

## Data Models

### ErrorEvent
```javascript
{
  timestamp: Date,
  errorType: string,
  errorMessage: string,
  elementRef: HTMLElement,
  processed: boolean
}
```

### ButtonLocation
```javascript
{
  element: HTMLElement,
  strategy: string,
  confidence: number,
  boundingRect: DOMRect
}
```

### AutomationConfig
```javascript
{
  enabled: boolean,
  responseDelay: number, // milliseconds
  maxRetries: number,
  cooldownPeriod: number,
  debugMode: boolean
}
```

## Error Handling

### Error Detection Failures
- **Fallback**: Multiple detection methods (text content, CSS classes, DOM structure)
- **Recovery**: Reinitialize observers if detection stops working
- **Logging**: Debug information for troubleshooting

### Button Location Failures
- **Retry Logic**: Up to 3 attempts with increasing delays
- **Multiple Strategies**: Try different element selection methods
- **Hover Simulation**: Force button visibility before clicking
- **Validation**: Confirm button exists and is clickable

### Click Failures
- **Retry Mechanism**: Attempt click up to 2 additional times
- **Event Simulation**: Use both click() and dispatchEvent methods
- **Timing Delays**: Wait between attempts to handle async updates
- **Success Verification**: Monitor for error message disappearance

## Testing Strategy

### Unit Testing
- Mock DOM elements and events
- Test error detection logic with various HTML structures
- Validate button location algorithms
- Test state management and cooldown logic

### Integration Testing
- Test on actual Google AI Studio pages
- Verify compatibility with different browser versions
- Test with various error scenarios
- Validate performance impact on page

### User Acceptance Testing
- Test with real usage patterns
- Verify automation doesn't interfere with normal operation
- Confirm error recovery works reliably
- Test across different screen sizes and layouts

## Implementation Considerations

### Performance
- Use efficient DOM queries with caching
- Implement debounced event handlers
- Minimize continuous polling in favor of event-driven detection
- Clean up observers and event listeners properly

### Compatibility
- Support major browsers (Chrome, Firefox, Safari, Edge)
- Handle different Google AI Studio interface versions
- Graceful degradation if page structure changes
- Userscript manager compatibility (Tampermonkey, Greasemonkey)

### Security
- No external network requests
- Minimal DOM manipulation
- Respect page's Content Security Policy
- No sensitive data collection or storage

### Maintainability
- Modular code structure for easy updates
- Configuration options for user customization
- Comprehensive logging for debugging
- Clear documentation and comments