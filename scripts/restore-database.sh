#!/bin/bash

# Network CMDB Database Restore Script
# This script restores a MySQL database backup for the Network CMDB

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups/database}"
DB_HOST="${DB_HOST:-172.16.30.62}"
DB_PORT="${DB_PORT:-44060}"
DB_NAME="${DB_NAME:-mydatabase}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD}"
BACKUP_FILE="${BACKUP_FILE}"

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

# Check if required variables are set
check_requirements() {
    log "Checking requirements..."

    if [ -z "$DB_PASSWORD" ]; then
        error "DB_PASSWORD environment variable is required"
        exit 1
    fi

    if ! command -v mysql &> /dev/null; then
        error "mysql client is not installed"
        exit 1
    fi

    if ! command -v gzip &> /dev/null; then
        error "gzip is not installed"
        exit 1
    fi

    success "Requirements check passed"
}

# Find backup file
find_backup_file() {
    if [ -n "$BACKUP_FILE" ]; then
        if [ ! -f "$BACKUP_FILE" ]; then
            error "Specified backup file not found: $BACKUP_FILE"
            exit 1
        fi
        log "Using specified backup file: $BACKUP_FILE"
    else
        # Use latest backup
        local latest_backup="$BACKUP_DIR/networkdb_backup_latest.sql.gz"
        if [ -L "$latest_backup" ] && [ -f "$latest_backup" ]; then
            BACKUP_FILE="$latest_backup"
            log "Using latest backup: $BACKUP_FILE"
        else
            error "No backup file specified and latest backup not found"
            error "Available backups:"
            ls -la "$BACKUP_DIR"/networkdb_backup_*.sql.gz 2>/dev/null || echo "None found"
            exit 1
        fi
    fi
}

# Test database connection
test_connection() {
    log "Testing database connection..."

    if mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1;" >/dev/null 2>&1; then
        success "Database connection successful"
    else
        error "Failed to connect to database"
        exit 1
    fi
}

# Verify backup file
verify_backup() {
    log "Verifying backup file integrity..."

    if gzip -t "$BACKUP_FILE" 2>/dev/null; then
        success "Backup file integrity verified"
    else
        error "Backup file is corrupted: $BACKUP_FILE"
        exit 1
    fi
}

# Create backup before restore
create_pre_restore_backup() {
    log "Creating pre-restore backup as safety measure..."

    local timestamp=$(date +'%Y%m%d_%H%M%S')
    local safety_backup="$BACKUP_DIR/pre_restore_backup_${timestamp}.sql.gz"

    mkdir -p "$BACKUP_DIR"

    mysqldump \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --user="$DB_USER" \
        --password="$DB_PASSWORD" \
        --single-transaction \
        --routines \
        --triggers \
        --events \
        --create-options \
        --extended-insert \
        --quick \
        --lock-tables=false \
        "$DB_NAME" | gzip > "$safety_backup"

    if [ $? -eq 0 ]; then
        success "Pre-restore backup created: $safety_backup"
    else
        error "Failed to create pre-restore backup"
        exit 1
    fi
}

# Restore database
restore_database() {
    log "Starting database restore..."
    log "Backup file: $BACKUP_FILE"
    log "Target database: $DB_NAME"

    warning "This will overwrite the current database!"

    # Extract and restore
    if [[ "$BACKUP_FILE" == *.gz ]]; then
        log "Decompressing and restoring database..."
        gzip -dc "$BACKUP_FILE" | mysql \
            --host="$DB_HOST" \
            --port="$DB_PORT" \
            --user="$DB_USER" \
            --password="$DB_PASSWORD" \
            "$DB_NAME"
    else
        log "Restoring database..."
        mysql \
            --host="$DB_HOST" \
            --port="$DB_PORT" \
            --user="$DB_USER" \
            --password="$DB_PASSWORD" \
            "$DB_NAME" < "$BACKUP_FILE"
    fi

    if [ $? -eq 0 ]; then
        success "Database restore completed successfully"
    else
        error "Database restore failed"
        exit 1
    fi
}

# Verify restore
verify_restore() {
    log "Verifying database restore..."

    # Basic connectivity and table count check
    local table_count=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -e "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema='$DB_NAME';" --skip-column-names "$DB_NAME" 2>/dev/null || echo "0")

    if [ "$table_count" -gt 0 ]; then
        success "Database restore verified - found $table_count tables"
    else
        error "Database restore verification failed - no tables found"
        exit 1
    fi
}

# Generate restore report
generate_report() {
    local report_file="$BACKUP_DIR/restore_report.txt"

    log "Generating restore report..."

    cat > "$report_file" << EOF
Network CMDB Database Restore Report
====================================

Restore Date: $(date)
Database Host: $DB_HOST:$DB_PORT
Database Name: $DB_NAME
Backup File: $BACKUP_FILE
File Size: $(du -h "$BACKUP_FILE" 2>/dev/null | cut -f1 || echo "Unknown")

Restore Status: SUCCESS

Database Tables:
$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -e "SHOW TABLES;" "$DB_NAME" 2>/dev/null | tail -n +2 || echo "Unable to list tables")

EOF

    success "Restore report generated: $report_file"
}

# List available backups
list_backups() {
    log "Available backup files:"

    if [ -d "$BACKUP_DIR" ]; then
        ls -lah "$BACKUP_DIR"/networkdb_backup_*.sql.gz 2>/dev/null | while read line; do
            echo "  $line"
        done

        if [ -L "$BACKUP_DIR/networkdb_backup_latest.sql.gz" ]; then
            echo "  Latest: $(readlink "$BACKUP_DIR/networkdb_backup_latest.sql.gz")"
        fi
    else
        warning "Backup directory not found: $BACKUP_DIR"
    fi
}

# Confirmation prompt
confirm_restore() {
    warning "WARNING: This will overwrite the current database!"
    warning "Database: $DB_NAME on $DB_HOST:$DB_PORT"
    warning "Backup file: $BACKUP_FILE"
    echo ""

    read -p "Are you sure you want to proceed? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        log "Restore cancelled by user"
        exit 0
    fi
}

# Main execution
main() {
    log "Starting Network CMDB database restore..."

    check_requirements
    find_backup_file
    verify_backup
    test_connection

    confirm_restore
    create_pre_restore_backup
    restore_database
    verify_restore
    generate_report

    success "Database restore completed successfully!"
}

# Help function
show_help() {
    cat << EOF
Network CMDB Database Restore Script

Usage: $0 [OPTIONS]

Environment Variables:
  BACKUP_DIR    Directory containing backups (default: ./backups/database)
  DB_HOST       Database host (default: 172.16.30.62)
  DB_PORT       Database port (default: 44060)
  DB_NAME       Database name (default: mydatabase)
  DB_USER       Database user (default: root)
  DB_PASSWORD   Database password (required)
  BACKUP_FILE   Specific backup file to restore (optional, uses latest if not specified)

Options:
  -h, --help    Show this help message
  -l, --list    List available backup files

Examples:
  # Restore from latest backup
  DB_PASSWORD=yourpassword ./restore-database.sh

  # Restore from specific backup file
  DB_PASSWORD=yourpassword BACKUP_FILE=./backups/database/networkdb_backup_20240918_120000.sql.gz ./restore-database.sh

  # List available backups
  ./restore-database.sh --list

EOF
}

# Parse command line arguments
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    -l|--list)
        list_backups
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac