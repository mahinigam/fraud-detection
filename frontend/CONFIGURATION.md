# Environment Configuration Guide

## Overview
The Fraud Detection System uses a comprehensive environment configuration system that provides type-safe configuration management with validation, feature flags, and environment-specific settings.

## Configuration Structure

### Environment Types
- **Development**: Local development with relaxed security and debugging enabled
- **Staging**: Pre-production testing environment with production-like settings
- **Production**: Live production environment with maximum security and performance
- **Test**: Automated testing environment with minimal features enabled

## Environment Variables

### Required Variables
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_FRAUD_API_ENDPOINT=https://api.frauddetection.com
VITE_ENVIRONMENT=production
```

### Optional Variables
```bash
VITE_APP_VERSION=1.0.0
VITE_BUILD_NUMBER=1
VITE_SUPABASE_SERVICE_KEY=your-service-key
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_ERROR_REPORTING=true
VITE_ERROR_REPORTING_ENDPOINT=https://errors.frauddetection.com
VITE_ANALYTICS_ENDPOINT=https://analytics.frauddetection.com
```

## Setup Instructions

### 1. Environment Files
Copy the appropriate environment file for your target environment:

```bash
# Development
cp .env.development .env.local

# Staging  
cp .env.staging .env.local

# Production
cp .env.production .env.local
```

### 2. Configure Your Values
Edit `.env.local` with your actual configuration values:

```bash
# Update with your actual Supabase project details
VITE_SUPABASE_URL=https://your-actual-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-actual-anon-key
VITE_FRAUD_API_ENDPOINT=https://your-api-endpoint.com
```

### 3. Validate Configuration
```bash
npm run deploy:validate
```

### 4. Security Check
```bash
npm run deploy:security
```

## Feature Flags

The system includes comprehensive feature flags that can be controlled per environment:

### Core Features
- `enableRealTimeUpdates`: WebSocket connections for live updates
- `enableAdvancedAnalytics`: Enhanced fraud detection analytics  
- `enableAuditLogs`: Comprehensive audit trail system
- `enableNotifications`: Toast notifications and alerts
- `enableSessionManagement`: Session timeout and security

### Security Features
- `enableDeviceTracking`: Device fingerprinting for security
- `enableLocationServices`: Geographic location tracking
- `enableBetaFeatures`: Experimental functionality
- `maintenanceMode`: System maintenance mode

### Performance Features
- `enableBatchProcessing`: Bulk transaction processing
- `enableAutoSave`: Automatic form data saving
- `enableThemeToggle`: Light/dark theme switching

## Security Configuration

### Session Management
```typescript
security: {
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  warningTime: 5 * 60 * 1000,     // 5 minutes warning
  maxLoginAttempts: 5,             // Failed login attempts
  lockoutDuration: 15 * 60 * 1000, // 15 minutes lockout
}
```

### Password Policy
```typescript
passwordPolicy: {
  minLength: 12,              // Production: 12, Development: 6
  requireUppercase: true,     // Require uppercase letters
  requireLowercase: true,     // Require lowercase letters  
  requireNumbers: true,       // Require numbers
  requireSpecialChars: true   // Require special characters
}
```

### Device Tracking
```typescript
deviceTracking: true,        // Enable device fingerprinting
locationTracking: true,      // Enable in production only
allowMultipleSessions: false, // Disable in production
csrfProtection: true        // Enable CSRF protection
```

## Deployment

### Build Commands
```bash
# Development build
npm run build:dev

# Staging build  
npm run build:staging

# Production build
npm run build:prod
```

### Deployment Pipeline
```bash
# Full deployment with validation
npm run deploy:dev     # Deploy to development
npm run deploy:staging # Deploy to staging
npm run deploy:prod    # Deploy to production
```

### Health Checks
```bash
npm run deploy:health  # Application health check
```

## Configuration Validation

The system automatically validates configuration on startup:

### Validation Checks
- Required environment variables presence
- URL format validation
- Security setting validation  
- Feature flag dependency validation
- Password policy compliance

### Accessing Validation
```typescript
import { config, configValidation, isFeatureEnabled } from './config/environment'

// Check if configuration is valid
if (!configValidation.isValid) {
  console.error('Configuration errors:', configValidation.errors)
}

// Use feature flags
if (isFeatureEnabled('enableRealTimeUpdates')) {
  // Enable real-time features
}

// Access configuration
const apiEndpoint = config.api.fraudDetectionEndpoint
```

## System Configuration UI

For administrators, a comprehensive configuration interface is available:

1. **Access**: Navigate to Admin Panel → System Config
2. **Features**: 
   - Configuration validation status
   - Database connection details
   - Security settings overview
   - Feature flag status
   - Monitoring configuration
3. **Security**: Only available to admin users

## Environment-Specific Behavior

### Development
- Debug logging enabled
- Relaxed security policies
- Beta features available
- Console logging enabled
- Higher session timeout (1 hour)

### Staging  
- Production-like security
- Analytics enabled
- Error reporting enabled
- Remote logging enabled
- Standard session timeout (45 minutes)

### Production
- Maximum security enabled
- All monitoring enabled
- Strict password policy
- Optimized performance settings
- Short session timeout (30 minutes)

## Monitoring & Analytics

### Error Reporting
```typescript
monitoring: {
  enableErrorReporting: true,
  errorReportingEndpoint: 'https://errors.frauddetection.com',
  logLevel: 'error' // production
}
```

### Performance Monitoring
```typescript
monitoring: {
  enablePerformanceMonitoring: true,
  enableAnalytics: true,
  analyticsEndpoint: 'https://analytics.frauddetection.com'
}
```

## Troubleshooting

### Common Issues

1. **Configuration Validation Failed**
   - Check all required environment variables are set
   - Verify URL formats are valid
   - Ensure Supabase credentials are correct

2. **Build Failures**
   - Verify environment file exists (.env.local)
   - Check for TypeScript errors
   - Validate environment variable syntax

3. **Runtime Errors**
   - Check browser console for configuration errors
   - Verify network connectivity to APIs
   - Check Supabase project status

### Debug Mode
Enable debug mode in development:
```bash
VITE_ENVIRONMENT=development
```

This will enable:
- Detailed console logging
- Configuration validation details
- Enhanced error reporting
- Performance timing information

## Security Best Practices

1. **Never commit actual credentials to version control**
2. **Use different Supabase projects for each environment**  
3. **Enable all security features in production**
4. **Regularly rotate API keys and credentials**
5. **Monitor configuration validation in production**
6. **Use environment-specific feature flags**

## Support

For configuration issues or questions:
- Check the configuration validation UI in admin panel
- Review console logs in development mode
- Verify all environment variables are properly set
- Contact system administrator for production issues