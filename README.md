# Google AI Studio Auto-Rerun

Automatically clicks the rerun button when Google AI Studio generation fails. This userscript provides intelligent error detection and swift recovery from generation failures.

## Features

🎯 **Smart Error Detection** - Detects multiple types of error messages and indicators  
⚡ **Fast Response** - Clicks rerun button within 1-2 seconds of error detection  
🔄 **Multiple Strategies** - Uses fallback methods to reliably find the rerun button  
🛡️ **Intelligent Behavior** - Only activates when actual errors occur  
📊 **Performance Monitoring** - Tracks success rates and performance metrics  
🔧 **Configurable** - Customizable timing, retries, and behavior  
🐛 **Debug Mode** - Comprehensive logging and testing capabilities  

## Installation

### Prerequisites
- A userscript manager like [Tampermonkey](https://www.tampermonkey.net/) or [Greasemonkey](https://www.greasespot.net/)
- Access to Google AI Studio

### Steps
1. Install a userscript manager in your browser
2. Click [here to install the script](https://raw.githubusercontent.com/ElliotBadinger/ai-studio-auto-rerun.user.js/main/ai-studio-auto-rerun.user.js)
3. Confirm installation in your userscript manager
4. Visit [Google AI Studio](https://aistudio.google.com/) - the script will activate automatically

## How It Works

The script monitors Google AI Studio for error messages like:
- "Failed to generate content. Please try again."
- "An internal error has occurred."
- "Something went wrong"

When an error is detected, it:
1. Waits for a configurable delay (default: 1.5 seconds)
2. Locates the rerun button using multiple strategies
3. Simulates hover to reveal the button if needed
4. Clicks the button and verifies success
5. Retries up to 2 times if the first attempt fails

## Configuration

The script can be customized through the browser console:

```javascript
// Enable debug mode
AIStudioAutoRerun.configManager.updateConfig({ debugMode: true });

// Adjust response delay (milliseconds)
AIStudioAutoRerun.configManager.updateConfig({ responseDelay: 2000 });

// Change maximum retries
AIStudioAutoRerun.configManager.updateConfig({ maxRetries: 3 });

// Modify cooldown period
AIStudioAutoRerun.configManager.updateConfig({ cooldownPeriod: 5000 });

// View current configuration
console.log(AIStudioAutoRerun.configManager.getConfig());
```

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `enabled` | `true` | Enable/disable the automation |
| `responseDelay` | `1500` | Delay before clicking rerun (ms) |
| `maxRetries` | `2` | Maximum retry attempts |
| `cooldownPeriod` | `3000` | Minimum time between actions (ms) |
| `debugMode` | `false` | Enable detailed logging |

## Status Indicator

A small green dot appears in the top-right corner when the script is active:
- 🟢 **Green**: Active and monitoring
- 🟠 **Orange**: Processing an error
- 🔴 **Red**: Error in script operation
- ⚪ **Gray**: Disabled

Click the indicator to view detailed status information.

## Debug Mode

Enable debug mode for troubleshooting:

```javascript
AIStudioAutoRerun.configManager.updateConfig({ debugMode: true });
```

Debug mode provides:
- Detailed console logging
- Performance metrics
- Manual testing functions
- Error detection analysis

### Debug Commands

```javascript
// Run manual tests
AIStudioAutoRerun.test();

// View performance metrics
console.log(AIStudioAutoRerun.performance.getReport());

// Check current state
console.log(AIStudioAutoRerun.stateManager.getStats());

// Export logs
AIStudioAutoRerun.monitoring.exportLogs();
```

## Troubleshooting

### Script Not Working
1. Ensure your userscript manager is enabled
2. Check that the script is active on aistudio.google.com
3. Enable debug mode to see detailed logs
4. Try refreshing the page

### Button Not Found
The script uses multiple strategies to find the rerun button:
1. Primary: Searches for star-shaped icons and rerun labels
2. Aria Labels: Uses accessibility attributes
3. Position: Looks for buttons near error messages
4. Data Attributes: Searches for data-testid and similar attributes
5. Hover Simulation: Reveals hidden buttons

### Performance Issues
- The script is optimized for minimal performance impact
- Uses efficient DOM queries with caching
- Employs event-driven detection instead of polling
- Automatically cleans up resources

### Common Issues

**Q: The script clicks too quickly**  
A: Increase the `responseDelay` setting

**Q: The script doesn't detect my error**  
A: Enable debug mode and check if your error message is in the patterns list

**Q: Multiple clicks happening**  
A: The cooldown period prevents this - check your configuration

## Browser Compatibility

✅ **Chrome** - Fully supported  
✅ **Firefox** - Fully supported  
✅ **Edge** - Fully supported  
✅ **Safari** - Supported with Userscripts extension  

## Privacy & Security

- No external network requests (except update checks)
- No data collection or tracking
- Minimal DOM manipulation
- Respects page's Content Security Policy
- Open source and auditable

## Contributing

Found a bug or want to contribute? 

1. [Report issues](https://github.com/ElliotBadinger/ai-studio-auto-rerun.user.js/issues)
2. [Submit pull requests](https://github.com/ElliotBadinger/ai-studio-auto-rerun.user.js/pulls)
3. [View source code](https://github.com/ElliotBadinger/ai-studio-auto-rerun.user.js)

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Changelog

### v1.0.0
- Initial release
- Smart error detection with multiple strategies
- Configurable timing and behavior
- Performance monitoring and debugging
- Status indicator and user feedback
- Comprehensive error handling and recovery

---

**Note**: This userscript is not affiliated with Google. Use at your own discretion.