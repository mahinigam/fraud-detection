#!/bin/bash

# Fraud Detection System - Test Runner Script
# This script runs the comprehensive testing suite

set -e

echo "🧪 Starting Fraud Detection System Test Suite"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the frontend directory"
    exit 1
fi

# Parse command line arguments
RUN_UNIT=true
RUN_INTEGRATION=true
RUN_E2E=false
COVERAGE=false
WATCH=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --unit-only)
            RUN_INTEGRATION=false
            RUN_E2E=false
            shift
            ;;
        --integration-only)
            RUN_UNIT=false
            RUN_E2E=false
            shift
            ;;
        --e2e-only)
            RUN_UNIT=false
            RUN_INTEGRATION=false
            RUN_E2E=true
            shift
            ;;
        --all)
            RUN_E2E=true
            shift
            ;;
        --coverage)
            COVERAGE=true
            shift
            ;;
        --watch)
            WATCH=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --unit-only         Run only unit tests"
            echo "  --integration-only  Run only integration tests"  
            echo "  --e2e-only         Run only E2E tests"
            echo "  --all              Run all tests including E2E"
            echo "  --coverage         Generate coverage report"
            echo "  --watch            Run tests in watch mode"
            echo "  --help             Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm install
fi

# Create test results directory
mkdir -p test-results

# Function to run unit tests
run_unit_tests() {
    print_status "Running unit tests..."
    
    if [ "$COVERAGE" = true ]; then
        if [ "$WATCH" = true ]; then
            npm run test:coverage -- --watch
        else
            npm run test:coverage
        fi
    else
        if [ "$WATCH" = true ]; then
            npm run test -- --watch
        else
            npm run test
        fi
    fi
    
    if [ $? -eq 0 ]; then
        print_success "Unit tests passed ✅"
        return 0
    else
        print_error "Unit tests failed ❌"
        return 1
    fi
}

# Function to run integration tests
run_integration_tests() {
    print_status "Running integration tests..."
    
    # Integration tests are part of the Vitest suite
    # but we can run them specifically with patterns
    if [ "$WATCH" = true ]; then
        npm run test -- --watch "integration|Integration"
    else
        npm run test "integration|Integration"
    fi
    
    if [ $? -eq 0 ]; then
        print_success "Integration tests passed ✅"
        return 0
    else
        print_error "Integration tests failed ❌"
        return 1
    fi
}

# Function to run E2E tests
run_e2e_tests() {
    print_status "Running E2E tests..."
    
    # Check if dev server is running
    if ! curl -s http://localhost:5173 > /dev/null; then
        print_status "Starting dev server for E2E tests..."
        npm run dev &
        DEV_SERVER_PID=$!
        
        # Wait for server to start
        print_status "Waiting for dev server to be ready..."
        for i in {1..30}; do
            if curl -s http://localhost:5173 > /dev/null; then
                break
            fi
            sleep 2
        done
        
        if ! curl -s http://localhost:5173 > /dev/null; then
            print_error "Dev server failed to start"
            kill $DEV_SERVER_PID 2>/dev/null || true
            return 1
        fi
    fi
    
    # Run Playwright tests
    npm run test:e2e
    E2E_EXIT_CODE=$?
    
    # Kill dev server if we started it
    if [ ! -z "$DEV_SERVER_PID" ]; then
        print_status "Stopping dev server..."
        kill $DEV_SERVER_PID 2>/dev/null || true
    fi
    
    if [ $E2E_EXIT_CODE -eq 0 ]; then
        print_success "E2E tests passed ✅"
        return 0
    else
        print_error "E2E tests failed ❌"
        return 1
    fi
}

# Function to generate test report
generate_report() {
    print_status "Generating test report..."
    
    # Create HTML report combining all test results
    cat > test-results/index.html << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fraud Detection System - Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 8px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        .success { border-color: #4caf50; background: #f1f8e9; }
        .error { border-color: #f44336; background: #ffebee; }
        .warning { border-color: #ff9800; background: #fff3e0; }
        .coverage-bar { width: 100%; height: 20px; background: #f0f0f0; border-radius: 10px; overflow: hidden; }
        .coverage-fill { height: 100%; background: linear-gradient(90deg, #f44336 0%, #ff9800 50%, #4caf50 80%); }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧪 Fraud Detection System Test Report</h1>
        <p>Generated on: $(date)</p>
    </div>
    
    <div class="section">
        <h2>📊 Test Summary</h2>
        <p>This report shows the results of all automated tests for the Fraud Detection System.</p>
    </div>
    
    <div class="section">
        <h2>📁 Available Reports</h2>
        <ul>
            <li><a href="coverage/index.html">Code Coverage Report</a></li>
            <li><a href="playwright-report/index.html">E2E Test Report</a></li>
            <li><a href="vitest-report.html">Unit Test Report</a></li>
        </ul>
    </div>
    
    <div class="section">
        <h2>🔧 Test Environment</h2>
        <ul>
            <li>Node.js: $(node --version)</li>
            <li>npm: $(npm --version)</li>
            <li>Browser: Chromium (Playwright)</li>
            <li>Test Framework: Vitest + Playwright</li>
        </ul>
    </div>
</body>
</html>
EOF
    
    print_success "Test report generated at test-results/index.html"
}

# Main execution
print_status "Test configuration:"
echo "  Unit tests: $RUN_UNIT"
echo "  Integration tests: $RUN_INTEGRATION" 
echo "  E2E tests: $RUN_E2E"
echo "  Coverage: $COVERAGE"
echo "  Watch mode: $WATCH"
echo ""

OVERALL_SUCCESS=true

# Run unit tests
if [ "$RUN_UNIT" = true ]; then
    if ! run_unit_tests; then
        OVERALL_SUCCESS=false
    fi
fi

# Run integration tests  
if [ "$RUN_INTEGRATION" = true ]; then
    if ! run_integration_tests; then
        OVERALL_SUCCESS=false
    fi
fi

# Run E2E tests
if [ "$RUN_E2E" = true ]; then
    if ! run_e2e_tests; then
        OVERALL_SUCCESS=false
    fi
fi

# Generate report (only if not in watch mode)
if [ "$WATCH" = false ]; then
    generate_report
fi

# Final result
echo ""
echo "=============================================="
if [ "$OVERALL_SUCCESS" = true ]; then
    print_success "🎉 All tests completed successfully!"
    
    if [ "$COVERAGE" = true ]; then
        print_status "📊 Coverage report available at: test-results/coverage/index.html"
    fi
    
    if [ "$RUN_E2E" = true ]; then
        print_status "🎭 E2E report available at: test-results/playwright-report/index.html"  
    fi
    
    print_status "📋 Combined report available at: test-results/index.html"
    exit 0
else
    print_error "❌ Some tests failed. Check the output above for details."
    exit 1
fi