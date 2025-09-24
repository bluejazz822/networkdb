#!/bin/bash

# Cloud Network CMDB - Test Coverage Analysis Script
# Ensures >95% test coverage across all reporting functionality

set -e

echo "🧪 Starting comprehensive test coverage analysis..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
TARGET_COVERAGE=95
COVERAGE_DIR="coverage"
REPORTS_DIR="coverage-reports"

# Create directories
mkdir -p $REPORTS_DIR

echo "📋 Test Configuration:"
echo "  Target Coverage: ${TARGET_COVERAGE}%"
echo "  Coverage Directory: $COVERAGE_DIR"
echo "  Reports Directory: $REPORTS_DIR"
echo ""

# Clean previous coverage data
echo "🧹 Cleaning previous coverage data..."
rm -rf $COVERAGE_DIR
rm -rf node_modules/.cache

# Set environment for testing
export NODE_ENV=test
export RUN_DB_TESTS=true

echo "🔧 Installing dependencies..."
npm ci --silent

echo "🏗️  Building project..."
npm run build --silent

# Run different test suites with coverage
echo ""
echo "🚀 Running Unit Tests..."
npx jest \
  --coverage \
  --coverageDirectory=$COVERAGE_DIR/unit \
  --testPathPattern=".*\.test\.ts$" \
  --testPathIgnorePatterns="integration|e2e|performance" \
  --collectCoverageFrom="src/**/*.ts" \
  --collectCoverageFrom="!src/**/*.d.ts" \
  --collectCoverageFrom="!src/**/index.ts" \
  --collectCoverageFrom="!src/tests/**/*" \
  --coverageReporters=json \
  --coverageReporters=lcov \
  --coverageReporters=text \
  --coverageReporters=html \
  --verbose

echo ""
echo "🔗 Running Integration Tests..."
npx jest \
  --coverage \
  --coverageDirectory=$COVERAGE_DIR/integration \
  --testPathPattern="integration.*\.test\.ts$" \
  --collectCoverageFrom="src/**/*.ts" \
  --collectCoverageFrom="!src/**/*.d.ts" \
  --collectCoverageFrom="!src/**/index.ts" \
  --collectCoverageFrom="!src/tests/**/*" \
  --coverageReporters=json \
  --coverageReporters=lcov \
  --coverageReporters=text \
  --coverageReporters=html \
  --testTimeout=30000 \
  --verbose

echo ""
echo "🎯 Running End-to-End Tests..."
npx jest \
  --coverage \
  --coverageDirectory=$COVERAGE_DIR/e2e \
  --testPathPattern="e2e.*\.test\.ts$" \
  --collectCoverageFrom="src/**/*.ts" \
  --collectCoverageFrom="!src/**/*.d.ts" \
  --collectCoverageFrom="!src/**/index.ts" \
  --collectCoverageFrom="!src/tests/**/*" \
  --coverageReporters=json \
  --coverageReporters=lcov \
  --coverageReporters=text \
  --coverageReporters=html \
  --testTimeout=60000 \
  --verbose

echo ""
echo "⚡ Running Performance Tests..."
npx jest \
  --coverage \
  --coverageDirectory=$COVERAGE_DIR/performance \
  --testPathPattern="performance.*\.test\.ts$" \
  --collectCoverageFrom="src/**/*.ts" \
  --collectCoverageFrom="!src/**/*.d.ts" \
  --collectCoverageFrom="!src/**/index.ts" \
  --collectCoverageFrom="!src/tests/**/*" \
  --coverageReporters=json \
  --coverageReporters=lcov \
  --coverageReporters=text \
  --coverageReporters=html \
  --testTimeout=120000 \
  --verbose

# Merge coverage reports
echo ""
echo "🔄 Merging coverage reports..."

# Install nyc for merging coverage
if ! command -v nyc &> /dev/null; then
    echo "Installing nyc for coverage merging..."
    npm install -g nyc
fi

# Merge all coverage files
mkdir -p $COVERAGE_DIR/merged
nyc merge $COVERAGE_DIR/unit $COVERAGE_DIR/merged/coverage-unit.json
nyc merge $COVERAGE_DIR/integration $COVERAGE_DIR/merged/coverage-integration.json
nyc merge $COVERAGE_DIR/e2e $COVERAGE_DIR/merged/coverage-e2e.json
nyc merge $COVERAGE_DIR/performance $COVERAGE_DIR/merged/coverage-performance.json

