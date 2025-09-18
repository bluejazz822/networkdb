# Integration Tests

This directory contains comprehensive integration tests for external services used by the Network CMDB application.

## Overview

The integration tests validate real-world connectivity and functionality with:

1. **N8n API Integration** (`n8n-api.test.ts`) - Tests n8n workflow service at http://172.16.30.60:5678
2. **Email Alerts Integration** (`email-alerts.test.ts`) - Tests SMTP email delivery and formatting

## Features Tested

### N8n API Integration
- Service connectivity and health checks
- API authentication with rate limiting
- Workflow discovery and registration
- Execution status polling and monitoring
- Database integration for workflow tracking
- Error handling and timeout scenarios
- Production configuration validation

### Email Alerts Integration
- SMTP connectivity and authentication
- Email template generation and formatting
- Alert delivery for failure/success/manual triggers
- Throttling and recipient management
- Service degradation handling
- Database integration for alert tracking

## Prerequisites

### Environment Configuration

Copy and configure your `.env` file with the following variables:

```bash
# N8n API Configuration
N8N_BASE_URL=http://172.16.30.60:5678
N8N_API_KEY=your-n8n-api-key-here
N8N_TIMEOUT=30000
N8N_RATE_LIMIT_MAX_REQUESTS=10
N8N_RETRY_MAX_ATTEMPTS=3
N8N_RETRY_BASE_DELAY=1000
N8N_RETRY_MAX_DELAY=30000
N8N_RETRY_EXPONENTIAL_BACKOFF=true
N8N_ENABLE_LOGGING=true

# Email/SMTP Configuration
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@domain.com
SMTP_PASS=your-password
EMAIL_FROM_NAME=Network CMDB Alerts
EMAIL_FROM_ADDRESS=alerts@yourdomain.com
MAX_ALERTS_PER_HOUR=10
MAX_ALERTS_PER_WORKFLOW_PER_HOUR=1
ALERT_DEFAULT_RECIPIENTS=admin@yourdomain.com

# Alert Service Configuration
ALERTS_ENABLED=true
ALERT_THROTTLE_ENABLED=false

# Database Configuration (for test setup)
DB_HOST=your-db-host
DB_PORT=3306
DB_NAME=your_test_database
DB_USER=your_user
DB_PASSWORD=your_password
```

### Service Requirements

1. **N8n Service**: Must be running and accessible at configured URL
2. **SMTP Server**: Must be configured and accessible for email tests
3. **Database**: MySQL/MariaDB instance for test data storage

## Running the Tests

### Run All Integration Tests
```bash
cd backend
RUN_DB_TESTS=true npm test -- tests/integration/
```

### Run Individual Test Suites
```bash
# N8n API tests only
RUN_DB_TESTS=true npm test -- tests/integration/n8n-api.test.ts

# Email alerts tests only
RUN_DB_TESTS=true npm test -- tests/integration/email-alerts.test.ts
```

### Run with Verbose Output
```bash
RUN_DB_TESTS=true npm test -- tests/integration/ --verbose
```

### Run with Extended Timeout (for slow networks)
```bash
RUN_DB_TESTS=true npm test -- tests/integration/ --testTimeout=120000
```

## Test Configuration Options

### Environment Variables for Testing

- `INTEGRATION_TEST_EMAIL`: Set to a real email address to test actual email delivery
- `ADMIN_TEST_EMAIL`: Admin email for service validation tests
- `RUN_DB_TESTS=true`: Required to enable database-dependent tests

### Test Modes

1. **Service Available Mode**: When external services are accessible, full integration testing
2. **Service Unavailable Mode**: Tests validate graceful degradation and error handling
3. **Mock Mode**: Uses test configurations that don't require real external services

## Understanding Test Results

### Service Validation

Each integration test begins with comprehensive service validation:

- **Connectivity**: Verifies service is reachable
- **Authentication**: Validates credentials and permissions
- **Configuration**: Checks service settings and compatibility
- **Performance**: Measures response times and identifies degraded performance

### Test Categories

1. **Service Validation**: Basic connectivity and configuration checks
2. **Core Operations**: Primary functionality testing with real services
3. **Error Handling**: Robustness testing with invalid inputs and service failures
4. **Production Readiness**: Configuration validation and health monitoring

### Expected Outcomes

- **Green Tests**: Service is healthy and functioning correctly
- **Yellow/Warning Tests**: Service is available but may have performance issues
- **Red/Failed Tests**: Service is unavailable or misconfigured
- **Skipped Tests**: Service unavailable, tests skipped gracefully

## Troubleshooting

### Common Issues

1. **Connection Timeouts**
   - Check network connectivity to external services
   - Verify firewall and security group configurations
   - Increase timeout values if needed

2. **Authentication Failures**
   - Verify API keys and credentials
   - Check service permissions and access levels
   - Ensure credentials are properly configured

3. **Database Connection Issues**
   - Verify database connection parameters
   - Ensure database is running and accessible
   - Check user permissions for test operations

4. **SMTP Configuration Issues**
   - Verify SMTP server settings
   - Check authentication credentials
   - Test SMTP connectivity outside the application

### Debug Mode

Enable detailed logging by setting:
```bash
N8N_ENABLE_LOGGING=true
NODE_ENV=development
```

### Service Health Checks

Use the external service validation utilities to diagnose issues:

```typescript
import { n8nValidator, emailValidator, externalServiceUtils } from '../helpers/external-services';

// Check n8n service
const n8nReport = await n8nValidator.validateAll();
console.log(n8nReport);

// Check email service
const emailReport = await emailValidator.validateAll();
console.log(emailReport);

// Generate comprehensive report
const report = externalServiceUtils.createValidationReport(n8nReport, emailReport);
externalServiceUtils.printValidationReport(report);
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Integration Tests
on: [push, pull_request]

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: test_password
          MYSQL_DATABASE: test_db
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3

    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd backend
          npm install

      - name: Run integration tests
        run: |
          cd backend
          RUN_DB_TESTS=true npm test -- tests/integration/
        env:
          N8N_BASE_URL: ${{ secrets.N8N_BASE_URL }}
          N8N_API_KEY: ${{ secrets.N8N_API_KEY }}
          SMTP_HOST: ${{ secrets.SMTP_HOST }}
          SMTP_USER: ${{ secrets.SMTP_USER }}
          SMTP_PASS: ${{ secrets.SMTP_PASS }}
          DB_HOST: 127.0.0.1
          DB_PORT: 3306
          DB_NAME: test_db
          DB_USER: root
          DB_PASSWORD: test_password
```

## Production Considerations

### Security
- Never commit real API keys or passwords to version control
- Use environment variables or secure secret management
- Rotate test credentials regularly
- Limit test account permissions to minimum required

### Performance
- Integration tests may take longer than unit tests
- Consider running integration tests separately from unit tests
- Use appropriate timeouts for network operations
- Monitor test execution times for performance regression

### Monitoring
- Set up alerts for integration test failures in CI/CD
- Monitor external service availability
- Track test execution metrics and success rates

## Contributing

When adding new integration tests:

1. Follow existing patterns in `external-services.ts` helper
2. Include comprehensive error handling and service degradation tests
3. Add appropriate logging and diagnostic information
4. Update this README with new test descriptions
5. Ensure tests work in both service-available and service-unavailable modes

## Related Documentation

- [N8n Service Documentation](../../src/services/N8nService.ts)
- [Alert Service Documentation](../../src/services/AlertService.ts)
- [External Service Validation](../helpers/external-services.ts)
- [Database Test Helpers](../helpers/database.ts)