#!/bin/bash

# Network CMDB Configuration Validation Script
# Validates environment configuration for production deployment

set -e

# Configuration
ENV_FILE="${ENV_FILE:-.env.production}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if environment file exists
check_env_file() {
    log "Checking environment file: $ENV_FILE"

    if [ ! -f "$ENV_FILE" ]; then
        error "Environment file not found: $ENV_FILE"
        exit 1
    fi

    success "Environment file found"
}

# Load environment variables
load_env() {
    log "Loading environment variables..."

    # Export variables from env file
    set -a
    source "$ENV_FILE"
    set +a

    success "Environment variables loaded"
}

# Validate required variables
validate_required_vars() {
    log "Validating required variables..."

    local required_vars=(
        "DB_HOST"
        "DB_PORT"
        "DB_NAME"
        "DB_USER"
        "DB_PASSWORD"
        "NODE_ENV"
        "PORT"
        "SESSION_SECRET"
        "JWT_SECRET"
    )

    local missing_vars=()
    local insecure_vars=()

    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done

    # Check for insecure default values
    if [[ "${SESSION_SECRET}" == "CHANGE_ME_TO_SECURE_RANDOM_STRING" ]]; then
        insecure_vars+=("SESSION_SECRET")
    fi

    if [[ "${JWT_SECRET}" == "CHANGE_ME_TO_SECURE_RANDOM_STRING" ]]; then
        insecure_vars+=("JWT_SECRET")
    fi

    # Report missing variables
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        error "Missing required variables: ${missing_vars[*]}"
        return 1
    fi

    # Report insecure variables
    if [[ ${#insecure_vars[@]} -gt 0 ]]; then
        error "Insecure default values found: ${insecure_vars[*]}"
        error "Generate secure secrets with: openssl rand -base64 32"
        return 1
    fi

    success "Required variables validation passed"
}

# Validate database connection
validate_database() {
    log "Validating database connection..."

    if command -v mysql &> /dev/null; then
        if mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1;" "$DB_NAME" >/dev/null 2>&1; then
            success "Database connection successful"
        else
            error "Database connection failed"
            return 1
        fi
    else
        warning "MySQL client not available, skipping database connectivity test"
    fi
}

# Validate network connectivity
validate_network() {
    log "Validating network connectivity..."

    # Check n8n connectivity
    if [ -n "$N8N_BASE_URL" ]; then
        local n8n_host=$(echo "$N8N_BASE_URL" | sed 's|http[s]*://||' | cut -d':' -f1)
        local n8n_port=$(echo "$N8N_BASE_URL" | sed 's|http[s]*://||' | cut -d':' -f2 | cut -d'/' -f1)

        if command -v nc &> /dev/null; then
            if nc -z "$n8n_host" "$n8n_port" 2>/dev/null; then
                success "N8n connectivity check passed"
            else
                warning "N8n service not reachable at $N8N_BASE_URL"
            fi
        else
            warning "netcat not available, skipping network connectivity tests"
        fi
    fi
}

# Validate security configuration
validate_security() {
    log "Validating security configuration..."

    local security_issues=()

    # Check secret lengths
    if [ ${#SESSION_SECRET} -lt 32 ]; then
        security_issues+=("SESSION_SECRET too short (minimum 32 characters)")
    fi

    if [ ${#JWT_SECRET} -lt 32 ]; then
        security_issues+=("JWT_SECRET too short (minimum 32 characters)")
    fi

    # Check database password strength
    if [ ${#DB_PASSWORD} -lt 12 ]; then
        security_issues+=("DB_PASSWORD should be at least 12 characters")
    fi

    # Check production environment
    if [[ "$NODE_ENV" != "production" ]]; then
        security_issues+=("NODE_ENV should be 'production' for production deployment")
    fi

    # Report security issues
    if [[ ${#security_issues[@]} -gt 0 ]]; then
        error "Security configuration issues:"
        for issue in "${security_issues[@]}"; do
            error "  - $issue"
        done
        return 1
    fi

    success "Security configuration validation passed"
}

# Validate performance settings
validate_performance() {
    log "Validating performance configuration..."

    local perf_warnings=()

    # Check database connection limits
    if [ -n "$DB_CONNECTION_LIMIT" ] && [ "$DB_CONNECTION_LIMIT" -lt 5 ]; then
        perf_warnings+=("DB_CONNECTION_LIMIT is very low ($DB_CONNECTION_LIMIT)")
    fi

    # Check cache TTL
    if [ -n "$CACHE_TTL" ] && [ "$CACHE_TTL" -lt 60 ]; then
        perf_warnings+=("CACHE_TTL is very low ($CACHE_TTL seconds)")
    fi

    # Report performance warnings
    if [[ ${#perf_warnings[@]} -gt 0 ]]; then
        warning "Performance configuration warnings:"
        for warn in "${perf_warnings[@]}"; do
            warning "  - $warn"
        done
    fi

    success "Performance configuration validation completed"
}

# Validate file system permissions
validate_filesystem() {
    log "Validating filesystem permissions..."

    local dirs_to_check=("logs" "config" "backups")

    for dir in "${dirs_to_check[@]}"; do
        if [ -d "$dir" ]; then
            if [ -r "$dir" ] && [ -w "$dir" ]; then
                success "Directory $dir permissions OK"
            else
                error "Directory $dir permissions incorrect"
                return 1
            fi
        else
            warning "Directory $dir does not exist (will be created during deployment)"
        fi
    done

    success "Filesystem validation completed"
}

# Generate configuration report
generate_report() {
    local report_file="config-validation-report.txt"

    log "Generating configuration report..."

    cat > "$report_file" << EOF
Network CMDB Configuration Validation Report
============================================

Validation Date: $(date)
Environment File: $ENV_FILE

Configuration Summary:
- Database: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME
- Application Port: $PORT
- Environment: $NODE_ENV
- Frontend URL: $FRONTEND_URL
- N8n Integration: ${N8N_BASE_URL:-"Not configured"}

Security Configuration:
- Session Secret Length: ${#SESSION_SECRET} characters
- JWT Secret Length: ${#JWT_SECRET} characters
- CORS Origins: $CORS_ORIGINS

Performance Settings:
- Database Connection Limit: ${DB_CONNECTION_LIMIT:-"Default"}
- Cache TTL: ${CACHE_TTL:-"Default"} seconds
- Rate Limit: ${RATE_LIMIT_MAX_REQUESTS:-"Default"} requests per ${RATE_LIMIT_WINDOW_MS:-"Default"}ms

Validation Status: PASSED

EOF

    success "Configuration report generated: $report_file"
}

# Main validation function
main() {
    log "Starting Network CMDB configuration validation..."

    check_env_file
    load_env
    validate_required_vars
    validate_security
    validate_performance
    validate_filesystem
    validate_database
    validate_network
    generate_report

    success "Configuration validation completed successfully!"
}

# Help function
show_help() {
    cat << EOF
Network CMDB Configuration Validation Script

Usage: $0 [OPTIONS]

Environment Variables:
  ENV_FILE    Environment file to validate (default: .env.production)

Options:
  -h, --help    Show this help message

Examples:
  # Validate production configuration
  ./validate-config.sh

  # Validate staging configuration
  ENV_FILE=.env.staging ./validate-config.sh

EOF
}

# Parse command line arguments
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac