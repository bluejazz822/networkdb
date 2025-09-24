# Cloud Network CMDB Reporting - User Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Creating Reports](#creating-reports)
4. [Advanced Filtering](#advanced-filtering)
5. [Data Export](#data-export)
6. [Analytics and Insights](#analytics-and-insights)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)
9. [FAQ](#faq)

---

## Getting Started

### Prerequisites

- Access to the Cloud Network CMDB web interface
- Valid user credentials with reporting permissions
- Modern web browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)

### Initial Setup

1. **Login to the System**
   - Navigate to your organization's CMDB URL
   - Enter your credentials
   - Verify your role includes reporting permissions

2. **Verify Data Access**
   - Check that you can see network resources in the main interface
   - Ensure your account has access to the cloud providers you need to report on

3. **Understand Your Permissions**
   - **Viewer:** Can view reports and export data
   - **Analyst:** Can create custom reports and access advanced features
   - **Admin:** Full access to all reporting features and analytics

---

## Dashboard Overview

### Main Dashboard

The reporting dashboard provides a high-level overview of your network infrastructure:

#### Key Metrics Panel
- **Total Resources:** Combined count of all network resources
- **Health Status:** Overall health percentage and distribution
- **Recent Activity:** Latest changes and updates
- **Utilization Metrics:** Resource usage and capacity information

#### Resource Count Widgets
- **VPCs:** Virtual Private Clouds across all providers
- **Transit Gateways:** Inter-VPC connectivity hubs
- **Customer Gateways:** VPN connection endpoints
- **VPC Endpoints:** Private service connections

#### Health Status Indicator
- **Green (Healthy):** Resources operating normally
- **Yellow (Warning):** Resources requiring attention
- **Red (Critical):** Resources with critical issues

### Real-time Updates

The dashboard refreshes automatically every 30 seconds to provide current information. You can also manually refresh by clicking the refresh button in the top-right corner.

---

## Creating Reports

### Quick Start Report

1. **Navigate to Reports**
   - Click "Reports" in the main navigation
   - Select "Create New Report"

2. **Choose Resource Type**
   - VPCs
   - Transit Gateways
   - Customer Gateways
   - VPC Endpoints

3. **Select Fields**
   - Choose which data columns to include
   - Common fields: ID, Name, Status, Region, Provider

4. **Apply Basic Filters** (Optional)
   - Filter by status (Active, Inactive, etc.)
   - Filter by region
   - Filter by cloud provider

5. **Run Report**
   - Click "Execute Report"
   - Review results in the data table

### Advanced Report Builder

#### Step 1: Define Scope
```
Resource Types: ☑ VPCs ☑ Transit Gateways ☐ Customer Gateways
Fields: vpc_id, cidr_block, state, region, account_id, provider
```

#### Step 2: Set Filters
```
Filter 1: State equals "available"
Filter 2: Region in ["us-east-1", "us-west-2", "eu-west-1"]
Filter 3: Created date > "2024-01-01"
```

#### Step 3: Configure Sorting
```
Primary Sort: Region (Ascending)
Secondary Sort: Created Date (Descending)
```

#### Step 4: Set Limits
```
Maximum Results: 500 rows
```

### Report Templates

#### Infrastructure Health Report
- **Purpose:** Identify resources requiring attention
- **Filters:** Status ≠ "available"
- **Fields:** ID, Name, Status, Region, Last Updated
- **Frequency:** Daily

#### Regional Distribution Report
- **Purpose:** Analyze resource distribution across regions
- **Aggregation:** Count by Region
- **Fields:** Region, Resource Count, Provider
- **Frequency:** Weekly

#### Compliance Audit Report
- **Purpose:** Generate data for compliance audits
- **Filters:** None (complete inventory)
- **Fields:** All available fields
- **Format:** Excel with metadata
- **Frequency:** Monthly

#### Cost Optimization Report
- **Purpose:** Identify unused or underutilized resources
- **Filters:** Status = "available" AND Last Activity > 30 days
- **Fields:** ID, Name, Size, Region, Last Activity
- **Frequency:** Weekly

---

## Advanced Filtering

### Filter Operators

#### Exact Match
- **Equals:** Field exactly matches value
- **Not Equals:** Field does not match value
- **Example:** `region equals "us-east-1"`

#### Range Operators
- **Greater Than:** Numeric or date values
- **Less Than:** Numeric or date values
- **Example:** `created_date greater_than "2024-01-01"`

#### List Operators
- **In:** Field value is in provided list
- **Not In:** Field value is not in provided list
- **Example:** `provider in ["aws", "azure"]`

#### Text Operators
- **Like:** Pattern matching with wildcards
- **Starts With:** Text starts with specified value
- **Example:** `name like "prod-%"`

#### Existence Operators
- **Exists:** Field has a value (not null)
- **Not Exists:** Field is null or empty
- **Example:** `description exists`

### Complex Filter Examples

#### Multi-Provider Health Check
```json
{
  "filters": [
    {
      "field": "provider",
      "operator": "in",
      "values": ["aws", "azure", "gcp"]
    },
    {
      "field": "state",
      "operator": "not_equals",
      "value": "available"
    },
    {
      "field": "last_checked",
      "operator": "greater_than",
      "value": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### Security Compliance Filter
```json
{
  "filters": [
    {
      "field": "encryption_enabled",
      "operator": "equals",
      "value": true
    },
    {
      "field": "public_access",
      "operator": "equals",
      "value": false
    },
    {
      "field": "compliance_tags",
      "operator": "exists"
    }
  ]
}
```

#### Cost Analysis Filter
```json
{
  "filters": [
    {
      "field": "instance_size",
      "operator": "in",
      "values": ["large", "xlarge", "2xlarge"]
    },
    {
      "field": "utilization_percent",
      "operator": "less_than",
      "value": 30
    },
    {
      "field": "cost_per_month",
      "operator": "greater_than",
      "value": 1000
    }
  ]
}
```

---

## Data Export

### Supported Formats

#### CSV (Comma-Separated Values)
- **Best for:** Large datasets, data analysis
- **Features:** Compression support, UTF-8 encoding
- **Limitations:** No formatting, flat structure only

#### Excel (.xlsx)
- **Best for:** Business reports, formatted presentation
- **Features:** Multiple sheets, formatting, formulas
- **Limitations:** File size limits (100MB max)

#### JSON
- **Best for:** API integration, data processing
- **Features:** Hierarchical data, metadata inclusion
- **Limitations:** Larger file sizes

#### PDF
- **Best for:** Document sharing, archival
- **Features:** Professional formatting, charts
- **Limitations:** Not editable, fixed layout

#### HTML
- **Best for:** Web viewing, email sharing
- **Features:** Interactive tables, styling
- **Limitations:** Limited data processing

### Export Process

1. **Create or Execute Report**
   - Generate the report with desired filters
   - Verify data is correct in preview

2. **Choose Export Format**
   - Select format based on intended use
   - Configure format-specific options

3. **Set Export Options**
   - Include metadata (timestamps, query info)
   - Enable compression for large files
   - Select specific fields for Excel exports

4. **Download File**
   - Export is processed server-side
   - Download link provided when ready
   - Files expire after 24 hours

### Export Options

#### Metadata Inclusion
```json
{
  "includeMetadata": true,
  "metadata": {
    "exportedAt": "2024-01-15T10:30:00Z",
    "totalRecords": 1250,
    "queryFilters": [...],
    "executionTime": 2340
  }
}
```

#### CSV Compression
```json
{
  "format": "csv",
  "options": {
    "compression": "gzip",
    "encoding": "utf-8"
  }
}
```

#### Excel Customization
```json
{
  "format": "excel",
  "options": {
    "customFields": ["id", "name", "status", "region"],
    "includeCharts": true,
    "autoFilter": true
  }
}
```

### Large Dataset Export

For datasets exceeding 10,000 records:

1. **Use Pagination**
   - Split exports into smaller batches
   - Export 5,000-10,000 records at a time

2. **Apply Strategic Filters**
   - Filter by date ranges
   - Filter by regions or providers
   - Use status filters to reduce size

3. **Choose Appropriate Format**
   - CSV for maximum efficiency
   - JSON for structured data
   - Avoid PDF for large datasets

4. **Monitor Export Status**
   - Large exports may take several minutes
   - Check export queue status
   - Download when complete

---

## Analytics and Insights

### Usage Analytics

#### Report Execution Metrics
- **Most Popular Reports:** Frequently run report types
- **Execution Times:** Performance trends over time
- **Error Rates:** Failed report percentages
- **User Activity:** Report usage by user and time

#### System Performance
- **Average Response Times:** Query performance metrics
- **Peak Usage Hours:** When system is most active
- **Data Volume Trends:** Growing dataset sizes
- **Export Pattern Analysis:** Popular export formats

### Business Intelligence

#### Resource Trends
- **Growth Patterns:** Resource count changes over time
- **Regional Distribution:** Geographic resource spread
- **Provider Adoption:** Multi-cloud usage patterns
- **Health Score Trends:** Infrastructure health over time

#### Operational Insights
- **Incident Correlation:** Link reports to operational events
- **Capacity Planning:** Resource growth projections
- **Compliance Tracking:** Audit trail maintenance
- **Cost Attribution:** Resource cost analysis

### Custom Dashboards

#### Executive Dashboard
- High-level KPIs
- Health score summaries
- Trend visualizations
- Exception alerts

#### Operations Dashboard
- Real-time status monitoring
- Capacity utilization
- Performance metrics
- Alert management

#### Compliance Dashboard
- Audit trail reports
- Policy compliance status
- Security posture metrics
- Regulatory requirements

---

## Best Practices

### Report Design

#### 1. Start Simple
- Begin with basic filters
- Add complexity gradually
- Test with small datasets first
- Validate results before scaling

#### 2. Use Meaningful Names
- Descriptive report names
- Clear filter descriptions
- Consistent naming conventions
- Version control for templates

#### 3. Optimize Performance
- Apply filters early
- Use appropriate limits
- Avoid unnecessary fields
- Consider data freshness needs

### Data Management

#### 1. Regular Maintenance
- Review and update report templates
- Archive obsolete reports
- Clean up old export files
- Monitor storage usage

#### 2. Quality Assurance
- Validate data accuracy
- Cross-check with source systems
- Test report logic regularly
- Document any known limitations

#### 3. Security Considerations
- Limit access to sensitive data
- Use appropriate user permissions
- Secure export file handling
- Audit report access

### Operational Efficiency

#### 1. Automation
- Schedule recurring reports
- Set up automated exports
- Configure alert thresholds
- Use API for integration

#### 2. Collaboration
- Share report templates
- Document common use cases
- Train team members
- Establish review processes

#### 3. Performance Monitoring
- Track report execution times
- Monitor system resource usage
- Optimize slow-running reports
- Scale infrastructure as needed

---

## Troubleshooting

### Common Issues

#### Report Execution Fails

**Symptoms:**
- Error message during report execution
- Report hangs or times out
- Empty result sets

**Solutions:**
1. **Check Filters:**
   - Verify filter syntax is correct
   - Ensure date formats are valid
   - Check for typos in field names

2. **Reduce Dataset Size:**
   - Add more restrictive filters
   - Reduce the limit parameter
   - Focus on specific time ranges

3. **Verify Permissions:**
   - Confirm access to requested resources
   - Check provider-specific permissions
   - Validate user role assignments

#### Export Problems

**Symptoms:**
- Export fails to generate
- Downloaded files are corrupted
- Export takes too long

**Solutions:**
1. **Format Selection:**
   - Try different export format
   - Use CSV for large datasets
   - Avoid PDF for > 1000 records

2. **Connection Issues:**
   - Check network connectivity
   - Retry download
   - Clear browser cache

3. **File Size Limits:**
   - Split large exports into batches
   - Use compression options
   - Filter data to reduce size

#### Performance Issues

**Symptoms:**
- Slow report execution
- Dashboard loading delays
- Timeout errors

**Solutions:**
1. **Query Optimization:**
   - Add specific filters
   - Reduce result set size
   - Use indexed fields when possible

2. **System Resources:**
   - Check during off-peak hours
   - Contact administrator if persistent
   - Consider report complexity

3. **Browser Performance:**
   - Clear browser cache
   - Disable unnecessary extensions
   - Try different browser

### Error Messages

#### "Database Connection Timeout"
- **Cause:** Heavy system load or network issues
- **Solution:** Wait and retry, contact support if persistent

#### "Invalid Filter Syntax"
- **Cause:** Malformed filter expressions
- **Solution:** Check filter syntax, use examples as reference

#### "Insufficient Permissions"
- **Cause:** User lacks required access rights
- **Solution:** Contact administrator to review permissions

#### "Export File Too Large"
- **Cause:** Result set exceeds export limits
- **Solution:** Add filters to reduce data size

#### "Rate Limit Exceeded"
- **Cause:** Too many requests in short time period
- **Solution:** Wait before retrying, reduce request frequency

### Getting Help

#### Self-Service Resources
1. **Documentation:** Complete user guides and API docs
2. **Examples:** Sample reports and common use cases
3. **FAQ:** Frequently asked questions
4. **Video Tutorials:** Step-by-step walkthroughs

#### Support Channels
1. **Help Desk:** Submit support tickets for technical issues
2. **User Community:** Connect with other users
3. **Training:** Request additional training sessions
4. **Escalation:** Critical issues escalation path

---

## FAQ

### General Questions

**Q: How often is the data updated?**
A: Data is synchronized from cloud providers every 15 minutes. Dashboard metrics are cached for 5 minutes for performance.

**Q: Can I schedule recurring reports?**
A: Yes, you can schedule reports to run automatically and receive email notifications with exported data.

**Q: What cloud providers are supported?**
A: AWS, Microsoft Azure, Google Cloud Platform, and Oracle Cloud Infrastructure.

**Q: Is there an API available?**
A: Yes, a comprehensive REST API is available for integration with other systems.

### Technical Questions

**Q: What's the maximum number of records I can export?**
A: There's no hard limit, but exports over 50,000 records may take longer and should be split into batches.

**Q: Can I access historical data?**
A: Yes, the system maintains historical data for up to 2 years, depending on your organization's retention policy.

**Q: How do I create custom fields in reports?**
A: Custom fields can be created through calculated expressions or by requesting new data collection from your administrator.

**Q: Can I share reports with external users?**
A: Reports can be exported and shared, but external users cannot access the live system without proper authentication.

### Security Questions

**Q: Is my data encrypted?**
A: Yes, all data is encrypted in transit (TLS 1.3) and at rest (AES-256).

**Q: Who can see my reports?**
A: Only users with appropriate permissions can view reports. Access is controlled by role-based permissions.

**Q: How long are exported files stored?**
A: Export files are automatically deleted after 24 hours for security reasons.

**Q: Can I audit who accessed my reports?**
A: Yes, all report access is logged and can be reviewed through the audit interface.

### Troubleshooting Questions

**Q: Why is my report running slowly?**
A: Large datasets, complex filters, or high system load can cause slow performance. Try adding filters to reduce the data size.

**Q: Why can't I see certain resources?**
A: This is typically due to permission restrictions. Contact your administrator to verify your access rights.

**Q: Why did my export fail?**
A: Common causes include network interruptions, file size limits, or invalid data. Check the error message for specific details.

**Q: How do I report a bug or request a feature?**
A: Use the feedback feature in the application or contact support with detailed information about the issue or request.

---

## Additional Resources

### Documentation Links
- [API Documentation](./api/reporting-api.md)
- [Administrator Guide](./admin/admin-guide.md)
- [Security Guide](./security/security-guide.md)
- [Integration Guide](./integration/integration-guide.md)

### Training Materials
- [Video Tutorial Library](https://training.networkdb.example.com)
- [Hands-on Workshop Schedule](https://training.networkdb.example.com/workshops)
- [Certification Program](https://training.networkdb.example.com/certification)

### Support
- **Email:** [support@networkdb.example.com](mailto:support@networkdb.example.com)
- **Phone:** 1-800-NETWORK (24/7)
- **Chat:** Available through the web interface
- **Community:** [https://community.networkdb.example.com](https://community.networkdb.example.com)

---

*Last updated: January 2024*
*Version: 1.0*