# Generate combined report
echo "📊 Generating combined coverage report..."
nyc report \
  --temp-dir $COVERAGE_DIR/merged \
  --reporter=text \
  --reporter=html \
  --reporter=lcov \
  --reporter=json-summary \
  --report-dir $COVERAGE_DIR/combined

# Create detailed coverage analysis
echo ""
echo "📈 Analyzing coverage by component..."

# Function to extract coverage percentage from JSON
get_coverage() {
    local json_file=$1
    if [ -f "$json_file" ]; then
        node -e "
            const fs = require('fs');
            const coverage = JSON.parse(fs.readFileSync('$json_file', 'utf8'));
            const lines = coverage.total.lines.pct;
            const statements = coverage.total.statements.pct;
            const functions = coverage.total.functions.pct;
            const branches = coverage.total.branches.pct;
            console.log(\`Lines: \${lines}% | Statements: \${statements}% | Functions: \${functions}% | Branches: \${branches}%\`);
            console.log(\`Overall: \${Math.min(lines, statements, functions, branches)}%\`);
        "
    else
        echo "Coverage file not found: $json_file"
        return 1
    fi
}

# Analyze each test suite
echo ""
echo "📋 Coverage Results by Test Suite:"
echo "=================================="

echo "Unit Tests:"
get_coverage "$COVERAGE_DIR/unit/coverage-summary.json"

echo ""
echo "Integration Tests:"
get_coverage "$COVERAGE_DIR/integration/coverage-summary.json"

echo ""
echo "End-to-End Tests:"
get_coverage "$COVERAGE_DIR/e2e/coverage-summary.json"

echo ""
echo "Performance Tests:"
get_coverage "$COVERAGE_DIR/performance/coverage-summary.json"

echo ""
echo "Combined Coverage:"
get_coverage "$COVERAGE_DIR/combined/coverage-summary.json"

# Extract overall coverage percentage
OVERALL_COVERAGE=$(node -e "
    const fs = require('fs');
    try {
        const coverage = JSON.parse(fs.readFileSync('$COVERAGE_DIR/combined/coverage-summary.json', 'utf8'));
        const overall = Math.min(
            coverage.total.lines.pct,
            coverage.total.statements.pct,
            coverage.total.functions.pct,
            coverage.total.branches.pct
        );
        console.log(overall);
    } catch(e) {
        console.log('0');
    }
")

echo ""
echo "🎯 Final Coverage Analysis:"
echo "=========================="
echo "Overall Coverage: ${OVERALL_COVERAGE}%"
echo "Target Coverage: ${TARGET_COVERAGE}%"

# Generate detailed component analysis
echo ""
echo "📊 Generating component-specific coverage analysis..."

# Create component coverage analysis script
cat > analyze-coverage.js << 'EOF'
const fs = require('fs');
const path = require('path');

function analyzeCoverage() {
    try {
        const coverageFile = './coverage/combined/coverage-final.json';
        if (!fs.existsSync(coverageFile)) {
            console.log('Combined coverage file not found');
            return;
        }

        const coverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));

        console.log('\n📋 Detailed Coverage Analysis by Component:');
        console.log('============================================');

        const components = {
            'Reporting Services': [],
            'Export Services': [],
            'Database Queries': [],
            'API Routes': [],
            'Middleware': [],
            'Utilities': [],
            'Other': []
        };

        // Categorize files
        Object.keys(coverage).forEach(filePath => {
            const relativePath = filePath.replace(process.cwd(), '').replace(/^\//, '');

            if (relativePath.includes('services/reporting/')) {
                components['Reporting Services'].push({ path: relativePath, coverage: coverage[filePath] });
            } else if (relativePath.includes('services/') && relativePath.includes('export')) {
                components['Export Services'].push({ path: relativePath, coverage: coverage[filePath] });
            } else if (relativePath.includes('database/queries')) {
                components['Database Queries'].push({ path: relativePath, coverage: coverage[filePath] });
            } else if (relativePath.includes('routes/') || relativePath.includes('api/')) {
                components['API Routes'].push({ path: relativePath, coverage: coverage[filePath] });
            } else if (relativePath.includes('middleware/')) {
                components['Middleware'].push({ path: relativePath, coverage: coverage[filePath] });
            } else if (relativePath.includes('utils/') || relativePath.includes('helpers/')) {
                components['Utilities'].push({ path: relativePath, coverage: coverage[filePath] });
            } else {
                components['Other'].push({ path: relativePath, coverage: coverage[filePath] });
            }
        });

        // Report by component
        Object.entries(components).forEach(([componentName, files]) => {
            if (files.length === 0) return;

            console.log(`\n${componentName}:`);
            console.log('-'.repeat(componentName.length + 1));

            let totalLines = 0, coveredLines = 0;
            let totalStatements = 0, coveredStatements = 0;
            let totalFunctions = 0, coveredFunctions = 0;
            let totalBranches = 0, coveredBranches = 0;

            files.forEach(file => {
                const cov = file.coverage;
                if (cov.lines) {
                    totalLines += cov.lines.total;
                    coveredLines += cov.lines.covered;
                }
                if (cov.statements) {
                    totalStatements += cov.statements.total;
                    coveredStatements += cov.statements.covered;
                }
                if (cov.functions) {
                    totalFunctions += cov.functions.total;
                    coveredFunctions += cov.functions.covered;
                }
                if (cov.branches) {
                    totalBranches += cov.branches.total;
                    coveredBranches += cov.branches.covered;
                }

                const lineCov = cov.lines ? Math.round(cov.lines.pct) : 0;
                const stmtCov = cov.statements ? Math.round(cov.statements.pct) : 0;
                const funcCov = cov.functions ? Math.round(cov.functions.pct) : 0;
                const branchCov = cov.branches ? Math.round(cov.branches.pct) : 0;
                const overall = Math.min(lineCov, stmtCov, funcCov, branchCov);

                const status = overall >= 95 ? '✅' : overall >= 80 ? '⚠️ ' : '❌';
                console.log(`  ${status} ${file.path.split('/').pop().padEnd(40)} ${overall.toString().padStart(3)}%`);
            });

            const compLineCov = totalLines > 0 ? Math.round((coveredLines / totalLines) * 100) : 0;
            const compStmtCov = totalStatements > 0 ? Math.round((coveredStatements / totalStatements) * 100) : 0;
            const compFuncCov = totalFunctions > 0 ? Math.round((coveredFunctions / totalFunctions) * 100) : 0;
            const compBranchCov = totalBranches > 0 ? Math.round((coveredBranches / totalBranches) * 100) : 0;
            const compOverall = Math.min(compLineCov, compStmtCov, compFuncCov, compBranchCov);

            console.log(`  ${'='.repeat(50)}`);
            console.log(`  Component Overall: ${compOverall}% (L:${compLineCov}% S:${compStmtCov}% F:${compFuncCov}% B:${compBranchCov}%)`);
        });

        // Identify low coverage files
        console.log('\n⚠️  Files Below 95% Coverage:');
        console.log('==============================');

        const lowCoverageFiles = [];
        Object.keys(coverage).forEach(filePath => {
            const cov = coverage[filePath];
            const lineCov = cov.lines ? cov.lines.pct : 0;
            const stmtCov = cov.statements ? cov.statements.pct : 0;
            const funcCov = cov.functions ? cov.functions.pct : 0;
            const branchCov = cov.branches ? cov.branches.pct : 0;
            const overall = Math.min(lineCov, stmtCov, funcCov, branchCov);

            if (overall < 95) {
                lowCoverageFiles.push({
                    path: filePath.replace(process.cwd(), '').replace(/^\//, ''),
                    coverage: overall,
                    details: { lines: lineCov, statements: stmtCov, functions: funcCov, branches: branchCov }
                });
            }
        });

        if (lowCoverageFiles.length === 0) {
            console.log('🎉 All files have ≥95% coverage!');
        } else {
            lowCoverageFiles
                .sort((a, b) => a.coverage - b.coverage)
                .forEach(file => {
                    console.log(`❌ ${file.path}`);
                    console.log(`   Overall: ${file.coverage.toFixed(1)}%`);
                    console.log(`   Lines: ${file.details.lines.toFixed(1)}% | Statements: ${file.details.statements.toFixed(1)}% | Functions: ${file.details.functions.toFixed(1)}% | Branches: ${file.details.branches.toFixed(1)}%`);
                    console.log('');
                });
        }

    } catch (error) {
        console.error('Error analyzing coverage:', error.message);
    }
}

analyzeCoverage();
EOF

# Copy coverage file for analysis
if [ -f "$COVERAGE_DIR/combined/coverage-final.json" ]; then
    node analyze-coverage.js
else
    echo "⚠️  Combined coverage file not found, skipping detailed analysis"
fi

# Generate coverage badge
echo ""
echo "🏆 Generating coverage badge..."

# Create coverage badge
if (( $(echo "$OVERALL_COVERAGE >= $TARGET_COVERAGE" | bc -l) )); then
    BADGE_COLOR="brightgreen"
    BADGE_STATUS="✅ PASSED"
else
    BADGE_COLOR="red"
    BADGE_STATUS="❌ FAILED"
fi

# Generate HTML coverage report
echo ""
echo "📄 Generating HTML coverage report..."
cat > $REPORTS_DIR/coverage-report.html << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Network CMDB - Coverage Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .metric { display: inline-block; margin: 10px; padding: 10px; border-radius: 3px; min-width: 100px; text-align: center; }
        .pass { background: #d4edda; color: #155724; }
        .fail { background: #f8d7da; color: #721c24; }
        .warn { background: #fff3cd; color: #856404; }
        .summary { margin: 20px 0; }
        .coverage-bar { width: 100%; height: 20px; background: #f0f0f0; border-radius: 10px; overflow: hidden; }
        .coverage-fill { height: 100%; background: linear-gradient(90deg, #ff4757, #ffa502, #2ed573); }
    </style>
</head>
<body>
    <div class="header">
        <h1>Cloud Network CMDB - Test Coverage Report</h1>
        <p>Generated: $(date)</p>
        <p>Target Coverage: ${TARGET_COVERAGE}%</p>
    </div>

    <div class="summary">
        <h2>Overall Coverage: ${OVERALL_COVERAGE}%</h2>
        <div class="coverage-bar">
            <div class="coverage-fill" style="width: ${OVERALL_COVERAGE}%"></div>
        </div>
        <p class="$([ "$OVERALL_COVERAGE" -ge "$TARGET_COVERAGE" ] && echo "pass" || echo "fail")">
            Status: $BADGE_STATUS
        </p>
    </div>

    <div>
        <h3>Coverage by Test Suite</h3>
        <iframe src="../coverage/unit/lcov-report/index.html" width="100%" height="300" title="Unit Test Coverage"></iframe>
        <iframe src="../coverage/integration/lcov-report/index.html" width="100%" height="300" title="Integration Test Coverage"></iframe>
        <iframe src="../coverage/e2e/lcov-report/index.html" width="100%" height="300" title="E2E Test Coverage"></iframe>
        <iframe src="../coverage/performance/lcov-report/index.html" width="100%" height="300" title="Performance Test Coverage"></iframe>
        <iframe src="../coverage/combined/lcov-report/index.html" width="100%" height="400" title="Combined Coverage"></iframe>
    </div>

    <div>
        <h3>Quick Links</h3>
        <ul>
            <li><a href="../coverage/combined/lcov-report/index.html">Detailed Combined Coverage Report</a></li>
            <li><a href="../coverage/unit/lcov-report/index.html">Unit Test Coverage</a></li>
            <li><a href="../coverage/integration/lcov-report/index.html">Integration Test Coverage</a></li>
            <li><a href="../coverage/e2e/lcov-report/index.html">End-to-End Test Coverage</a></li>
            <li><a href="../coverage/performance/lcov-report/index.html">Performance Test Coverage</a></li>
        </ul>
    </div>
</body>
</html>
EOF

# Clean up temporary files
rm -f analyze-coverage.js

# Final results
echo ""
echo "🎯 COVERAGE ANALYSIS COMPLETE"
echo "============================="
echo "Overall Coverage: ${OVERALL_COVERAGE}%"
echo "Target Coverage: ${TARGET_COVERAGE}%"
echo "Status: $BADGE_STATUS"
echo ""
echo "📁 Reports Generated:"
echo "  - HTML Report: $REPORTS_DIR/coverage-report.html"
echo "  - Combined LCOV: $COVERAGE_DIR/combined/lcov-report/index.html"
echo "  - Unit Tests: $COVERAGE_DIR/unit/lcov-report/index.html"
echo "  - Integration Tests: $COVERAGE_DIR/integration/lcov-report/index.html"
echo "  - E2E Tests: $COVERAGE_DIR/e2e/lcov-report/index.html"
echo "  - Performance Tests: $COVERAGE_DIR/performance/lcov-report/index.html"
echo ""

# Check if coverage meets target
if (( $(echo "$OVERALL_COVERAGE >= $TARGET_COVERAGE" | bc -l) )); then
    echo -e "${GREEN}🎉 SUCCESS: Coverage target of ${TARGET_COVERAGE}% achieved!${NC}"
    echo -e "${GREEN}✅ All tests passed with ${OVERALL_COVERAGE}% coverage${NC}"
    exit 0
else
    echo -e "${RED}❌ FAILURE: Coverage of ${OVERALL_COVERAGE}% is below target of ${TARGET_COVERAGE}%${NC}"
    echo -e "${YELLOW}⚠️  Please add more tests to increase coverage${NC}"
    exit 1
fi